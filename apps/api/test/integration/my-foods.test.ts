import { randomUUID } from 'node:crypto';
import { istToday, type MealItem, type SyncResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ImportedFood } from '../../src/foods/ifct.ts';
import { importFoods, importPackagedFoods, importPortions, importUsdaArchive } from '../../src/foods/importFoods.ts';
import { BRAND_LABEL_SOURCE } from '../../src/foods/brandLabels.ts';
import { HOME_FOOD_SOURCE } from '../../src/foods/homeFoods.ts';
import { INDB_GROUP, INDB_SOURCE } from '../../src/foods/indb.ts';
import { startTestApi, type TestUser } from './app.ts';
import { connect } from './database.ts';

// My foods through POST /v1/sync, and meals with USDA servings and your own units (docs/plans/
// more-foods.md, D-39; REQ-LOG-011). Self-access only (REQ-NFR-001, D-20). Every value is synthetic.

const NOW = new Date('2026-11-04T06:30:00Z');
const TODAY = istToday(NOW);
const AT = '2026-11-04T06:00:00.000Z';

// A synthetic USDA food with two servings: made-up values, not USDA's.
const TEST_BREAD: ImportedFood = {
  code: '99999901',
  name: 'Test bread',
  foodGroup: 'Test breads',
  proteinG: '9.4',
  fibreG: '2.3',
  fatG: '3.6',
  carbsG: '49.2',
  kcal: '267',
  kcalSource: 'published',
  estimated: false,
  needsReview: false,
  hidden: false,
  note: null,
  aliases: [],
};

// A synthetic INDB recipe with its serving: made-up values, not INDB's (D-46).
const TEST_CURRY: ImportedFood = { ...TEST_BREAD, code: 'BFP999', name: 'Test curry', foodGroup: INDB_GROUP, estimated: true };

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  client = await connect();
  // USDA's foods are archived (D-47): a meal with a USDA serving, logged before, checks against it.
  await importUsdaArchive(
    client,
    [TEST_BREAD],
    [
      { code: TEST_BREAD.code, seq: 1, label: 'Medium or regular slice', grams: 28 },
      { code: TEST_BREAD.code, seq: 2, label: 'Cup', grams: 40 },
    ],
  );
  await importFoods(client, [TEST_CURRY], INDB_SOURCE);
  await importPortions(client, INDB_SOURCE, [{ code: TEST_CURRY.code, seq: 1, label: 'Bowl', grams: 180 }]);
  // A synthetic brand label with a 10 g serving (D-49).
  await importFoods(client, [{ ...TEST_CURRY, code: 'test-dairy-butter', name: 'Test Dairy Salted Butter', foodGroup: 'Test Dairy', fibreG: null, estimated: false }], BRAND_LABEL_SOURCE);
  await importPortions(client, BRAND_LABEL_SOURCE, [{ code: 'test-dairy-butter', seq: 1, label: 'Serving', grams: 10 }]);
  // A synthetic home-style food (D-59), made-up values.
  await importFoods(client, [{ ...TEST_CURRY, code: 'home-test-toast', name: 'Test toast', foodGroup: 'Test bread', fibreG: null, estimated: false, flag: 'llm' }], HOME_FOOD_SOURCE);
  await importPortions(client, HOME_FOOD_SOURCE, [{ code: 'home-test-toast', seq: 1, label: '2 slices', grams: 56 }]);
  // A synthetic packaged food with a 50 g serving (D-48).
  await importPackagedFoods(client, [
    { barcode: '8901234567890', name: 'Test sandwich bread', brand: 'Test Foods', kcal: 250, proteinG: 8, carbsG: 50, fatG: 2, fibreG: null, servingGrams: 50 },
  ]);
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await importPackagedFoods(client, []);
  await importFoods(client, [], BRAND_LABEL_SOURCE);
  await importFoods(client, [], HOME_FOOD_SOURCE);
  await importFoods(client, [], INDB_SOURCE);
  await importUsdaArchive(client, [], []);
  await api.close();
  await client.end();
});

