/**
 * Demo seed: mock data only (faker names/phones, made-up London addresses).
 *
 * Every date is relative to the day you run it (Europe/London), so the demo always
 * shows the same situations. Re-running wipes the business data (customers, orders,
 * deliveries, leave) and builds it again; login accounts are kept.
 *
 *   npx tsx scripts/seed.ts
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_PASSWORD in .env.local.
 *
 * Team: 1 admin, 3 ops, 1 driver, 3 assemblers (password = SEED_PASSWORD).
 *
 * Calendar it produces (T = today, horizon T … T+13):
 *   T     open   3/4  delivered (waiting for assembly) + failed + 2 scheduled (one without D-1 confirmation)
 *   T+1   open   3/4  D-1 call list: confirmed / pending / unreachable (+ link that is too late to change)
 *   T+2   CLOSED      no driver: Arthur's weekly day off
 *   T+3   open   2/4  one customer missed the D-4 call (unconfirmed)
 *   T+4   LOCKED 4/4  D-4 list: no link / link sent / booked; morning window full
 *   T+5   open   3/4  Bobby weekly off, covered; includes a retry of a failed order
 *   T+6   LOCKED 4/4
 *   T+7   CLOSED      no driver: Arthur's leave booked AFTER 2 deliveries were planned → "2 to move"
 *   T+8   open        two of three assemblers off (leave + weekly off), one covers
 *   T+9   CLOSED      no driver: Arthur's weekly day off
 *   T+10  CLOSED      no assembler: one weekly off + two on leave
 *   T+11  open        Sam weekly off + Bobby on leave, Priya covers
 *   T+12  CLOSED      no assembler: Bobby weekly off + Priya and Sam on leave
 *
 * Assembly: T-3 has one assembled and one FAILED assembly (missing parts), which stays in
 * the assembler's queue on the crew screen until it is marked assembled.
 *
 * Leave inbox: 4 pending requests (one would close a day with 3 deliveries, one is from ops,
 * one is beyond the 14-day grid) and 1 rejected request.
 */
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import { addDays, dayOfWeek, todayISO } from '../src/lib/dates';
import { orderHandling, type LiftSize } from '../src/lib/utils';
import type { Database } from '../src/types/database.types';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedPassword = process.env.SEED_PASSWORD

if (!supabaseUrl || !supabaseKey || !seedPassword) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SEED_PASSWORD in .env.local');
    process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

faker.seed(2026); // same names every run
const T = todayISO();
const day = (offset: number) => addDays(T, offset);

type Slot = Database['public']['Enums']['delivery_slot_type'];
type Call = Database['public']['Enums']['call_status_type'];
type Item = { name: string; length: number; width: number; height: number; weight: number };

// ─── Team ────────────────────────────────────────────────────────────────────
// Weekly days off are chosen relative to today so that today, D-1 and D-4 are always
// working days (the call lists are never empty) while the horizon still has closed days.
// One van goes out per day; the extra driver and assemblers are cover so a single absence
// does not close the day. A day closes only when ALL drivers or ALL assemblers are off.
const users = [
    { email: 'admin@test.com', name: 'Charles J', role: 'admin', crewRole: null, offDay: null },
    { email: 'ops@test.com', name: 'Katty F', role: 'ops', crewRole: null, offDay: null },
    { email: 'ops2@test.com', name: 'Meera S', role: 'ops', crewRole: null, offDay: null },
    { email: 'ops3@test.com', name: 'Tom W', role: 'ops', crewRole: null, offDay: null },
    { email: 'driver@test.com', name: 'Arthur H', role: 'crew', crewRole: 'driver', offDay: dayOfWeek(day(2)) },
    { email: 'assembler@test.com', name: 'Sam L', role: 'crew', crewRole: 'assembler', offDay: dayOfWeek(day(4)) },
    { email: 'assembler2@test.com', name: 'Bobby P', role: 'crew', crewRole: 'assembler', offDay: dayOfWeek(day(5)) },
    { email: 'assembler3@test.com', name: 'Priya K', role: 'crew', crewRole: 'assembler', offDay: dayOfWeek(day(1)) },
] as const;

