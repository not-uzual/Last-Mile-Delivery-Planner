'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';
import { addDays, dayOfWeek, formatDate, todayISO } from '@/lib/dates';

/** How far ahead people can ask for a day off. */
const MAX_DAYS_AHEAD = 90;

function refresh() {
  revalidatePath('/admin');
  revalidatePath('/ops');
  revalidatePath('/crew');
}

/** Crew and ops ask for ONE day off. It does nothing to availability until admin approves it. */
export async function requestLeave(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await withRole(['ops', 'crew']);
  const date = String(formData.get('date') ?? '');
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200) || null;
  const today = todayISO();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Pick a date.' };
  if (date <= today) return { ok: false, error: 'Ask at least a day ahead.' };
  if (date > addDays(today, MAX_DAYS_AHEAD)) return { ok: false, error: `You can ask up to ${MAX_DAYS_AHEAD} days ahead.` };

  const { data: me } = await supabase.from('profiles').select('weekly_off_day').eq('id', profile.id).single();
  if (me?.weekly_off_day === dayOfWeek(date)) return { ok: false, error: 'That is already your weekly day off.' };

  const { data: existing } = await supabase
    .from('leave_records')
    .select('status')
    .eq('profile_id', profile.id)
    .eq('leave_date', date)
    .neq('status', 'rejected')
    .maybeSingle();
  if (existing) return { ok: false, error: existing.status === 'approved' ? 'You are already off that day.' : 'You already asked for that day.' };

  const { error } = await supabase.from('leave_records').insert({
    profile_id: profile.id,
    leave_date: date,
    status: 'pending',
    reason,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Request sent for ${formatDate(date)}` };
}

/** Withdraw your own request while it is still pending. */
export async function withdrawLeaveRequest(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await withRole(['ops', 'crew']);
  const { data, error } = await supabase
    .from('leave_records')
    .delete()
    .eq('id', String(formData.get('recordId')))
    .eq('profile_id', profile.id)
    .eq('status', 'pending')
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: 'This request was already decided.' };
  refresh();
  return { ok: true };
}

/** Admin approves or rejects a pending request. */
export async function decideLeave(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await withRole(['admin']);
  const decision = String(formData.get('decision'));
  if (decision !== 'approved' && decision !== 'rejected') return { ok: false, error: 'Invalid decision.' };

  const { data, error } = await supabase
    .from('leave_records')
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', String(formData.get('recordId')))
    .eq('status', 'pending') // never flip a decision that was already made
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: 'This request was withdrawn or already decided.' };
  refresh();
  return { ok: true };
}
