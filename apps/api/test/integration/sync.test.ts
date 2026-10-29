import { randomUUID } from 'node:crypto';
import { addDays, istToday, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// Test strategy "Sync (ADR-0007)" and the self-access cases (REQ-NFR-001, REQ-NFR-004, D-20).

// A fixed clock: 2026-10-28 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

function weighIn(day: string, weightGrams: number, changeId: string = randomUUID()) {
  return { changeId, type: 'weighIn.set', data: { day, weightGrams, recordedAt: `${day}T02:00:00.000Z` } };
}

async function sync(user: TestUser, changes: unknown[], cursor: string | null = null) {
  return api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor, changes },
  });
}

async function syncOk(user: TestUser, changes: unknown[], cursor: string | null = null): Promise<SyncResponse> {
  const response = await sync(user, changes, cursor);
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function storedWeighIns(userId: string) {
  const { rows } = await api.db.query(
    'select day::text as day, weight_grams from app.weigh_ins where user_id = $1 order by day',
    [userId],
  );
  return rows;
}

describe('authorization: POST /v1/sync', () => {
  it('REQ-NFR-001 no token, an expired token or another key get 401', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ]) {
      const response = await api.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        payload: { cursor: null, changes: [weighIn(TODAY, 70_000)] },
      });
      expect(response.statusCode).toBe(401);
    }
    expect(await storedWeighIns(user.id)).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await sync(user, [weighIn(TODAY, 70_000)]);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-NFR-001 a second user’s sync never changes or returns the first user’s weigh-ins, even with the same day and changeId', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    const shared = randomUUID();
    await syncOk(userA, [weighIn(TODAY, 70_000, shared)]);

    const reply = await syncOk(userB, [weighIn(TODAY, 90_000, shared)]);

    expect(reply.results).toEqual([{ changeId: shared, status: 'accepted', error: null }]);
    expect(reply.pull.weighIns).toEqual([expect.objectContaining({ day: TODAY, weightGrams: 90_000 })]);
    expect(await storedWeighIns(userA.id)).toEqual([{ day: TODAY, weight_grams: 70_000 }]);
    expect(await storedWeighIns(userB.id)).toEqual([{ day: TODAY, weight_grams: 90_000 }]);
    const againA = await syncOk(userA, []);
    expect(againA.pull.weighIns.map((entry) => entry.weightGrams)).toEqual([70_000]);
  });

  it('REQ-ROLE-002 logging a weight without the Personal Training User role is rejected', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(`delete from app.user_roles where user_id = $1 and role = 'personal'`, [user.id]);

    const reply = await syncOk(user, [weighIn(TODAY, 70_000)]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'ROLE_NOT_ENABLED' } });
    expect(await storedWeighIns(user.id)).toEqual([]);
  });
});

