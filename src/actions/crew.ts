'use server';

import { createClient } from '@/lib/db/server';
import { revalidatePath } from 'next/cache';

export async function updateDeliveryStatus(formData: FormData) {
  const deliveryId = formData.get('deliveryId') as string;
  const orderId = formData.get('orderId') as string;
  const status = formData.get('status') as 'completed' | 'failed';
  const notes = formData.get('notes') as string;

  const supabase = await createClient();

  // 1. Update the delivery record
  await supabase.from('deliveries').update({ 
    status: status,
    notes: notes 
  }).eq('id', deliveryId);

  // 2. Update the parent order status based on the delivery outcome
  const orderStatus = status === 'completed' ? 'delivered' : 'delivery_failed';
  await supabase.from('orders').update({ status: orderStatus }).eq('id', orderId);

  // 3. Refresh the crew view and ops dashboards
  revalidatePath('/crew');
  revalidatePath('/ops/planning');
}