type LeaveStatus = Database['public']['Enums']['leave_status_type'];
// Every leave day was requested by the person; approved ones (decided by admin) change availability; pending requests wait
// in the admin's inbox; rejected ones are kept for the requester to see.
const leave: { who: (typeof users)[number]['email']; days: number[]; why: string; status?: LeaveStatus; reason?: string }[] = [
    { who: 'driver@test.com', days: [-1], why: 'past leave (not listed as upcoming)' },
    { who: 'driver@test.com', days: [7], why: 'only driver off → closed after 2 deliveries were planned' },
    { who: 'assembler@test.com', days: [8], why: 'with Priya’s weekly off, Bobby alone covers → still open' },
    { who: 'assembler2@test.com', days: [10, 11], why: 'T+10 closes with Priya and Sam; T+11 Priya covers' },
    { who: 'assembler3@test.com', days: [10, 12], why: 'T+10 / T+12 no assembler left' },
    { who: 'assembler@test.com', days: [10, 12], why: 'T+10 / T+12 no assembler left' },

    // Requests waiting for the admin (one day each)
    { who: 'driver@test.com', days: [5], status: 'pending', reason: 'Family wedding', why: 'only driver → approving CLOSES T+5 with 3 deliveries' },
    { who: 'assembler2@test.com', days: [4], status: 'pending', reason: 'Dentist', why: 'Priya covers → safe to approve' },
    { who: 'ops2@test.com', days: [3], status: 'pending', reason: 'Exam', why: 'ops is not on the delivery rota' },
    { who: 'assembler3@test.com', days: [20], status: 'pending', why: 'beyond the 14-day grid' },
    { who: 'assembler2@test.com', days: [6], status: 'rejected', reason: 'Moving house', why: 'rejected: shows in Bobby’s list, does not count' },
];

// ─── Buildings ───────────────────────────────────────────────────────────────
// [length, width, height] of the lift cabin in cm; null = staircase only.
const LIFT_STANDARD: [number, number, number] = [140, 110, 220];
const LIFT_SMALL: [number, number, number] = [100, 80, 200];
const NO_LIFT = null;

// ─── Furniture (cm / kg) ─────────────────────────────────────────────────────
const I = {
    chair: { name: 'Oak dining chair', length: 55, width: 50, height: 90, weight: 8 },
    bedside: { name: 'Bedside table', length: 50, width: 40, height: 60, weight: 14 },
    table: { name: 'Dining table 6-seat', length: 180, width: 90, height: 75, weight: 45 },
    sofa: { name: '3-seater sofa', length: 230, width: 95, height: 85, weight: 70 },        // too long for any lift and the stairs
    wardrobe: { name: 'Double wardrobe', length: 120, width: 60, height: 210, weight: 85 },
    mirror: { name: 'Floor mirror', length: 60, width: 8, height: 210, weight: 20 },        // fits the standard lift only standing up
    corner: { name: 'Corner unit', length: 220, width: 140, height: 110, weight: 40 },      // exactly the standard lift: fits (≤)
    bookcase: { name: 'Tall bookcase', length: 200, width: 40, height: 30, weight: 60 },    // exactly the stair-carry limit: stairs
    drawers: { name: 'Solid chest of drawers', length: 120, width: 50, height: 100, weight: 75 }, // short but too heavy for stairs
    armchair: { name: 'Armchair', length: 95, width: 90, height: 100, weight: 40 },         // too wide for the small lift → stairs
    bed: { name: 'King bed frame (flat-packed)', length: 210, width: 30, height: 25, weight: 55 },
    desk: { name: 'Writing desk', length: 120, width: 60, height: 76, weight: 30 },
} satisfies Record<string, Item>;

// ─── Scenarios ───────────────────────────────────────────────────────────────
type DeliverySpec = {
    on: number;                         // day offset from today
    status?: 'scheduled' | 'delivered' | 'failed';
    reason?: string;
    slot?: Slot;
    d4?: Call;
    d1?: Call;
    link?: boolean;                     // create a booking link
    assembly?: 'assembled' | 'failed';  // only after a drop-off
    assemblyNote?: string;
};
type OrderSpec = {
    note: string;
    customer: string;                   // key into `customers`; the same key = same customer
    ready: number;                      // ready-date offset
    items: Item[];
    deliveries?: DeliverySpec[];        // oldest first; at most one that is not failed
};

