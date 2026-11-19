-- custom enum types
CREATE TYPE app_role_type AS ENUM ('admin', 'ops', 'crew');
CREATE TYPE crew_role_type AS ENUM ('driver', 'assembler');
CREATE TYPE order_status_type AS ENUM ('unplanned', 'planned', 'delivered', 'failed');
CREATE TYPE call_status_type AS ENUM ('pending', 'confirmed', 'unreachable');
CREATE TYPE delivery_status_type AS ENUM ('scheduled', 'delivered', 'failed');

-- 1. Users & Team
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    app_role app_role_type NOT NULL,
    crew_role crew_role_type, -- Nullable for admin/ops
    weekly_off_day INTEGER CHECK (weekly_off_day BETWEEN 0 AND 6), -- 0=Sun, 1=Mon,...
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leave_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, leave_date)
);

-- 2. Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    lift_length FLOAT,
    lift_width FLOAT, 
    lift_height FLOAT,
    has_staircase_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Orders & Items
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    ready_date DATE NOT NULL,
    status order_status_type DEFAULT 'unplanned',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    length FLOAT NOT NULL,
    width FLOAT NOT NULL, 
    height FLOAT NOT NULL,
    weight FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Deliveries
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    d4_call_status call_status_type DEFAULT 'pending',
    d1_call_status call_status_type DEFAULT 'pending',
    trip_number INTEGER CHECK (trip_number IN (1, 2)),
    sequence_order INTEGER,
    estimated_arrival TIME,
    requires_porter BOOLEAN DEFAULT FALSE,
    status delivery_status_type DEFAULT 'scheduled',
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);