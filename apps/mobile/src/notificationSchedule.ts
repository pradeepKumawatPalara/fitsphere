import type { IstDay } from '@fitsphere/shared';
import { KIND_INFO, type NotificationKind } from './notifications';

// What the phone schedules (ADR-0014, rule 2 to 3): one-time notifications for the next 7 days, at most
// 40 at once (iOS keeps 64), at Asia/Kolkata wall-clock times turned into absolute instants. The
// phone's own time zone never decides (invariant #5).

export const WINDOW_DAYS = 7;
export const MAX_PENDING = 40;

/** The three Android channels, one for each category, so the user can silence one in the phone's settings. */
export type PushChannel = 'reminders' | 'goals' | 'nudges';

/** One notification to schedule. `body` is the text; it names the kind of event only (REQ-NOT-006). */
export type ScheduleRequest = { body: string; route: string; channel: PushChannel; at: Date };

const CHANNEL_OF = { reminder: 'reminders', goal: 'goals', nudge: 'nudges' } as const;

/** IST is UTC+05:30 all year, with no daylight saving. */
export function istInstant(day: IstDay, hhmm: string): Date {
  return new Date(`${day}T${hhmm}:00+05:30`);
}

/** A notification of a kind, to fire at a time. */
export function requestFor(kind: NotificationKind, at: Date): ScheduleRequest {
  const info = KIND_INFO[kind];
  return { body: info.title, route: info.route, channel: CHANNEL_OF[info.category], at };
}

/** The "Send a test notification" button's: it opens the list. */
export function testRequest(now: Date, afterSeconds = 2): ScheduleRequest {
  return { body: 'This is a test notification.', route: '/notifications', channel: 'reminders', at: new Date(now.getTime() + afterSeconds * 1000) };
}

/** The requests to hold now: those still ahead and within 7 days, soonest first, at most 40. */
export function windowOf(requests: ScheduleRequest[], now: Date): ScheduleRequest[] {
  const end = now.getTime() + WINDOW_DAYS * 24 * 3_600_000;
  return requests
    .filter((request) => request.at.getTime() > now.getTime() && request.at.getTime() <= end)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING);
}
