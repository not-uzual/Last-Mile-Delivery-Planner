# Last-Mile Delivery Planner

A small planning tool for a furniture business with **one van, one driver and a few assemblers**.
Ops plans which order goes on which day, the crew works through the day on their phone, the admin
manages the team and approves leave, and customers pick their own delivery window from a link.

- **Stack:** Next.js 16 (App Router, server actions, React 19), Supabase (Postgres + Auth + RLS), Tailwind 4,
  Leaflet + OpenStreetMap for maps, the public OSRM server for road travel times.
- **Accounts:** free plans only, under my own accounts. All customer data is fake (faker) and no
  real system is connected.
- **Secrets:** none in the code. Everything comes from `.env.local`, which git ignores.

---

## Contents

1. [Run it](#1-run-it)
2. [The database](#2-the-database)
3. [The screens](#3-the-screens)
4. [The planning logic](#4-the-planning-logic)
   - [Does an item fit the lift?](#41-does-an-item-fit-the-lift)
   - [One trip or more trips?](#42-one-trip-or-more-trips)
   - [Arrival times](#43-arrival-times)
   - [Which days are open](#44-which-days-are-open)
5. [Security](#5-security)
6. [How we built it (the journey)](#6-how-we-built-it-the-journey)
7. [One-page note: what works, what does not, what next](#7-one-page-note)

---

## 1. Run it

```bash
npm install

# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # only used by the seed script, never by the app
SEED_PASSWORD=...                  # password given to every demo login

npx supabase link                          # once, to your own Supabase project
npx supabase db reset --linked --yes       # build the schema from supabase/migrations (wipes the DB)
npx tsx scripts/seed.ts                    # demo team + 28 customers + 32 orders
npx supabase gen types typescript --linked > src/types/database.types.ts   # after any schema change

npm run dev
```

**Demo logins** (all use `SEED_PASSWORD`):

| Login | Who | Role |
|---|---|---|
| `admin@test.com` | Charles J | admin |
| `ops@test.com`, `ops2@test.com`, `ops3@test.com` | Katty F, Meera S, Tom W | ops |
| `driver@test.com` | Arthur H | crew · driver (the only driver) |
| `assembler@test.com`, `assembler2@test.com`, `assembler3@test.com` | Sam L, Bobby P, Priya K | crew · assembler |

**Seed dates:** every seed date is relative to *today* in Europe/London, so the demo always shows the
same situations. The full calendar is listed at the top of `scripts/seed.ts`:
- a locked day and a closed day;
- a day that leave closed after it was already planned;
- every call state;
- a failed delivery and a failed assembly;
- pending, approved and rejected leave.

The seed prints three booking links you can open without logging in.

---

## 2. The database

Two migration files, kept as the single source of truth:

- `supabase/migrations/20261119190221_init_schema.sql`: tables, enums, constraints, triggers and functions.
- `supabase/migrations/20261119224144_rls_policies.sql`: who can read and write what.

```
profiles ──< leave_records            (one row per person per day off)
customers ──< orders ──< order_items  (an order is one customer's furniture, items carry size + weight)
                  └──< deliveries     (one row per ATTEMPT on a date)
```

| Table | What it holds | Key rules (enforced by the database, not just the UI) |
|---|---|---|
| `profiles` | Name, `app_role` (admin / ops / crew), `crew_role` (driver / assembler), `weekly_off_day` | Only crew have a crew role: `CHECK ((app_role='crew') = (crew_role IS NOT NULL))` |
| `leave_records` | One requested day off, `pending → approved / rejected`, who decided and when | One live request per person per day (partial unique index ignoring rejected); a decision always has a time; reason ≤ 200 chars |
| `customers` | Address, lat/lng, phone, lift cabin size or "staircase only" | Lift size must be all three numbers or "staircase only"; lat/lng in range |
| `orders` | `ready_date` (earliest it can go out), `status unplanned → planned → delivered` | Orders can't be deleted while deliveries point at them (`ON DELETE RESTRICT`) |
| `order_items` | Name, length/width/height in cm, weight in kg | All > 0 |
| `deliveries` | Date, drop-off status, failure reason, D-4/D-1 call status, booking link token, booked window, assembly status/note | See below |

**Why a delivery is an attempt, not an order:**
- A failed drop-off keeps its row as history (`failed` + reason), and the order goes back to `unplanned`.
- A retry is simply a new delivery row.
- A partial unique index allows only **one live (non-failed) delivery per order**.
- The queue shows "Failed 18 Nov" with the reason on hover, without any extra history table.

**Rules on `deliveries`:**
- **Max 4 per day:** the trigger `enforce_daily_delivery_limit` takes an advisory lock on the date and
  counts. The UI checks first, but the trigger is the backstop when two ops users schedule at the same moment.
- **A failed drop-off needs a reason:** `CHECK (status <> 'failed' OR failure_reason IS NOT NULL)`.
- **Assembly is a separate step, after the drop-off:**
  - `assembly_status pending / assembled / failed`, with a note and a time;
  - no assembly before the drop-off (`CHECK (assembly_status = 'pending' OR status = 'delivered')`);
  - a failed assembly needs a note, and "assembled" always records when.
- **Time windows:** morning / midday / afternoon, at most `slot_capacity() = 2` per window per day.
  `book_slot(token, slot)` is a `SECURITY DEFINER` function. It is the *only* way an anonymous customer
  touches the database: it checks the token, the date (changes allowed up to the day before, locked on the delivery day) and the window capacity.

**Why this design:**
- It's small: 6 tables, and every column is used by a screen.
- The rules that matter for money and safety (4 a day, one live delivery, decisions are final)
  live in Postgres, so a bug in the UI or two people clicking at once can't break them.
- Enums instead of free text, so a typo can't create a new status.
- Dates are plain `DATE`s in the business timezone (Europe/London), so "today" means the same day for everyone.

---

## 3. The screens

| Screen | Who | What it does |
|---|---|---|
| `/login` | everyone | Email + password, plus demo buttons for each role. `src/proxy.ts` sends each role to its own area and blocks the others. |
| `/ops` | ops | **14-day strip** coloured open / locked / closed with x/4 counts. **Selected day:** map + route, ETA per stop, kg on board, handling badges (fits lift / staircase / hoist), D-4 and D-1 call chips, delivered / assembled / assembly failed badges, move-to-another-day (suggests the nearest open day) and send-back-to-queue. Failed drop-offs listed under it. **Unplanned queue** under the day: ready date, failed-before badge, schedule on any open day. **Right rail:** today's customer calls (D-4: agree a window / send the booking link; D-1: reconfirm; overdue list) and the ops person's own time off. |
| `/admin` | admin | **KPIs** for the next 14 days. **Team coverage grid:** last 3 days (faded) + today (blue line) + next 14. Each cell shows on duty / weekly off / approved leave / *asked* (dashed). **Team table** with an editable weekly day off. **Leave requests** (same height as the team card, scrolls): each request shows its impact ("Closes the day: no driver left · 3 deliveries to move" / "Team still covered" / "Not on the delivery rota") and Approve / Reject. The admin has no leave form. |
| `/crew` | driver, assemblers | Phone-first "today" view: progress, who is on duty, next stop highlighted, directions + call buttons, items with sizes and handling warnings. **Driver:** Delivered / Failed (+reason). **Assembler:** stops wait until the driver drops them off, then Assembled / Failed (+note). A failed assembly stays in their queue with a red flag, including ones from earlier days, until it's done. Own time off at the bottom. |
| `/book/[token]` | customer, no login | Shows the delivery date and lets the customer pick a window. Full windows are disabled. Changes are allowed up to the day before; on the delivery day the customer is asked to call. |

---

## 4. The planning logic

### 4.1 Does an item fit the lift?

`src/lib/utils.ts → doesItemFitLift`, `itemHandling`, `orderHandling`

```ts
const itemDims = [item.length, item.width, item.height].sort((a, b) => a - b);
const liftDims = [lift.lift_length, lift.lift_width, lift.lift_height].sort((a, b) => a - b);
return itemDims.every((dim, i) => dim <= liftDims[i]);
```

- **Sort both boxes** and compare smallest-to-smallest, middle-to-middle, largest-to-largest. This means
  the item may be turned in any direction (a sofa can stand on its end), and we don't care which side
  the database calls "length".
- **Unknown lift = no lift:** if the building is "staircase only" or any lift dimension is missing, the
  item does **not** fit. When unsure we plan for the harder case, never the easier one.
- **No fit → can two people carry it up the stairs?** Yes if its longest side is ≤ **200 cm** and it weighs
  ≤ **60 kg** → *Staircase carry*. Otherwise → *Rope / crane lift (hoist)*.
- **An order is as hard as its hardest item:** `lift < stairs < hoist`. If anything isn't *lift*, the delivery
  is saved with `requires_porter = true`, and ops and crew see an amber/red warning before the day starts.

**Known simplification:** a box that only goes in *tilted diagonally* is reported as not fitting, and door
widths and the turn in the corridor are not modelled. Both errors are on the safe side.

### 4.2 One trip or more trips?

**Today the app plans exactly one trip per day:** depot → every stop → depot.

**Why one trip is enough for now:**
- The real limit on this business is people and hours, not the van.
- There is one driver and each stop takes **45 min** on site (unloading, carry, assembly).
- So the day is capped at **4 deliveries**: 4 × 45 min + London driving fits between the 09:00 start and
  the end of the 15:00–18:00 window.
- 4 orders of home furniture fit one van, so one loop is the honest default.

**What is already in place for more trips:**
- `deliveries.trip_number` (1 or 2) and `sequence_order` exist in the schema;
- moving a delivery to another day clears them;
- the ops screen shows total **kg on board** for the day.

**The rule I would add** (not implemented yet):
1. Sum weight and volume of the day's items in route order.
2. When the next stop would go over the van's payload or volume, close trip 1: go back to the depot,
   reload, start trip 2.
3. A single order bigger than the van is flagged to ops, never split silently.
4. The return leg to the depot and the reload time are added to the ETA clock (section 4.3), so the
   later stops' times stay honest.

### 4.3 Arrival times

`src/lib/routing.ts → getRouteForDay`, constants in `src/lib/config.ts`

1. **Stop order:** booked windows first (morning → midday → afternoon), then unbooked stops in planned
   order (`compareBySlot`). Failed stops are left out.
2. **Road times:** one request to the free public **OSRM** server: depot → stop 1 → … → depot. It returns
   real driving time for every leg.
3. **The clock:**
   ```
   clock = 09:00 (van leaves the depot)
   for each stop:
       clock += driving time of this leg
       clock  = max(clock, start of the customer's booked window)   ← wait if early
       arrival = clock
       clock += 45 min on site
       departure = clock
   clock += last leg back → "back to depot by"
   ```
4. **Where the times show:** ops sees `arrival–departure` per stop and the route on the map. Crew see
   "ETA hh:mm" and "Back to depot by".
5. **If OSRM is down** (8-second timeout), the screen says "Routing service unavailable, ETAs not shown".
   It never shows a guessed time.

**Simplifications:**
- no traffic by time of day;
- the order is by window, not an optimised shortest route;
- 45 min is the same for a chair and a wardrobe;
- the ETA is not stored, it is worked out fresh each time the page loads, so it is never stale.

### 4.4 Which days are open

`src/lib/availability.ts → getDayAvailability`

- **CLOSED:** no driver on duty **or** no assembler on duty, because of a weekly day off or *approved* leave.
  Pending leave changes nothing.
- **LOCKED:** 4 deliveries already.
- **OPEN:** otherwise.

**Guards when ops schedules or moves an order:**
- not in the past;
- not before the order's `ready_date`;
- the day must be open.

**When leave is approved after deliveries were planned:** the day turns closed, and ops sees
"N to move", with the nearest open day suggested for each.

---

## 5. Security

- **Two layers:** `src/proxy.ts` keeps each role in its own area, and every server action re-checks the role
  with `withRole([...])`, because server actions are public POST endpoints.
- **Leave is locked down in the database (RLS):**
  - crew and ops can only *request* a pending day for themselves, and withdraw it while it's pending;
  - the admin can only approve or reject *pending* requests, signed as themselves;
  - decisions are final, and the admin can't book or take leave.
  - I tested this with real logins: 12/12 attempts behaved as expected.
- **Customers** never log in. Their link carries a random 128-bit token, and the only thing it can do is
  call `book_slot`.
- **The service role key** is used only by the seed script.

---

## 6. How we built it (the journey)

The order things happened, and what changed my mind along the way.

**Foundation** (commits `initialize project` → `RBAC: access control middleware`)
1. Next.js app, Supabase project, first schema and migration, typed client from generated types.
2. Faker seed so no real customer data is ever used.
3. Login page and role-based routing: admin / ops / crew each land in their own area.

**Screens** (`add admin pages` → `revamp ui screens` → `add custom ui components`)
4. Admin, ops and crew screens. Then a full UI revamp with a small shared component set
   (`Card`, `Badge`, `buttonClass`, `EmptyState`, `ActionButton`…).

**Schema review and seed** (`improve schema and seed more data`)

5. Rewrote the init schema to the design we were actually following, folding in my own changes:
   - attempts instead of one delivery per order;
   - enums everywhere;
   - CHECK constraints;
   - `ON DELETE RESTRICT` on orders;
   - the 4-a-day trigger with a lock.

   We tested the migration first, then reset.
6. Question: *"we have 4 deliveries in a day, how are we handling that with one driver?"* That led to the
   capacity reasoning in [4.2](#42-one-trip-or-more-trips): one driver + 45 min a stop → 4 a day, one loop.
7. Reviewed RLS. Read access for any logged-in user is fine for a small internal team; writes are where
   it matters (see what's next).
8. Seed rewritten with an edge case for every rule:
   - lift/stairs/hoist boundaries (exactly 200 cm, exactly 60 kg);
   - locked and closed days;
   - every call state;
   - ready-date limits;
   - failed and retried orders.

   Added more ops and crew users, then `assembler@test.com`, and regenerated the TypeScript types after
   every schema change.

**Leave** (`leave feature for ops and crew`)

9. Idea: crew and ops should *ask* for leave and the admin should *approve* it, instead of the admin
   typing it in. Built it as **one day per request**.
10. Folded the leave tables into the init schema and re-initialised the remote DB, then seeded with my own
    password from `.env.local`.
11. Admin side:
    - the admin doesn't take leave, so I removed the admin from the leave form, the rota and the coverage grid;
    - renamed the confusing admin files (`weekly-off-select.tsx`, `actions/team.ts`);
    - merged "leave requests" with "upcoming leave";
    - approved leave can't be reverted, so there's no list for it: it only shows in **team coverage**.
12. Re-seeded clean with **only one driver**. That makes the leave impact real: approving the driver's
    request closes a day.
13. Final leave rules moved into the database:
    - the admin can't create leave, so `requested_by` was dropped;
    - the default status is `pending`;
    - three tight RLS policies.

    Tested with real logins, then re-seeded.

**Polish**

14. Admin layout:
    - the leave card matches the team card's height and scrolls;
    - the coverage grid always shows the **past 3 days**, faded but readable, with a light **blue line** at today;
    - the "why does it say 20 and not 21?" question: dates follow London time, not the laptop's time zone.
15. Ops layout: removed the leave hint from the day tiles; moved the unplanned queue under the selected day.

**Customer booking** (`feat customer slot booking on D4`)

16. At D-4, ops sends a link, and the customer picks morning / midday / afternoon (max 2 per window).
    D-1 is a reconfirmation call. The booked window feeds the ETA clock.

**Driver and assembler split** (latest)

17. Problem spotted on the crew page: the driver and the assembler were pressing the same button.
    - Now the driver marks the **drop-off** and the assembler marks **assembly**, separately.
    - An assembler can't act until the drop-off, and a failed assembly goes back into their queue with a
      flag and the note until it's done.
    - Ops sees the assembly badge.
    - New columns and constraints in the init schema; DB reset, re-seeded, tested in the browser with the
      driver, assembler and ops logins.

---

## 7. One-page note

### What works
- **Planning:** 14-day view, open / locked / closed days from real rota + approved leave, max 4 a day
  enforced in the database, ready-date and past-date checks, move / unschedule, nearest-open-day suggestion.
- **Handling check:** lift fit with rotation, staircase carry vs rope/crane lift, warnings for ops and crew
  before the day starts.
- **Route and ETAs:** real road times (OSRM), booked windows respected, 45 min per stop, return-to-depot
  time, map.
- **Customer contact:**
  - D-4 booking link with window capacity;
  - D-1 reconfirmation;
  - overdue call list.
- **Crew day:** phone-first, separate driver drop-off and assembler assembly, failed drop-offs go back to
  the ops queue, failed assemblies stay flagged for the assembler.
- **Leave:** request → approve / reject with the impact shown, decisions final and enforced by RLS.
- **Demo:** one command re-seeds a realistic, date-relative demo covering every edge case.

### What does not (yet)
- **One trip only:** no van payload/volume check, so `trip_number` is never set (see [4.2](#42-one-trip-or-more-trips)).
- **Stop order isn't optimised:** stops go by booked window, then planned order, not the shortest route.
  No traffic by time of day.
- **Writes on customers / orders / deliveries** are allowed for any logged-in user at the database level.
  The role checks live in the server actions only.
- **No screen to create customers or orders:** they come from the seed. There is no import from a shop system,
  on purpose.
- **Fixed assumptions:** the 45-minute service time and the 200 cm / 60 kg stair limits are constants, not
  per item. Diagonal tilt into a lift isn't considered.
- **No automated test suite in the repo:** the RLS and browser flows were tested with throwaway scripts.
- The free public OSRM server has no uptime promise. When it fails, ETAs are hidden.

### What I would do next
1. **Photo proof on delivery:** the driver photographs the drop-off at the door, and the assembler photographs
   the finished assembly, before the stop can be closed. Photos go to a private Supabase Storage bucket and
   ops sees them on the day view, which settles "arrived damaged" or "never assembled" disputes.
2. **Porter cost estimate:** the handling check already sorts each order into fits lift / staircase carry /
   rope-crane lift ([4.1](#41-does-an-item-fit-the-lift)), so give each band a price: staircase carry per floor
   and per heavy item (needs a new `floor` field on customers), hoist as a fixed call-out fee. Ops sees it on
   the queue and the day, and quotes it at the D-4 call.
3. **Trips:** add van payload/volume to config, split the route into trips when it overflows, and add the
   reload time to the ETA clock.
4. **Tighten RLS** on deliveries and orders, the same way as leave:
   - only ops plans;
   - only the driver changes the drop-off;
   - only an assembler changes assembly.
5. **Better routes:** optimise the stop order inside each booked window, and use a hosted router with traffic.
6. **Ops can add customers and orders** with validation, so the app works without the seed.
7. **Service time per order:** longer for wardrobes and hoists, shorter for a single chair.
8. **Tests in the repo:** unit tests for `doesItemFitLift`, `getDayAvailability` and the ETA clock;
   Playwright for the leave and crew flows; RLS tests run in CI against a local Supabase.
9. **Notifications:** SMS or email to the customer with the booking link and the day-before reminder.
