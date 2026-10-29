import {
  fromGrams,
  fromMillimetres,
  isMeasurementMmInRange,
  isWeightGramsInRange,
  MEASUREMENT_MM_MAX,
  MEASUREMENT_MM_MIN,
  toGrams,
  toMillimetres,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
  type IstDay,
  type LengthUnit,
} from '@fitsphere/shared';

// Display helpers. Days are IST days written YYYY-MM-DD; reading their parts in UTC keeps them
// independent of the phone's time zone (invariant #5).
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function dayParts(day: IstDay) {
  const date = new Date(`${day}T00:00:00Z`);
  return {
    weekday: WEEKDAYS[date.getUTCDay()]!,
    weekdayName: WEEKDAY_NAMES[date.getUTCDay()]!,
    date: date.getUTCDate(),
    month: MONTHS[date.getUTCMonth()]!,
  };
}

/** e.g. "Wed 28 Oct" */
export function formatDay(day: IstDay): string {
  const parts = dayParts(day);
  return `${parts.weekday} ${parts.date} ${parts.month}`;
}

/** The body-weight unit until the Settings slice adds the setting (Skeleton decision 6, REQ-ACC-003). */
export const BODY_WEIGHT_UNIT = 'kg';

export const WEIGHT_RULE = `Enter a weight from ${fromGrams(WEIGHT_GRAMS_MIN, 'kg').toFixed(1)} to ${fromGrams(
  WEIGHT_GRAMS_MAX,
  'kg',
).toFixed(1)} kg, with at most one decimal.`;

/** Reads typed kg with at most one decimal ("70.3" or "70,3"); null when it cannot be saved. */
export function parseWeightInput(text: string): number | null {
  const value = parseOneDecimal(text);
  if (value === null) return null;
  const grams = toGrams(value, BODY_WEIGHT_UNIT);
  return isWeightGramsInRange(grams) ? grams : null;
}

/** Reads a number typed with at most one decimal, with a dot or a comma; null otherwise. */
export function parseOneDecimal(text: string): number | null {
  const match = /^(\d{1,4})(?:[.,](\d))?$/.exec(text.trim());
  return match ? Number(`${match[1]}.${match[2] ?? '0'}`) : null;
}

/** Reads a whole number from `min` to `max`; spaces and thousands commas are ignored. */
export function parseWholeNumber(text: string, min: number, max: number): number | null {
  const digits = text.replace(/[\s,]/g, '');
  if (!/^\d{1,7}$/.test(digits)) return null;
  const value = Number(digits);
  return value >= min && value <= max ? value : null;
}

/** e.g. 10000 → "10,000". */
export function formatInteger(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** e.g. "Wednesday 28 October 2026", for the calendar's day buttons. */
export function formatLongDay(day: IstDay): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAY_NAMES[date.getUTCDay()]!} ${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]!} ${date.getUTCFullYear()}`;
}

/** A month written YYYY-MM, e.g. "October 2026". */
export function formatMonth(month: string): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[number - 1]!} ${year}`;
}

/** The month `count` months after `month` (YYYY-MM). */
export function addMonths(month: string, count: number): string {
  const [year, number] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, number - 1 + count, 1)).toISOString().slice(0, 7);
}

/** The weeks of a month, Monday first; days outside the month are null. */
export function monthWeeks(month: string): (IstDay | null)[][] {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (IstDay | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/**
 * The name the header greets the user with (REQ-HOME-001). No name is collected at sign-up, so it
 * is the part of the email before "@" (MVP default, D-23).
 */
export function nameFromEmail(email: string | null): string {
  return email?.split('@')[0] ?? '';
}

/**
 * The lowest and highest one-decimal values in `unit` that store within 10–250 cm (Q-028): 10.0 to
 * 250.0 cm, and 4.0 to 98.4 in.
 */
export function measurementRange(unit: LengthUnit): { min: number; max: number } {
  const step = (value: number, by: number) => Math.round((value + by) * 10) / 10;
  let min = fromMillimetres(MEASUREMENT_MM_MIN, unit);
  if (!isMeasurementMmInRange(toMillimetres(min, unit))) min = step(min, 0.1);
  let max = fromMillimetres(MEASUREMENT_MM_MAX, unit);
  if (!isMeasurementMmInRange(toMillimetres(max, unit))) max = step(max, -0.1);
  return { min, max };
}

/** Reads a length typed with at most one decimal in `unit`: whole millimetres, or null. */
export function parseLength(text: string, unit: LengthUnit): number | null {
  const value = parseOneDecimal(text);
  if (value === null) return null;
  const mm = toMillimetres(value, unit);
  return isMeasurementMmInRange(mm) ? mm : null;
}
