'use server';

import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import type { ActionResult } from './types';
import { loadAvailability } from '@/lib/planning';
import { formatDate, todayISO } from '@/lib/dates';
import { orderHandling } from '@/lib/utils';

const CALL_COLUMNS = { d4: 'd4_call_status', d1: 'd1_call_status' } as const;
const CALL_STATUSES = ['pending', 'confirmed', 'unreachable'] as const;

function refresh() {
  revalidatePath('/ops');
  revalidatePath('/crew');
}

/** Checks a date can take one more delivery: not in the past, not before the order is ready, team working, < 4 booked. */
async function checkDayAccepts(
  supabase: Awaited<ReturnType<typeof withRole>>['supabase'],
  date: string,
  readyDate: string,
): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Pick a valid date.';
  if (date < todayISO()) return 'That date is in the past.';
  if (date < readyDate) return `The order is not ready until ${formatDate(readyDate)}.`;

  const { days } = await loadAvailability(supabase, [date]);
  const day = days[0];
  if (day.status === 'closed') return `${formatDate(date)} is closed – no driver or assembler working.`;
  if (day.status === 'locked') return `${formatDate(date)} already has 4 deliveries.`;
  return null;
}

export async function updateCallStatus(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['ops']);
  const deliveryId = String(formData.get('deliveryId'));
  const column = CALL_COLUMNS[String(formData.get('call')) as keyof typeof CALL_COLUMNS];
  const status = String(formData.get('status')) as (typeof CALL_STATUSES)[number];
  if (!column || !CALL_STATUSES.includes(status)) return { ok: false, error: 'Invalid call outcome.' };

  const patch = column === 'd4_call_status' ? { d4_call_status: status } : { d1_call_status: status };
  const { error } = await supabase.from('deliveries').update(patch).eq('id', deliveryId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function scheduleOrder(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['ops']);
  const orderId = String(formData.get('orderId'));
  const date = String(formData.get('date'));

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, ready_date, customers(lift_length, lift_width, lift_height, has_staircase_only), order_items(length, width, height, weight)')
    .eq('id', orderId)
    .single();
  if (orderError || !order) return { ok: false, error: 'Order not found.' };
  if (order.status !== 'unplanned') return { ok: false, error: 'This order is already planned.' };

  const problem = await checkDayAccepts(supabase, date, order.ready_date);
  if (problem) return { ok: false, error: problem };

  const handling = order.customers ? orderHandling(order.order_items, order.customers) : 'lift';

  const { error } = await supabase.from('deliveries').insert({
    order_id: orderId,
    scheduled_date: date,
    requires_porter: handling !== 'lift',
    status: 'scheduled',
  });
  if (error) return { ok: false, error: error.message };

  await supabase.from('orders').update({ status: 'planned' }).eq('id', orderId);
  refresh();
  return { ok: true, message: `Scheduled for ${formatDate(date)}` };
}

export async function rescheduleDelivery(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['ops']);
  const deliveryId = String(formData.get('deliveryId'));
  const date = String(formData.get('date'));

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status, scheduled_date, orders(ready_date)')
    .eq('id', deliveryId)
    .single();
  if (!delivery || delivery.status !== 'scheduled') return { ok: false, error: 'Only scheduled deliveries can be moved.' };
  if (delivery.scheduled_date === date) return { ok: false, error: 'Already on that day.' };

  const problem = await checkDayAccepts(supabase, date, delivery.orders?.ready_date ?? date);
  if (problem) return { ok: false, error: problem };

  // A new date means the customer has to agree the slot again (the same booking link keeps working).
  const { error } = await supabase
    .from('deliveries')
    .update({ scheduled_date: date, d4_call_status: 'pending', d1_call_status: 'pending', time_slot: null, slot_booked_at: null, sequence_order: null, trip_number: null })
    .eq('id', deliveryId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Moved to ${formatDate(date)}` };
}

export async function unassignDelivery(formData: FormData): Promise<ActionResult> {
  const { supabase } = await withRole(['ops']);
  const deliveryId = String(formData.get('deliveryId'));

  const { data: delivery } = await supabase.from('deliveries').select('id, status, order_id').eq('id', deliveryId).single();
  if (!delivery || delivery.status !== 'scheduled') return { ok: false, error: 'Only scheduled deliveries can be removed.' };

  const { error } = await supabase.from('deliveries').delete().eq('id', deliveryId);
  if (error) return { ok: false, error: error.message };
  await supabase.from('orders').update({ status: 'unplanned' }).eq('id', delivery.order_id);
  refresh();
  return { ok: true };
}
