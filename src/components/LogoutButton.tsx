'use client';

import { logout } from '@/actions/auth';

export default function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
    >
      Log out
    </button>
  );
}