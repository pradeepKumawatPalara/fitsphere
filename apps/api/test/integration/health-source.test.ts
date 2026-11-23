import { randomUUID } from 'node:crypto';
import { addDays, istToday, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApi, type TestUser } from './app.ts';

// D-121, ADR-0013, docs/plans/health-connect.md: steps and weight carry a source. A value the user
// typed is never replaced by an import from the phone's health store; synthetic data only.

// A fixed clock: 2026-10-28 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);
const YESTERDAY = addDays(TODAY, -1);

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

type Source = 'manual' | 'health_connect';

function weighIn(day: string, weightGrams: number, source?: Source) {
  return {
    changeId: randomUUID(),
    type: 'weighIn.set',
    data: { day, weightGrams, recordedAt: `${day}T02:00:00.000Z`, ...(source ? { source } : {}) },
  };
}

function steps(day: string, count: number, source?: Source) {
  return {
    changeId: randomUUID(),
    type: 'steps.set',
    data: { day, steps: count, recordedAt: `${day}T02:00:00.000Z`, ...(source ? { source } : {}) },
  };
}

async function syncOk(user: TestUser, changes: unknown[]): Promise<SyncResponse> {
  const response = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor: null, changes },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function stored(table: 'weigh_ins' | 'step_counts', userId: string) {
  const column = table === 'weigh_ins' ? 'weight_grams' : 'steps';
  const { rows } = await api.db.query<{ day: string; value: number; source: string }>(
    `select day::text as day, ${column} as value, source from app.${table} where user_id = $1 order by day`,
    [userId],
  );
  return rows;
}

// The same rules for both tables: [name, table, the change to make, the stored value's name].
const KINDS = [
  { name: 'weight', table: 'weigh_ins', make: weighIn, a: 70_000, b: 71_000, c: 72_000 },
  { name: 'steps', table: 'step_counts', make: steps, a: 5_000, b: 6_000, c: 7_000 },
] as const;

describe.each(KINDS)('D-121 $name source', ({ table, make, a, b, c }) => {
  it('a value with no source is the user\'s own (a phone before D-121)', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [make(TODAY, a)]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted', error: null });
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: a, source: 'manual' }]);
  });

  it('an import fills an empty day, tagged health_connect, and the pull says so', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [make(TODAY, a, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted', error: null });
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: a, source: 'health_connect' }]);
    const pulled = table === 'weigh_ins' ? reply.pull.weighIns : reply.pull.steps;
    expect(pulled).toEqual([expect.objectContaining({ day: TODAY, source: 'health_connect' })]);
  });

  it('a later import updates an earlier import (steps grow through the day)', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a, 'health_connect')]);

    const reply = await syncOk(user, [make(TODAY, b, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted', error: null });
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: b, source: 'health_connect' }]);
  });

  it('an import never replaces a value the user typed: rejected MANUAL_VALUE_EXISTS, value kept', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a, 'manual')]);

    const reply = await syncOk(user, [make(TODAY, b, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'MANUAL_VALUE_EXISTS', details: null } });
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: a, source: 'manual' }]);
  });

  it('the same refused import sent again gets the same reply', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a)]);
    const import_ = make(TODAY, b, 'health_connect');

    const first = await syncOk(user, [import_]);
    const second = await syncOk(user, [import_]);

    expect(second.results).toEqual(first.results);
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: a, source: 'manual' }]);
  });

  it('a value the user types over an import makes it theirs, and a later import cannot change it', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a, 'health_connect')]);

    await syncOk(user, [make(TODAY, b)]);
    const reply = await syncOk(user, [make(TODAY, c, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'MANUAL_VALUE_EXISTS' } });
    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: b, source: 'manual' }]);
  });

  it('a typed value replaces a typed value, as before', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a)]);

    await syncOk(user, [make(TODAY, b, 'manual')]);

    expect(await stored(table, user.id)).toEqual([{ day: TODAY, value: b, source: 'manual' }]);
  });

  it('each day decides alone: a typed day does not stop an import for another day', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [make(TODAY, a)]);

    const reply = await syncOk(user, [make(YESTERDAY, b, 'health_connect'), make(TODAY, c, 'health_connect')]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'rejected']);
    expect(await stored(table, user.id)).toEqual([
      { day: YESTERDAY, value: b, source: 'health_connect' },
      { day: TODAY, value: a, source: 'manual' },
    ]);
  });

  it('REQ-NFR-001 an import changes only the caller\'s own rows, never another user\'s', async () => {
    const owner = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    await syncOk(owner, [make(TODAY, a)]);

    const reply = await syncOk(other, [make(TODAY, b, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted' });
    expect(await stored(table, owner.id)).toEqual([{ day: TODAY, value: a, source: 'manual' }]);
    expect(await stored(table, other.id)).toEqual([{ day: TODAY, value: b, source: 'health_connect' }]);
  });

  it('an unknown source, or a source in the wrong type, is VALIDATION_FAILED and changes nothing', async () => {
    const user = await api.signUpWithAccount();
    const unknown = make(TODAY, a);
    (unknown.data as Record<string, unknown>).source = 'fitbit';
    const wrongType = make(TODAY, a);
    (wrongType.data as Record<string, unknown>).source = 1;

    const reply = await syncOk(user, [unknown, wrongType]);

    expect(reply.results.map((result) => result.error?.code)).toEqual(['VALIDATION_FAILED', 'VALIDATION_FAILED']);
    expect(await stored(table, user.id)).toEqual([]);
  });

  it('an import for a day in the future is DAY_IN_FUTURE, as for a typed value', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [make(addDays(TODAY, 1), a, 'health_connect')]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'DAY_IN_FUTURE' } });
  });
});

