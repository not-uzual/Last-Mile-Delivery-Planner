'use client';

import { useActionState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { updateWeeklyOff } from '@/actions/team';
import type { ActionResult } from '@/actions/types';
import { WEEKDAYS } from '@/lib/dates';

/** Saves as soon as a new day is picked. */
export default function WeeklyOffSelect({ id, value }: { id: string; value: number | null }) {
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<ActionResult, FormData>((_p, fd) => updateWeeklyOff(fd), null);
  return (
    <div className="flex items-center gap-2">
      <select
        name="offDay"
        defaultValue={value ?? ''}
        aria-label="Weekly day off"
        onChange={(e) => {
          const fd = new FormData();
          fd.set('id', id);
          fd.set('offDay', e.target.value);
          startTransition(() => action(fd));
        }}
        className="h-8 rounded-md border-0 bg-white py-0 pl-2.5 pr-8 text-xs text-zinc-800 ring-1 ring-inset ring-zinc-200 focus:ring-2 focus:ring-zinc-900"
      >
        <option value="">No off day</option>
        {WEEKDAYS.map((d, i) => (
          <option key={d} value={i}>{d}</option>
        ))}
      </select>
      <span className="w-4">
        {pending ? <Loader2 className="size-3.5 animate-spin text-zinc-400" /> : state?.ok ? <Check className="size-3.5 text-emerald-600" /> : null}
      </span>
      {state && !state.ok && <span className="text-[11px] text-rose-600">{state.error}</span>}
    </div>
  );
}
