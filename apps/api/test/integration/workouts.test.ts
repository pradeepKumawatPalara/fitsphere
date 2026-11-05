import { randomUUID } from 'node:crypto';
import { addDays, istToday, type SyncResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';
import { connect, insertUser } from './database.ts';

// Workouts through POST /v1/sync and GET /v1/users/{userId}/workouts (REQ-TRN-003, REQ-TRN-004,
// REQ-NFR-004), the self-access cases for them (REQ-NFR-001, D-20), the workouts table and the log
// rule (invariant #7). The sync route's authorization block is in sync.test.ts.

// A fixed clock: 2026-10-28 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);
const RECORDED_AT = `${TODAY}T02:00:00.000Z`;
const DELETED_AT = `${TODAY}T03:00:00.000Z`;

const NONE = { calories: null, averageHeartRateBpm: null, highestHeartRateBpm: null, note: null };
const SQUAT_SET = { reps: 10, weightGrams: 40_000, seconds: null };
const SQUAT = { kind: 'sets', name: 'Squat', sets: [SQUAT_SET, SQUAT_SET, SQUAT_SET], durationSeconds: null, ...NONE };
const PUSH_UP = {
  kind: 'sets',
  name: 'Push-up',
  sets: [
    { reps: 20, weightGrams: null, seconds: null },
    { reps: 15, weightGrams: null, seconds: null },
  ],
  durationSeconds: null,
  ...NONE,
  note: 'Slow on the way down',
};
const PLANK = { kind: 'sets', name: 'Plank', sets: [{ reps: null, weightGrams: null, seconds: 60 }], durationSeconds: null, ...NONE };
const RUN = {
  kind: 'cardio',
  name: 'Running',
  durationSeconds: 1_800,
  distanceMetres: 5_000,
  speedMetresPerHour: null,
  inclinePermille: null,
  level: null,
  ...NONE,
  calories: { kcal: 368, estimated: true },
  averageHeartRateBpm: 148,
  highestHeartRateBpm: 172,
};
/** The squat as an app before D-50 saved it: the same reps and weight for every set. */
const EARLIER_SQUAT = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

function workout(id: string, day: string, exercises: unknown[] = [SQUAT], changeId: string = randomUUID()) {
  return { changeId, type: 'workout.set', data: { id, day, exercises, recordedAt: RECORDED_AT } };
}

function deletion(id: string, changeId: string = randomUUID()) {
  return { changeId, type: 'workout.delete', data: { id, deletedAt: DELETED_AT } };
}

async function syncOk(user: TestUser, changes: unknown[], cursor: string | null = null): Promise<SyncResponse> {
  const response = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor, changes },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function storedWorkouts(userId: string) {
  const { rows } = await api.db.query(
    `select id, day::text as day, exercises, deleted_at from app.workouts where user_id = $1 order by day, id`,
    [userId],
  );
  return rows;
}

function read(userId: string, token: string | null, query = `from=${addDays(TODAY, -120)}&to=${TODAY}`) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/users/${userId}/workouts?${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('REQ-TRN-003 workouts through POST /v1/sync', () => {
  it('REQ-TRN-003 applies a workout and returns it in the pull', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const reply = await syncOk(user, [workout(id, TODAY, [SQUAT, PUSH_UP])]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted']);
    expect(reply.pull.workouts).toEqual([
      {
        deleted: false,
        id,
        day: TODAY,
        exercises: [SQUAT, PUSH_UP],
        recordedAt: RECORDED_AT,
        updatedAt: expect.stringMatching(/Z$/),
      },
    ]);
  });

  it('D-50 sets with their own reps, weight and time, and cardio with its distance, calories and heart rate', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const reply = await syncOk(user, [workout(id, TODAY, [PUSH_UP, PLANK, RUN])]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted']);
    expect(reply.pull.workouts.map((entry) => (entry.deleted ? null : entry.exercises))).toEqual([[PUSH_UP, PLANK, RUN]]);
    expect((await storedWorkouts(user.id)).map((row) => row.exercises)).toEqual([[PUSH_UP, PLANK, RUN]]);
  });

  it('D-50 a change from an app before D-50 is stored and served as that many identical sets', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const reply = await syncOk(user, [workout(id, TODAY, [EARLIER_SQUAT])]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted']);
    expect(reply.pull.workouts.map((entry) => (entry.deleted ? null : entry.exercises))).toEqual([[SQUAT]]);
    expect((await storedWorkouts(user.id)).map((row) => row.exercises)).toEqual([[SQUAT]]);
  });

  it('D-50 a workout stored before D-50 comes back in the pull and the history as identical sets', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [workout(id, TODAY, [SQUAT])]);
    await api.db.query('update app.workouts set exercises = $2::jsonb where user_id = $1', [user.id, JSON.stringify([EARLIER_SQUAT])]);

    const pulled = await syncOk(user, []);
    const history = await read(user.id, user.token);

    expect(pulled.pull.workouts.map((entry) => (entry.deleted ? null : entry.exercises))).toEqual([[SQUAT]]);
    expect(history.json().items.map((item: { exercises: unknown }) => item.exercises)).toEqual([[SQUAT]]);
  });

  it('Q-025 accepts an empty workout, and a day may hold several workouts', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [workout(randomUUID(), TODAY, []), workout(randomUUID(), TODAY)]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect((await storedWorkouts(user.id)).map((row) => row.exercises.length).sort()).toEqual([0, 1]);
  });

  it('ADR-0007 rule 2 a second change for the workout replaces the whole workout', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [workout(id, TODAY, [SQUAT, PUSH_UP])]);

    await syncOk(user, [workout(id, TODAY, [{ ...SQUAT, sets: [SQUAT_SET] }])]);

    expect(await storedWorkouts(user.id)).toEqual([{ id, day: TODAY, exercises: [{ ...SQUAT, sets: [SQUAT_SET] }], deleted_at: null }]);
  });

  it('REQ-DATE-001 a day later than today in IST is rejected with DAY_IN_FUTURE', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [workout(randomUUID(), addDays(TODAY, 1))]);

    expect(reply.results[0]?.error?.code).toBe('DAY_IN_FUTURE');
    expect(await storedWorkouts(user.id)).toEqual([]);
  });

  it('D-29 an unknown field, a value out of range or 31 exercises is rejected, without the values', async () => {
    const user = await api.signUpWithAccount();
    const unknownField = workout(randomUUID(), TODAY, [{ ...SQUAT, rpe: 8 }]);
    const tooHeavy = workout(randomUUID(), TODAY, [{ ...SQUAT, sets: [{ ...SQUAT_SET, weightGrams: 500_001 }] }]);
    const tooMany = workout(randomUUID(), TODAY, Array.from({ length: 31 }, () => SQUAT));
    const named = workout(randomUUID(), TODAY);
    (named.data as Record<string, unknown>).userId = randomUUID();

    const reply = await syncOk(user, [unknownField, tooHeavy, tooMany, named]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
    ]);
    expect(JSON.stringify(reply.results)).not.toContain('500001');
    expect(await storedWorkouts(user.id)).toEqual([]);
  });

  it('ADR-0007 a change sent twice is applied once, and the second reply matches the first', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    const first = workout(id, TODAY, [SQUAT]);
    const replyOne = await syncOk(user, [first]);
    await syncOk(user, [workout(id, TODAY, [PUSH_UP])]);

    const replyTwo = await syncOk(user, [first]);

    expect(replyTwo.results).toEqual(replyOne.results);
    expect((await storedWorkouts(user.id)).map((row) => row.exercises)).toEqual([[PUSH_UP]]);
  });

  it('D-29 a deletion keeps an empty row and comes back in the pull as deleted', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    const created = await syncOk(user, [workout(id, TODAY)]);

    const reply = await syncOk(user, [deletion(id)], created.cursor);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(reply.pull.workouts).toEqual([{ deleted: true, id, day: TODAY, updatedAt: expect.stringMatching(/Z$/) }]);
    expect(await storedWorkouts(user.id)).toEqual([{ id, day: TODAY, exercises: null, deleted_at: new Date(DELETED_AT) }]);
  });

  it('ADR-0007 rule 2 a workout saved after its deletion is restored; deleting an unknown ID changes nothing', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [workout(id, TODAY), deletion(id)]);

    const reply = await syncOk(user, [workout(id, TODAY, [PUSH_UP]), deletion(randomUUID())]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect(await storedWorkouts(user.id)).toEqual([{ id, day: TODAY, exercises: [PUSH_UP], deleted_at: null }]);
  });

  it('REQ-ROLE-002 both change types need the Personal Training User role', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(`delete from app.user_roles where user_id = $1 and role = 'personal'`, [user.id]);

    const reply = await syncOk(user, [workout(randomUUID(), TODAY), deletion(randomUUID())]);

    expect(reply.results.map((result) => result.error?.code)).toEqual(['ROLE_NOT_ENABLED', 'ROLE_NOT_ENABLED']);
  });
});

