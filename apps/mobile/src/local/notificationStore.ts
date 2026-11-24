import { istToday, type IstDay } from '@fitsphere/shared';
import { useSyncExternalStore } from 'react';
import { parseReminders, type ReminderSettings } from '../notificationSettings';
import { NOTIFICATION_KEEP_DAYS, type NotificationCategory, type NotificationKind, type NotificationRow } from '../notifications';
import type { SqlDb } from './sql';
import { getMeta, setMeta } from './store';

// The notification list on this phone (ADR-0014): not synced, kept 90 days, cleared with the phone's
// database when the user signs out. Reads leave out the notifications the user dismissed.

type Stored = {
  id: string;
  kind: string;
  category: NotificationCategory;
  title: string;
  route: string;
  source: 'local' | 'server';
  created_at: string;
  read_at: string | null;
};

function toRow(row: Stored): NotificationRow {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    category: row.category,
    title: row.title,
    route: row.route,
    source: row.source,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

// A number that changes when the list does, so the bell and the list read it again.
let version = 0;
const listeners = new Set<() => void>();
function changed(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useNotificationsVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Adds a notification; one with the same key (a kind on a day) is not added again, even dismissed. Returns whether it was added. */
export async function addNotification(db: SqlDb, row: NotificationRow & { dedupeKey: string }): Promise<boolean> {
  const { changes } = await db.runAsync(
    `INSERT OR IGNORE INTO notifications (id, kind, category, title, route, source, created_at, read_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [row.id, row.kind, row.category, row.title, row.route, row.source, row.createdAt, row.dedupeKey],
  );
  if (changes > 0) changed();
  return changes > 0;
}

/** The shown notifications, newest first; one category, or all. */
export async function listNotifications(db: SqlDb, category?: NotificationCategory): Promise<NotificationRow[]> {
  const rows = await db.getAllAsync<Stored>(
    `SELECT id, kind, category, title, route, source, created_at, read_at FROM notifications
     WHERE dismissed_at IS NULL ${category ? 'AND category = ?' : ''} ORDER BY created_at DESC, id DESC`,
    category ? [category] : [],
  );
  return rows.map(toRow);
}

export async function unreadCount(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE dismissed_at IS NULL AND read_at IS NULL', []);
  return row?.n ?? 0;
}

export async function markRead(db: SqlDb, id: string, at: Date): Promise<void> {
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL', [at.toISOString(), id]);
  changed();
}

export async function markAllRead(db: SqlDb, at: Date): Promise<void> {
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND dismissed_at IS NULL', [at.toISOString()]);
  changed();
}

/** Hides a notification (the X on its card). It stays stored, read, so it is not made again that day. */
export async function dismissNotification(db: SqlDb, id: string, at: Date): Promise<void> {
  await db.runAsync('UPDATE notifications SET dismissed_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?', [at.toISOString(), at.toISOString(), id]);
  changed();
}

/** The reminders the user chose; all off before they choose. */
export async function getReminderSettings(db: SqlDb): Promise<ReminderSettings> {
  return parseReminders(await getMeta(db, 'notification_settings'));
}

export async function saveReminderSettings(db: SqlDb, settings: ReminderSettings): Promise<void> {
  await setMeta(db, 'notification_settings', JSON.stringify(settings));
  changed();
}

/** The IST day a notification of a kind was last made, dismissed or not, or null. */
export async function lastNotificationDay(db: SqlDb, kind: NotificationKind): Promise<IstDay | null> {
  const row = await db.getFirstAsync<{ at: string | null }>('SELECT max(created_at) AS at FROM notifications WHERE kind = ?', [kind]);
  return row?.at ? istToday(new Date(row.at)) : null;
}

/** How many notifications were made on an IST day (for the daily cap). */
export async function countCreatedOn(db: SqlDb, day: IstDay): Promise<number> {
  const from = new Date(`${day}T00:00:00+05:30`);
  const to = new Date(from.getTime() + 24 * 3_600_000);
  const row = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM notifications WHERE created_at >= ? AND created_at < ?', [
    from.toISOString(),
    to.toISOString(),
  ]);
  return row?.n ?? 0;
}

/** Removes the notifications older than the phone keeps (90 days). */
export async function removeOldNotifications(db: SqlDb, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_KEEP_DAYS * 24 * 3_600_000).toISOString();
  const { changes } = await db.runAsync('DELETE FROM notifications WHERE created_at < ?', [cutoff]);
  if (changes > 0) changed();
}
