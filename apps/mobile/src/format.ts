import { fromGrams, toGrams, WEIGHT_GRAMS_MAX, WEIGHT_GRAMS_MIN, isWeightGramsInRange, type IstDay } from '@fitsphere/shared';

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
  const match = /^(\d{1,3})(?:[.,](\d))?$/.exec(text.trim());
  if (!match) return null;
  const grams = toGrams(Number(`${match[1]}.${match[2] ?? '0'}`), BODY_WEIGHT_UNIT);
  return isWeightGramsInRange(grams) ? grams : null;
}
