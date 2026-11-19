'use server';

import { createClient } from '@/lib/db/server';
import { revalidatePath } from 'next/cache';

export async function updateWeeklyOff(formData: FormData) {
  const id = formData.get('id') as string;
  const offDay = parseInt(formData.get('offDay') as string, 10);
  
  const supabase = await createClient();
  await supabase.from('profiles').update({ weekly_off_day: offDay }).eq('id', id);
  
  revalidatePath('/admin/team'); // Refreshes the page data
}

export async function addLeave(formData: FormData) {
  const profileId = formData.get('profileId') as string;
  const leaveDate = formData.get('leaveDate') as string;
  
  const supabase = await createClient();
  await supabase.from('leave_records').insert({ 
    profile_id: profileId, 
    leave_date: leaveDate 
  });
  
  revalidatePath('/admin/leave');
}

export async function removeLeave(formData: FormData) {
  const recordId = formData.get('recordId') as string;
  
  const supabase = await createClient();
  await supabase.from('leave_records').delete().eq('id', recordId);
  
  revalidatePath('/admin/leave');
}