'use client';

import { useActionState, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, Smartphone, Route } from 'lucide-react';
import { login } from '@/actions/auth';
import { Logo } from '@/components/Logo';
import { buttonClass, inputClass } from '@/components/ui';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@test.com', blurb: 'Team & leave' },
  { role: 'Operations', email: 'ops@test.com', blurb: 'Plan & run the day' },
  { role: 'Crew (Driver)', email: 'driver@test.com', blurb: 'Mark deliveries' },
  { role: 'Crew (Assembler)', email: 'assembler@test.com', blurb: 'Assembles orders' }
];

export default function LoginPage() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(async (_prev: { error: string } | null, fd: FormData) => (await login(fd)) ?? null, null);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_520px]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <Logo inverted className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Every order, on the right day, through the right way.</h2>
          <ul className="mt-8 space-y-4 text-sm text-zinc-300">
            <li className="flex gap-3"><Smartphone className="size-5 shrink-0 text-brand-100" />Admin, Ops and Crew all at one place.</li>
            <li className="flex gap-3"><Route className="size-5 shrink-0 text-brand-100" />Maps, calendar, routing and arrival times in one view.</li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-brand-100" /> Lift and staircase checks before the pickup leaves.</li>
          </ul>
        </div>
        <p className="relative text-xs text-zinc-500">Demo environment · all data is synthatic</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Logo />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">Use your work account to continue.</p>

          <form action={action} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Email</span>
              <input ref={emailRef} type="email" name="email" autoComplete="email" required className={`${inputClass} mt-1.5 h-10`} />
            </label>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Password</label>
              <div className="relative mt-1.5">
                <input id="password" ref={passwordRef} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required className={`${inputClass} h-10 pr-10`} />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-700"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            </div>
            {state?.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{state.error}</p>}
            <button type="submit" disabled={pending} className={`${buttonClass('primary', 'md')} h-10 w-full`}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <>Continue <ArrowRight className="size-4" /></>}
            </button>
          </form>

          <div className="mt-10">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Demo accounts</p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    if (emailRef.current) emailRef.current.value = a.email;
                    if (passwordRef.current) passwordRef.current.value = 'pswd123';
                  }}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-left ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
                >
                  <span>
                    <span className="block text-sm font-medium">{a.role}</span>
                    <span className="block text-xs text-zinc-500">{a.email}</span>
                  </span>
                  <span className="text-xs text-zinc-400">{a.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
