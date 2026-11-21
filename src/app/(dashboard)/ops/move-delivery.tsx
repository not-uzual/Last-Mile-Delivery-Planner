'use client';

import { useActionState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { rescheduleDelivery } from '@/actions/ops';
import type { ActionResult } from '@/actions/types';
import { buttonClass } from '@/components/ui';

export default function MoveDelivery({
  deliveryId,
  options,
  suggested,
}: {
  deliveryId: string;
  options: { date: string; label: string }[];
  suggested?: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>((_p, fd) => rescheduleDelivery(fd), null);
  if (options.length === 0) return <span className="text-[11px] text-zinc-400">No open day to move to</span>;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <div className="flex items-center gap-1">
        <select
          name="date"
          defaultValue={suggested ?? options[0].date}
          aria-label="Move to day"
          className="h-6 rounded-md border-0 bg-white py-0 pl-2 pr-6 text-[11px] text-zinc-700 ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-zinc-900"
        >
          {options.map((o) => (
            <option key={o.date} value={o.date}>
              {o.label}
              {o.date === suggested ? ' (nearest)' : ''}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={buttonClass('secondary', 'xs')}>
          {pending ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
          Move
        </button>
      </div>
      {state && !state.ok && <p className="text-[11px] text-rose-600">{state.error}</p>}
    </form>
  );
}
