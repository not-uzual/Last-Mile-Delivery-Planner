'use client';

import { useActionState, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { updateAssemblyStatus, updateDeliveryStatus } from '@/actions/crew';
import type { ActionResult } from '@/actions/types';
import { buttonClass, inputClass } from '@/components/ui';

/** The driver marks the drop-off; the assembler marks the assembly after it. */
const STEP = {
  delivery: {
    action: updateDeliveryStatus,
    done: 'delivered',
    doneLabel: 'Delivered',
    question: 'Why did the drop-off fail?',
    reasons: ['Customer not home', 'Item doesn’t fit', 'Access blocked', 'Item damaged', 'Customer refused'],
  },
  assembly: {
    action: updateAssemblyStatus,
    done: 'assembled',
    doneLabel: 'Assembled',
    question: 'Why couldn’t it be assembled?',
    reasons: ['Missing parts', 'Item damaged', 'Not enough room', 'Wrong tools', 'Customer asked to wait'],
  },
} as const;

export default function StopActions({ deliveryId, step }: { deliveryId: string; step: keyof typeof STEP }) {
  const { action: submit, done, doneLabel, question, reasons } = STEP[step];
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [state, action, pending] = useActionState<ActionResult, FormData>((_p, fd) => submit(fd), null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="deliveryId" value={deliveryId} />

      {failing ? (
        <div className="space-y-3 rounded-xl bg-rose-50 p-3 ring-1 ring-inset ring-rose-100">
          <p className="text-sm font-medium text-rose-900">{question}</p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${reason === r ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-rose-800 ring-rose-200'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Or type a reason…" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFailing(false)} className={buttonClass('secondary', 'lg')}>
              Back
            </button>
            <button type="submit" name="status" value="failed" disabled={pending || !reason.trim()} className={`${buttonClass('primary', 'lg')} bg-rose-600 hover:bg-rose-700`}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <X className="size-5" />} Mark failed
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button type="button" onClick={() => setFailing(true)} className={buttonClass('danger', 'lg')}>
            Failed
          </button>
          <button type="submit" name="status" value={done} disabled={pending} className={buttonClass('success', 'lg')}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} {doneLabel}
          </button>
        </div>
      )}

      {state && !state.ok && <p className="text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}
