import { istToday, type IstDay } from '@fitsphere/shared';
import { formatDay } from './format';

// Notifications (ADR-0014, docs/plans/notifications.md): what the list shows. The text names the kind
// of event only: no food, weight, count or name, so a lock screen reveals nothing about the user
// (REQ-NOT-006, invariant #7).

export type NotificationCategory = 'reminder' | 'goal' | 'nudge';

export type NotificationKind =
  | 'meal_breakfast'
  | 'meal_lunch'
  | 'meal_dinner'
  | 'meal_snack'
  | 'workout_reminder'
  | 'measurements_due'
  | 'target_reached'
  | 'weekly_workouts'
  | 'inactive';

type KindInfo = {
  category: NotificationCategory;
  /** The notification's text. */
  title: string;
  /** The button's label: what the notification asks the user to do (design D). */
  action: string;
  /** The screen the button opens. */
  route: string;
};

export const KIND_INFO: Record<NotificationKind, KindInfo> = {
  meal_breakfast: { category: 'reminder', title: 'Time to log breakfast.', action: 'Log breakfast', route: '/log-meal?slot=breakfast' },
  meal_lunch: { category: 'reminder', title: 'Time to log lunch.', action: 'Log lunch', route: '/log-meal?slot=lunch' },
  meal_dinner: { category: 'reminder', title: 'Time to log dinner.', action: 'Log dinner', route: '/log-meal?slot=dinner' },
  meal_snack: { category: 'reminder', title: 'Time to log a snack.', action: 'Log snack', route: '/log-meal?slot=snack' },
  workout_reminder: { category: 'reminder', title: 'Workout time. Open FitSphere to start.', action: 'Open Training', route: '/training' },
  measurements_due: { category: 'reminder', title: 'Measurements are due.', action: 'Add measurements', route: '/home' },
  target_reached: { category: 'goal', title: "You reached today's target.", action: "See today's nutrition", route: '/nutrition' },
  weekly_workouts: { category: 'goal', title: "You reached this week's workouts.", action: 'Open Training', route: '/training' },
  inactive: { category: 'nudge', title: 'It has been a few days. Log something small today?', action: 'Log meal', route: '/log-meal' },
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = { reminder: 'Reminder', goal: 'Goal', nudge: 'Nudge' };

/** What the local table holds for one notification. */
export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  route: string;
  source: 'local' | 'server';
  createdAt: string;
  readAt: string | null;
};

/** A new notification of a kind, once per kind and IST day (the key). */
export function newNotification(kind: NotificationKind, id: string, createdAt: Date): NotificationRow & { dedupeKey: string } {
  const info = KIND_INFO[kind];
  return {
    id,
    kind,
    category: info.category,
    title: info.title,
    route: info.route,
    source: 'local',
    createdAt: createdAt.toISOString(),
    readAt: null,
    dedupeKey: `${kind}:${istToday(createdAt)}`,
  };
}

/** The button's label for a row; the kind's, or "Open" for a kind this app does not know. */
export function actionLabel(kind: string): string {
  return (KIND_INFO as Record<string, KindInfo | undefined>)[kind]?.action ?? 'Open';
}

/** "Just now", "5 min ago", "6 h ago", "Yesterday", then the date ("Mon 17 Nov"). */
export function timeAgo(createdAt: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const today = istToday(now);
  const day = istToday(new Date(createdAt));
  if (day === today) return `${Math.floor(minutes / 60)} h ago`;
  const yesterday = istToday(new Date(now.getTime() - 24 * 3_600_000));
  if (day === yesterday) return 'Yesterday';
  return formatDay(day as IstDay, today);
}

/** The phone keeps 90 days (ADR-0007 rule 1); older notifications are removed. */
export const NOTIFICATION_KEEP_DAYS = 90;
