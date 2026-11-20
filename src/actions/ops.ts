'use server';

import { createClient } from '@/lib/db/server';
import { revalidatePath } from 'next/cache';

export async function updateCallStatus(formData: FormData) {
  const deliveryId = formData.get('deliveryId') as string;
  const callType = formData.get('callType') as 'd4_call_status' | 'd1_call_status';
  const status = formData.get('status') as string;

  const supabase = await createClient();
  
  await supabase
    .from('deliveries')
    .update({ [callType]: status })
    .eq('id', deliveryId);

  revalidatePath('/ops/calls');
}

export async function scheduleOrder(formData: FormData) {
  const orderId = formData.get('orderId') as string;
  const scheduledDate = formData.get('scheduledDate') as string;
  const requiresPorter = formData.get('requiresPorter') === 'true';

  const supabase = await createClient();

  // 1. Create the delivery
  await supabase.from('deliveries').insert({
    order_id: orderId,
    scheduled_date: scheduledDate,
    requires_porter: requiresPorter,
    status: 'scheduled'
  });

  // 2. Update the order status
  await supabase.from('orders').update({ status: 'planned' }).eq('id', orderId);

  revalidatePath('/ops/planning');
  revalidatePath('/ops/calendar');
  revalidatePath('/ops/calls');
}

export async function getCalendarData(dates: string[]) {
  const supabase = await createClient();

  const [teamRes, leavesRes, deliveriesRes] = await Promise.all([
    supabase.from('profiles').select('id, crew_role, weekly_off_day').eq('app_role', 'crew'),
    supabase.from('leave_records').select('profile_id, leave_date').in('leave_date', dates),
    supabase.from('deliveries').select('scheduled_date, id').in('scheduled_date', dates),
  ]);

  if (teamRes.error) throw teamRes.error;
  if (leavesRes.error) throw leavesRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;

  return {
    team: teamRes.data,
    leaves: leavesRes.data,
    deliveries: deliveriesRes.data,
  };
}