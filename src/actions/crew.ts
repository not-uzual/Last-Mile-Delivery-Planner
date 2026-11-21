'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';

function refresh() {
  revalidatePath('/crew');
  revalidatePath('/ops');
}

/** Driver: the drop-off happened (delivered) or didn't (failed + reason). */
export async function updateDeliveryStatus(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await withRole(['crew']);
  if (profile.crew_role !== 'driver') return { ok: false, error: 'Only the driver marks the drop-off.' };

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
    .eq('id', deliveryId)
    .eq('status', 'scheduled');
  if (error) return { ok: false, error: error.message };

  // Delivered closes the order. Failed puts it back in the ops queue as
  // 'unplanned' so it gets a new date; the failed delivery row stays as history.
  await supabase
    .from('orders')
    .update({ status: status === 'delivered' ? 'delivered' : 'unplanned' })
    .eq('id', delivery.order_id);

  refresh();
  return { ok: true };
}

/**
 * Assembler: after the drop-off, assembled or failed (+ note).
 * A failed assembly stays in the assembler's queue with its note until it is marked assembled.
 */
export async function updateAssemblyStatus(formData: FormData): Promise<ActionResult> {
  const { supabase, profile } = await withRole(['crew']);
  if (profile.crew_role !== 'assembler') return { ok: false, error: 'Only an assembler marks assembly.' };

  const deliveryId = String(formData.get('deliveryId'));
  const status = String(formData.get('status'));
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 200);

  if (status !== 'assembled' && status !== 'failed') return { ok: false, error: 'Invalid status.' };
  if (status === 'failed' && !reason) return { ok: false, error: 'Add a short note so you know what to fix next time.' };

  const { data, error } = await supabase
    .from('deliveries')
    .update({
      assembly_status: status,
      assembly_note: status === 'failed' ? reason : null,
      assembled_at: status === 'assembled' ? new Date().toISOString() : null,
    })
    .eq('id', deliveryId)
    .eq('status', 'delivered') // nothing to assemble before the drop-off
    .neq('assembly_status', 'assembled') // done is done
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data.length) return { ok: false, error: 'Not dropped off yet, or already assembled.' };

  refresh();
  return { ok: true };
}
