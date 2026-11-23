import type { MealItem } from '@fitsphere/shared';
import { getReminderSettings, listNotifications, saveReminderSettings } from './local/notificationStore';
import type { SqlDb } from './local/sql';
import { migrateLocal, saveEntry } from './local/store';
import { sameSets } from './testing/exercises';
import { syncReminders } from './notificationSync';
import { turnOn, type PermissionState, type PushPort } from './notificationPush';
import { DEFAULT_REMINDERS } from './notificationSettings';
import type { ScheduleRequest } from './notificationSchedule';
import { memoryDb } from './testing/memoryDb';

// Keeping the reminders in step with the phone's data (ADR-0014). Monday 23 November 2026, 14:00 IST.
// A fake phone and synthetic data only.

const NOW = new Date('2026-11-23T08:30:00Z');
const TODAY = '2026-11-23';
let counter = 0;
const newId = () => `00000000-0000-4000-c000-${String(++counter).padStart(12, '0')}`;

const ATTA: MealItem = {
  source: 'ifct2017', ref: 'A019', name: 'Wheat flour, atta', amount: { unit: 'g', value: 60 },
  kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82, estimated: false,
};

function fakePhone(state: PermissionState = 'granted') {
  const scheduled: ScheduleRequest[] = [];
  const presented: ScheduleRequest[] = [];
  const port: PushPort = {
    permission: async () => ({ state, canAskAgain: true }),
    requestPermission: async () => state,
    createChannels: async () => undefined,
    schedule: async (request) => {
      scheduled.push(request);
    },
    present: async (request) => {
      presented.push(request);
    },
    cancelAll: async () => {
      scheduled.length = 0;
    },
    openSettings: async () => undefined,
  };
  return { port, scheduled, presented };
}

let db: SqlDb;
beforeEach(async () => {
  counter = 0;
  db = memoryDb();
  await migrateLocal(db);
});
afterEach(async () => {
  await db.closeAsync();
});

async function choose(change: (s: typeof DEFAULT_REMINDERS) => void) {
  const s = structuredClone(await getReminderSettings(db));
  change(s);
  await saveReminderSettings(db, s);
}

