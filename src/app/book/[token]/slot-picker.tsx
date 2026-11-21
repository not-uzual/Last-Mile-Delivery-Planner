'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { bookSlot } from '@/actions/booking';
import { SLOTS, SLOT_BY_ID, SLOT_CAPACITY, type TimeSlot } from '@/lib/slots';
import { buttonClass } from '@/components/ui';
import { cn } from '@/lib/utils';

type Result = { ok: true } | { ok: false; error: string } | null;

export default function SlotPicker({
  token,
  current,
  taken,
  status,
  scheduledDate,
}: {
  token: string;
  current: TimeSlot | null;
  taken: Partial<Record<TimeSlot, number>>;
  status: 'scheduled' | 'delivered' | 'failed';
  scheduledDate: string;
}) {
  const [selected, setSelected] = useState<TimeSlot | null>(current);
  const [editing, setEditing] = useState(current === null);
  const [state, action, pending] = useActionState<Result, FormData>(async (_p, fd) => {
    const res = await bookSlot(token, String(fd.get('slot')));
    if (res.ok) setEditing(false);
    return res;
  }, null);

  // Customers can change online until the day before delivery (the server enforces this too).
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const locked = status !== 'scheduled' || scheduledDate <= today;

  if (!editing && current) {
    const slot = SLOT_BY_ID[current];
    return (
      <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">You’re booked</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              {slot.label}, {slot.window}
            </p>
          </div>
          {!locked && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-emerald-800 underline underline-offset-2">
              Change
            </button>
          )}
        </div>
      </div>
    );
  }

  if (locked) {
    return <p className="rounded-xl bg-white p-5 text-sm text-zinc-600 ring-1 ring-zinc-200">This delivery can no longer be changed online. Please call us if you need help.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-zinc-900">Pick a time window</legend>
        {SLOTS.map((s) => {
          const full = (taken[s.id] ?? 0) >= SLOT_CAPACITY;
          const isSelected = selected === s.id;
          return (
            <label
              key={s.id}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-xl bg-white p-4 ring-1 ring-inset transition',
                isSelected ? 'ring-2 ring-zinc-900' : 'ring-zinc-200 hover:ring-zinc-300',
                full && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="slot" value={s.id} disabled={full} checked={isSelected} onChange={() => setSelected(s.id)} className="size-4 accent-zinc-900" />
                <span>
                  <span className="block text-sm font-semibold">{s.label}</span>
                  <span className="block text-sm tabular-nums text-zinc-500">{s.window}</span>
                </span>
              </span>
              <span className={cn('text-xs font-medium', full ? 'text-rose-600' : 'text-emerald-700')}>{full ? 'Full' : 'Available'}</span>
            </label>
          );
        })}
      </fieldset>

      {state && !state.ok && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}

      <button type="submit" disabled={!selected || pending} className={cn(buttonClass('primary', 'lg'), 'w-full')}>
        {pending && <Loader2 className="size-5 animate-spin" />}
        Confirm time
      </button>
    </form>
  );
}