describe('REQ-NFR-001 self-access for workouts (D-20)', () => {
  it('REQ-NFR-001 a second user’s sync never changes, deletes or returns the first user’s workout, even with the same workout ID and changeId', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    const id = randomUUID();
    const changeId = randomUUID();
    await syncOk(userA, [workout(id, TODAY, [SQUAT], changeId)]);

    const replyB = await syncOk(userB, [workout(id, TODAY, [PUSH_UP], changeId)]);
    await syncOk(userB, [deletion(id)]);

    expect(replyB.results[0]?.status).toBe('accepted');
    expect(replyB.pull.workouts.map((entry) => (entry.deleted ? null : entry.exercises))).toEqual([[PUSH_UP]]);
    expect(await storedWorkouts(userA.id)).toEqual([{ id, day: TODAY, exercises: [SQUAT], deleted_at: null }]);
    expect((await storedWorkouts(userB.id)).map((row) => row.exercises)).toEqual([null]);
    const againA = await syncOk(userA, []);
    expect(againA.pull.workouts).toEqual([expect.objectContaining({ deleted: false, id, exercises: [SQUAT] })]);
  });
});

describe('ADR-0007 rule 1 workouts in the pull', () => {
  it('ADR-0007 rule 1 returns workouts of the last 90 IST days only', async () => {
    const user = await api.signUpWithAccount();
    const firstDay = addDays(TODAY, -89);
    await syncOk(user, [workout(randomUUID(), addDays(TODAY, -90)), workout(randomUUID(), firstDay)]);

    const reply = await syncOk(user, []);

    expect(reply.pull.workouts.map((entry) => entry.day)).toEqual([firstDay]);
  });

  it('ADR-0007 pages across kinds, workouts included, in change order with one cursor', async () => {
    const paged = await startTestApi({ now: () => NOW, syncPageSize: 2 });
    try {
      const user = await paged.signUpWithAccount();
      const call = async (cursor: string | null, changes: unknown[] = []) => {
        const response = await paged.app.inject({
          method: 'POST',
          url: '/v1/sync',
          headers: { authorization: `Bearer ${user.token}` },
          payload: { cursor, changes },
        });
        return response.json() as SyncResponse;
      };
      const first = await call(null, [
        { changeId: randomUUID(), type: 'steps.set', data: { day: TODAY, steps: 1, recordedAt: RECORDED_AT } },
        workout(randomUUID(), TODAY),
        workout(randomUUID(), TODAY, []),
        { changeId: randomUUID(), type: 'target.set', data: { kind: 'weekly_workouts', value: 4, setAt: RECORDED_AT } },
      ]);
      const second = await call(first.cursor);

      expect([first.hasMore, second.hasMore]).toEqual([true, false]);
      const kinds = [first, second].map((reply) =>
        Object.entries(reply.pull)
          .filter(([, items]) => items.length > 0)
          .map(([kind, items]) => `${kind}:${items.length}`),
      );
      expect(kinds).toEqual([['steps:1', 'workouts:1'], ['workouts:1', 'targets:1']]);
    } finally {
      await paged.close();
    }
  });
});

