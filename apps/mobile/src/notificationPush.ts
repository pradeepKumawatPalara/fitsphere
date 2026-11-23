import { getMeta, setMeta } from './local/store';
import type { SqlDb } from './local/sql';
import { testRequest, windowOf, type ScheduleRequest } from './notificationSchedule';

// Push on the phone (ADR-0014): the phone's permission, the channels and the schedule. The operating
// system fires the notifications; no server is involved. The phone's part is behind a port, so the
// rules here run in tests without a phone (notificationPortExpo.ts is the real one).

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type PushPort = {
  /** The phone's permission now; `canAskAgain` is false once the user refused for good. */
  permission(): Promise<{ state: PermissionState; canAskAgain: boolean }>;
  /** Shows the phone's own prompt. */
  requestPermission(): Promise<PermissionState>;
  /** The Android channels (Reminders, Goals, Nudges); nothing on an iPhone. */
  createChannels(): Promise<void>;
  schedule(request: ScheduleRequest): Promise<void>;
  /** Shows one now (a goal reached); a rebuild of the schedule leaves it alone. */
  present(request: ScheduleRequest): Promise<void>;
  cancelAll(): Promise<void>;
  /** Opens the phone's settings for this app. */
  openSettings(): Promise<void>;
};

/** The master switch, on this phone only (`sync_meta`): '1' when on. */
export async function isEnabled(db: SqlDb): Promise<boolean> {
  return (await getMeta(db, 'notifications_enabled')) === '1';
}

/**
 * Turns notifications on. The phone's prompt is asked here, once the user chose to turn them on, never at
 * start (REQ-NOT-006); where the phone already allows them, nothing is asked. A refusal leaves them off:
 * the list in the app still works.
 */
export async function turnOn(port: PushPort, db: SqlDb): Promise<PermissionState> {
  let { state } = await port.permission();
  if (state === 'undetermined') state = await port.requestPermission();
  if (state === 'granted') {
    await port.createChannels();
    await setMeta(db, 'notifications_enabled', '1');
  }
  return state;
}

/** Turns them off and cancels everything scheduled. */
export async function turnOff(port: PushPort, db: SqlDb): Promise<void> {
  await setMeta(db, 'notifications_enabled', '0');
  await port.cancelAll();
}

/**
 * Replaces the schedule with the window of the given requests (next 7 days, at most 40). Nothing is
 * scheduled when the master switch is off or the phone has withdrawn its permission.
 */
export async function rebuildSchedule(port: PushPort, db: SqlDb, requests: ScheduleRequest[], now: Date): Promise<number> {
  await port.cancelAll();
  if (!(await isEnabled(db))) return 0;
  if ((await port.permission()).state !== 'granted') return 0;
  const held = windowOf(requests, now);
  for (const request of held) await port.schedule(request);
  return held.length;
}

/** "Send a test notification": one that arrives in a couple of seconds, apart from the schedule and its limits. */
export async function sendTest(port: PushPort, now: Date): Promise<void> {
  await port.schedule(testRequest(now));
}