describe('syncReminders', () => {
  it('does nothing while every reminder is off', async () => {
    const phone = fakePhone();
    await turnOn(phone.port, db);

    await syncReminders(db, phone.port, NOW, newId);

    expect(await listNotifications(db)).toEqual([]);
    expect(phone.scheduled).toEqual([]);
  });

  it('puts a missed reminder in the list, and schedules the ones ahead, when push is on', async () => {
    const phone = fakePhone();
    await turnOn(phone.port, db);
    await choose((s) => {
      s.meals.breakfast.enabled = true; // 08:30, passed
      s.meals.dinner.enabled = true; // 20:00, ahead
    });

    await syncReminders(db, phone.port, NOW, newId);

    // Yesterday's breakfast and dinner, and today's breakfast: all passed with nothing logged. Newest first.
    expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['meal_breakfast', 'meal_dinner', 'meal_breakfast']);
    expect(phone.scheduled).toHaveLength(13); // today's dinner, then breakfast and dinner on the next 6 days
    expect(phone.scheduled[0]?.at.toISOString()).toBe('2026-11-23T14:30:00.000Z');
  });

  it('a meal logged cancels its reminder: not listed, not scheduled for the day', async () => {
    const phone = fakePhone();
    await turnOn(phone.port, db);
    await choose((s) => {
      s.meals.breakfast.enabled = true;
      s.meals.dinner.enabled = true;
    });
    await saveEntry(db, 'meal', {
      changeId: newId(),
      data: { id: newId(), day: TODAY, mealType: 'breakfast', tags: [], items: [ATTA], recordedAt: NOW.toISOString() },
    });
    await saveEntry(db, 'meal', {
      changeId: newId(),
      data: { id: newId(), day: TODAY, mealType: 'dinner', tags: [], items: [ATTA], recordedAt: NOW.toISOString() },
    });

    await syncReminders(db, phone.port, NOW, newId);

    // Only yesterday's breakfast and dinner are listed; today's have food.
    expect((await listNotifications(db)).map((row) => row.createdAt.slice(0, 10))).toEqual(['2026-11-22', '2026-11-22']);
    expect(phone.scheduled).toHaveLength(12); // breakfast and dinner on the next 6 days; today's have food
  });

  it('fills the list but schedules nothing while push is off', async () => {
    const phone = fakePhone();
    await choose((s) => (s.meals.breakfast.enabled = true));

    await syncReminders(db, phone.port, NOW, newId);

    expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['meal_breakfast', 'meal_breakfast']);
    expect(phone.scheduled).toEqual([]);
  });

  it('a second run makes no second row for the same reminder and day', async () => {
    const phone = fakePhone();
    await choose((s) => (s.meals.breakfast.enabled = true));

    await syncReminders(db, phone.port, NOW, newId);
    await syncReminders(db, phone.port, NOW, newId);

    expect(await listNotifications(db)).toHaveLength(2); // yesterday's and today's breakfast
  });

  it('keeps the list when the phone has no notification module', async () => {
    const phone = fakePhone();
    const broken: PushPort = { ...phone.port, cancelAll: () => Promise.reject(new Error('no module')) };
    await choose((s) => (s.meals.breakfast.enabled = true));

    await expect(syncReminders(db, broken, NOW, newId)).resolves.toBeUndefined();

    expect(await listNotifications(db)).toHaveLength(2);
  });

  describe('goals', () => {
    async function eatAndTarget() {
      await saveEntry(db, 'target', { changeId: newId(), data: { kind: 'protein', value: 5, day: TODAY, setAt: NOW.toISOString() } });
      await saveEntry(db, 'meal', {
        changeId: newId(),
        data: { id: newId(), day: TODAY, mealType: 'lunch', tags: [], items: [ATTA], recordedAt: NOW.toISOString() },
      });
    }

    it('tells once when the daily protein target is reached, and shows it now with push on', async () => {
      const phone = fakePhone();
      await turnOn(phone.port, db);
      await choose((s) => (s.goals.dailyTarget = true));
      await eatAndTarget();

      await syncReminders(db, phone.port, NOW, newId);
      await syncReminders(db, phone.port, NOW, newId);

      expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['target_reached']);
      expect(phone.presented.map((request) => request.channel)).toEqual(['goals']);
    });

    it('lists it but shows nothing now in quiet hours', async () => {
      const phone = fakePhone();
      await turnOn(phone.port, db);
      await choose((s) => (s.goals.dailyTarget = true));
      await eatAndTarget();

      await syncReminders(db, phone.port, new Date('2026-11-23T17:30:00Z'), newId); // 23:00 IST

      expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['target_reached']);
      expect(phone.presented).toEqual([]);
    });

    it('does nothing with the goal off, or below the target', async () => {
      const phone = fakePhone();
      await eatAndTarget();
      await syncReminders(db, phone.port, NOW, newId);
      expect(await listNotifications(db)).toEqual([]);
      await choose((s) => (s.goals.dailyTarget = true));
      await saveEntry(db, 'target', { changeId: newId(), data: { kind: 'protein', value: 50, day: TODAY, setAt: NOW.toISOString() } });
      await syncReminders(db, phone.port, NOW, newId);
      expect(await listNotifications(db)).toEqual([]);
    });

    it('tells once a week when the weekly workouts reach the target', async () => {
      const phone = fakePhone();
      await choose((s) => (s.goals.weeklyWorkouts = true));
      await saveEntry(db, 'target', { changeId: newId(), data: { kind: 'weekly_workouts', value: 1, day: TODAY, setAt: NOW.toISOString() } });
      await saveEntry(db, 'workout', {
        changeId: newId(),
        data: { id: newId(), day: TODAY, exercises: [sameSets('Squat', 3, 10, 40_000)], recordedAt: NOW.toISOString(), timer: null },
      });

      await syncReminders(db, phone.port, NOW, newId);
      await syncReminders(db, phone.port, new Date('2026-11-24T08:30:00Z'), newId);

      expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['weekly_workouts']);
    });
  });

  it('the nudge moves to X days from the open, and is listed when it was due while the app was closed', async () => {
    const phone = fakePhone();
    await turnOn(phone.port, db);
    await choose((s) => (s.nudge = { enabled: true, afterDays: 3, time: '09:00' }));

    await syncReminders(db, phone.port, NOW, newId); // first open: nothing due, one scheduled in 3 days
    expect(phone.scheduled.map((request) => request.at.toISOString())).toEqual(['2026-11-26T03:30:00.000Z']);
    expect(await listNotifications(db)).toEqual([]);

    await syncReminders(db, phone.port, new Date('2026-11-27T08:30:00Z'), newId); // back after 4 days
    expect((await listNotifications(db)).map((row) => row.kind)).toEqual(['inactive']);
  });
});
