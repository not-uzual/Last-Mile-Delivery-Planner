import { dayOfWeek } from './dates';

export const MAX_DELIVERIES_PER_DAY = 4;

export type CrewMember = {
  id: string;
  full_name: string;
  crew_role: 'driver' | 'assembler' | null;
  weekly_off_day: number | null;
};

export type LeaveRecord = { profile_id: string; leave_date: string };

export type OffReason = 'weekly-off' | 'leave';

export type DayStatus = 'open' | 'locked' | 'closed';

export type DayAvailability = {
  date: string;
  status: DayStatus;
  deliveryCount: number;
  onDuty: CrewMember[];
  off: { member: CrewMember; reason: OffReason }[];
  hasDriver: boolean;
  hasAssembler: boolean;
  /** Deliveries beyond what the day can take (all of them if the day is closed). */
  overflow: number;
};

export function offReason(member: CrewMember, date: string, leaves: LeaveRecord[]): OffReason | null {
  if (leaves.some((l) => l.profile_id === member.id && l.leave_date === date)) return 'leave';
  if (member.weekly_off_day === dayOfWeek(date)) return 'weekly-off';
  return null;
}

/**
 * A day is CLOSED when no driver or no assembler is working,
 * LOCKED when it already has 4 deliveries, otherwise OPEN.
 */
export function getDayAvailability(
  date: string,
  crew: CrewMember[],
  leaves: LeaveRecord[],
  deliveryCount: number,
): DayAvailability {
  const onDuty: CrewMember[] = [];
  const off: DayAvailability['off'] = [];
  for (const member of crew) {
    const reason = offReason(member, date, leaves);
    if (reason) off.push({ member, reason });
    else onDuty.push(member);
  }
  const hasDriver = onDuty.some((m) => m.crew_role === 'driver');
  const hasAssembler = onDuty.some((m) => m.crew_role === 'assembler');

  let status: DayStatus = 'open';
  if (!hasDriver || !hasAssembler) status = 'closed';
  else if (deliveryCount >= MAX_DELIVERIES_PER_DAY) status = 'locked';

  const capacity = status === 'closed' ? 0 : MAX_DELIVERIES_PER_DAY;
  return {
    date,
    status,
    deliveryCount,
    onDuty,
    off,
    hasDriver,
    hasAssembler,
    overflow: Math.max(0, deliveryCount - capacity),
  };
}

/** Nearest open day on or after `notBefore`, skipping `exclude` (e.g. the day being emptied). */
export function nearestOpenDay(days: DayAvailability[], notBefore: string, exclude?: string): string | null {
  return days.find((d) => d.date >= notBefore && d.date !== exclude && d.status === 'open')?.date ?? null;
}
