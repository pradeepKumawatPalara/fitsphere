import { randomUUID } from 'node:crypto';
import { addDays, istToday, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApi, type TestUser } from './app.ts';

// Steps, sleep, measurements and targets through POST /v1/sync (REQ-HOME-006, REQ-MEAS-*,
// REQ-ROLE-007, REQ-NFR-004), and the self-access cases for them (REQ-NFR-001, D-20).
// The route's authorization block is in sync.test.ts.

// A fixed clock: 2026-10-28 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);
const RECORDED_AT = `${TODAY}T02:00:00.000Z`;

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

function change(type: string, data: Record<string, unknown>, changeId: string = randomUUID()) {
  return { changeId, type, data };
}

const steps = (day: string, count: number, changeId?: string) =>
  change('steps.set', { day, steps: count, recordedAt: RECORDED_AT }, changeId);
const sleep = (day: string, sleepMinutes: number, changeId?: string) =>
  change('sleep.set', { day, sleepMinutes, recordedAt: RECORDED_AT }, changeId);
const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };
const measurements = (day: string, waistMm: number, extra: Record<string, unknown> = {}, changeId?: string) =>
  change(
    'measurements.set',
    { day, upperWaistMm: waistMm, lowerWaistMm: waistMm + 30, ...NO_OPTIONAL, ...extra, recordedAt: RECORDED_AT },
    changeId,
  );
// A target from today on, unless another day is given (D-77).
const target = (kind: string, value: number, extra: Record<string, unknown> = {}, changeId?: string) =>
  change('target.set', { kind, value, day: TODAY, setAt: RECORDED_AT, ...extra }, changeId);

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

async function rowsOf(table: string, userId: string, columns: string) {
  const { rows } = await api.db.query(`select ${columns} from app.${table} where user_id = $1 order by 1`, [userId]);
  return rows;
}

describe('REQ-HOME-006 steps and sleep', () => {
  it('REQ-HOME-006 applies steps and sleep and returns them in the pull', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [steps(TODAY, 8_432), sleep(TODAY, 450)]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted']);
    expect(reply.pull.steps).toEqual([
      { day: TODAY, steps: 8_432, recordedAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) },
    ]);
    expect(reply.pull.sleep).toEqual([
      { day: TODAY, sleepMinutes: 450, recordedAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) },
    ]);
  });

  it('Q-030 a second value for the day replaces the first', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [steps(TODAY, 1_000), sleep(TODAY, 300)]);

    await syncOk(user, [steps(TODAY, 2_000), sleep(TODAY, 480)]);

    expect(await rowsOf('step_counts', user.id, 'day::text, steps')).toEqual([{ day: TODAY, steps: 2_000 }]);
    expect(await rowsOf('sleep_logs', user.id, 'day::text, sleep_minutes')).toEqual([{ day: TODAY, sleep_minutes: 480 }]);
  });

  it('REQ-DATE-001 a day later than today in IST is rejected with DAY_IN_FUTURE', async () => {
    const user = await api.signUpWithAccount();
    const tomorrow = addDays(TODAY, 1);

    const reply = await syncOk(user, [steps(tomorrow, 10), sleep(tomorrow, 10)]);

    expect(reply.results.map((result) => result.error?.code)).toEqual(['DAY_IN_FUTURE', 'DAY_IN_FUTURE']);
    expect(await rowsOf('step_counts', user.id, 'day')).toEqual([]);
  });

  it('Q-028 out-of-range values are rejected per change, without the value', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [steps(TODAY, 200_001), sleep(TODAY, 1_441), steps(TODAY, 12.5)]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
    ]);
    expect(JSON.stringify(reply)).not.toContain('200001');
    expect(await rowsOf('step_counts', user.id, 'day')).toEqual([]);
  });
});

describe('REQ-MEAS-001…006 measurements', () => {
  it('REQ-MEAS-004 applies both waist values with the optional fields empty', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [measurements(TODAY, 812)]);

    expect(reply.pull.measurements).toEqual([
      {
        day: TODAY,
        upperWaistMm: 812,
        lowerWaistMm: 842,
        ...NO_OPTIONAL,
        recordedAt: RECORDED_AT,
        updatedAt: expect.stringMatching(/Z$/),
      },
    ]);
  });

  it('Q-030 a second entry for the day replaces the whole first one, clearing fields left empty', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [measurements(TODAY, 812, { chestMm: 990, notes: 'Synthetic note' })]);

    await syncOk(user, [measurements(TODAY, 800)]);

    expect(await rowsOf('measurements', user.id, 'upper_waist_mm, chest_mm, notes')).toEqual([
      { upper_waist_mm: 800, chest_mm: null, notes: null },
    ]);
  });

  it('REQ-MEAS-004 a missing waist value, or one outside 10–250 cm, is rejected', async () => {
    const user = await api.signUpWithAccount();
    const missing = measurements(TODAY, 812);
    delete (missing.data as Record<string, unknown>).lowerWaistMm;

    const reply = await syncOk(user, [missing, measurements(TODAY, 99), measurements(TODAY, 812, { armMm: 2_501 })]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
    ]);
    expect(await rowsOf('measurements', user.id, 'day')).toEqual([]);
  });

  it('REQ-DATE-001 a future day is rejected with DAY_IN_FUTURE', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [measurements(addDays(TODAY, 1), 812)]);

    expect(reply.results[0]?.error?.code).toBe('DAY_IN_FUTURE');
  });
});

