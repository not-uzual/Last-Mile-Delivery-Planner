'use client';

import { getCalendarData } from '@/actions/ops';
import { useEffect, useState } from 'react';

type CalendarDay = {
  date: string;
  status: string;
  deliveryCount: number;
  driversAvailable: number;
  assemblersAvailable: number;
};

export default function OpsCalendar() {
  const [calendar, setCalendar] = useState<CalendarDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCalendar() {
      const today = new Date();
      const dates = Array.from({ length: 14 }).map((_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return date.toISOString().split('T')[0];
      });

      try {
        const { team, leaves, deliveries } = await getCalendarData(dates);
        const days = dates.map((date) => {
          const dayOfWeek = new Date(date).getDay();
          let driversAvailable = 0;
          let assemblersAvailable = 0;

          team.forEach((member) => {
            const isOnLeave = leaves.some(
              (leave) => leave.profile_id === member.id && leave.leave_date === date,
            );
            const isOffDay = member.weekly_off_day === dayOfWeek;

            if (!isOnLeave && !isOffDay) {
              if (member.crew_role === 'driver') driversAvailable++;
              if (member.crew_role === 'assembler') assemblersAvailable++;
            }
          });

          const isClosed = driversAvailable === 0 || assemblersAvailable === 0;
          const deliveryCount = deliveries.filter(
            (delivery) => delivery.scheduled_date === date,
          ).length;
          const isLocked = deliveryCount >= 4;

          let status = 'Open';
          if (isClosed) status = 'Closed';
          else if (isLocked) status = 'Locked';

          return { date, status, deliveryCount, driversAvailable, assemblersAvailable };
        });

        setCalendar(days);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the calendar.');
      }
    }

    void loadCalendar();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">14-Day Delivery Calendar</h1>
      {error ? (
        <p className="text-red-600" role="alert">{error}</p>
      ) : calendar ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {calendar.map((day) => (
            <div
              key={day.date}
              className={`p-4 rounded-lg border shadow-sm flex flex-col items-center
                ${day.status === 'Closed' ? 'bg-red-50 border-red-200' :
                  day.status === 'Locked' ? 'bg-orange-50 border-orange-200' : 'bg-white border-green-200'}`}
            >
              <span className="text-sm text-gray-500 font-medium">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className={`mt-2 text-lg font-bold
                ${day.status === 'Closed' ? 'text-red-600' : day.status === 'Locked' ? 'text-orange-600' : 'text-green-600'}
              `}>
                {day.status}
              </span>
              <span className="text-xs text-gray-400 mt-1">{day.deliveryCount}/4 Deliveries</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600" role="status">Loading delivery calendar...</p>
      )}
    </div>
  );
}
