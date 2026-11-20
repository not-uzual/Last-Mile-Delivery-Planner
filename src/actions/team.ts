'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';

/** Admin sets a team member's fixed weekly day off (0 = Sun … 6 = Sat, empty = none). */
export async function updateWeeklyOff(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['admin']);
  const id = String(formData.get('id'));
  const raw = String(formData.get('offDay'));
  const offDay = raw === '' ? null : Number(raw);
  if (offDay !== null && !(offDay >= 0 && offDay <= 6)) return { ok: false, error: 'Invalid day.' };

  // Admin has no weekly day off (not on the rota), so only non-admin rows are updated.
  const { error } = await supabase.from('profiles').update({ weekly_off_day: offDay }).eq('id', id).neq('app_role', 'admin');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  revalidatePath('/ops');
  revalidatePath('/crew');
  return { ok: true };
}
