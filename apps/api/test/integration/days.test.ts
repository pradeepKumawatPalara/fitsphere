import { randomUUID } from 'node:crypto';
import { addDays, istToday, MAX_DAYS_RANGE, type DaysResponse, type MealItem } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// GET /v1/users/{userId}/days (D-106; ADR-0007 rule 1): the day data of days older than the phone's
// 90, read online when opened, with the self-access cases (REQ-NFR-001, D-20). All values are
// synthetic.

// A fixed clock: 2026-10-28 09:00 IST. The older week is 200 days back, well before the 90.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);
const OLD = addDays(TODAY, -200);
const AT = `${TODAY}T02:00:00.000Z`;

const SNACK: MealItem = {
  source: 'own',
  ref: null,
  name: 'Synthetic snack bar',
  amount: { unit: 'g', value: 40 },
  kcal: 180,
  proteinG: 4,
  carbsG: 24,
  fatG: 8,
  fibreG: null,
  estimated: false,
};
const PLANK = {
  kind: 'sets',
  name: 'Plank',
  sets: [{ reps: null, weightGrams: null, seconds: 60 }],
  durationSeconds: null,
  calories: null,
  averageHeartRateBpm: null,
  highestHeartRateBpm: null,
  note: null,
};

let api: Awaited<ReturnType<typeof startTestApi>>;
let owner: TestUser & { id: string };
const mealId = randomUUID();
const deletedMealId = randomUUID();
const workoutId = randomUUID();

async function sync(user: TestUser, changes: unknown[]) {
  const response = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor: null, changes },
  });
  expect(response.statusCode).toBe(200);
  for (const result of response.json().results) expect(result.status).toBe('accepted');
}

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
  owner = await api.signUpWithAccount();
  await sync(owner, [
    { changeId: randomUUID(), type: 'weighIn.set', data: { day: OLD, weightGrams: 74_100, recordedAt: AT } },
    { changeId: randomUUID(), type: 'steps.set', data: { day: OLD, steps: 8_410, recordedAt: AT } },
    { changeId: randomUUID(), type: 'sleep.set', data: { day: addDays(OLD, 1), sleepMinutes: 430, recordedAt: AT } },
    { changeId: randomUUID(), type: 'meal.set', data: { id: mealId, day: OLD, mealType: 'lunch', tags: [], items: [SNACK], recordedAt: AT } },
    { changeId: randomUUID(), type: 'meal.set', data: { id: deletedMealId, day: OLD, mealType: 'dinner', tags: [], items: [SNACK], recordedAt: AT } },
    { changeId: randomUUID(), type: 'meal.delete', data: { id: deletedMealId, deletedAt: AT } },
    { changeId: randomUUID(), type: 'workout.set', data: { id: workoutId, day: addDays(OLD, 2), exercises: [PLANK], recordedAt: AT } },
    // Outside the week asked for: never sent.
    { changeId: randomUUID(), type: 'weighIn.set', data: { day: addDays(OLD, 10), weightGrams: 73_900, recordedAt: AT } },
    { changeId: randomUUID(), type: 'weighIn.set', data: { day: TODAY, weightGrams: 72_400, recordedAt: AT } },
  ]);
});

afterAll(async () => {
  await api.close();
});

function read(userId: string, token: string | null, from = OLD, to = addDays(OLD, 6)) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/users/${userId}/days?from=${from}&to=${to}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('D-106 GET /v1/users/:userId/days: an older week, as the sync pull sends it', () => {
  it('ADR-0007 rule 1 sends every kind of day data of the days asked for, and nothing outside them', async () => {
    const response = await read(owner.id, owner.token);

    expect(response.statusCode).toBe(200);
    const body = response.json() as DaysResponse;
    expect(body.weighIns).toEqual([{ day: OLD, weightGrams: 74_100, recordedAt: AT, updatedAt: expect.any(String) }]);
    expect(body.steps).toEqual([{ day: OLD, steps: 8_410, recordedAt: AT, updatedAt: expect.any(String) }]);
    expect(body.sleep).toEqual([{ day: addDays(OLD, 1), sleepMinutes: 430, recordedAt: AT, updatedAt: expect.any(String) }]);
    expect(body.measurements).toEqual([]);
    expect(body.workouts).toEqual([expect.objectContaining({ id: workoutId, day: addDays(OLD, 2), deleted: false, exercises: [PLANK] })]);
    expect(body.meals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mealId, day: OLD, deleted: false, mealType: 'lunch', totals: expect.objectContaining({ kcal: 180 }) }),
        // A meal deleted on another phone is sent as deleted, so the phone removes its copy.
        { id: deletedMealId, day: OLD, deleted: true, updatedAt: expect.any(String) },
      ]),
    );
    expect(body.meals).toHaveLength(2);
  });

  it('reads one day, and up to MAX_DAYS_RANGE days', async () => {
    const one = await read(owner.id, owner.token, OLD, OLD);
    const most = await read(owner.id, owner.token, OLD, addDays(OLD, MAX_DAYS_RANGE - 1));

    expect(one.statusCode).toBe(200);
    expect((one.json() as DaysResponse).sleep).toEqual([]);
    expect(most.statusCode).toBe(200);
    expect((most.json() as DaysResponse).weighIns.map((item) => item.day)).toEqual([OLD, addDays(OLD, 10)]);
  });

  it.each([
    ['more than MAX_DAYS_RANGE days', OLD, addDays(OLD, MAX_DAYS_RANGE), 'to'],
    ['to before from', OLD, addDays(OLD, -1), 'to'],
    ['a day that is not a date', 'yesterday', OLD, 'from'],
  ])('refuses %s with VALIDATION_FAILED', async (_, from, to, field) => {
    const response = await read(owner.id, owner.token, from, to);

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({ code: 'VALIDATION_FAILED', details: [expect.objectContaining({ field })] });
  });

  it('refuses a query with another field', async () => {
    const response = await api.app.inject({
      method: 'GET',
      url: `/v1/users/${owner.id}/days?from=${OLD}&to=${OLD}&userId=${owner.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

// The self-access cases (REQ-NFR-001, D-20).
describe('authorization: GET /v1/users/:userId/days', () => {
  it('another signed-in user with an account gets 404, and none of the owner’s days', async () => {
    const other = await api.signUpWithAccount();

    const response = await read(owner.id, other.token);

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'NOT_FOUND', message: 'Not available.', details: null });
  });

  it('T-01 a user ID that does not exist gets the same 404 as another user', async () => {
    const other = await api.signUpWithAccount();

    for (const response of [await read(randomUUID(), other.token), await read('not-a-uuid', other.token)]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toMatchObject({ code: 'NOT_FOUND', details: null });
    }
  });

  it('another user reading their own ID gets only their own days: none here', async () => {
    const other = await api.signUpWithAccount();

    const response = await read(other.id, other.token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ weighIns: [], steps: [], sleep: [], measurements: [], workouts: [], meals: [] });
  });

  it('no token, an expired token or one signed by another key gets 401', async () => {
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
