import { randomUUID } from 'node:crypto';
import { addDays, istToday, type MealItem, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApi, type TestUser } from './app.ts';

// Meals and saved meals through POST /v1/sync (REQ-LOG-001…003, REQ-LOG-007, REQ-NUT-004,
// REQ-SAVED-001, REQ-NFR-004), and the self-access cases for them (REQ-NFR-001, D-20). The route's
// authorization block is in sync.test.ts. All values are synthetic.

// A fixed clock: 2026-10-28 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);
const AT = `${TODAY}T02:00:00.000Z`;

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

const ATTA: MealItem = {
  source: 'ifct2017',
  ref: 'A019',
  name: 'Wheat flour, atta',
  amount: { unit: 'g', value: 60 },
  kcal: 192,
  proteinG: 6.34,
  carbsG: 38.5,
  fatG: 0.92,
  fibreG: 6.82,
  estimated: false,
};
const GHEE: MealItem = {
  source: 'ifct2017',
  ref: 'T013',
  name: 'Ghee',
  amount: { unit: 'g', value: 5 },
  kcal: 45,
  proteinG: 0,
  carbsG: 0,
  fatG: 5,
  fibreG: 0,
  estimated: true,
};
const OWN_NO_FIBRE: MealItem = {
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

function mealSet(id: string, extra: Record<string, unknown> = {}, changeId: string = randomUUID()) {
  return {
    changeId,
    type: 'meal.set',
    data: { id, day: TODAY, mealType: 'lunch', tags: [], items: [ATTA, GHEE], recordedAt: AT, ...extra },
  };
}
function mealDelete(id: string, changeId: string = randomUUID()) {
  return { changeId, type: 'meal.delete', data: { id, deletedAt: AT } };
}
function savedSet(id: string, extra: Record<string, unknown> = {}) {
  return {
    changeId: randomUUID(),
    type: 'savedMeal.set',
    data: { id, name: 'Two rotis', mealType: 'dinner', tags: [], items: [ATTA], savedAt: AT, ...extra },
  };
}
function savedDelete(id: string) {
  return { changeId: randomUUID(), type: 'savedMeal.delete', data: { id, deletedAt: AT } };
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

async function storedMeals(userId: string) {
  const { rows } = await api.db.query(
    `select id, day::text as day, meal_type, kcal::float8 as kcal, deleted_at is not null as deleted, items is null as empty
     from app.meals where user_id = $1 order by created_at`,
    [userId],
  );
  return rows;
}

describe('REQ-LOG-001 meals', () => {
  it('REQ-LOG-007 applies a meal and returns it with totals computed by the server', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const reply = await syncOk(user, [mealSet(id, { tags: ['before_training'] })]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(reply.pull.meals).toEqual([
      {
        deleted: false,
        id,
        day: TODAY,
        mealType: 'lunch',
        tags: ['before_training'],
        items: [ATTA, GHEE],
        totals: { kcal: 237, proteinG: 6.34, carbsG: 38.5, fatG: 5.92, fibreG: 6.82 },
        photo: null,
        recordedAt: AT,
        updatedAt: expect.stringMatching(/Z$/),
      },
    ]);
  });

  it('D-26 a total is the sum of the known values, and null only when no item has that value', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [
      mealSet(randomUUID(), { items: [ATTA, OWN_NO_FIBRE] }),
      mealSet(randomUUID(), { items: [OWN_NO_FIBRE] }),
    ]);

    const totals = reply.pull.meals.map((meal) => (meal.deleted ? null : meal.totals.fibreG));
    expect(totals).toEqual([6.82, null]);
  });

  it('REQ-NUT-004 Edit replaces the whole meal with the same ID; there is still one meal', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [mealSet(id)]);

    await syncOk(user, [mealSet(id, { mealType: 'dinner', items: [ATTA] })]);

    expect(await storedMeals(user.id)).toEqual([{ id, day: TODAY, meal_type: 'dinner', kcal: 192, deleted: false, empty: false }]);
  });

  it('REQ-NUT-004 Delete removes the content, keeps an empty row, and the pull reports the deletion', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    const first = await syncOk(user, [mealSet(id)]);

    const second = await syncOk(user, [mealDelete(id)], first.cursor);

    expect(second.pull.meals).toEqual([{ deleted: true, id, day: TODAY, updatedAt: expect.stringMatching(/Z$/) }]);
    expect(await storedMeals(user.id)).toEqual([{ id, day: TODAY, meal_type: null, kcal: null, deleted: true, empty: true }]);
  });

  it('ADR-0007 a meal created and deleted offline arrive together and end deleted; deleting an unknown meal changes nothing', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const reply = await syncOk(user, [mealSet(id), mealDelete(id), mealDelete(randomUUID())]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted', 'accepted']);
    expect(reply.pull.meals).toEqual([expect.objectContaining({ deleted: true, id })]);
    expect(await storedMeals(user.id)).toHaveLength(1);
  });

  it('ADR-0007 rule 2 a meal saved again after a deletion is back: the change received last wins', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [mealSet(id), mealDelete(id)]);

    await syncOk(user, [mealSet(id, { items: [GHEE] })]);

    expect(await storedMeals(user.id)).toEqual([{ id, day: TODAY, meal_type: 'lunch', kcal: 45, deleted: false, empty: false }]);
  });

  it('ADR-0007 a change sent twice is applied once', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    const change = mealSet(id);
    await syncOk(user, [change]);
    await syncOk(user, [mealDelete(id)]);

    await syncOk(user, [change]);

    expect(await storedMeals(user.id)).toEqual([expect.objectContaining({ deleted: true })]);
  });

  it('REQ-DATE-001 a meal on a day later than today in IST is rejected with DAY_IN_FUTURE', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [mealSet(randomUUID(), { day: addDays(TODAY, 1) })]);

    expect(reply.results[0]?.error?.code).toBe('DAY_IN_FUTURE');
    expect(await storedMeals(user.id)).toEqual([]);
  });

  it.each([
    ['no items', { items: [] }],
    ['31 items', { items: Array.from({ length: 31 }, () => ATTA) }],
    ['no meal type', { mealType: undefined }],
    ['an unknown meal type', { mealType: 'brunch' }],
    ['an unknown tag', { tags: ['party'] }],
    ['the same tag twice', { tags: ['dessert', 'dessert'] }],
    ['0 g', { items: [{ ...ATTA, amount: { unit: 'g', value: 0 } }] }],
    ['2,001 g', { items: [{ ...ATTA, amount: { unit: 'g', value: 2_001 } }] }],
    ['a portion that is not a half', { items: [{ ...ATTA, amount: { unit: 'portion', value: 1.3 } }] }],
    ['a negative value', { items: [{ ...ATTA, proteinG: -1 }] }],
    ['an empty item name', { items: [{ ...ATTA, name: '  ' }] }],
    ['totals sent by the phone', { totals: { kcal: 1 } }],
    ['a user ID', { userId: randomUUID() }],
  ])('REQ-LOG-007 a meal with %s is rejected', async (_case, extra) => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [mealSet(randomUUID(), extra)]);

    expect(reply.results[0]?.error?.code).toBe('VALIDATION_FAILED');
    expect(await storedMeals(user.id)).toEqual([]);
  });

  it('REQ-LOG-007 a portion of a dish in halves is accepted', async () => {
    const user = await api.signUpWithAccount();
    const dish: MealItem = { ...ATTA, source: 'dish', ref: 'D-ROTI', amount: { unit: 'portion', value: 1.5 }, estimated: true };

    const reply = await syncOk(user, [mealSet(randomUUID(), { items: [dish] })]);

    expect(reply.results[0]?.status).toBe('accepted');
  });

  it('ADR-0007 rule 1 the pull holds the last 90 IST days of meals, deletions included', async () => {
    const user = await api.signUpWithAccount();
    const old = randomUUID();
    const recent = randomUUID();
    await syncOk(user, [mealSet(old, { day: addDays(TODAY, -90) }), mealSet(recent, { day: addDays(TODAY, -89) })]);

    const reply = await syncOk(user, []);

    expect(reply.pull.meals.map((meal) => meal.id)).toEqual([recent]);
  });
});