const customers: Record<string, { lift: [number, number, number] | null; email?: boolean }> = {
    c1: { lift: LIFT_STANDARD }, c2: { lift: LIFT_STANDARD }, c3: { lift: NO_LIFT }, c4: { lift: LIFT_SMALL },
    c5: { lift: LIFT_STANDARD }, c6: { lift: LIFT_STANDARD }, c7: { lift: NO_LIFT }, c8: { lift: LIFT_STANDARD, email: false },
    c9: { lift: LIFT_SMALL }, c10: { lift: LIFT_STANDARD }, c11: { lift: LIFT_STANDARD }, c12: { lift: NO_LIFT },
    c13: { lift: LIFT_STANDARD }, c14: { lift: LIFT_SMALL }, c15: { lift: LIFT_STANDARD }, c16: { lift: LIFT_STANDARD },
    c17: { lift: NO_LIFT }, c18: { lift: LIFT_STANDARD }, c19: { lift: LIFT_STANDARD }, c20: { lift: LIFT_SMALL },
    c21: { lift: LIFT_STANDARD }, c22: { lift: NO_LIFT }, c23: { lift: LIFT_STANDARD }, c24: { lift: LIFT_STANDARD },
    c25: { lift: LIFT_SMALL }, c26: { lift: LIFT_STANDARD, email: false }, c27: { lift: NO_LIFT }, c28: { lift: LIFT_STANDARD },
};