describe('REQ-ROLE-007 own targets', () => {
  it('REQ-ROLE-007 sets each kind, recording the caller as who set it', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [
      target('calories', 2_000),
      target('protein', 120),
      target('steps', 10_000),
      target('weekly_workouts', 4),
      target('body_weight', 68_500),
      // D-70.
      target('carbs', 250),
      target('fat', 60),
      target('fibre', 30),
    ]);

    expect(reply.results.every((result) => result.status === 'accepted')).toBe(true);
    expect(reply.pull.targets.map(({ kind, value, setByUserId }) => ({ kind, value, setByUserId }))).toEqual([
      { kind: 'calories', value: 2_000, setByUserId: user.id },
      { kind: 'protein', value: 120, setByUserId: user.id },
      { kind: 'steps', value: 10_000, setByUserId: user.id },
      { kind: 'weekly_workouts', value: 4, setByUserId: user.id },
      { kind: 'body_weight', value: 68_500, setByUserId: user.id },
      { kind: 'carbs', value: 250, setByUserId: user.id },
      { kind: 'fat', value: 60, setByUserId: user.id },
      { kind: 'fibre', value: 30, setByUserId: user.id },
    ]);
    expect(reply.pull.targets[0]).toEqual(
      expect.objectContaining({ day: TODAY, setAt: RECORDED_AT, updatedAt: expect.stringMatching(/Z$/) }),
    );
  });

  it('D-77 a value from another day is kept beside the earlier one, so the days before keep theirs', async () => {
    const user = await api.signUpWithAccount();
    const yesterday = addDays(TODAY, -1);
    const first = await syncOk(user, [target('calories', 2_000, { day: yesterday })]);

    const reply = await syncOk(user, [target('calories', 2_200)], first.cursor);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(await rowsOf('targets', user.id, `day::text, value`)).toEqual([
      { day: yesterday, value: 2_000 },
      { day: TODAY, value: 2_200 },
    ]);
    expect(reply.pull.targets.map(({ kind, day, value }) => ({ kind, day, value }))).toEqual([{ kind: 'calories', day: TODAY, value: 2_200 }]);
    const all = await syncOk(user, []);
    expect(all.pull.targets.map(({ day, value }) => [day, value])).toEqual([
      [yesterday, 2_000],
      [TODAY, 2_200],
    ]);
  });

  it('D-77 a second value on the same day replaces that day’s; the change received last wins (Q-075)', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [target('calories', 2_000)]);

    await syncOk(user, [target('calories', 1_800)]);

    expect(await rowsOf('targets', user.id, 'kind, day::text, value')).toEqual([{ kind: 'calories', day: TODAY, value: 1_800 }]);
  });

  it('D-77 a value set offline keeps the day it was set; a day after today is refused', async () => {
    const user = await api.signUpWithAccount();
    const lastWeek = addDays(TODAY, -7);

    const reply = await syncOk(user, [target('protein', 110, { day: lastWeek }), target('protein', 120, { day: addDays(TODAY, 1) })]);

    expect(reply.results.map((result) => result.error?.code ?? result.status)).toEqual(['accepted', 'DAY_IN_FUTURE']);
    expect(await rowsOf('targets', user.id, 'day::text, value')).toEqual([{ day: lastWeek, value: 110 }]);
  });

  it('D-77 a change without its day is refused', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [change('target.set', { kind: 'calories', value: 2_000, setAt: RECORDED_AT })]);

    expect(reply.results[0]?.error?.code).toBe('VALIDATION_FAILED');
    expect(await rowsOf('targets', user.id, 'kind')).toEqual([]);
  });

  it('D-23 a value outside its kind’s range, or an unknown kind, is rejected', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [
      target('weekly_workouts', 15),
      target('calories', 10_001),
      target('sugar', 200),
      target('fibre', 201),
      target('fat', -1),
    ]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
      'VALIDATION_FAILED',
    ]);
    expect(await rowsOf('targets', user.id, 'kind')).toEqual([]);
  });

  it('invariant #2 a change cannot name who set the target', async () => {
    const user = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();

    const reply = await syncOk(user, [target('calories', 2_000, { setByUserId: other.id })]);

    expect(reply.results[0]?.error?.code).toBe('VALIDATION_FAILED');
    expect(await rowsOf('targets', user.id, 'kind')).toEqual([]);
  });
});

