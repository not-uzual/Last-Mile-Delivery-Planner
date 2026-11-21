'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { withRole } from './guard';
import { createClient } from '@/lib/db/server';
import { SLOTS, type TimeSlot } from '@/lib/slots';

/**
 * Ops: returns the delivery's booking token, creating one the first time.
 * 16 random bytes (128 bits) in base64url → 22 characters, not guessable.
 */
export async function createBookingLink(deliveryId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { supabase } = await withRole(['ops']);

  const { data: delivery } = await supabase.from('deliveries').select('id, status, booking_token').eq('id', deliveryId).single();
  if (!delivery || delivery.status !== 'scheduled') return { ok: false, error: 'Delivery not found or already completed.' };
  if (delivery.booking_token) return { ok: true, token: delivery.booking_token };

  const token = randomBytes(16).toString('base64url');
  const { error } = await supabase.from('deliveries').update({ booking_token: token }).eq('id', deliveryId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/ops');
  return { ok: true, token };
}

/** Customer (no login): books a time window through the token-checked database function. */
export async function bookSlot(token: string, slot: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!SLOTS.some((s) => s.id === slot)) return { ok: false, error: 'Pick a time window.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('book_slot', { p_token: token, p_slot: slot as TimeSlot });
  if (error) return { ok: false, error: 'Something went wrong. Please try again.' };

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? 'Could not book this slot.' };

  revalidatePath(`/book/${token}`);
  revalidatePath('/ops');
  revalidatePath('/crew');
  return { ok: true };
}
