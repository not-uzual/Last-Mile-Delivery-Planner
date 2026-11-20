'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';

export async function updateDeliveryStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['crew']);
  const deliveryId = String(formData.get('deliveryId'));
  const status = String(formData.get('status'));
  const reason = String(formData.get('reason') ?? '').trim();

  if (status !== 'delivered' && status !== 'failed') return { ok: false, error: 'Invalid status.' };
  if (status === 'failed' && !reason) return { ok: false, error: 'Add a short reason so ops can rebook it.' };

  const { data: delivery } = await supabase.from('deliveries').select('id, status, order_id').eq('id', deliveryId).single();
  if (!delivery) return { ok: false, error: 'Delivery not found.' };
  if (delivery.status !== 'scheduled') return { ok: false, error: 'This delivery was already marked.' };

  const { error } = await supabase
    .from('deliveries')
    .update({ status, failure_reason: status === 'failed' ? reason : null })
    .eq('id', deliveryId);
  if (error) return { ok: false, error: error.message };

  // Delivered closes the order. Failed puts it back in the ops queue as
  // 'unplanned' so it gets a new date; the failed delivery row stays as history.
  await supabase
    .from('orders')
    .update({ status: status === 'delivered' ? 'delivered' : 'unplanned' })
    .eq('id', delivery.order_id);

  revalidatePath('/crew');
  revalidatePath('/ops');
  return { ok: true };
}
