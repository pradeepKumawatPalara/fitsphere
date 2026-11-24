import { getMeta } from './local/store';
import type { SqlDb } from './local/sql';
import { migrateLocal } from './local/store';
import { isEnabled, rebuildSchedule, sendTest, turnOff, turnOn, type PermissionState, type PushPort } from './notificationPush';
import { istInstant, MAX_PENDING, requestFor, windowOf, type ScheduleRequest } from './notificationSchedule';
import { memoryDb } from './testing/memoryDb';

// Push on the phone (ADR-0014, REQ-NOT-005, REQ-NOT-006): the permission is asked when the user turns
// notifications on, the schedule is the next 7 days at IST times, at most 40. A fake phone; no real
// notification is ever sent.

const NOW = new Date('2026-11-23T06:30:00Z'); // 12:00 IST on Monday 23 November

function fakePhone(initial: PermissionState, afterPrompt: PermissionState = 'granted') {
  let state = initial;
  const calls = { prompts: 0, channels: 0, cancelled: 0, scheduled: [] as ScheduleRequest[], settings: 0 };
  const port: PushPort = {
    permission: async () => ({ state, canAskAgain: state !== 'denied' }),
    requestPermission: async () => {
      calls.prompts += 1;
      state = afterPrompt;
      return state;
    },
    createChannels: async () => {
      calls.channels += 1;
    },
    present: async () => undefined,
    schedule: async (request) => {
      calls.scheduled.push(request);
    },
    cancelAll: async () => {
      calls.cancelled += 1;
      calls.scheduled = [];
    },
    openSettings: async () => {
      calls.settings += 1;
    },
  };
  return { port, calls, withdraw: () => (state = 'denied') };
}

let db: SqlDb;
beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});
afterEach(async () => {
  await db.closeAsync();
});

describe('turning notifications on', () => {
  it('asks the phone once, makes the channels and switches on', async () => {
    const phone = fakePhone('undetermined');

    expect(await turnOn(phone.port, db)).toBe('granted');

    expect(phone.calls).toMatchObject({ prompts: 1, channels: 1 });
    expect(await isEnabled(db)).toBe(true);
  });

  it('does not ask again where the phone already allows them', async () => {
    const phone = fakePhone('granted');

    await turnOn(phone.port, db);

    expect(phone.calls.prompts).toBe(0);
    expect(await isEnabled(db)).toBe(true);
  });

  it('a refusal leaves them off and makes nothing', async () => {
    const phone = fakePhone('undetermined', 'denied');

    expect(await turnOn(phone.port, db)).toBe('denied');

    expect(await isEnabled(db)).toBe(false);
    expect(phone.calls.channels).toBe(0);
  });

  it('turning off cancels what is scheduled', async () => {
    const phone = fakePhone('granted');
    await turnOn(phone.port, db);
    await rebuildSchedule(phone.port, db, [requestFor('meal_dinner', new Date('2026-11-23T14:30:00Z'))], NOW);

    await turnOff(phone.port, db);

    expect(await getMeta(db, 'notifications_enabled')).toBe('0');
    expect(phone.calls.scheduled).toEqual([]);
  });
});

describe('the schedule', () => {
  it('holds only what is ahead and within 7 days, soonest first', async () => {
    const phone = fakePhone('granted');
    await turnOn(phone.port, db);
    const at = (iso: string) => requestFor('meal_lunch', new Date(iso));

    const count = await rebuildSchedule(
      phone.port,
      db,
      [at('2026-12-05T06:30:00Z'), at('2026-11-24T06:30:00Z'), at('2026-11-22T06:30:00Z'), at('2026-11-23T14:00:00Z')],
      NOW,
    );

    expect(count).toBe(2);
    expect(phone.calls.scheduled.map((request) => request.at.toISOString())).toEqual(['2026-11-23T14:00:00.000Z', '2026-11-24T06:30:00.000Z']);
  });

  it('keeps at most 40', () => {
    const many = Array.from({ length: 60 }, (_, n) => requestFor('meal_snack', new Date(NOW.getTime() + (n + 1) * 60_000)));

    const held = windowOf(many, NOW);

    expect(held).toHaveLength(MAX_PENDING);
    expect(held[0]?.at.getTime()).toBe(NOW.getTime() + 60_000);
  });

  it('schedules nothing while off, or once the phone has withdrawn its permission', async () => {
    const phone = fakePhone('granted');
    const request = requestFor('meal_dinner', new Date('2026-11-23T14:30:00Z'));

    expect(await rebuildSchedule(phone.port, db, [request], NOW)).toBe(0);

    await turnOn(phone.port, db);
    phone.withdraw();
    expect(await rebuildSchedule(phone.port, db, [request], NOW)).toBe(0);
    expect(phone.calls.scheduled).toEqual([]);
  });

  it('turns an IST wall-clock time into its instant, whatever the phone zone', () => {
    expect(istInstant('2026-11-23', '20:00').toISOString()).toBe('2026-11-23T14:30:00.000Z');
    expect(istInstant('2026-11-23', '00:30').toISOString()).toBe('2026-11-22T19:00:00.000Z');
  });

  it('names the kind of event only, on the channel of its category', () => {
    const request = requestFor('target_reached', NOW);

    expect(request).toMatchObject({ channel: 'goals', route: '/nutrition' });
    expect(request.body).not.toMatch(/\d/);
  });
});

describe('the test notification', () => {
  it('arrives in two seconds and opens the list', async () => {
    const phone = fakePhone('granted');

    await sendTest(phone.port, NOW);

    expect(phone.calls.scheduled).toEqual([
      { body: 'This is a test notification.', route: '/notifications', channel: 'reminders', at: new Date(NOW.getTime() + 2000) },
    ]);
  });
});