describe('authorization: GET /v1/users/:userId/workouts', () => {
  let owner: TestUser & { id: string };

  beforeAll(async () => {
    owner = await api.signUpWithAccount();
    await syncOk(owner, [workout(randomUUID(), addDays(TODAY, -3))]);
  });

  it('REQ-NFR-001 the user themselves gets 200 with their workouts', async () => {
    const response = await read(owner.id, owner.token);

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { day: string }) => item.day)).toEqual([addDays(TODAY, -3)]);
    expect(response.json().nextCursor).toBeNull();
  });

  it('REQ-NFR-001 another signed-in user with an account gets 404', async () => {
    const other = await api.signUpWithAccount();

    const response = await read(owner.id, other.token);

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'NOT_FOUND', message: 'Not available.', details: null });
  });

  it('T-01 a user ID that does not exist gets the same 404 as another user', async () => {
    const other = await api.signUpWithAccount();

    for (const response of [
      await read(randomUUID(), other.token),
      await read(owner.id, other.token),
      await read('not-a-uuid', other.token),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toEqual({
        code: 'NOT_FOUND',
        message: 'Not available.',
        retryable: false,
        requestId: expect.any(String),
        details: null,
      });
    }
  });

  it('REQ-NFR-001 no token, an expired token or one signed by another key gets 401', async () => {
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, owner.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, owner.subject),
    ]) {
      expect((await read(owner.id, token)).statusCode).toBe(401);
    }
  });

  it('REQ-ACC-010 signed in without an account set up gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await read(owner.id, user.token);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });
});

