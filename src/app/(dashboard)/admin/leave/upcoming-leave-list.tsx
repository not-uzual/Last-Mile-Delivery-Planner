'use client';

import { removeLeave } from '@/actions/admin';
import { startTransition, useEffect, useState } from 'react';

export type UpcomingLeaveRecord = {
  id: string;
  leave_date: string;
  profiles: { full_name: string } | null;
};

export default function UpcomingLeaveList({
  leaves,
}: {
  leaves: UpcomingLeaveRecord[] | null;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    startTransition(() => {
      setNow(Date.now());
    });
  }, []);

  const today = now === null ? null : new Date(now).toISOString().split('T')[0];
  const upcomingLeaves = today === null
    ? null
    : (leaves ?? []).filter((leave) => leave.leave_date >= today);

  return (
    <div className="bg-white shadow rounded-lg p-6 col-span-1 md:col-span-2">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Leave</h2>
      {upcomingLeaves === null ? (
        <p className="text-gray-500 text-sm">Loading upcoming leave...</p>
      ) : upcomingLeaves.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {upcomingLeaves.map((leave) => (
            <li key={leave.id} className="py-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{leave.profiles?.full_name}</p>
                <p className="text-sm text-gray-500">{new Date(leave.leave_date).toLocaleDateString()}</p>
              </div>
              <form action={removeLeave}>
                <input type="hidden" name="recordId" value={leave.id} />
                <button type="submit" className="text-red-600 hover:text-red-900 text-sm font-medium">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-sm">No upcoming leave scheduled.</p>
      )}
    </div>
  );
}
