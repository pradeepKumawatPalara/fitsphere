import { newNotification } from '../notifications';
import { memoryDb } from '../testing/memoryDb';
import { addNotification, dismissNotification, listNotifications, markAllRead, markRead, removeOldNotifications, unreadCount } from './notificationStore';
import type { SqlDb } from './sql';
import { migrateLocal } from './store';

// The phone's notification list (ADR-0014, REQ-NOT-001). Synthetic data only.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOON = new Date('2026-11-23T06:30:00Z'); // 12:00 IST

let db: SqlDb;
beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});
afterEach(async () => {
  await db.closeAsync();
});

describe('the notification list on the phone', () => {
  it('lists the newest first and counts the unread', async () => {
    await addNotification(db, newNotification('meal_lunch', id(1), new Date('2026-11-23T07:00:00Z')));
    await addNotification(db, newNotification('workout_reminder', id(2), new Date('2026-11-23T12:30:00Z')));

    expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['workout_reminder', 'meal_lunch']);
    expect(await unreadCount(db)).toBe(2);
  });

  it('makes one notification of a kind a day, and another the next day', async () => {
    expect(await addNotification(db, newNotification('meal_lunch', id(1), NOON))).toBe(true);
    expect(await addNotification(db, newNotification('meal_lunch', id(2), new Date('2026-11-23T08:00:00Z')))).toBe(false);
    expect(await addNotification(db, newNotification('meal_lunch', id(3), new Date('2026-11-24T06:30:00Z')))).toBe(true);

    expect(await listNotifications(db)).toHaveLength(2);
  });

  it('marks one read, then all read', async () => {
    await addNotification(db, newNotification('meal_lunch', id(1), NOON));
    await addNotification(db, newNotification('meal_dinner', id(2), NOON));

    await markRead(db, id(1), NOON);
    expect(await unreadCount(db)).toBe(1);
    await markAllRead(db, NOON);
    expect(await unreadCount(db)).toBe(0);
  });

  it('filters by category', async () => {
    await addNotification(db, newNotification('meal_lunch', id(1), NOON));
    await addNotification(db, newNotification('target_reached', id(2), NOON));

    expect((await listNotifications(db, 'goal')).map((row) => row.kind)).toEqual(['target_reached']);
    expect(await listNotifications(db, 'nudge')).toEqual([]);
  });

  it('a dismissed notification leaves the list and the count, and is not made again that day', async () => {
    await addNotification(db, newNotification('meal_lunch', id(1), NOON));

    await dismissNotification(db, id(1), NOON);

    expect(await listNotifications(db)).toEqual([]);
    expect(await unreadCount(db)).toBe(0);
    expect(await addNotification(db, newNotification('meal_lunch', id(2), NOON))).toBe(false);
  });

  it('removes the notifications older than 90 days', async () => {
    await addNotification(db, newNotification('meal_lunch', id(1), new Date('2026-08-01T06:30:00Z')));
    await addNotification(db, newNotification('meal_dinner', id(2), new Date('2026-11-20T06:30:00Z')));

    await removeOldNotifications(db, NOON);

    expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['meal_dinner']);
  });
});