describe('D-121 migration 0036', () => {
  it('a row that exists before the migration reads as manual: the column defaults to manual', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(
      `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, $2, 70000, now())`,
      [user.id, TODAY],
    );
    await api.db.query(`insert into app.step_counts (user_id, day, steps, recorded_at) values ($1, $2, 5000, now())`, [
      user.id,
      TODAY,
    ]);

    expect((await stored('weigh_ins', user.id))[0]?.source).toBe('manual');
    expect((await stored('step_counts', user.id))[0]?.source).toBe('manual');
  });

  it('the database refuses a source that is neither manual nor health_connect', async () => {
    const user = await api.signUpWithAccount();

    await expect(
      api.db.query(
        `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at, source) values ($1, $2, 70000, now(), 'fitbit')`,
        [user.id, TODAY],
      ),
    ).rejects.toThrow(/source/);
    await expect(
      api.db.query(
        `insert into app.step_counts (user_id, day, steps, recorded_at, source) values ($1, $2, 5000, now(), 'fitbit')`,
        [user.id, TODAY],
      ),
    ).rejects.toThrow(/source/);
  });
});

describe('D-121 the weigh-in history sends the source', () => {
  it('GET /v1/users/{userId}/weigh-ins says where each value came from', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [weighIn(YESTERDAY, 70_000, 'health_connect'), weighIn(TODAY, 70_500)]);

    const history = await api.app.inject({
      method: 'GET',
      url: `/v1/users/${user.id}/weigh-ins?from=${addDays(TODAY, -5)}&to=${TODAY}`,
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(history.statusCode).toBe(200);
    expect(history.json().items).toEqual([
      expect.objectContaining({ day: YESTERDAY, source: 'health_connect' }),
      expect.objectContaining({ day: TODAY, source: 'manual' }),
    ]);
  });
});

describe('D-121 healthImport.remove (Disconnect, then Remove)', () => {
  const remove = (data: unknown = { removedAt: NOW.toISOString() }) => ({ changeId: randomUUID(), type: 'healthImport.remove', data });

  it('deletes the caller imported steps and weights and keeps the ones the user typed', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [
      weighIn(YESTERDAY, 70_000, 'health_connect'),
      weighIn(TODAY, 70_500),
      steps(YESTERDAY, 5_000, 'health_connect'),
      steps(TODAY, 6_000),
    ]);

    const reply = await syncOk(user, [remove()]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted', error: null });
    expect(await stored('weigh_ins', user.id)).toEqual([{ day: TODAY, value: 70_500, source: 'manual' }]);
    expect(await stored('step_counts', user.id)).toEqual([{ day: TODAY, value: 6_000, source: 'manual' }]);
  });

  it('REQ-NFR-001 never touches the imported values of another user', async () => {
    const owner = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    await syncOk(owner, [weighIn(TODAY, 70_000, 'health_connect'), steps(TODAY, 5_000, 'health_connect')]);

    await syncOk(other, [remove()]);

    expect(await stored('weigh_ins', owner.id)).toHaveLength(1);
    expect(await stored('step_counts', owner.id)).toHaveLength(1);
  });

  it('a change that names anything else (a user, a day) is VALIDATION_FAILED and deletes nothing', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [weighIn(TODAY, 70_000, 'health_connect')]);

    const reply = await syncOk(user, [remove({ removedAt: NOW.toISOString(), day: TODAY }), remove({})]);

    expect(reply.results.map((result) => result.error?.code)).toEqual(['VALIDATION_FAILED', 'VALIDATION_FAILED']);
    expect(await stored('weigh_ins', user.id)).toHaveLength(1);
  });
});
