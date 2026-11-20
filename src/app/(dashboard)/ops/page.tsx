import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Inbox,
  MapPin,
  Package,
  Phone,
  PhoneCall,
  PhoneOff,
  Route,
  Truck,
  Undo2,
  Users,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/db/server';
import { loadAvailability } from '@/lib/planning';
import { getRouteForDay } from '@/lib/routing';
import { MAX_DELIVERIES_PER_DAY, nearestOpenDay, type DayAvailability } from '@/lib/availability';
import { addDays, formatDate, nextDays, relativeDay, todayISO } from '@/lib/dates';
import { HANDLING_LABEL, cn, itemHandling, orderHandling, type Handling } from '@/lib/utils';
import { scheduleOrder, unassignDelivery, updateCallStatus } from '@/actions/ops';
import { Badge, Card, CardHeader, Dot, EmptyState, Skeleton, StatCard, type Tone } from '@/components/ui';
import ActionButton from '@/components/ui/ActionButton';
import Map from '@/components/map/Map';
import MoveDelivery from './move-delivery';
import BookingLink from './booking-link';
import TimeOff from '@/components/leave/TimeOff';
import { SLOT_BY_ID, compareBySlot, type TimeSlot } from '@/lib/slots';

export const metadata: Metadata = { title: 'Operations' };

type SearchParams = Promise<{ date?: string }>;

export default function OpsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<OpsSkeleton />}>
      <OpsWorkspace searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS_TONE: Record<DayAvailability['status'], Tone> = { open: 'green', locked: 'amber', closed: 'red' };
const STATUS_LABEL: Record<DayAvailability['status'], string> = { open: 'Open', locked: 'Locked', closed: 'Closed' };
const HANDLING_TONE: Record<Handling, Tone> = { lift: 'neutral', stairs: 'amber', hoist: 'red' };
type CallStatus = 'pending' | 'confirmed' | 'unreachable';