function change(type: string, data: Record<string, unknown>) {
  return { changeId: randomUUID(), type, data };
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

const MY_BREAD = { name: 'Peanut butter bread', unit: 'slice', kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: 1.5, savedAt: AT };

function meal(items: MealItem[]) {
  return change('meal.set', { id: randomUUID(), day: TODAY, mealType: 'breakfast', tags: [], items, recordedAt: AT });
}

const BREAD_ITEM: MealItem = {
  source: 'usda_fndds',
  ref: TEST_BREAD.code,
  name: 'Test bread',
  amount: { unit: 'serving', label: 'Medium or regular slice', value: 2, grams: 56 },
  kcal: 149.52,
  proteinG: 5.26,
  carbsG: 27.55,
  fatG: 2.02,
  fibreG: 1.29,
  estimated: false,
};

describe('REQ-LOG-011 My foods through POST /v1/sync', () => {
  it('saves a My food and returns it in the pull; a later change replaces it', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();

    const first = await syncOk(user, [change('myFood.set', { id, ...MY_BREAD })]);
    expect(first.results[0]?.status).toBe('accepted');
    expect(first.pull.myFoods).toEqual([{ deleted: false, id, ...MY_BREAD, updatedAt: expect.stringMatching(/Z$/) }]);

    const second = await syncOk(user, [change('myFood.set', { id, ...MY_BREAD, unit: 'g', kcal: 450, fibreG: null })]);
    expect(second.pull.myFoods).toEqual([expect.objectContaining({ id, unit: 'g', kcal: 450, fibreG: null })]);
  });

  it('a deleted My food comes back as deleted, with no content, and can be saved again', async () => {
    const user = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(user, [change('myFood.set', { id, ...MY_BREAD })]);

    const deleted = await syncOk(user, [change('myFood.delete', { id, deletedAt: AT })]);
    expect(deleted.pull.myFoods).toEqual([{ deleted: true, id, updatedAt: expect.stringMatching(/Z$/) }]);
    const { rows } = await api.db.query('select name, kcal from app.my_foods where user_id = $1 and id = $2', [user.id, id]);
    expect(rows).toEqual([{ name: null, kcal: null }]);

    const again = await syncOk(user, [change('myFood.set', { id, ...MY_BREAD })]);
    expect(again.pull.myFoods).toEqual([expect.objectContaining({ deleted: false, id })]);
  });

  it.each([
    ['over 2,000 kcal per slice', { kcal: 2_001 }],
    ['over 900 kcal per 100 g', { unit: 'g', kcal: 901 }],
    ['a unit not on the list', { unit: 'plate' }],
    ['no name', { name: ' ' }],
  ])('refuses a My food %s', async (_case, fields) => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [change('myFood.set', { id: randomUUID(), ...MY_BREAD, ...fields })]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
  });

  it('REQ-NFR-001 a user only ever pulls their own My foods; the same ID is another user’s own', async () => {
    const owner = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    const id = randomUUID();
    await syncOk(owner, [change('myFood.set', { id, ...MY_BREAD })]);

    expect((await syncOk(other, [])).pull.myFoods).toEqual([]);
    await syncOk(other, [change('myFood.delete', { id, deletedAt: AT })]);
    const { rows } = await api.db.query('select name from app.my_foods where user_id = $1 and id = $2', [owner.id, id]);
    expect(rows).toEqual([{ name: 'Peanut butter bread' }]);
  });
});

