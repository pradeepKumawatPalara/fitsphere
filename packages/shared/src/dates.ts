// IST days (invariant #5, REQ-DATE-004). Phase 1 serves India only, so "today" and day boundaries
// use Asia/Kolkata for everyone. IST is a fixed +05:30 offset with no daylight saving, so no date
// library or time zone database is needed, and nothing here reads the machine's time zone.

/** A day the user chose, as `YYYY-MM-DD` in IST. */
export type IstDay = string;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `value` is a real calendar day written as `YYYY-MM-DD`. */
export function isIstDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** The IST day an instant falls on. */
export function istDayOf(instant: Date): IstDay {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in IST, from the clock's UTC time. */
export function istToday(now: Date = new Date()): IstDay {
  return istDayOf(now);
}

/** Whether `day` is later than today in IST (REQ-DATE-001; Q-017 MVP default). */
export function isFutureIstDay(day: IstDay, now: Date = new Date()): boolean {
  return day > istToday(now);
}

/** The day `count` days after `day` (before it when `count` is negative). */
export function addDays(day: IstDay, count: number): IstDay {
  return new Date(dayStartUtcMs(day) + count * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday that starts the Mon–Sun week holding `day` (REQ-HOME-002). */
export function istWeekStart(day: IstDay): IstDay {
  const weekday = new Date(dayStartUtcMs(day)).getUTCDay(); // 0 is Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** The seven days, Monday to Sunday, of the week holding `day`. */
export function istWeekDays(day: IstDay): IstDay[] {
  const monday = istWeekStart(day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function dayStartUtcMs(day: IstDay): number {
  if (!isIstDay(day)) throw new RangeError('Not a YYYY-MM-DD day');
  return Date.parse(`${day}T00:00:00Z`);
}
