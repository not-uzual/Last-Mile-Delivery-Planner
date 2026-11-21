import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, Clock, Coffee, MapPin, Navigation, Package, Phone, PartyPopper, XCircle } from 'lucide-react';
import { createClient } from '@/lib/db/server';
import { getCurrentProfile, loadAvailability } from '@/lib/planning';
import { getRouteForDay } from '@/lib/routing';
import { formatDate, todayISO } from '@/lib/dates';
import { HANDLING_LABEL, cn, itemHandling, orderHandling } from '@/lib/utils';
import { Badge, Card, EmptyState, Skeleton, buttonClass } from '@/components/ui';
import StopActions from './stop-actions';
import TimeOff from '@/components/leave/TimeOff';
import { SLOT_BY_ID, compareBySlot } from '@/lib/slots';

export const metadata: Metadata = { title: 'Today' };

export default function CrewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-72" />
        </div>
      }
    >
      <CrewToday />
    </Suspense>
  );
}

async function CrewToday() {

  await connection();
  const supabase = await createClient();
  const today = todayISO();

  const [profile, { days }, deliveriesRes] = await Promise.all([
    getCurrentProfile(supabase),
    loadAvailability(supabase, [today]),
    supabase
      .from('deliveries')
      .select(
        'id, status, failure_reason, d1_call_status, time_slot, orders(id, customers(name, address, phone, lat, lng, lift_length, lift_width, lift_height, has_staircase_only), order_items(id, name, length, width, height, weight))',
      )
      .eq('scheduled_date', today)
      .order('sequence_order', { nullsFirst: false })
      .order('created_at'),
  ]);
  if (deliveriesRes.error) throw deliveriesRes.error;

  const day = days[0];
  const amOff = day.off.find((o) => o.member.id === profile?.id);
  const stops = deliveriesRes.data
    .flatMap((d) => (d.orders?.customers ? [{ ...d, customer: d.orders.customers, items: d.orders.order_items }] : []))
    .sort(compareBySlot);
  const routeStops = stops.filter((s) => s.status !== 'failed');
  const route = await getRouteForDay(
    routeStops.map((s) => ({ id: s.id, lat: s.customer.lat, lng: s.customer.lng, notBeforeMinutes: s.time_slot ? SLOT_BY_ID[s.time_slot].startMinutes : undefined })),
  );
  const eta = new Map(route?.arrivals.map((a) => [a.id, a.arrival]) ?? []);

  const pending = stops.filter((s) => s.status === 'scheduled');
  const done = stops.filter((s) => s.status !== 'scheduled');
  const progress = stops.length ? Math.round((done.length / stops.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl bg-zinc-900 p-5 text-white shadow-lg">
        <p className="text-xs font-medium text-zinc-400">{formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-2xl font-semibold tracking-tight">
            {pending.length} <span className="text-base font-normal text-zinc-400">of {stops.length} stops left</span>
          </p>
          {route && <p className="text-xs tabular-nums text-zinc-400">Back to depot by {route.returnToDepot}</p>}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-700">
          <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {day.onDuty.map((m) => (
            <span key={m.id} className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', m.id === profile?.id ? 'bg-white text-zinc-900' : 'bg-zinc-800 text-zinc-300')}>
              {m.full_name} · {m.crew_role}
            </span>
          ))}
        </div>
      </div>

      {amOff && (
        <Card className="flex items-center gap-3 p-4">
          <Coffee className="size-5 text-amber-600" />
          <p className="text-sm text-zinc-700">You’re {amOff.reason === 'leave' ? 'on leave' : 'off'} today. Enjoy the day!</p>
        </Card>
      )}

      {pending.length === 0 && (
        <Card>
          <EmptyState icon={stops.length ? PartyPopper : Clock} title={stops.length ? 'All stops done' : 'No deliveries today'}>
            {stops.length ? 'Nice work. Head back to the depot.' : 'Check back tomorrow.'}
          </EmptyState>
        </Card>
      )}

      {/* Pending stops */}
      {pending.map((s, i) => {
        const handling = orderHandling(s.items, s.customer);
        const index = routeStops.findIndex((r) => r.id === s.id) + 1;
        return (
          <Card key={s.id} className={cn('overflow-hidden', i === 0 && 'ring-2 ring-zinc-900')}>
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {i === 0 ? 'Next stop' : `Stop ${index}`}
                  {eta.get(s.id) && <span className="ml-2 font-medium normal-case tracking-normal text-zinc-900">ETA {eta.get(s.id)}</span>}
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-tight">{s.customer.name}</h2>
                {s.time_slot && (
                  <p className="mt-1 text-xs font-medium text-violet-700">
                    Booked {SLOT_BY_ID[s.time_slot].label.toLowerCase()} · {SLOT_BY_ID[s.time_slot].window}
                  </p>
                )}
                <p className="mt-1 flex items-start gap-1.5 text-sm text-zinc-600">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-zinc-400" /> {s.customer.address}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.customer.lat},${s.customer.lng}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>
                <Navigation className="size-4" /> Directions
              </a>
              <a href={`tel:${s.customer.phone}`} className={buttonClass('secondary', 'md')}>
                <Phone className="size-4" /> Call
              </a>
            </div>

            {handling !== 'lift' && (
              <div className={cn('mx-4 mt-3 flex items-start gap-2 rounded-lg p-3 text-sm', handling === 'hoist' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900')}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">{HANDLING_LABEL[handling]}</span>
                  {s.customer.has_staircase_only ? ' — building has no lift.' : ' — some items don’t fit the lift.'}
                </p>
              </div>
            )}

            <ul className="mx-4 mt-3 divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
              {s.items.map((it) => {
                const h = itemHandling(it, s.customer);
                return (
                  <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <Package className="size-3.5 shrink-0 text-zinc-400" /> {it.name}
                      </p>
                      <p className="text-xs tabular-nums text-zinc-500">
                        {it.length}×{it.width}×{it.height} cm · {it.weight} kg
                      </p>
                    </div>
                    {h !== 'lift' && <Badge tone={h === 'hoist' ? 'red' : 'amber'}>{HANDLING_LABEL[h]}</Badge>}
                  </li>
                );
              })}
            </ul>

            <div className="p-4">
              <StopActions deliveryId={s.id} crewRole={profile?.crew_role ?? null} />
            </div>
          </Card>
        );
      })}

      {/* Completed */}
      {done.length > 0 && (
        <Card>
          <p className="border-b border-zinc-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Completed</p>
          <ul className="divide-y divide-zinc-100">
            {done.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                {s.status === 'delivered' ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-rose-500" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.customer.name}</p>
                  <p className="truncate text-xs text-zinc-500">{s.status === 'delivered' ? 'Delivered' : `Failed — ${s.failure_reason ?? 'no reason'}`}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Suspense fallback={<Skeleton className="h-48" />}>
        <TimeOff />
      </Suspense>
    </div>
  );
}