describe('REQ-TRN-004 workout history', () => {
  let user: TestUser & { id: string };
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort();
  const [oldest, sameDayA, sameDayB, recent, deleted] = ids as [string, string, string, string, string];

  beforeAll(async () => {
    user = await api.signUpWithAccount();
    await syncOk(user, [
      workout(recent, addDays(TODAY, -5)),
      workout(sameDayB, addDays(TODAY, -95), [PUSH_UP]),
      workout(sameDayA, addDays(TODAY, -95), []),
      workout(oldest, addDays(TODAY, -100)),
      workout(deleted, addDays(TODAY, -95)),
      deletion(deleted),
    ]);
  });

  it('REQ-TRN-004 returns the requested IST days, oldest first, without deleted workouts', async () => {
    const response = await read(user.id, user.token, `from=${addDays(TODAY, -99)}&to=${TODAY}`);

    expect(response.json().items).toEqual([
      { id: sameDayA, day: addDays(TODAY, -95), exercises: [], recordedAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) },
      { id: sameDayB, day: addDays(TODAY, -95), exercises: [PUSH_UP], recordedAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) },
      { id: recent, day: addDays(TODAY, -5), exercises: [SQUAT], recordedAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) },
    ]);
  });

  it('api-conventions pages with limit and an opaque cursor, also within one day', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page += 1) {
      const query: string = `from=${addDays(TODAY, -120)}&to=${TODAY}&limit=1${cursor ? `&cursor=${cursor}` : ''}`;
      const body = (await read(user.id, user.token, query)).json();
      seen.push(...body.items.map((item: { id: string }) => item.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }

    expect(seen).toEqual([oldest, sameDayA, sameDayB, recent]);
    expect(cursor).toBeNull();
  });

  it('api-conventions refuses a cursor that is not the route’s, unknown query fields and a limit over 500', async () => {
    const weighInCursor = Buffer.from(`v1d:${TODAY}`).toString('base64url');
    for (const query of [
      `from=${TODAY}&to=${TODAY}&cursor=${weighInCursor}`,
      `to=${TODAY}`,
      `from=${TODAY}&to=${TODAY}&userId=x`,
      `from=${TODAY}&to=${TODAY}&limit=501`,
    ]) {
      const response = await read(user.id, user.token, query);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
  });
});

