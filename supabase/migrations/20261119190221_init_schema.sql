-- Last-Mile Delivery Planner: core schema.
-- Units: dimensions in cm, weight in kg. Dates are business dates in Europe/London.
--
-- Lifecycle:
--   order:    unplanned --(ops schedules)--> planned --(crew delivers)--> delivered
--                 ^                             |
--                 +------(crew marks failed)----+
--   delivery: one row per attempt. A failed attempt stays as history (status 'failed' + reason)
--             and the order goes back to 'unplanned', so a retry is simply a new delivery row.
--   assembly: tracked on the delivery, separately from the drop-off. The driver marks the drop-off,
--             then the assembler marks assembled / failed. A failed assembly keeps its note and stays
--             in the assembler's queue until it is marked assembled.
--

-- ─── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE app_role_type        AS ENUM ('admin', 'ops', 'crew');            -- what you can access
CREATE TYPE crew_role_type       AS ENUM ('driver', 'assembler');             -- what you do on the van
CREATE TYPE order_status_type    AS ENUM ('unplanned', 'planned', 'delivered');
CREATE TYPE delivery_status_type AS ENUM ('scheduled', 'delivered', 'failed');
CREATE TYPE call_status_type     AS ENUM ('pending', 'confirmed', 'unreachable');
CREATE TYPE delivery_slot_type   AS ENUM ('morning', 'midday', 'afternoon');
CREATE TYPE leave_status_type    AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE assembly_status_type AS ENUM ('pending', 'assembled', 'failed');

-- ─── 1. Team ─────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name      TEXT NOT NULL,
    app_role       app_role_type NOT NULL,
    crew_role      crew_role_type,
    weekly_off_day INTEGER CHECK (weekly_off_day BETWEEN 0 AND 6),            -- 0 = Sun … 6 = Sat
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT crew_role_only_for_crew CHECK ((app_role = 'crew') = (crew_role IS NOT NULL))
);

-- Role of the signed-in user, used by RLS policies. SECURITY DEFINER so a policy
-- that reads profiles does not trigger the profiles policies again (recursion).
CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS app_role_type
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT app_role FROM profiles WHERE id = auth.uid() $$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

-- One row = one day off. Crew and ops REQUEST a day for themselves (pending); admin approves
-- or rejects it, and that decision is final. Admin takes no leave and never books it for others.
-- Only APPROVED leave affects availability.
CREATE TABLE leave_records (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- who is off
    leave_date   DATE NOT NULL,
    status       leave_status_type NOT NULL DEFAULT 'pending',
    reason       TEXT CHECK (char_length(reason) <= 200),
    decided_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,      -- the admin who decided
    decided_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT decision_recorded CHECK ((status = 'pending') = (decided_at IS NULL))
);
CREATE INDEX leave_records_date_idx ON leave_records (leave_date);
-- one live (pending or approved) entry per person per day; a rejected day can be asked again
CREATE UNIQUE INDEX leave_records_one_live_per_day ON leave_records (profile_id, leave_date) WHERE status <> 'rejected';
CREATE INDEX leave_records_pending_idx ON leave_records (leave_date) WHERE status = 'pending';

-- ─── 2. Customers ────────────────────────────────────────────────────────────
CREATE TABLE customers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               TEXT NOT NULL,
    phone              TEXT NOT NULL,
    email              TEXT,
    address            TEXT NOT NULL,
    lat                DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng                DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    has_staircase_only BOOLEAN NOT NULL DEFAULT false,
    lift_length        DOUBLE PRECISION CHECK (lift_length > 0),
    lift_width         DOUBLE PRECISION CHECK (lift_width > 0),
    lift_height        DOUBLE PRECISION CHECK (lift_height > 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT lift_size_known CHECK (
        has_staircase_only OR (lift_length IS NOT NULL AND lift_width IS NOT NULL AND lift_height IS NOT NULL)
    )
);

-- ─── 3. Orders & items ───────────────────────────────────────────────────────
CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    ready_date  DATE NOT NULL,                                              
    status      order_status_type NOT NULL DEFAULT 'unplanned',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_status_idx   ON orders (status);

CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    length     DOUBLE PRECISION NOT NULL CHECK (length > 0),
    width      DOUBLE PRECISION NOT NULL CHECK (width > 0),
    height     DOUBLE PRECISION NOT NULL CHECK (height > 0),
    weight     DOUBLE PRECISION NOT NULL CHECK (weight > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

-- ─── 4. Deliveries ─────────────────────────────────────
CREATE TABLE deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    scheduled_date  DATE NOT NULL,
    status          delivery_status_type NOT NULL DEFAULT 'scheduled',
    failure_reason  TEXT,

    -- customer contact
    d4_call_status  call_status_type NOT NULL DEFAULT 'pending',              
    d1_call_status  call_status_type NOT NULL DEFAULT 'pending',
    booking_token   TEXT UNIQUE,  
    time_slot       delivery_slot_type,                                       
    slot_booked_at  TIMESTAMPTZ,

    -- route planning
    trip_number     INTEGER CHECK (trip_number IN (1, 2)),
    sequence_order  INTEGER CHECK (sequence_order > 0),
    requires_porter BOOLEAN NOT NULL DEFAULT false,                           

    -- assembly (assembler's step, after the driver's drop-off)
    assembly_status assembly_status_type NOT NULL DEFAULT 'pending',
    assembly_note   TEXT,                                                     -- why the last try failed
    assembled_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT failed_needs_reason CHECK (status <> 'failed' OR failure_reason IS NOT NULL),
    CONSTRAINT assembly_after_drop_off CHECK (assembly_status = 'pending' OR status = 'delivered'),
    CONSTRAINT failed_assembly_needs_note CHECK (assembly_status <> 'failed' OR assembly_note IS NOT NULL),
    CONSTRAINT assembled_has_time CHECK ((assembly_status = 'assembled') = (assembled_at IS NOT NULL))
);
CREATE INDEX deliveries_date_idx ON deliveries (scheduled_date);
-- the assembler's "needs another try" list
CREATE INDEX deliveries_assembly_failed_idx ON deliveries (scheduled_date) WHERE assembly_status = 'failed';
-- an order can have many failed attempts but only one live (scheduled or delivered) delivery
CREATE UNIQUE INDEX deliveries_one_active_per_order ON deliveries (order_id) WHERE status <> 'failed';

-- ─── 5. Business rules the database guarantees ───────────────────────────────

-- Never a 5th delivery on a day.
-- this is the backstop for two ops users scheduling at the same moment.
CREATE OR REPLACE FUNCTION enforce_daily_delivery_limit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    booked INT;
BEGIN
    IF NEW.status = 'failed' THEN
        RETURN NEW;                                  
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('day:' || NEW.scheduled_date::text));
    SELECT count(*) INTO booked
      FROM deliveries
     WHERE scheduled_date = NEW.scheduled_date
       AND status <> 'failed'
       AND id <> NEW.id;
    IF booked >= 4 THEN
        RAISE EXCEPTION 'That day already has 4 deliveries.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER deliveries_daily_limit
    BEFORE INSERT OR UPDATE OF scheduled_date, status ON deliveries
    FOR EACH ROW EXECUTE FUNCTION enforce_daily_delivery_limit();

-- ─── 6. Customer self-booking (/book/<token>) ────────────────────────────────

-- Max deliveries per time window per day.
CREATE OR REPLACE FUNCTION public.slot_capacity() RETURNS INT
LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;

CREATE OR REPLACE FUNCTION public.get_booking(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    d RECORD;
BEGIN
    IF p_token IS NULL OR length(p_token) < 16 THEN
        RETURN NULL;
    END IF;

    SELECT dl.id, dl.order_id, dl.scheduled_date, dl.time_slot, dl.status, c.name, c.address
      INTO d
      FROM deliveries dl
      JOIN orders o ON o.id = dl.order_id
      JOIN customers c ON c.id = o.customer_id
     WHERE dl.booking_token = p_token;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    RETURN json_build_object(
        'customer_name', d.name,
        'address', d.address,
        'scheduled_date', d.scheduled_date,
        'time_slot', d.time_slot,
        'status', d.status,
        'items', (SELECT coalesce(json_agg(oi.name ORDER BY oi.name), '[]'::json)
                    FROM order_items oi WHERE oi.order_id = d.order_id),
        -- how many OTHER deliveries already hold each window that day
        'taken', (SELECT coalesce(json_object_agg(t.time_slot, t.n), '{}'::json)
                    FROM (SELECT time_slot, count(*) AS n
                            FROM deliveries
                           WHERE scheduled_date = d.scheduled_date
                             AND time_slot IS NOT NULL
                             AND status <> 'failed'
                             AND id <> d.id
                           GROUP BY time_slot) t)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_slot(p_token TEXT, p_slot delivery_slot_type)
RETURNS JSON
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    d deliveries%ROWTYPE;
    taken INT;
BEGIN
    SELECT * INTO d FROM deliveries WHERE booking_token = p_token FOR UPDATE;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'This booking link is not valid.');
    END IF;
    IF d.status <> 'scheduled' THEN
        RETURN json_build_object('error', 'This delivery can no longer be changed.');
    END IF;
    -- Changes are allowed up to the day before delivery (the D-1 call reconfirms).
    IF d.scheduled_date <= (now() AT TIME ZONE 'Europe/London')::date THEN
        RETURN json_build_object('error', 'It is too late to change this slot online. Please call us.');
    END IF;

    -- Serialise bookings for the same day so two customers cannot take the last place at once.
    PERFORM pg_advisory_xact_lock(hashtext('slots:' || d.scheduled_date::text));

    SELECT count(*) INTO taken
      FROM deliveries
     WHERE scheduled_date = d.scheduled_date
       AND time_slot = p_slot
       AND status <> 'failed'
       AND id <> d.id;
    IF taken >= slot_capacity() THEN
        RETURN json_build_object('error', 'Sorry, that time window was just taken. Please pick another.');
    END IF;

    UPDATE deliveries
       SET time_slot = p_slot,
           slot_booked_at = now(),
           d4_call_status = 'confirmed'
     WHERE id = d.id;

    RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_booking(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_slot(TEXT, delivery_slot_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(TEXT, delivery_slot_type) TO anon, authenticated;
