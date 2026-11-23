import { addDays, type IstDay } from '@fitsphere/shared';
import { istInstant, WINDOW_DAYS } from './notificationSchedule';
import type { NotificationKind } from './notifications';
import { daysBetween } from './progress/calculations';
import { DAILY_CAP, inQuietHours, MEAL_SLOTS, NUDGE_MAX_DAYS, type ReminderSettings } from './notificationSettings';

// Which reminders there are, and when (ADR-0014, REQ-NOT-002): the meals, the workout days and the
// measurements, each at the user's time, in India (Asia/Kolkata) days. A reminder that would be pointless
// is left out: the meal already has food, the day already has a workout (the plan, section 5). Pure: the
// clock and what the phone holds come in as values, so tests use a fake clock.

/** Measurements are due after more than this many days (Home's rule, D-85). */
export const MEASUREMENTS_DUE_AFTER_DAYS = 7;
/** A measurements reminder is made at most this often, so a user who ignores it is not nagged daily. */
export const MEASUREMENTS_REMIND_EVERY_DAYS = 7;

export type PlanInput = {
  settings: ReminderSettings;
  now: Date;
  /** The meal types with food on each day, for the days the phone holds. */
  mealsByDay: Record<IstDay, readonly string[]>;
  /** The days with a logged workout (one with an exercise, D-108). */
  workoutDays: readonly IstDay[];
  /** The latest day with measurements, or null. */
  lastMeasurementsDay: IstDay | null;
  /** The day a measurements reminder was last made, dismissed or not, or null. */
  lastRemindedDay: IstDay | null;
  /** The latest day with a meal, workout or measurement logged, or null. */
  lastActiveDay: IstDay | null;
  /** The day an inactivity nudge was last made, or null. */
  lastNudgeDay: IstDay | null;
};

export type Planned = { kind: NotificationKind; at: Date; day: IstDay };

function isoWeekday(day: IstDay): number {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 is Sunday
  return weekday === 0 ? 7 : weekday;
}

/** Every reminder of the given days, at the user's times, with the pointless ones left out. */
function occurrences(input: PlanInput, days: IstDay[]): Planned[] {
  const { settings } = input;
  const planned: Planned[] = [];
  for (const day of days) {
    for (const slot of MEAL_SLOTS) {
      const meal = settings.meals[slot];
      if (meal.enabled && !(input.mealsByDay[day] ?? []).includes(slot)) {
        planned.push({ kind: `meal_${slot}`, at: istInstant(day, meal.time), day });
      }
    }
    const workout = settings.workout;
    if (workout.enabled && workout.days.includes(isoWeekday(day)) && !input.workoutDays.includes(day)) {
      planned.push({ kind: 'workout_reminder', at: istInstant(day, workout.time), day });
    }
    const measurements = settings.measurements;
    if (measurements.enabled) {
      const due = input.lastMeasurementsDay === null || daysBetween(input.lastMeasurementsDay, day) > MEASUREMENTS_DUE_AFTER_DAYS;
      const recent = input.lastRemindedDay !== null && daysBetween(input.lastRemindedDay, day) < MEASUREMENTS_REMIND_EVERY_DAYS;
      if (due && !recent) planned.push({ kind: 'measurements_due', at: istInstant(day, measurements.time), day });
    }
  }
  return limited(planned.sort((a, b) => a.at.getTime() - b.at.getTime()));
}

/** India's time of day, "HH:mm", of an instant (+05:30, no daylight saving). */
export function istTime(at: Date): string {
  return new Date(at.getTime() + 330 * 60_000).toISOString().slice(11, 16);
}

/** Quiet hours drop a notification; at most DAILY_CAP a day, the earliest kept (Q-C). */
function limited(planned: Planned[]): Planned[] {
  const perDay = new Map<IstDay, number>();
  return planned.filter((item) => {
    if (inQuietHours(istTime(item.at))) return false;
    const count = (perDay.get(item.day) ?? 0) + 1;
    perDay.set(item.day, count);
    return count <= DAILY_CAP;
  });
}

/** The nudge's day: this many days after the last logged day (or after today when nothing is logged). */
function nudgeDay(input: PlanInput, today: IstDay): IstDay {
  return addDays(input.lastActiveDay ?? today, Math.min(input.settings.nudge.afterDays, NUDGE_MAX_DAYS));
}

/** A nudge is made at most once in a stretch of the same length, so a user who stays away is not nagged daily. */
function nudgeAllowed(input: PlanInput, day: IstDay): boolean {
  return input.lastNudgeDay === null || daysBetween(input.lastNudgeDay, day) >= input.settings.nudge.afterDays;
}

function nudgeFor(input: PlanInput, today: IstDay): Planned[] {
  const { nudge } = input.settings;
  if (!nudge.enabled) return [];
  const due = nudgeDay(input, today);
  const day = due < today ? today : due;
  return nudgeAllowed(input, day) ? [{ kind: 'inactive', at: istInstant(day, nudge.time), day }] : [];
}

/** Today and the next six days: the reminders still ahead, to schedule. At most one measurements reminder. */
export function planReminders(input: PlanInput, today: IstDay): Planned[] {
  const days = Array.from({ length: WINDOW_DAYS }, (_, n) => addDays(today, n));
  const nudge = nudgeFor(input, today).filter((item) => days.includes(item.day));
  const ahead = limited([...occurrences(input, days), ...nudge].sort((a, b) => a.at.getTime() - b.at.getTime())).filter(
    (item) => item.at.getTime() > input.now.getTime(),
  );
  const firstDue = ahead.findIndex((item) => item.kind === 'measurements_due');
  return ahead.filter((item, index) => item.kind !== 'measurements_due' || index === firstDue);
}

/**
 * Yesterday's and today's reminders whose time has passed and that were not pointless: what the phone
 * fired, or would have, while the app was closed. They go to the list when the app opens (the list is
 * the record, ADR-0014 rule 4).
 */
export function missedReminders(input: PlanInput, today: IstDay): Planned[] {
  const days = [addDays(today, -1), today];
  const nudge = nudgeFor(input, today).filter((item) => item.day <= today);
  const passed = limited([...occurrences(input, days), ...nudge].sort((a, b) => a.at.getTime() - b.at.getTime())).filter(
    (item) => item.at.getTime() <= input.now.getTime(),
  );
  const firstDue = passed.findIndex((item) => item.kind === 'measurements_due');
  return passed.filter((item, index) => item.kind !== 'measurements_due' || index === firstDue);
}
