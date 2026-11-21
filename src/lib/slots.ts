import type { Database } from '@/types/database.types';

export type TimeSlot = Database['public']['Enums']['delivery_slot_type'];

/** Max deliveries per time window per day. Keep in sync with slot_capacity() in the booking migration. */
export const SLOT_CAPACITY = 2;

export const SLOTS: { id: TimeSlot; label: string; window: string; startMinutes: number }[] = [
  { id: 'morning', label: 'Morning', window: '09:00 – 12:00', startMinutes: 9 * 60 },
  { id: 'midday', label: 'Midday', window: '12:00 – 15:00', startMinutes: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', window: '15:00 – 18:00', startMinutes: 15 * 60 },
];

export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s])) as Record<TimeSlot, (typeof SLOTS)[number]>;

/** Route order: booked windows earliest first, unbooked stops after them, then by when they were planned. */
export function compareBySlot(a: { time_slot: TimeSlot | null }, b: { time_slot: TimeSlot | null }) {
  const rank = (s: TimeSlot | null) => (s ? SLOTS.findIndex((x) => x.id === s) : SLOTS.length);
  return rank(a.time_slot) - rank(b.time_slot);
}
