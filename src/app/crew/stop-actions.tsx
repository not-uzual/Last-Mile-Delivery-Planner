'use client';

import { useActionState, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { updateDeliveryStatus } from '@/actions/crew';
import type { ActionResult } from '@/actions/types';
import { buttonClass, inputClass } from '@/components/ui';

const REASONS = ['Customer not home', 'Item doesn’t fit', 'Access blocked', 'Item damaged', 'Customer refused'];

export default function StopActions({ deliveryId, crewRole }: { deliveryId: string; crewRole: 'driver' | 'assembler' | null }) {
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState('');
  const [state, action, pending] = useActionState<ActionResult, FormData>((_p, fd) => updateDeliveryStatus(fd), null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="deliveryId" value={deliveryId} />

      {failing ? (
        <div className="space-y-3 rounded-xl bg-rose-50 p-3 ring-1 ring-inset ring-rose-100">
          <p className="text-sm font-medium text-rose-900">Why did it fail?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
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
          <input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason…" className={inputClass} />
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
          <button type="submit" name="status" value="delivered" disabled={pending} className={buttonClass('success', 'lg')}>
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} {crewRole === 'assembler' ? 'Assembled' : 'Delivered'}
          </button>
        </div>
      )}

      {state && !state.ok && <p className="text-sm text-rose-600">{state.error}</p>}
    </form>
  );
}
