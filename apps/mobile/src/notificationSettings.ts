// What the user chose for reminders (ADR-0014, docs/plans/notifications.md, REQ-NOT-002, REQ-NOT-005):
// every reminder is off until the user turns it on (the plan's proposal, Q-B), each with its own time.
// Kept on this phone only, as one JSON text in `sync_meta`.

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type ReminderSettings = {
  /** Workout days are ISO weekdays: 1 is Monday, 7 is Sunday. */
  workout: { enabled: boolean; days: number[]; time: string };
  meals: Record<MealSlot, { enabled: boolean; time: string }>;
  measurements: { enabled: boolean; time: string };
  /** Goals: told once when reached (the day's protein target, the week's workouts target). */
  goals: { dailyTarget: boolean; weeklyWorkouts: boolean };
  /** The inactivity nudge: after this many days (2 to 7) with nothing logged, at this time. */
  nudge: { enabled: boolean; afterDays: number; time: string };
};

/** No notification fires between these times, India's clock, and at most this many a day (Q-C's proposal). */
export const QUIET_START = '22:00';
export const QUIET_END = '07:00';
export const DAILY_CAP = 4;
export const NUDGE_MIN_DAYS = 2;
export const NUDGE_MAX_DAYS = 7;

/** The times the plan proposed (Q-B); nothing is on. */
export const DEFAULT_REMINDERS: ReminderSettings = {
  workout: { enabled: false, days: [1, 3, 5], time: '18:00' },
  meals: {
    breakfast: { enabled: false, time: '08:30' },
    lunch: { enabled: false, time: '13:00' },
    dinner: { enabled: false, time: '20:00' },
    snack: { enabled: false, time: '16:30' },
  },
  measurements: { enabled: false, time: '09:00' },
  goals: { dailyTarget: false, weeklyWorkouts: false },
  nudge: { enabled: false, afterDays: 3, time: '18:30' },
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && TIME.test(value) ? value : fallback;
}

function flagOr(value: unknown): boolean {
  return value === true;
}

function daysOr(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const days = value.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Reads the saved text; anything missing or wrong falls back to its default, so a bad value never stops the app. */
export function parseReminders(text: string | null): ReminderSettings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = text === null ? {} : JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
  } catch {
    // Unreadable: the defaults.
  }
  const workout = (raw.workout ?? {}) as Record<string, unknown>;
  const meals = (raw.meals ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const measurements = (raw.measurements ?? {}) as Record<string, unknown>;
  const goals = (raw.goals ?? {}) as Record<string, unknown>;
  const nudge = (raw.nudge ?? {}) as Record<string, unknown>;
  const afterDays =
    Number.isInteger(nudge.afterDays) && (nudge.afterDays as number) >= NUDGE_MIN_DAYS && (nudge.afterDays as number) <= NUDGE_MAX_DAYS
      ? (nudge.afterDays as number)
      : DEFAULT_REMINDERS.nudge.afterDays;
  const mealOf = (slot: MealSlot) => ({
    enabled: flagOr(meals[slot]?.enabled),
    time: timeOr(meals[slot]?.time, DEFAULT_REMINDERS.meals[slot].time),
  });
  return {
    workout: {
      enabled: flagOr(workout.enabled),
      days: daysOr(workout.days, DEFAULT_REMINDERS.workout.days),
      time: timeOr(workout.time, DEFAULT_REMINDERS.workout.time),
    },
    meals: { breakfast: mealOf('breakfast'), lunch: mealOf('lunch'), dinner: mealOf('dinner'), snack: mealOf('snack') },
    measurements: { enabled: flagOr(measurements.enabled), time: timeOr(measurements.time, DEFAULT_REMINDERS.measurements.time) },
    goals: { dailyTarget: flagOr(goals.dailyTarget), weeklyWorkouts: flagOr(goals.weeklyWorkouts) },
    nudge: { enabled: flagOr(nudge.enabled), afterDays, time: timeOr(nudge.time, DEFAULT_REMINDERS.nudge.time) },
  };
}

/** A time moved by minutes, round the clock: "23:30" and +30 is "00:00". */
export function shiftTime(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "13:00" as "1:00 pm". */
export function timeLabel(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export const WEEKDAYS = [
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
  { day: 7, short: 'S', name: 'Sunday' },
] as const;

/** Whether a time of day falls in quiet hours (22:00 to 07:00 crosses midnight). */
export function inQuietHours(hhmm: string): boolean {
  return hhmm >= QUIET_START || hhmm < QUIET_END;
}
