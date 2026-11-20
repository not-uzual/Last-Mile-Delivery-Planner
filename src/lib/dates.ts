// All planning happens in the depot's local time zone, never the server's
// (Vercel runs in UTC) or the browser's. Dates are passed around as
// 'YYYY-MM-DD' strings, which match Postgres DATE columns exactly.
export const BUSINESS_TZ = 'Europe/London';

export function todayISO(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date());
}

function toUTCDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, same convention as profiles.weekly_off_day */
export function dayOfWeek(iso: string): number {
  return toUTCDate(iso).getUTCDay();
}

export function nextDays(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return toUTCDate(iso).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

export function relativeDay(iso: string, today: string): string {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  return formatDate(iso);
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
