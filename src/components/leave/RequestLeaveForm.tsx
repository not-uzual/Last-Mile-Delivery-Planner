'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { requestLeave } from '@/actions/leave';
import type { ActionResult } from '@/actions/types';
import { buttonClass, inputClass } from '@/components/ui';

/** One day off per request, from tomorrow onwards. */
export default function RequestLeaveForm({ min, max }: { min: string; max: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult, FormData>((_p, fd) => requestLeave(fd), null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Day</span>
          <input type="date" name="date" min={min} max={max} defaultValue={min} required className={`${inputClass} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Reason <span className="font-normal text-zinc-400">(mendatory)</span></span>
          <input name="reason" maxLength={200} placeholder="e.g. doctor’s appointment" className={`${inputClass} mt-1`} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${buttonClass('primary', 'md')} w-full`}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Request day off
      </button>
      {state && (
        <p className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-rose-600'}`} role="status">
          {state.ok ? state.message : state.error}
        </p>
      )}
    </form>
  );
}