async function OpsWorkspace({ searchParams }: { searchParams: SearchParams }) {
  // Mark the page as request-time before reading the clock: 'today' must be the real today,
  // not the moment the page was prerendered at build time.
  await connection();
  const supabase = await createClient();
  const { date: dateParam } = await searchParams;
  const today = todayISO();
  const horizon = nextDays(today, 14);
  const selected = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const d1 = addDays(today, 1);
  const d4 = addDays(today, 4);

  const [availability, queueRes, dayRes, callsRes] = await Promise.all([
    loadAvailability(supabase, horizon.includes(selected) ? horizon : [...horizon, selected]),
    supabase
      .from('orders')
      .select(
        'id, ready_date, customers(name, address, lift_length, lift_width, lift_height, has_staircase_only), order_items(id, name, length, width, height, weight), deliveries(status, scheduled_date, failure_reason)',
      )
      .eq('status', 'unplanned')
      .order('ready_date'),
    supabase
      .from('deliveries')
      .select(
        'id, status, d4_call_status, d1_call_status, time_slot, failure_reason, orders(id, ready_date, customers(name, address, phone, lat, lng, lift_length, lift_width, lift_height, has_staircase_only), order_items(id, name, length, width, height, weight))',
      )
      .eq('scheduled_date', selected)
      .order('sequence_order', { nullsFirst: false })
      .order('created_at'),
    supabase
      .from('deliveries')
      .select('id, scheduled_date, d4_call_status, d1_call_status, time_slot, booking_token, orders(customers(name, phone))')
      .eq('status', 'scheduled')
      .gte('scheduled_date', today)
      .lte('scheduled_date', d4)
      .order('scheduled_date'),
  ]);
  if (queueRes.error) throw queueRes.error;
  if (dayRes.error) throw dayRes.error;
  if (callsRes.error) throw callsRes.error;

  const horizonDays = availability.days.filter((d) => horizon.includes(d.date));
  const day = availability.days.find((d) => d.date === selected)!;
  const todayAvail = horizonDays[0];

  // ---- Selected day: stops, route & ETAs -------------------------------------------------
  const stops = dayRes.data.flatMap((d) => {
    const order = d.orders;
    const customer = order?.customers;
    if (!order || !customer) return [];
    return [{ ...d, order, customer, items: order.order_items, handling: orderHandling(order.order_items, customer) }];
  }).sort(compareBySlot);
  const active = stops.filter((s) => s.status !== 'failed');
  const failed = stops.filter((s) => s.status === 'failed');
  const route = await getRouteForDay(
    active.map((s) => ({ id: s.id, lat: s.customer.lat, lng: s.customer.lng, notBeforeMinutes: s.time_slot ? SLOT_BY_ID[s.time_slot].startMinutes : undefined })),
  );
  const eta = new globalThis.Map(route?.arrivals.map((a) => [a.id, a]) ?? []);
  const capacity = day.status === 'closed' ? 0 : MAX_DELIVERIES_PER_DAY;
  const totalKg = active.reduce((sum, s) => sum + s.items.reduce((k, i) => k + i.weight, 0), 0);

  const openDaysFrom = (from: string) =>
    horizonDays
      .filter((d) => d.status === 'open' && d.date >= from && d.date !== selected)
      .map((d) => ({ date: d.date, label: `${formatDate(d.date)} · ${d.deliveryCount}/4` }));

  // ---- Queue ---------------------------------------------------------------------------
  const queue = queueRes.data.flatMap((o) => {
    if (!o.customers) return [];
    const readyFrom = o.ready_date > today ? o.ready_date : today;
    const lastFailure = o.deliveries.filter((d) => d.status === 'failed').sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
    return [
      {
        ...o,
        customer: o.customers,
        readyFrom,
        handling: orderHandling(o.order_items, o.customers),
        weight: o.order_items.reduce((k, i) => k + i.weight, 0),
        earliest: nearestOpenDay(horizonDays, readyFrom),
        lastFailure,
      },
    ];
  });
  const readyNow = queue.filter((o) => o.ready_date <= today).length;

  // ---- Calls ---------------------------------------------------------------------------
  const calls = callsRes.data.map((c) => ({ ...c, name: c.orders?.customers?.name ?? 'Unknown', phone: c.orders?.customers?.phone ?? '' }));
  const d4Calls = calls.filter((c) => c.scheduled_date === d4);
  const d1Calls = calls.filter((c) => c.scheduled_date === d1);
  // Customers whose D-4 call is already in the past but never confirmed, or who are due today without a D-1 confirmation.
  const unconfirmed = calls.filter(
    (c) =>
      (c.scheduled_date < d4 && c.d4_call_status !== 'confirmed') ||
      (c.scheduled_date === today && c.d1_call_status !== 'confirmed') ||
      (c.scheduled_date === d1 && c.d1_call_status === 'unreachable'),
  );
  const callsDone = [...d4Calls.map((c) => c.d4_call_status), ...d1Calls.map((c) => c.d1_call_status)].filter((s) => s !== 'pending').length;

  // ---- KPIs ----------------------------------------------------------------------------
  const booked = horizonDays.reduce((n, d) => n + d.deliveryCount, 0);
  const slots = horizonDays.filter((d) => d.status !== 'closed').length * MAX_DELIVERIES_PER_DAY;
  const overbookedDays = horizonDays.filter((d) => d.overflow > 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">{formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Delivery planning</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><Dot tone="green" /> Open</span>
          <span className="flex items-center gap-1.5"><Dot tone="amber" /> Locked (4/4)</span>
          <span className="flex items-center gap-1.5"><Dot tone="red" /> Closed (team off)</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Unplanned orders" value={queue.length} hint={`${readyNow} ready to ship now`} icon={Inbox} tone="brand" />
        <StatCard label="Booked · next 14 days" value={<>{booked}<span className="text-sm font-normal text-zinc-400"> / {slots}</span></>} hint={`${horizonDays.filter((d) => d.status === 'open').length} days still open`} icon={CalendarDays} tone="blue" />
        <StatCard label="Calls today" value={<>{callsDone}<span className="text-sm font-normal text-zinc-400"> / {d4Calls.length + d1Calls.length}</span></>} hint={unconfirmed.length ? `${unconfirmed.length} customer${unconfirmed.length > 1 ? 's' : ''} not confirmed` : 'Everyone confirmed'} icon={PhoneCall} tone={unconfirmed.length ? 'amber' : 'green'} />
        <StatCard
          label="Crew today"
          value={<>{todayAvail.onDuty.length}<span className="text-sm font-normal text-zinc-400"> on duty</span></>}
          hint={todayAvail.off.length ? `Off: ${todayAvail.off.map((o) => o.member.full_name).join(', ')}` : 'Full team working'}
          icon={Users}
          tone={todayAvail.status === 'closed' ? 'red' : 'green'}
        />
      </div>

      {overbookedDays.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">Overloaded days:</span>
          {overbookedDays.map((d) => (
            <Link key={d.date} href={`?date=${d.date}`} scroll={false} className="underline decoration-rose-300 underline-offset-2 hover:decoration-rose-600">
              {formatDate(d.date)} ({d.overflow} to move{d.status === 'closed' ? ', team off' : ''})
            </Link>
          ))}
        </div>
      )}

      {/* 14-day calendar strip */}
      <Card>
        <CardHeader icon={CalendarDays} title="Next 14 days" description="Pick a day to plan it. A day takes at most 4 deliveries and closes when no driver or no assembler is working." />
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 md:grid-cols-7">
          {horizonDays.map((d) => (
            <DayTile key={d.date} day={d} today={today} selected={d.date === selected} />
          ))}
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* ---------------- Left: selected day, then the unplanned queue ---------------- */}
        <div className="min-w-0 space-y-6">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{relativeDay(selected, today) === 'Today' ? 'Today' : formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                <Badge tone={STATUS_TONE[day.status]}>{STATUS_LABEL[day.status]}</Badge>
                <span className="text-xs tabular-nums text-zinc-500">{day.deliveryCount}/{MAX_DELIVERIES_PER_DAY} deliveries</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {day.onDuty.map((m) => (
                  <Badge key={m.id} tone="green" icon={m.crew_role === 'driver' ? Truck : Users}>
                    {m.full_name} · {m.crew_role}
                  </Badge>
                ))}
                {day.off.map(({ member, reason }) => (
                  <Badge key={member.id} tone="neutral" className="line-through decoration-zinc-400" title={reason === 'leave' ? 'On leave' : 'Weekly day off'}>
                    {member.full_name} · {reason === 'leave' ? 'leave' : 'day off'}
                  </Badge>
                ))}
              </div>
              {day.status === 'closed' && (
                <p className="mt-2 text-xs text-rose-600">No {!day.hasDriver ? 'driver' : 'assembler'} working — nothing can be delivered this day.</p>
              )}
            </div>
            {route && (
              <dl className="grid grid-cols-3 gap-4 text-right">
                <Metric label="Distance" value={`${route.distanceKm.toFixed(1)} km`} />
                <Metric label="Driving" value={`${Math.round(route.drivingMinutes)} min`} />
                <Metric label="Back at depot" value={route.returnToDepot} />
              </dl>
            )}
          </div>

          {active.length > 0 ? (
            <>
              <div className="relative border-b border-zinc-100">
                <Map
                  className="h-[340px]"
                  geometry={route?.geometry ?? null}
                  deliveries={active.map((s) => ({
                    id: s.id,
                    name: s.customer.name,
                    address: s.customer.address,
                    lat: s.customer.lat,
                    lng: s.customer.lng,
                    arrivalTime: eta.get(s.id)?.arrival,
                    status: s.status ?? 'scheduled',
                  }))}
                />
                {!route && (
                  <p className="absolute bottom-2 left-2 z-[500] rounded-md bg-white/90 px-2 py-1 text-[11px] text-amber-700 shadow">
                    Routing service unavailable — ETAs not shown.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between bg-zinc-50/60 px-4 py-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5"><Route className="size-3" /> Leaves depot 09:00 · 45 min on site per stop</span>
                <span className="tabular-nums">{totalKg} kg on board</span>
              </div>
              <ol className="divide-y divide-zinc-100">
                {active.map((s, i) => {
                  const over = i >= capacity;
                  const from = s.order.ready_date > today ? s.order.ready_date : today;
                  const options = openDaysFrom(from);
                  const suggested = nearestOpenDay(horizonDays, from, selected);
                  const itemNotes = s.items.filter((it) => itemHandling(it, s.customer) !== 'lift');
                  return (
                    <li key={s.id} className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]', over && 'bg-rose-50/50')}>
                      <span className={cn('mt-0.5 grid size-6 place-items-center rounded-full text-[11px] font-semibold text-white', s.status === 'delivered' ? 'bg-emerald-600' : 'bg-zinc-900')}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-sm font-medium">{s.customer.name}</p>
                          {eta.get(s.id) && (
                            <span className="flex items-center gap-1 text-xs tabular-nums text-zinc-500">
                              <Clock className="size-3" /> {eta.get(s.id)!.arrival}–{eta.get(s.id)!.departure}
                            </span>
                          )}
                          {s.status === 'delivered' && <Badge tone="green" icon={CheckCircle2}>Delivered</Badge>}
                          {over && <Badge tone="red" icon={AlertTriangle}>Over capacity</Badge>}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                          <MapPin className="size-3 shrink-0" /> {s.customer.address}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge icon={Package}>{s.items.length} item{s.items.length > 1 ? 's' : ''} · {s.items.reduce((k, it) => k + it.weight, 0)} kg</Badge>
                          <Badge tone={HANDLING_TONE[s.handling]} title={itemNotes.map((it) => `${it.name}: ${HANDLING_LABEL[itemHandling(it, s.customer)]}`).join('\n') || undefined}>
                            {HANDLING_LABEL[s.handling]}
                          </Badge>
                          {s.time_slot && <Badge tone="violet" icon={Clock} title="Window the customer booked">{SLOT_BY_ID[s.time_slot].label} {SLOT_BY_ID[s.time_slot].window}</Badge>}
                          <CallChip label="D-4" status={s.d4_call_status} />
                          <CallChip label="D-1" status={s.d1_call_status} />
                        </div>
                      </div>
                      {s.status === 'scheduled' && (
                        <div className="col-span-2 flex items-start justify-end gap-1.5 sm:col-span-1">
                          <MoveDelivery deliveryId={s.id} options={options} suggested={over ? suggested : null} />
                          <ActionButton action={unassignDelivery} fields={{ deliveryId: s.id }} size="xs" variant="ghost" title="Send back to the unplanned queue">
                            <Undo2 className="size-3" />
                          </ActionButton>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <EmptyState icon={Truck} title={day.status === 'closed' ? 'Team is off this day' : 'Nothing scheduled yet'}>
              {day.status === 'closed' ? 'Pick another day to plan deliveries.' : 'Add orders from the unplanned queue to build this day’s route.'}
            </EmptyState>
          )}

          {failed.length > 0 && (
            <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Failed — back in the queue</p>
              <ul className="space-y-1">
                {failed.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs text-zinc-600">
                    <XCircle className="size-3.5 text-rose-500" /> <span className="font-medium">{s.customer.name}</span>
                    <span className="truncate text-zinc-400">— {s.failure_reason ?? 'no reason given'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

          <Card>
            <CardHeader
              icon={Inbox}
              title={<>Unplanned queue <span className="ml-1 font-normal text-zinc-400">{queue.length}</span></>}
              description={`Adding to ${relativeDay(selected, today)} · ${day.status === 'open' ? `${MAX_DELIVERIES_PER_DAY - day.deliveryCount} slot${MAX_DELIVERIES_PER_DAY - day.deliveryCount === 1 ? '' : 's'} left` : STATUS_LABEL[day.status].toLowerCase()}`}
            />
            {queue.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All caught up">Every order has a delivery date.</EmptyState>
            ) : (
              <ul className="max-h-[640px] divide-y divide-zinc-100 overflow-y-auto">
                {queue.map((o) => {
                  const notReady = selected < o.readyFrom;
                  const blocked = day.status !== 'open' ? `${formatDate(selected)} is ${STATUS_LABEL[day.status].toLowerCase()}` : notReady ? `Not ready until ${formatDate(o.ready_date)}` : undefined;
                  return (
                    <li key={o.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.customer.name}</p>
                          <p className="truncate text-xs text-zinc-500">{o.customer.address}</p>
                        </div>
                        <span className={cn('shrink-0 text-[11px] font-medium', o.ready_date <= today ? 'text-emerald-600' : 'text-zinc-500')}>
                          {o.ready_date <= today ? 'Ready' : `Ready ${formatDate(o.ready_date, { day: 'numeric', month: 'short' })}`}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge icon={Package} title={o.order_items.map((it) => `${it.name} — ${it.length}×${it.width}×${it.height} cm, ${it.weight} kg`).join('\n')}>
                          {o.order_items.length} item{o.order_items.length > 1 ? 's' : ''} · {o.weight} kg
                        </Badge>
                        <Badge tone={HANDLING_TONE[o.handling]}>{HANDLING_LABEL[o.handling]}</Badge>
                        {o.customer.has_staircase_only && <Badge tone="amber">No lift</Badge>}
                        {o.lastFailure && <Badge tone="red" icon={Undo2} title={o.lastFailure.failure_reason ?? undefined}>Failed {formatDate(o.lastFailure.scheduled_date, { day: 'numeric', month: 'short' })}</Badge>}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-start justify-end gap-1.5">
                        {o.earliest && o.earliest !== selected && (
                          <ActionButton action={scheduleOrder} fields={{ orderId: o.id, date: o.earliest }} size="xs" title="Nearest open day on or after the ready date">
                            Earliest · {formatDate(o.earliest)}
                          </ActionButton>
                        )}
                        {!o.earliest && <span className="text-[11px] text-zinc-400">No open day in the next 14 days</span>}
                        <ActionButton action={scheduleOrder} fields={{ orderId: o.id, date: selected }} size="xs" variant="primary" disabled={!!blocked} title={blocked}>
                          Add to {relativeDay(selected, today)}
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------------- Right rail ---------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader icon={Phone} title="Customer calls" description="D-4: send the customer a link to pick their time. D-1: call to reconfirm." />
            <CallSection title={`D-4 · agree slot for ${formatDate(d4)}`} rows={d4Calls} call="d4" />
            <CallSection title={`D-1 · reconfirm for ${formatDate(d1)}`} rows={d1Calls} call="d1" />
            {unconfirmed.length > 0 && (
              <div className="border-t border-zinc-100">
                <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-medium uppercase tracking-wide text-rose-600">
                  <AlertTriangle className="size-3" /> Not confirmed
                </p>
                <ul className="divide-y divide-zinc-100">
                  {unconfirmed.map((c) => {
                    const call = c.d4_call_status !== 'confirmed' ? 'd4' : 'd1';
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-zinc-500">
                            <Link href={`?date=${c.scheduled_date}`} scroll={false} className="hover:underline">{relativeDay(c.scheduled_date, today)}</Link>
                            {' · '}{call === 'd4' ? 'slot never agreed' : 'not reconfirmed'}
                          </p>
                        </div>
                        <CallAction id={c.id} call={call} token={c.booking_token} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>

          <Suspense fallback={<Skeleton className="h-48" />}>
            <TimeOff />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function DayTile({ day, today, selected }: { day: DayAvailability; today: string; selected: boolean }) {
  const tone = STATUS_TONE[day.status];
  return (
    <Link
      href={`?date=${day.date}`}
      scroll={false}
      className={cn(
        'group relative rounded-lg border p-2.5 transition-all',
        selected ? 'border-zinc-900 bg-white ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
        day.status === 'closed' && !selected && 'bg-hatch',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          {day.date === today ? 'Today' : formatDate(day.date, { weekday: 'short' })}
        </span>
        <Dot tone={tone} />
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{formatDate(day.date, { day: 'numeric' })}<span className="ml-1 text-xs font-normal text-zinc-400">{formatDate(day.date, { month: 'short' })}</span></p>
      <div className="mt-2 flex gap-0.5" aria-label={`${day.deliveryCount} of 4 slots used`}>
        {Array.from({ length: MAX_DELIVERIES_PER_DAY }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full',
              i < day.deliveryCount ? (day.status === 'closed' ? 'bg-rose-400' : day.status === 'locked' ? 'bg-amber-500' : 'bg-zinc-800') : 'bg-zinc-200',
            )}
          />
        ))}
      </div>
      <p className={cn('mt-1.5 text-[11px]', day.status === 'closed' ? 'text-rose-600' : day.status === 'locked' ? 'text-amber-700' : 'text-zinc-500')}>
        {day.status === 'closed' ? (day.overflow ? `Closed · ${day.overflow} to move` : 'Closed') : day.status === 'locked' ? 'Full' : `${MAX_DELIVERIES_PER_DAY - day.deliveryCount} free`}
      </p>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function CallChip({ label, status }: { label: string; status: CallStatus | null }) {
  const s = status ?? 'pending';
  const tone: Tone = s === 'confirmed' ? 'green' : s === 'unreachable' ? 'red' : 'neutral';
  const Icon = s === 'confirmed' ? CheckCircle2 : s === 'unreachable' ? PhoneOff : Clock;
  return (
    <Badge tone={tone} icon={Icon} title={`${label} call: ${s}`}>
      {label}
    </Badge>
  );
}

/** D-4 → booking link the customer uses to pick a window. D-1 → ops reconfirms by phone. */
function CallAction({ id, call, token }: { id: string; call: 'd4' | 'd1'; token: string | null }) {
  if (call === 'd4') return <BookingLink deliveryId={id} token={token} />;
  return (
    <ActionButton action={updateCallStatus} fields={{ deliveryId: id, call, status: 'confirmed' }} size="xs" title="Customer reconfirmed on the phone">
      <CheckCircle2 className="size-3 text-emerald-600" /> Confirmed
    </ActionButton>
  );
}

function CallSection({
  title,
  rows,
  call,
}: {
  title: string;
  rows: {
    id: string;
    name: string;
    phone: string;
    d4_call_status: CallStatus | null;
    d1_call_status: CallStatus | null;
    time_slot: TimeSlot | null;
    booking_token: string | null;
  }[];
  call: 'd4' | 'd1';
}) {
  return (
    <div className="border-t border-zinc-100 first-of-type:border-t-0">
      <p className="px-4 pt-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {rows.length === 0 ? (
        <p className="px-4 pb-3 pt-1 text-xs text-zinc-400">No calls due.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => {
            const status = (call === 'd4' ? r.d4_call_status : r.d1_call_status) ?? 'pending';
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {r.name}
                    {status !== 'pending' && <CallChip label={status === 'confirmed' ? 'Confirmed' : 'No answer'} status={status} />}
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500">
                    <a href={`tel:${r.phone}`} className="hover:text-zinc-900">{r.phone}</a>
                    {r.time_slot && <span className="ml-1.5 text-violet-700">· {SLOT_BY_ID[r.time_slot].label} {SLOT_BY_ID[r.time_slot].window}</span>}
                    {call === 'd4' && !r.time_slot && r.booking_token && <span className="ml-1.5 text-amber-700">· link sent, waiting</span>}
                  </p>
                </div>
                {status !== 'confirmed' && <CallAction id={r.id} call={call} token={r.booking_token} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function OpsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)}
      </div>
      <Skeleton className="h-52" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[520px]" />
      </div>
    </div>
  );
}