describe('ADR-0007 sync', () => {
  it('REQ-HOME-006 applies a weigh-in and returns it in the pull', async () => {
    const user = await api.signUpWithAccount();
    const change = weighIn(TODAY, 70_250);

    const reply = await syncOk(user, [change]);

    expect(reply.results).toEqual([{ changeId: change.changeId, status: 'accepted', error: null }]);
    expect(reply.pull).toEqual({
      weighIns: [
        { day: TODAY, weightGrams: 70_250, recordedAt: `${TODAY}T02:00:00.000Z`, updatedAt: expect.stringMatching(/Z$/) },
      ],
      steps: [],
      sleep: [],
      measurements: [],
      workouts: [],
      targets: [],
      meals: [],
      savedMeals: [],
      removals: [],
    });
    expect(reply.hasMore).toBe(false);
  });

  it('ADR-0007 a change sent twice is applied once, and the second reply matches the first', async () => {
    const user = await api.signUpWithAccount();
    const first = weighIn(TODAY, 70_000);
    const replyOne = await syncOk(user, [first]);
    await syncOk(user, [weighIn(TODAY, 71_000)]);

    const replyTwo = await syncOk(user, [first]);

    expect(replyTwo.results).toEqual(replyOne.results);
    // Applying it again would have overwritten the newer value.
    expect(await storedWeighIns(user.id)).toEqual([{ day: TODAY, weight_grams: 71_000 }]);
    const { rows } = await api.db.query('select count(*)::int as n from app.applied_changes where user_id = $1', [user.id]);
    expect(rows[0].n).toBe(2);
  });

  it('Q-030 two changes for the same day: the one received last wins', async () => {
    const user = await api.signUpWithAccount();

    await syncOk(user, [weighIn(TODAY, 70_000), weighIn(TODAY, 72_000)]);

    expect(await storedWeighIns(user.id)).toEqual([{ day: TODAY, weight_grams: 72_000 }]);
  });

  it('REQ-DATE-001 a day later than today in IST is rejected with DAY_IN_FUTURE; the others still apply', async () => {
    const user = await api.signUpWithAccount();
    const future = weighIn(addDays(TODAY, 1), 70_000);
    const today = weighIn(TODAY, 71_000);

    const reply = await syncOk(user, [future, today]);

    expect(reply.results).toEqual([
      {
        changeId: future.changeId,
        status: 'rejected',
        error: { code: 'DAY_IN_FUTURE', message: 'The date is in the future.', details: null },
      },
      { changeId: today.changeId, status: 'accepted', error: null },
    ]);
    expect(await storedWeighIns(user.id)).toEqual([{ day: TODAY, weight_grams: 71_000 }]);
  });

  it('invariant #5 today comes from the IST clock: 00:10 IST is already the next day', async () => {
    const lateApi = await startTestApi({ now: () => new Date('2026-10-27T18:40:00Z') });
    try {
      const user = await lateApi.signUpWithAccount();
      const response = await lateApi.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: { authorization: `Bearer ${user.token}` },
        payload: { cursor: null, changes: [weighIn('2026-10-28', 70_000)] },
      });
      expect(response.json().results[0].status).toBe('accepted');
    } finally {
      await lateApi.close();
    }
  });

  it('REQ-HOME-006 out-of-range and malformed values are rejected per change, without the value', async () => {
    const user = await api.signUpWithAccount();
    const tooHeavy = weighIn(TODAY, 300_001);
    const notWhole = weighIn(TODAY, 70_000.5);
    const badDay = { ...weighIn(TODAY, 70_000), data: { day: '2026-02-30', weightGrams: 70_000, recordedAt: NOW.toISOString() } };
    const extraField = { ...weighIn(TODAY, 70_000), data: { ...weighIn(TODAY, 70_000).data, userId: randomUUID() } };

    const response = await sync(user, [tooHeavy, notWhole, badDay, extraField]);
    const reply: SyncResponse = response.json();

    expect(reply.results.map((entry) => entry.error?.code)).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
    ]);
    expect(response.body).not.toContain('300001');
    expect(await storedWeighIns(user.id)).toEqual([]);
  });

  it('ADR-0007 an unknown change type is rejected with UNKNOWN_CHANGE_TYPE', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [{ changeId: randomUUID(), type: 'meal.add', data: {} }]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'UNKNOWN_CHANGE_TYPE' } });
  });

  it('error model: more than 100 changes is 413 PAYLOAD_TOO_LARGE and nothing is applied', async () => {
    const user = await api.signUpWithAccount();
    const changes = Array.from({ length: 101 }, (_, index) => weighIn(addDays(TODAY, -index), 70_000));

    const response = await sync(user, changes);

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await storedWeighIns(user.id)).toEqual([]);
  });

  it('error model: an unknown field, a bad change ID or a bad cursor fails the whole request', async () => {
    const user = await api.signUpWithAccount();

    const extra = await api.app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { cursor: null, changes: [], userId: user.id },
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.json().error.details).toEqual([{ field: 'userId', issue: 'unknown_field' }]);

    const badId = await sync(user, [{ changeId: 'not-a-uuid', type: 'weighIn.set', data: {} }]);
    expect(badId.json().error.details).toEqual([{ field: 'changes[0].changeId', issue: 'invalid_format' }]);

    const badCursor = await sync(user, [], 'made-up');
    expect(badCursor.json().error.details).toEqual([{ field: 'cursor', issue: 'invalid_format' }]);
  });
});

describe('ADR-0007 rule 1 the pull', () => {
  it('ADR-0007 rule 1 returns only the user’s own weigh-ins from the last 90 IST days', async () => {
    const user = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    await syncOk(other, [weighIn(TODAY, 99_000)]);
    const firstDay = addDays(TODAY, -89);
    await syncOk(user, [weighIn(addDays(TODAY, -90), 70_000), weighIn(firstDay, 70_100), weighIn(TODAY, 70_200)]);

    const reply = await syncOk(user, []);

    expect(reply.pull.weighIns.map((entry) => entry.day)).toEqual([firstDay, TODAY]);
  });

  it('ADR-0007 returns nothing new on a repeat with the latest cursor, then only what changed', async () => {
    const user = await api.signUpWithAccount();
    const first = await syncOk(user, [weighIn(TODAY, 70_000)]);

    const repeat = await syncOk(user, [], first.cursor);
    expect(repeat.pull.weighIns).toEqual([]);
    expect(repeat.cursor).toBe(first.cursor);

    const yesterday = addDays(TODAY, -1);
    const changed = await syncOk(user, [weighIn(yesterday, 70_500)], repeat.cursor);
    expect(changed.pull.weighIns.map((entry) => entry.day)).toEqual([yesterday]);
  });

  it('ADR-0007 pages the pull with hasMore and a new cursor', async () => {
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
      const days = [0, 1, 2, 3, 4].map((offset) => addDays(TODAY, -offset));
      const first = await call(null, days.map((day) => weighIn(day, 70_000)));
      const second = await call(first.cursor);
      const third = await call(second.cursor);

      expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
      const pulled = [first, second, third].flatMap((reply) => reply.pull.weighIns.map((entry) => entry.day));
      expect(pulled.sort()).toEqual([...days].sort());
    } finally {
      await paged.close();
    }
  });
});
