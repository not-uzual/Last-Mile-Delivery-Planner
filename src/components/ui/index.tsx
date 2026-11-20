import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'brand';

const TONES: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
  className,
  title,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden />}
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const colors: Record<Tone, string> = {
    neutral: 'bg-zinc-400',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    blue: 'bg-sky-500',
    violet: 'bg-violet-500',
    brand: 'bg-brand-500',
  };
  return <span className={cn('inline-block size-1.5 shrink-0 rounded-full', colors[tone])} aria-hidden />;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const iconTone: Record<Tone, string> = {
    neutral: 'text-zinc-500 bg-zinc-100',
    green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-rose-600 bg-rose-50',
    blue: 'text-sky-600 bg-sky-50',
    violet: 'text-violet-600 bg-violet-50',
    brand: 'text-brand-600 bg-brand-50',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <span className={cn('grid size-7 place-items-center rounded-md', iconTone[tone])}>
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {children && <p className="mt-1 max-w-xs text-xs text-zinc-500">{children}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-zinc-200/70', className)} />;
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function buttonClass(variant: ButtonVariant = 'secondary', size: 'xs' | 'sm' | 'md' | 'lg' = 'sm') {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
    secondary: 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-xs',
    ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
    danger: 'bg-white text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  };
  const sizes = {
    xs: 'h-6 px-2 text-[11px] gap-1 rounded-md',
    sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
    md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
    lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  };
  return cn(
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:pointer-events-none disabled:opacity-40',
    variants[variant],
    sizes[size],
  );
}

export const inputClass =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 focus:outline-none';
