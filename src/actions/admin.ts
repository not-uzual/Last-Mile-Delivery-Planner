'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';
import { todayISO } from '@/lib/dates';

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/ops');
}

export async function updateWeeklyOff(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['admin']);
  const id = String(formData.get('id'));
  const raw = String(formData.get('offDay'));
  const offDay = raw === '' ? null : Number(raw);
  if (offDay !== null && !(offDay >= 0 && offDay <= 6)) return { ok: false, error: 'Invalid day.' };

  const { error } = await supabase.from('profiles').update({ weekly_off_day: offDay }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function addLeave(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['admin']);
  const profileId = String(formData.get('profileId'));
  const from = String(formData.get('from'));
  const to = String(formData.get('to') || from);

  if (!from) return { ok: false, error: 'Pick a start date.' };
  if (from < todayISO()) return { ok: false, error: 'Leave cannot start in the past.' };
  if (to < from) return { ok: false, error: 'End date is before start date.' };

  const dates: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
    if (dates.length > 60) return { ok: false, error: 'Leave longer than 60 days – split it up.' };
  }

  const { error } = await supabase
    .from('leave_records')
    .upsert(dates.map((leave_date) => ({ profile_id: profileId, leave_date })), {
      onConflict: 'profile_id,leave_date',
      ignoreDuplicates: true,
    });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: dates.length === 1 ? 'Leave booked' : `${dates.length} days booked` };
}

export async function removeLeave(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['admin']);
  const { error } = await supabase.from('leave_records').delete().eq('id', String(formData.get('recordId')));
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