const orders: OrderSpec[] = [
    // ── History ──
    { note: 'delivered last week', customer: 'c1', ready: -6, items: [I.table, I.chair, I.chair], deliveries: [{ on: -3, status: 'delivered', slot: 'morning', d4: 'confirmed', d1: 'confirmed', assembly: 'assembled' }] },
    { note: 'delivered, staircase carry, assembly FAILED → back in assembler queue', customer: 'c3', ready: -5, items: [I.bookcase], deliveries: [{ on: -3, status: 'delivered', d4: 'confirmed', d1: 'confirmed', assembly: 'failed', assemblyNote: 'Missing two shelf brackets' }] },

    // ── Today (crew screen) ──
    { note: 'today: delivered', customer: 'c2', ready: -3, items: [I.desk, I.chair], deliveries: [{ on: 0, status: 'delivered', slot: 'morning', d4: 'confirmed', d1: 'confirmed' }] },
    { note: 'today: failed → back in queue', customer: 'c5', ready: -2, items: [I.wardrobe], deliveries: [{ on: 0, status: 'failed', reason: 'Customer not home', d4: 'confirmed', d1: 'confirmed' }] },
    { note: 'today: staircase-only, small items', customer: 'c7', ready: -2, items: [I.bedside, I.armchair], deliveries: [{ on: 0, slot: 'midday', d4: 'confirmed', d1: 'confirmed' }] },
    { note: 'today: sofa needs hoist, D-1 never confirmed', customer: 'c6', ready: -1, items: [I.sofa], deliveries: [{ on: 0, d4: 'confirmed', d1: 'pending' }] },

    // ── D-1 call list ──
    { note: 'D-1 confirmed, afternoon', customer: 'c9', ready: -1, items: [I.armchair], deliveries: [{ on: 1, slot: 'afternoon', d4: 'confirmed', d1: 'confirmed' }] },
    { note: 'D-1 still to call; link exists but too late to change', customer: 'c10', ready: 0, items: [I.mirror], deliveries: [{ on: 1, slot: 'morning', d4: 'confirmed', d1: 'pending', link: true }] },
    { note: 'D-1 unreachable → unconfirmed', customer: 'c11', ready: 0, items: [I.corner], deliveries: [{ on: 1, d4: 'confirmed', d1: 'unreachable' }] },

    // ── Between D-1 and D-4 ──
    { note: 'missed D-4 call → unconfirmed', customer: 'c12', ready: 1, items: [I.drawers], deliveries: [{ on: 3, d4: 'unreachable' }] },
    { note: 'booked midday', customer: 'c13', ready: 2, items: [I.table], deliveries: [{ on: 3, slot: 'midday', d4: 'confirmed', link: true }] },

    // ── D-4: locked day + booking-link states ──
    { note: 'D-4: no link yet', customer: 'c14', ready: 1, items: [I.desk], deliveries: [{ on: 4 }] },
    { note: 'D-4: link sent, waiting (morning is full)', customer: 'c15', ready: 2, items: [I.bed], deliveries: [{ on: 4, link: true }] },
    { note: 'D-4: booked morning', customer: 'c16', ready: 2, items: [I.chair, I.chair, I.chair, I.chair], deliveries: [{ on: 4, slot: 'morning', d4: 'confirmed', link: true }] },
    { note: 'D-4: booked morning (window now full)', customer: 'c17', ready: 3, items: [I.bookcase, I.bedside], deliveries: [{ on: 4, slot: 'morning', d4: 'confirmed', link: true }] },

    // ── T+5 ──
    { note: 'retry: failed two days ago, rebooked', customer: 'c18', ready: -4, items: [I.wardrobe, I.bedside], deliveries: [{ on: -2, status: 'failed', reason: 'Wardrobe did not fit through the door', d4: 'confirmed', d1: 'confirmed' }, { on: 5 }] },
    { note: 'second order of a customer', customer: 'c1', ready: 3, items: [I.desk], deliveries: [{ on: 5 }] },
    { note: 'small lift, heavy drawers (still fits lift)', customer: 'c20', ready: 4, items: [I.drawers], deliveries: [{ on: 5 }] },

    // ── T+6 locked ──
    { note: 'T+6 #1', customer: 'c21', ready: 4, items: [I.table], deliveries: [{ on: 6 }] },
    { note: 'T+6 #2', customer: 'c22', ready: 4, items: [I.chair, I.chair], deliveries: [{ on: 6 }] },
    { note: 'T+6 #3', customer: 'c23', ready: 5, items: [I.corner], deliveries: [{ on: 6 }] },
    { note: 'T+6 #4', customer: 'c24', ready: 5, items: [I.mirror], deliveries: [{ on: 6 }] },

    // ── T+7 closed by leave after planning ──
    { note: 'stranded by driver leave', customer: 'c25', ready: 5, items: [I.armchair], deliveries: [{ on: 7 }] },
    { note: 'stranded by driver leave', customer: 'c26', ready: 6, items: [I.desk, I.chair], deliveries: [{ on: 7 }] },

    // ── Unplanned queue ──
    { note: 'queue: ready 5 days ago (overdue)', customer: 'c4', ready: -5, items: [I.armchair, I.bedside] },
    { note: 'queue: failed twice', customer: 'c8', ready: -9, items: [I.sofa], deliveries: [
        { on: -6, status: 'failed', reason: 'Sofa did not fit the lift', d4: 'confirmed', d1: 'confirmed' },
        { on: -4, status: 'failed', reason: 'Hoist not available', d4: 'confirmed', d1: 'confirmed' },
    ] },
    { note: 'queue: ready today', customer: 'c27', ready: 0, items: [I.bed] },
    { note: 'queue: ready on a locked day → next open', customer: 'c28', ready: 4, items: [I.table, I.chair] },
    { note: 'queue: ready on locked T+6 → skips closed T+7', customer: 'c19', ready: 6, items: [I.mirror] },
    { note: 'queue: ready on closed T+7', customer: 'c2', ready: 7, items: [I.bookcase] },
    { note: 'queue: ready on closed T+12 → T+13', customer: 'c3', ready: 12, items: [I.drawers] },
    { note: 'queue: ready after the 14-day horizon', customer: 'c13', ready: 20, items: [I.corner] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function must<R extends { data: unknown; error: { message: string } | null }>(p: PromiseLike<R>, what: string) {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    return data as NonNullable<R['data']>;
}

const token = () => randomBytes(16).toString('base64url');

async function ensureUsers() {
    const existing = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (existing.error) throw existing.error;
    const ids = new Map<string, string>();

    for (const u of users) {
        let id = existing.data.users.find((x) => x.email === u.email)?.id;
        if (!id) {
            const { data, error } = await supabase.auth.admin.createUser({ email: u.email, password: seedPassword, email_confirm: true });
            if (error) throw error;
            id = data.user.id;
            console.log(`  created ${u.email}`);
        }
        await must(
            supabase.from('profiles').upsert({ id, full_name: u.name, app_role: u.role, crew_role: u.crewRole, weekly_off_day: u.offDay }),
            `profile ${u.email}`,
        );
        ids.set(u.email, id);
    }
    return ids;
}

async function wipeBusinessData() {
    // Order matters: deliveries and orders use ON DELETE RESTRICT.
    await must(supabase.from('deliveries').delete().not('id', 'is', null), 'clear deliveries');
    await must(supabase.from('orders').delete().not('id', 'is', null), 'clear orders'); // items cascade
    await must(supabase.from('customers').delete().not('id', 'is', null), 'clear customers');
    await must(supabase.from('leave_records').delete().not('id', 'is', null), 'clear leave');
}

function fakeCustomer(lift: [number, number, number] | null, withEmail: boolean) {
    const name = faker.person.fullName();
    return {
        name,
        phone: faker.helpers.replaceSymbols('07### ######'),
        email: withEmail ? faker.internet.email({ firstName: name.split(' ')[0], provider: 'example.com' }) : null,
        address: `${faker.location.buildingNumber()} ${faker.location.street()}, London`,
        // Inner London so OSRM routes stay short
        lat: faker.number.float({ min: 51.47, max: 51.55, fractionDigits: 5 }),
        lng: faker.number.float({ min: -0.2, max: 0.02, fractionDigits: 5 }),
        has_staircase_only: lift === null,
        lift_length: lift?.[0] ?? null,
        lift_width: lift?.[1] ?? null,
        lift_height: lift?.[2] ?? null,
    };
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function runSeed() {
    console.log(`Seeding for today = ${T}`);

    console.log('Team…');
    const userIds = await ensureUsers();

    console.log('Clearing previous demo data…');
    await wipeBusinessData();

    console.log('Leave…');
    await must(
        supabase.from('leave_records').insert(
            leave.flatMap((l) => {
                const status = l.status ?? 'approved';
                const adminId = userIds.get('admin@test.com')!;
                const self = userIds.get(l.who)!;
                return l.days.map((d) => ({
                    profile_id: self,
                    leave_date: day(d),
                    status,
                    reason: l.reason ?? null,
                    decided_by: status === 'pending' ? null : adminId,
                    decided_at: status === 'pending' ? null : new Date().toISOString(),
                }));
            }),
        ),
        'leave',
    );

    console.log('Customers…');
    const keys = Object.keys(customers);
    const inserted = await must(
        supabase.from('customers').insert(keys.map((k) => fakeCustomer(customers[k].lift, customers[k].email !== false))).select('id'),
        'customers',
    );
    const customerId = new Map(keys.map((k, i) => [k, inserted[i].id]));

    console.log('Orders, items and deliveries…');
    const links: { note: string; url: string }[] = [];
    for (const o of orders) {
        const live = o.deliveries?.find((d) => (d.status ?? 'scheduled') !== 'failed');
        const status = !live ? 'unplanned' : live.status === 'delivered' ? 'delivered' : 'planned';

        const order = await must(
            supabase.from('orders').insert({ customer_id: customerId.get(o.customer)!, ready_date: day(o.ready), status }).select('id').single(),
            `order "${o.note}"`,
        );
        await must(supabase.from('order_items').insert(o.items.map((it) => ({ ...it, order_id: order.id }))), `items "${o.note}"`);

        const lift = customers[o.customer].lift;
        const liftSize: LiftSize = { has_staircase_only: lift === null, lift_length: lift?.[0] ?? null, lift_width: lift?.[1] ?? null, lift_height: lift?.[2] ?? null };
        const requiresPorter = orderHandling(o.items, liftSize) !== 'lift';

        for (const d of o.deliveries ?? []) {
            const bookingToken = d.link ? token() : null;
            await must(
                supabase.from('deliveries').insert({
                    order_id: order.id,
                    scheduled_date: day(d.on),
                    status: d.status ?? 'scheduled',
                    failure_reason: d.reason ?? null,
                    d4_call_status: d.d4 ?? 'pending',
                    d1_call_status: d.d1 ?? 'pending',
                    booking_token: bookingToken,
                    time_slot: d.slot ?? null,
                    slot_booked_at: d.slot ? new Date().toISOString() : null,
                    requires_porter: requiresPorter,
                    assembly_status: d.assembly ?? 'pending',
                    assembly_note: d.assemblyNote ?? null,
                    assembled_at: d.assembly === 'assembled' ? new Date().toISOString() : null,
                }),
                `delivery "${o.note}"`,
            );
            if (bookingToken) links.push({ note: o.note, url: `/book/${bookingToken}` });
        }
    }

    console.log(`\nDone: ${keys.length} customers, ${orders.length} orders.`);
    console.log('Booking links to try (append to your app URL):');
    for (const l of links) console.log(`  ${l.url}  ← ${l.note}`);
}

runSeed().catch((e) => {
    console.error(e);
    process.exit(1);
});
