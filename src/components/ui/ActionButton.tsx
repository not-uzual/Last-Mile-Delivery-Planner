'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ActionResult } from '@/actions/types';
import { buttonClass, type ButtonVariant } from './index';
import { cn } from '@/lib/utils';

/**
 * A one-click form around a server action. Shows a spinner while it runs and
 * the action's error message (e.g. "day already has 4 deliveries") if it fails.
 */
export default function ActionButton({
  action,
  fields,
  children,
  variant = 'secondary',
  size = 'sm',
  disabled,
  title,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>((_prev, fd) => action(fd), null);

  return (
    <form action={formAction} className={cn('inline-flex flex-col items-end', className)}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={disabled || pending} title={title} className={cn(buttonClass(variant, size), className && 'w-full')}>
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {children}
      </button>
      {state && !state.ok && (
        <p role="alert" className="mt-1 max-w-56 text-right text-[11px] leading-tight text-rose-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