describe('REQ-SAVED-001 saved meals', () => {
  it('REQ-NUT-004 "Save to my meals" stores a copy with its totals; Delete reports the deletion', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const saved = await syncOk(user, [savedSet(id)]);
    expect(saved.pull.savedMeals).toEqual([
      {
        deleted: false,
        id,
        name: 'Two rotis',
        mealType: 'dinner',
        tags: [],
        items: [ATTA],
        totals: { kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82 },
        savedAt: AT,
        updatedAt: expect.stringMatching(/Z$/),
      },
    ]);

    const deleted = await syncOk(user, [savedDelete(id)], saved.cursor);
    expect(deleted.pull.savedMeals).toEqual([{ deleted: true, id, updatedAt: expect.stringMatching(/Z$/) }]);
  });

  it('ADR-0007 rule 1 saved meals are always in the pull, however old', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [savedSet(randomUUID())]);
    await api.db.query(`update app.saved_meals set saved_at = '2020-01-01T00:00:00Z' where user_id = $1`, [user.id]);

    const reply = await syncOk(user, []);

    expect(reply.pull.savedMeals).toHaveLength(1);
  });

  it.each([
    ['an empty name', { name: ' ' }],
    ['a 61-character name', { name: 'x'.repeat(61) }],
    ['a day', { day: TODAY }],
  ])('REQ-SAVED-001 a saved meal with %s is rejected', async (_case, extra) => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [savedSet(randomUUID(), extra)]);

    expect(reply.results[0]?.error?.code).toBe('VALIDATION_FAILED');
  });
});

describe('REQ-NFR-001 self-access for meals (D-20)', () => {
  it('REQ-NFR-001 a second user using the first user’s meal and saved-meal IDs only ever writes their own', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    const mealId = randomUUID();
    const savedId = randomUUID();
    await syncOk(userA, [mealSet(mealId), savedSet(savedId)]);

    const replyB = await syncOk(userB, [mealSet(mealId, { items: [GHEE] }), savedSet(savedId, { name: 'B' })]);
    await syncOk(userB, [mealDelete(mealId), savedDelete(savedId)]);

    expect(replyB.pull.meals.map((meal) => (meal.deleted ? null : meal.totals.kcal))).toEqual([45]);
    expect(await storedMeals(userA.id)).toEqual([expect.objectContaining({ id: mealId, kcal: 237, deleted: false })]);
    const againA = await syncOk(userA, []);
    expect(againA.pull.meals).toEqual([expect.objectContaining({ deleted: false, id: mealId })]);
    expect(againA.pull.savedMeals).toEqual([expect.objectContaining({ deleted: false, name: 'Two rotis' })]);
  });

  it('REQ-ROLE-002 every meal change needs the Personal Training User role', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(`delete from app.user_roles where user_id = $1 and role = 'personal'`, [user.id]);
    const id = randomUUID();

    const reply = await syncOk(user, [mealSet(id), mealDelete(id), savedSet(id), savedDelete(id)]);

    expect(reply.results.map((result) => result.error?.code)).toEqual([
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
      'ROLE_NOT_ENABLED',
    ]);
  });
});
