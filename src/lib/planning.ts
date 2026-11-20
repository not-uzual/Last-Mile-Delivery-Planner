import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getDayAvailability, type CrewMember, type DayAvailability, type LeaveRecord } from './availability';

type DB = SupabaseClient<Database>;

/** Loads crew, leave and delivery counts and works out the status of each date. */
export async function loadAvailability(supabase: DB, dates: string[]) {
  const [crewRes, leaveRes, deliveryRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, crew_role, weekly_off_day')
      .eq('app_role', 'crew')
      .order('crew_role')
      .order('full_name'),
    // Approved leave changes availability; pending requests are only shown as hints.
    supabase.from('leave_records').select('profile_id, leave_date, status').in('leave_date', dates).neq('status', 'rejected'),
    supabase
      .from('deliveries')
      .select('scheduled_date')
      .in('scheduled_date', dates)
      .neq('status', 'failed'), // a failed delivery no longer takes up a slot
  ]);
  if (crewRes.error) throw crewRes.error;
  if (leaveRes.error) throw leaveRes.error;
  if (deliveryRes.error) throw deliveryRes.error;

  const crew = crewRes.data as CrewMember[];
  const leaves: LeaveRecord[] = leaveRes.data.filter((l) => l.status === 'approved');
  const pendingLeaves: LeaveRecord[] = leaveRes.data.filter((l) => l.status === 'pending');
  const counts = new Map<string, number>();
  for (const d of deliveryRes.data) counts.set(d.scheduled_date, (counts.get(d.scheduled_date) ?? 0) + 1);

  const days: DayAvailability[] = dates.map((date) =>
    getDayAvailability(date, crew, leaves, counts.get(date) ?? 0),
  );
  return { crew, leaves, pendingLeaves, days };
}

export async function getCurrentProfile(supabase: DB) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, app_role, crew_role')
    .eq('id', user.id)
    .maybeSingle();
  return data;
}
