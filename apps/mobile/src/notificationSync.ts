import { addDays, istToday, istWeekStart, type IstDay } from '@fitsphere/shared';
import { addNotification, countCreatedOn, getReminderSettings, lastNotificationDay } from './local/notificationStore';
import type { SqlDb } from './local/sql';
import { dayNutrition, getMeta, latestMeasurementsDay, listEntries, listMealsOfDay, setMeta, targetsOn } from './local/store';
import { istTime, missedReminders, planReminders, type PlanInput } from './notificationPlanner';
import { isEnabled, rebuildSchedule, type PushPort } from './notificationPush';
import { requestFor } from './notificationSchedule';
import { DAILY_CAP, inQuietHours, type ReminderSettings } from './notificationSettings';
import { newNotification, type NotificationKind } from './notifications';
import { weekTargetDay } from './targets';
import { isLogged } from './workouts';

// Keeps the reminders in step with what the user logged (ADR-0014): run when the app opens or comes back,
// and when a setting or the phone's data changes. A meal logged cancels that meal's reminder for the day;
// a workout does the same; a measurement moves the measurements reminder. Everything it reads is on the
// phone, so it works offline (REQ-NOT-007).

async function readState(db: SqlDb, now: Date, today: IstDay): Promise<PlanInput> {
  const settings = await getReminderSettings(db);
  const yesterday = addDays(today, -1);
  const mealsByDay: Record<IstDay, string[]> = {};
  for (const day of [yesterday, today]) {
    mealsByDay[day] = (await listMealsOfDay(db, day)).map((meal) => meal.mealType);
  }
  const workouts = await listEntries(db, 'workout', yesterday, addDays(today, 6));
  return {
    settings,
    now,
    mealsByDay,
    workoutDays: workouts.filter(isLogged).map((workout) => workout.day),
    lastMeasurementsDay: await latestMeasurementsDay(db, today),
    lastRemindedDay: await lastNotificationDay(db, 'measurements_due'),
    // Opening the app counts as being active (the plan: the nudge moves to "X days from now" at every open).
    lastActiveDay: ((await getMeta(db, 'last_open_day')) as IstDay | null) ?? today,
    lastNudgeDay: await lastNotificationDay(db, 'inactive'),
  };
}

/** A goal reached becomes a row, once; and, with push on, outside quiet hours and under the day's cap, a notification now. */
async function tellGoal(db: SqlDb, port: PushPort, kind: NotificationKind, now: Date, newId: () => string): Promise<void> {
  const row = newNotification(kind, newId(), now);
  if (!(await addNotification(db, row))) return;
  try {
    if (!(await isEnabled(db)) || (await port.permission()).state !== 'granted') return;
    if (inQuietHours(istTime(now)) || (await countCreatedOn(db, istToday(now))) > DAILY_CAP) return;
    await port.present(requestFor(kind, now));
  } catch {
    // No native module in this build: the list row stands.
  }
}

/** The goals the user switched on: today's protein target and this week's workouts (REQ-NOT-003). */
async function checkGoals(db: SqlDb, port: PushPort, settings: ReminderSettings, now: Date, today: IstDay, newId: () => string) {
  if (settings.goals.dailyTarget) {
    const protein = (await targetsOn(db, today)).find((target) => target.kind === 'protein');
    const eaten = await dayNutrition(db, today);
    if (protein && eaten && eaten.proteinG >= protein.value) await tellGoal(db, port, 'target_reached', now, newId);
  }
  if (settings.goals.weeklyWorkouts) {
    const weekStart = istWeekStart(today);
    const target = (await targetsOn(db, weekTargetDay(today))).find((item) => item.kind === 'weekly_workouts');
    const done = (await listEntries(db, 'workout', weekStart, addDays(weekStart, 6))).filter(isLogged).length;
    const last = await lastNotificationDay(db, 'weekly_workouts');
    if (target && done >= target.value && (last === null || last < weekStart)) await tellGoal(db, port, 'weekly_workouts', now, newId);
  }
}

/**
 * First the list: each reminder of yesterday and today whose time has passed and that was not pointless
 * becomes a row (once a kind and day), whether or not push is on. Then the schedule: the next 7 days'
 * reminders, when push is on.
 */
export async function syncReminders(db: SqlDb, port: PushPort, now: Date, newId: () => string): Promise<void> {
  const today = istToday(now);
  const state = await readState(db, now, today);
  for (const item of missedReminders(state, today)) {
    await addNotification(db, newNotification(item.kind, newId(), item.at));
  }
  await checkGoals(db, port, state.settings, now, today, newId);
  await setMeta(db, 'last_open_day', today);
  // The rows just made change the measurements and nudge rules, so they are read again for the schedule.
  const planned = planReminders(
    {
      ...state,
      lastActiveDay: today,
      lastRemindedDay: await lastNotificationDay(db, 'measurements_due'),
      lastNudgeDay: await lastNotificationDay(db, 'inactive'),
    },
    today,
  );
  try {
    await rebuildSchedule(port, db, planned.map((item) => requestFor(item.kind, item.at)), now);
  } catch {
    // A build made before notifications existed has no native module; the list above is already made.
  }
}
