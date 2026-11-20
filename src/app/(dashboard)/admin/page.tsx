import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { AlertTriangle, CalendarClock, CalendarDays, Check, Plane, Truck, UserCheck, Users, Wrench, X } from 'lucide-react';
import { createClient } from '@/lib/db/server';
import { loadAvailability } from '@/lib/planning';
import { getDayAvailability, offReason, type CrewMember, type DayAvailability, type LeaveRecord } from '@/lib/availability';
import { addDays, formatDate, nextDays, todayISO } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { decideLeave } from '@/actions/leave';
import { Badge, Card, CardHeader, Skeleton, StatCard, type Tone } from '@/components/ui';
import ActionButton from '@/components/ui/ActionButton';
import WeeklyOffSelect from './weekly-off-select';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminConsole />
    </Suspense>
  );
}

async function AdminConsole() {
  // Mark the page as request-time before reading the clock: 'today' must be the real today,
  // not the moment the page was prerendered at build time.
  await connection();
  const supabase = await createClient();
  const today = todayISO();
  const horizon = nextDays(today, 14);
  // The coverage grid also shows the last 3 days so admin can see who was just off.
  const PAST_DAYS = 3;
  const gridDates = nextDays(addDays(today, -PAST_DAYS), PAST_DAYS + 14);

  const [{ crew, leaves, pendingLeaves, days: gridDays }, teamRes, leaveRes] = await Promise.all([
    loadAvailability(supabase, gridDates),
    supabase.from('profiles').select('id, full_name, app_role, crew_role, weekly_off_day').order('app_role').order('full_name'),
    supabase
      .from('leave_records')
      // leave_records has two links to profiles (who is off / who decided), so name the one we want
      .select('id, leave_date, profile_id, status, reason, created_at, profiles!leave_records_profile_id_fkey(full_name, app_role, crew_role)')
      .gte('leave_date', today)
      .eq('status', 'pending')
      .order('leave_date'),
  ]);
  if (teamRes.error) throw teamRes.error;
  if (leaveRes.error) throw leaveRes.error;

  const days = gridDays.filter((d) => d.date >= today); // today + next 13, for the stats
  const todayDay = days[0];
  const closedDays = days.filter((d) => d.status === 'closed');
  // Admin is not on the leave system: no leave, no weekly day off, not in the coverage grid.
  const rota = teamRes.data.filter((m) => m.app_role !== 'admin');
  const requests = leaveRes.data; // approved leave is final and shows in the coverage grid

  // Requests can be further out than the 14-day grid; load availability for those days too.
  const extraDates = [...new Set(requests.map((r) => r.leave_date))].filter((d) => !horizon.includes(d));
  const extra = extraDates.length ? await loadAvailability(supabase, extraDates) : null;
  const allDays = [...days, ...(extra?.days ?? [])];
  const allLeaves = [...leaves, ...(extra?.leaves ?? [])];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-zinc-500">{formatDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Team & availability</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Crew members" value={crew.length} hint={`${crew.filter((c) => c.crew_role === 'driver').length} driver · ${crew.filter((c) => c.crew_role === 'assembler').length} assemblers`} icon={Users} tone="brand" />
        <StatCard label="On duty today" value={todayDay.onDuty.length} hint={todayDay.status === 'closed' ? 'Deliveries closed today' : 'Team can deliver today'} icon={UserCheck} tone={todayDay.status === 'closed' ? 'red' : 'green'} />
        <StatCard label="Off today" value={todayDay.off.length} hint={todayDay.off.map((o) => o.member.full_name).join(', ') || 'Nobody'} icon={Plane} tone="amber" />
        <StatCard label="Closed days · next 14" value={closedDays.length} hint={closedDays.slice(0, 3).map((d) => formatDate(d.date, { weekday: 'short', day: 'numeric' })).join(', ') || 'None'} icon={CalendarDays} tone={closedDays.length ? 'red' : 'neutral'} />
      </div>

      {/* Coverage grid */}
      <Card className="overflow-hidden">
        <CardHeader icon={CalendarClock} title="Team coverage · last 3 days and next 14" description="A day closes when all drivers or all assemblers are off. Dashed = asked for, not approved yet." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium text-zinc-500">Member</th>
                {gridDays.map((d) => (
                  <th
                    key={d.date}
                    className={cn(
                      'px-1 py-2 text-center font-medium',
                      d.date === today ? 'text-zinc-900' : d.date < today ? 'text-zinc-400' : 'text-zinc-500',
                      d.date === today && 'border-l-2 border-blue-400',
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wide">{d.date === today ? 'Today' : formatDate(d.date, { weekday: 'short' })}</div>
                    <div className="tabular-nums">{formatDate(d.date, { day: 'numeric' })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rota.map((m) => (
                <tr key={m.id}>
                  <td className="sticky left-0 z-10 border-t border-zinc-100 bg-white px-4 py-2">
                    <div className="flex items-center gap-2">
                      {m.crew_role === 'driver' ? <Truck className="size-3.5 text-zinc-400" /> : m.crew_role === 'assembler' ? <Wrench className="size-3.5 text-zinc-400" /> : <Users className="size-3.5 text-zinc-400" />}
                      <span>
                        <span className="font-medium text-zinc-900">{m.full_name}</span>
                        <span className="ml-1.5 text-[10px] capitalize text-zinc-400">{m.app_role === 'ops' ? 'Operations' : m.app_role === 'admin' ? 'Admin' : m.crew_role}</span>
                      </span>
                    </div>
                  </td>
                  {gridDays.map((d) => {
                    const reason = offReason(m, d.date, leaves);
                    const requested = !reason && pendingLeaves.some((l) => l.profile_id === m.id && l.leave_date === d.date);
                    return (
                      <td key={d.date} className={cn('border-t border-zinc-100 px-1 py-1.5 text-center', d.date < today && 'opacity-70', d.date === today && 'border-l-2 border-l-blue-400')}>
                        <span
                          title={reason === 'leave' ? 'On leave' : reason === 'weekly-off' ? 'Weekly day off' : requested ? 'Asked for this day off (pending)' : 'Working'}
                          className={cn(
                            'mx-auto grid h-6 w-full max-w-11 place-items-center rounded-md text-[10px] font-medium',
                            reason === 'leave'
                              ? 'bg-amber-100 text-amber-800'
                              : reason === 'weekly-off'
                                ? 'bg-zinc-100 text-zinc-500'
                                : requested
                                  ? 'border border-dashed border-amber-400 bg-white text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700',
                          )}
                        >
                          {reason === 'leave' ? 'Leave' : reason === 'weekly-off' ? 'Off' : requested ? 'Asked' : '✓'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 border-t border-zinc-200 bg-zinc-50 px-4 py-2 font-medium text-zinc-600">Day status</td>
                {gridDays.map((d) => (
                  <td key={d.date} className={cn('border-t border-zinc-200 bg-zinc-50 px-1 py-2 text-center', d.date < today && 'opacity-70', d.date === today && 'border-l-2 border-l-blue-400')}>
                    <Badge tone={d.status === 'closed' ? 'red' : d.status === 'locked' ? 'amber' : 'green'}>{d.status === 'closed' ? 'Closed' : d.status === 'locked' ? 'Full' : 'Open'}</Badge>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHeader icon={Users} title="Team" description="Set each team member's weekly day off. Changes save immediately." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50/70 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Today</th>
                  <th className="px-4 py-2 font-medium">Weekly day off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {teamRes.data.map((m) => {
                  const reason = offReason(m, today, leaves);
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <Badge tone={m.app_role === 'admin' ? 'violet' : m.app_role === 'ops' ? 'blue' : 'neutral'}>{m.app_role === 'ops' ? 'Operations' : m.app_role === 'admin' ? 'Admin' : 'Crew'}</Badge>
                          {m.crew_role && <Badge tone="brand" className="capitalize">{m.crew_role}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {reason ? <Badge tone="amber">{reason === 'leave' ? 'On leave' : 'Day off'}</Badge> : <Badge tone="green">On duty</Badge>}
                      </td>
                      <td className="px-4 py-2">
                        {m.app_role === 'admin' ? <span className="text-xs text-zinc-400">—</span> : <WeeklyOffSelect id={m.id} value={m.weekly_off_day} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Leave requests waiting for a decision (approved leave shows in the coverage grid).
            On large screens the card is pinned to the Team card's height and scrolls inside. */}
        <div className="relative min-h-80">
          <Card className="flex flex-col overflow-hidden lg:absolute lg:inset-0">
            <CardHeader
              icon={Plane}
              title={<>Leave requests <span className="ml-1 font-normal text-zinc-400">{requests.length}</span></>}
              description="One-day requests from crew and ops. Approval is final, so check what it does to deliveries first."
            />
            {requests.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-400">No requests waiting.</p>
            ) : (
              <ul className="max-h-[28rem] min-h-0 flex-1 divide-y divide-zinc-100 overflow-y-auto lg:max-h-none">
                {requests.map((r) => {
                  const impact = leaveImpact(r, allDays, crew, allLeaves);
                  return (
                    <li key={r.id} className="space-y-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {r.profiles?.full_name}
                          <span className="ml-1.5 text-xs font-normal capitalize text-zinc-500">{r.profiles?.crew_role ?? 'operations'}</span>
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(r.leave_date, { weekday: 'long', day: 'numeric', month: 'short' })}
                          {r.reason && <> · “{r.reason}”</>}
                        </p>
                      </div>
                      <Badge tone={impact.tone} icon={impact.tone === 'red' ? AlertTriangle : undefined}>{impact.text}</Badge>
                      <div className="flex justify-end gap-1.5">
                        <ActionButton action={decideLeave} fields={{ recordId: r.id, decision: 'rejected' }} size="xs" variant="ghost">
                          <X className="size-3.5" /> Reject
                        </ActionButton>
                        <ActionButton action={decideLeave} fields={{ recordId: r.id, decision: 'approved' }} size="xs" variant={impact.tone === 'red' ? 'danger' : 'success'}>
                          <Check className="size-3.5" /> Approve
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

          </Card>
        </div>
      </div>
    </div>
  );
}

/** What approving a one-day request would do to that day's deliveries. */
function leaveImpact(
  request: { profile_id: string; leave_date: string },
  days: DayAvailability[],
  crew: CrewMember[],
  leaves: LeaveRecord[],
): { tone: Tone; text: string } {
  if (!crew.some((c) => c.id === request.profile_id)) return { tone: 'neutral', text: 'Not on the delivery rota' };
  const day = days.find((d) => d.date === request.leave_date);
  if (!day) return { tone: 'neutral', text: 'No impact' };
  if (day.status === 'closed') return { tone: 'neutral', text: 'Deliveries already closed that day' };

  const after = getDayAvailability(day.date, crew, [...leaves, { profile_id: request.profile_id, leave_date: request.leave_date }], day.deliveryCount);
  if (after.status !== 'closed') return { tone: 'green', text: 'Team still covered' };

  const missing = !after.hasDriver ? 'driver' : 'assembler';
  const toMove = day.deliveryCount ? ` · ${day.deliveryCount} deliver${day.deliveryCount > 1 ? 'ies' : 'y'} to move` : '';
  return { tone: 'red', text: `Closes the day: no ${missing} left${toMove}` };
}

function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
