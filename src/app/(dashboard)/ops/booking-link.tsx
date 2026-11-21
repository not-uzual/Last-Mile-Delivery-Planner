'use client';

import { useState, useTransition } from 'react';
import { Check, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { createBookingLink } from '@/actions/booking';
import { buttonClass } from '@/components/ui';

/**
 * D-4: instead of phoning to agree a slot, ops sends the customer a link.
 * Click → create (or reuse) the token, copy the URL to the clipboard, show an "open" button.
 */
export default function BookingLink({ deliveryId, token: initialToken }: { deliveryId: string; token: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const urlFor = (t: string) => `${window.location.origin}/book/${t}`;

  function copyLink() {
    setError(null);
    startTransition(async () => {
      let t = token;
      if (!t) {
        const res = await createBookingLink(deliveryId);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        t = res.token;
        setToken(t);
      }
      try {
        await navigator.clipboard.writeText(urlFor(t));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard can be blocked (e.g. insecure origin); the open button still works.
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={copyLink}
          disabled={pending}
          className={buttonClass('secondary', 'xs')}
          title={token ? 'Copy the booking link again' : 'Create a booking link and copy it'}
          aria-label="Copy booking link"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : copied ? <Check className="size-3 text-emerald-600" /> : <Link2 className="size-3" />}
          {copied ? 'Copied' : token ? 'Copy link' : 'Get link'}
        </button>
        {token && (
          <a href={`/book/${token}`} target="_blank" rel="noopener noreferrer" className={buttonClass('ghost', 'xs')} title="Open the customer page" aria-label="Open booking page">
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
