import { Suspense } from 'react';
import { createClient } from '@/lib/db/server';
import { getCurrentProfile } from '@/lib/planning';
import LogoutButton from './LogoutButton';
import { Logo } from './Logo';

const ROLE_LABEL = { admin: 'Admin', ops: 'Operations', crew: 'Crew' } as const;

async function UserChip() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile) return null;
  const initials = profile.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium leading-tight text-zinc-900">{profile.full_name}</p>
        <p className="text-[11px] capitalize leading-tight text-zinc-500">{profile.crew_role ?? ROLE_LABEL[profile.app_role]}</p>
      </div>
      <span className="grid size-8 place-items-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{initials}</span>
      <LogoutButton />
    </div>
  );
}

export default function AppShell({
  role,
  children,
  width = 'wide',
}: {
  role: keyof typeof ROLE_LABEL;
  children: React.ReactNode;
  width?: 'wide' | 'narrow';
}) {
  const container = width === 'wide' ? 'max-w-[1440px]' : 'max-w-xl';
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-[1100] border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6 ${container}`}>
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-5 w-px bg-zinc-200 sm:block" />
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{ROLE_LABEL[role]}</span>
          </div>
          <Suspense fallback={<span className="size-8 rounded-full bg-zinc-100" />}>
            <UserChip />
          </Suspense>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 sm:px-6 ${container}`}>{children}</main>
    </div>
  );
}