describe('D-39 meals with USDA servings (archived, D-47) and your own units', () => {
  it('accepts a USDA food in a serving on its archived list, with the grams it came to', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [meal([BREAD_ITEM])]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(reply.pull.meals[0]).toMatchObject({ items: [expect.objectContaining({ amount: BREAD_ITEM.amount })] });
  });

  it.each([
    ['a serving its food does not have', { ...BREAD_ITEM, amount: { ...BREAD_ITEM.amount, label: 'Large slice' } }],
    ['grams that are not the serving’s', { ...BREAD_ITEM, amount: { ...BREAD_ITEM.amount, grams: 60 } }],
    ['a food not on the list', { ...BREAD_ITEM, ref: '99999999' }],
  ])('refuses a meal with %s', async (_case, item) => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [meal([item as MealItem])]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
  });

  it('D-46 accepts an INDB recipe in its serving, and refuses one in another source’s serving', async () => {
    const user = await api.signUpWithAccount();
    const curry: MealItem = {
      source: 'indb',
      ref: TEST_CURRY.code,
      name: 'Test curry',
      amount: { unit: 'serving', label: 'Bowl', value: 1.5, grams: 270 },
      kcal: 259.2,
      proteinG: 11.07,
      carbsG: 22.41,
      fatG: 14.04,
      fibreG: 4.86,
      estimated: true,
    };

    const reply = await syncOk(user, [meal([curry]), meal([{ ...BREAD_ITEM, source: 'indb' }])]);

    expect(reply.results.map((entry) => entry.status)).toEqual(['accepted', 'rejected']);
  });

  it('D-48 accepts a packaged food in its serving, with the grams it came to, and refuses another', async () => {
    const user = await api.signUpWithAccount();
    const bread: MealItem = {
      source: 'barcode',
      ref: '8901234567890',
      name: 'Test sandwich bread (Test Foods)',
      amount: { unit: 'serving', label: 'Serving', value: 1.5, grams: 75 },
      kcal: 187.5,
      proteinG: 6,
      carbsG: 37.5,
      fatG: 1.5,
      fibreG: null,
      estimated: false,
    };

    const reply = await syncOk(user, [
      meal([bread]),
      meal([{ ...bread, amount: { unit: 'serving', label: 'Serving', value: 1.5, grams: 90 } }]),
      meal([{ ...bread, amount: { unit: 'serving', label: 'Slice', value: 1.5, grams: 75 } }]),
      meal([{ ...bread, ref: '96385074' }]),
    ]);

    expect(reply.results.map((entry) => entry.status)).toEqual(['accepted', 'rejected', 'rejected', 'rejected']);
  });

  it('D-49 accepts a brand label in its serving, and refuses another serving', async () => {
    const user = await api.signUpWithAccount();
    const butter: MealItem = {
      source: 'brand_label',
      ref: 'test-dairy-butter',
      name: 'Test Dairy Salted Butter',
      amount: { unit: 'serving', label: 'Serving', value: 2, grams: 20 },
      kcal: 53.4,
      proteinG: 1.88,
      carbsG: 1.66,
      fatG: 1.04,
      fibreG: null,
      estimated: false,
    };

    const reply = await syncOk(user, [meal([butter]), meal([{ ...butter, amount: { unit: 'serving', label: 'Serving', value: 2, grams: 30 } }])]);

    expect(reply.results.map((entry) => entry.status)).toEqual(['accepted', 'rejected']);
  });

  it('D-59 accepts a home-style food in grams or its serving, and refuses another serving', async () => {
    const user = await api.signUpWithAccount();
    const toast: MealItem = {
      source: 'home',
      ref: 'home-test-toast',
      name: 'Test toast',
      amount: { unit: 'serving', label: '2 slices', value: 1, grams: 56 },
      kcal: 204.4,
      proteinG: 4.48,
      carbsG: 25.2,
      fatG: 9.52,
      fibreG: null,
      estimated: false,
    };

    const reply = await syncOk(user, [
      meal([toast]),
      meal([{ ...toast, amount: { unit: 'g', value: 30 } }]),
      meal([{ ...toast, amount: { unit: 'serving', label: '2 slices', value: 1, grams: 60 } }]),
    ]);

    expect(reply.results.map((entry) => entry.status)).toEqual(['accepted', 'accepted', 'rejected']);
  });

  it('accepts your own food by the slice, naming the My food it came from', async () => {
    const user = await api.signUpWithAccount();
    const own: MealItem = {
      source: 'own',
      ref: randomUUID(),
      name: 'Peanut butter bread',
      amount: { unit: 'own', name: 'slice', value: 2 },
      kcal: 360,
      proteinG: 12,
      carbsG: 40,
      fatG: 18,
      fibreG: 3,
      estimated: false,
    };

    const reply = await syncOk(user, [meal([own])]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(reply.pull.meals[0]).toMatchObject({ totals: { kcal: 360, proteinG: 12 } });
  });
});
