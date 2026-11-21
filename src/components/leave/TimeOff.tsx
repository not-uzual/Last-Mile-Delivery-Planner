import { CalendarOff, X } from 'lucide-react';
import { createClient } from '@/lib/db/server';
import { getCurrentProfile } from '@/lib/planning';
import { addDays, formatDate, todayISO } from '@/lib/dates';
import { withdrawLeaveRequest } from '@/actions/leave';
import { Badge, Card, CardHeader, type Tone } from '@/components/ui';
import ActionButton from '@/components/ui/ActionButton';
import RequestLeaveForm from './RequestLeaveForm';

const STATUS: Record<'pending' | 'approved' | 'rejected', { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for admin approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

/** "Time off" card for crew and ops: ask for a day off and follow your requests. */
export default async function TimeOff() {
  const supabase = await createClient();
  const today = todayISO();
  const profile = await getCurrentProfile(supabase);
  if (!profile) return null;

  const { data, error } = await supabase
    .from('leave_records')
    .select('id, leave_date, status, reason')
    .eq('profile_id', profile.id)
    .gte('leave_date', today)
    .order('leave_date');
  if (error) throw error;

  return (
    <Card>
      <CardHeader icon={CalendarOff} title="Request Leave" description="Ask for a one day off." />
      <RequestLeaveForm min={addDays(today, 1)} max={addDays(today, 90)} />
      {data.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatDate(l.leave_date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                {l.reason && <p className="truncate text-xs text-zinc-500">{l.reason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>
                {l.status === 'pending' && (
                  <ActionButton action={withdrawLeaveRequest} fields={{ recordId: l.id }} size="xs" variant="ghost" title="Withdraw request">
                    <X className="size-3.5" />
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