describe('REQ-NFR-001 self-access for daily data (D-20)', () => {
  it('REQ-NFR-001 a second user’s sync never changes or returns the first user’s steps, sleep, measurements or targets, even with the same day, kind and changeId', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await syncOk(userA, [
      steps(TODAY, 5_000, ids[0]),
      sleep(TODAY, 400, ids[1]),
      measurements(TODAY, 800, {}, ids[2]),
      target('calories', 2_000, {}, ids[3]),
    ]);

    const replyB = await syncOk(userB, [
      steps(TODAY, 9_000, ids[0]),
      sleep(TODAY, 500, ids[1]),
      measurements(TODAY, 900, {}, ids[2]),
      target('calories', 2_500, {}, ids[3]),
    ]);

    expect(replyB.results.every((result) => result.status === 'accepted')).toBe(true);
    expect(replyB.pull.steps.map((entry) => entry.steps)).toEqual([9_000]);
    expect(replyB.pull.sleep.map((entry) => entry.sleepMinutes)).toEqual([500]);
    expect(replyB.pull.measurements.map((entry) => entry.upperWaistMm)).toEqual([900]);
    expect(replyB.pull.targets.map((entry) => [entry.value, entry.setByUserId])).toEqual([[2_500, userB.id]]);

    expect(await rowsOf('step_counts', userA.id, 'steps')).toEqual([{ steps: 5_000 }]);
    expect(await rowsOf('sleep_logs', userA.id, 'sleep_minutes')).toEqual([{ sleep_minutes: 400 }]);
    expect(await rowsOf('measurements', userA.id, 'upper_waist_mm')).toEqual([{ upper_waist_mm: 800 }]);
    expect(await rowsOf('targets', userA.id, 'value, set_by_user_id')).toEqual([{ value: 2_000, set_by_user_id: userA.id }]);
    const againA = await syncOk(userA, []);
    expect(againA.pull.steps.map((entry) => entry.steps)).toEqual([5_000]);
    expect(againA.pull.targets.map((entry) => entry.value)).toEqual([2_000]);
  });

  it('REQ-ROLE-002 every kind needs the Personal Training User role', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(`delete from app.user_roles where user_id = $1 and role = 'personal'`, [user.id]);

    const reply = await syncOk(user, [steps(TODAY, 10), sleep(TODAY, 10), measurements(TODAY, 800), target('steps', 10)]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
    ]);
  });
});

describe('ADR-0007 rule 1 the pull across kinds', () => {
  it('ADR-0007 rule 1 applies the 90-day window to day data, but always returns targets, older ones too (D-77)', async () => {
    const user = await api.signUpWithAccount();
    const tooOld = addDays(TODAY, -90);
    const firstDay = addDays(TODAY, -89);
    await syncOk(user, [target('steps', 8_000, { day: tooOld })]);
    await syncOk(user, [
      steps(tooOld, 1),
      steps(firstDay, 2),
      sleep(tooOld, 1),
      measurements(tooOld, 800),
      measurements(firstDay, 810),
    ]);

    const reply = await syncOk(user, []);

    expect(reply.pull.steps.map((entry) => entry.day)).toEqual([firstDay]);
    expect(reply.pull.sleep).toEqual([]);
    expect(reply.pull.measurements.map((entry) => entry.day)).toEqual([firstDay]);
    expect(reply.pull.targets.map((entry) => entry.kind)).toEqual(['steps']);
  });

  it('ADR-0007 a repeat with the latest cursor returns nothing; a changed target comes back alone', async () => {
    const user = await api.signUpWithAccount();
    const first = await syncOk(user, [steps(TODAY, 1), target('protein', 100)]);

    const repeat = await syncOk(user, [], first.cursor);
    expect([repeat.pull.steps, repeat.pull.targets]).toEqual([[], []]);

    const changed = await syncOk(user, [target('protein', 110)], repeat.cursor);
    expect(changed.pull.steps).toEqual([]);
    expect(changed.pull.targets.map((entry) => entry.value)).toEqual([110]);
  });

  it('ADR-0007 pages across kinds in change order with one cursor', async () => {
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
      const yesterday = addDays(TODAY, -1);
      const first = await call(null, [
        steps(TODAY, 1),
        change('weighIn.set', { day: TODAY, weightGrams: 70_000, recordedAt: RECORDED_AT }),
        sleep(TODAY, 2),
        target('calories', 2_000),
        measurements(yesterday, 800),
      ]);
      const second = await call(first.cursor);
      const third = await call(second.cursor);

      expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false]);
      const kinds = [first, second, third].map((reply) =>
        Object.entries(reply.pull)
          .filter(([, items]) => items.length > 0)
          .map(([kind, items]) => `${kind}:${items.length}`),
      );
      expect(kinds).toEqual([['weighIns:1', 'steps:1'], ['sleep:1', 'targets:1'], ['measurements:1']]);
    } finally {
      await paged.close();
    }
  });
});