describe('Workouts table (migration 0007)', () => {
  const CHECK_VIOLATION = '23514';
  const UNIQUE_VIOLATION = '23505';
  let client: pg.Client;

  beforeAll(async () => {
    client = await connect();
  });

  afterAll(async () => {
    await client.end();
  });

  const insert = (userId: string, id: string, exercises: string | null, deletedAt: string | null = null) =>
    client.query(
      `insert into app.workouts (user_id, id, day, exercises, recorded_at, deleted_at)
       values ($1, $2, '2026-10-05', $3::jsonb, now(), $4)`,
      [userId, id, exercises, deletedAt],
    );
  const sqlState = (error: unknown) => (error as { code?: string }).code;

  it('D-29 a live workout has an array of at most 30 exercises; a deleted one has none', async () => {
    const user = await insertUser(client);
    const thirty = JSON.stringify(Array.from({ length: 30 }, () => SQUAT));
    const thirtyOne = JSON.stringify(Array.from({ length: 31 }, () => SQUAT));
    await expect(insert(user, randomUUID(), null)).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
    await expect(insert(user, randomUUID(), '{}')).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
    await expect(insert(user, randomUUID(), thirtyOne)).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
    await expect(insert(user, randomUUID(), '[]', DELETED_AT)).rejects.toSatisfy(
      (error) => sqlState(error) === CHECK_VIOLATION,
    );
    await insert(user, randomUUID(), '[]');
    await insert(user, randomUUID(), thirty);
    await insert(user, randomUUID(), null, DELETED_AT);
  });

  it('invariant #1 a workout ID is unique per user only', async () => {
    const [userA, userB] = [await insertUser(client), await insertUser(client)];
    const id = randomUUID();
    await insert(userA, id, '[]');
    await insert(userB, id, '[]');
    await expect(insert(userA, id, '[]')).rejects.toSatisfy((error) => sqlState(error) === UNIQUE_VIOLATION);
  });

  it('REQ-NFR-004 an update takes a new change_seq; deleting the user deletes their workouts', async () => {
    const user = await insertUser(client);
    const id = randomUUID();
    await insert(user, id, '[]');
    const before = await client.query(`select change_seq from app.workouts where user_id = $1`, [user]);
    await client.query(`update app.workouts set exercises = $2::jsonb where user_id = $1`, [user, JSON.stringify([SQUAT])]);
    const after = await client.query(`select change_seq from app.workouts where user_id = $1`, [user]);
    expect(BigInt(after.rows[0].change_seq)).toBeGreaterThan(BigInt(before.rows[0].change_seq));

    await client.query('delete from app.users where id = $1', [user]);
    expect((await client.query('select 1 from app.workouts where user_id = $1', [user])).rowCount).toBe(0);
  });
});

describe('invariant #7 workout logs', () => {
  it('ADR-0002 step 6 the log holds no exercise name, note or weight, and no history query value', async () => {
    const lines: string[] = [];
    const logged = await startTestApi({ now: () => NOW, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
    try {
      const user = await logged.signUpWithAccount();
      const auth = { authorization: `Bearer ${user.token}` };
      await logged.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: auth,
        payload: {
          cursor: null,
          changes: [
            workout(randomUUID(), '2026-10-02', [
              {
                ...SQUAT,
                name: 'synthetic-exercise-9e2b',
                sets: [{ reps: 10, weightGrams: 123_456, seconds: null }],
                note: 'synthetic-note-4a7c',
              },
            ]),
          ],
        },
      });
      await logged.app.inject({ method: 'GET', url: `/v1/users/${user.id}/workouts?from=2026-09-13&to=2026-10-02`, headers: auth });

      const log = lines.join('');
      expect(log).not.toContain('synthetic-exercise-9e2b');
      expect(log).not.toContain('synthetic-note-4a7c');
      expect(log).not.toContain('123456');
      expect(log).not.toContain('2026-09-13');
      expect(log).not.toContain('2026-10-02');
      const requests = lines.map((line) => JSON.parse(line)).filter((entry) => entry.msg === 'request');
      expect(requests.at(-1)).toMatchObject({ method: 'GET', route: '/v1/users/:userId/workouts', status: 200 });
    } finally {
      await logged.close();
    }
  });
});
