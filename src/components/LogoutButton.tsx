'use client';

import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/actions/auth';
import { buttonClass } from './ui';

export default function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => logout())}
      disabled={pending}
      className={buttonClass('ghost', 'sm')}
      title="Log out"
    >
      <LogOut className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
