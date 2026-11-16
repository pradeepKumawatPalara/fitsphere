import { randomUUID } from 'node:crypto';
import { istToday, type FoodsResponse, type MealItem, type SyncResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ImportedFood } from '../../src/foods/ifct.ts';
import { IFCT_SOURCE } from '../../src/foods/ifct.ts';
import { INDB_GROUP, INDB_SOURCE } from '../../src/foods/indb.ts';
import { opensOnOf, withPackagedUnits, type FoodUnits } from '../../src/foods/foodUnits.ts';
import { importFoods, importPackagedFoods, importPortions } from '../../src/foods/importFoods.ts';
import type { ImportedPortion } from '../../src/foods/usda.ts';
import { startTestApi, type TestUser } from './app.ts';
import { connect } from './database.ts';

// D-102: the units of the owner's food database: foods:import, GET /v1/foods and the sync's check of a
// serving; and one food in a meal up to 10,000 g. Every value is synthetic.

const NOW = new Date('2026-11-13T06:30:00Z');
const TODAY = istToday(NOW);
const AT = '2026-11-13T06:00:00.000Z';

const RECIPE: ImportedFood = {
  code: 'BFP991',
  name: 'Test boiled rice',
  foodGroup: INDB_GROUP,
  proteinG: '2.5',
  fibreG: '1.2',
  fatG: '0.2',
  carbsG: '26',
  kcal: '120',
  kcalSource: 'published',
  estimated: true,
  needsReview: false,
  hidden: false,
  note: null,
  aliases: [],
};
const OIL: ImportedFood = { ...RECIPE, code: 'T991', name: 'Test oil', foodGroup: 'Test fats', proteinG: '0', fibreG: '0', fatG: '100', carbsG: '0', kcal: '900', estimated: false };
const BANANA: ImportedFood = { ...OIL, code: 'T992', name: 'Test banana', foodGroup: 'Test fruits', fatG: '0.3', carbsG: '23', proteinG: '1.2', kcal: '105' };

const RICE_SERVINGS: ImportedPortion[] = [{ code: RECIPE.code, seq: 1, label: 'Plate', grams: 300 }];
const riceUnits = (plate: number): Map<string, FoodUnits> =>
  new Map([
    [
      RECIPE.code,
      {
        opensOn: 'Plate',
        units: [
          { label: 'Katori', grams: 129 },
          { label: 'Plate', grams: plate },
          { label: 'ml', grams: 1.03 },
        ],
      },
    ],
  ]);
const IFCT_UNITS = new Map<string, FoodUnits>([[BANANA.code, { opensOn: 'Medium', units: [{ label: 'Medium', grams: 120 }] }]]);
const BAR = { barcode: '8901234599901', name: 'Test dark bar', brand: 'Test Sweets', kcal: 520, proteinG: 6, carbsG: 50, fatG: 33, fibreG: null, servingGrams: null };
const CHIPS = { ...BAR, barcode: '8901234599902', name: 'Test chips', servingGrams: 25 };

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

async function importRice(plate: number) {
  const units = riceUnits(plate);
  return importPortions(client, INDB_SOURCE, RICE_SERVINGS, units, (rows) => opensOnOf(rows, units));
}

beforeAll(async () => {
  client = await connect();
  await importFoods(client, [RECIPE], INDB_SOURCE);
  await importRice(301);
  // IFCT's foods written directly, so the list's other foods stay as other tests left them.
  for (const food of [OIL, BANANA]) {
    await client.query(
      `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated, needs_review, hidden)
       values ('ifct2017', $1, $2, $3, $4, $5, $6, $7, $8, 'published', false, false, false) on conflict (source, code) do nothing`,
      [food.code, food.name, food.foodGroup, food.proteinG, food.fibreG, food.fatG, food.carbsG, food.kcal],
    );
  }
  await importPortions(client, IFCT_SOURCE, [], IFCT_UNITS, (rows) => opensOnOf(rows, IFCT_UNITS));
  await importPackagedFoods(client, [
    withPackagedUnits(BAR, { opensOn: 'Bar', units: [{ label: 'Bar', grams: 20 }, { label: 'Pack', grams: 20 }] }),
    withPackagedUnits(CHIPS, { opensOn: 'Serving', units: [{ label: 'Serving', grams: 30 }, { label: 'Katori', grams: 150 }] }),
  ]);
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await importPackagedFoods(client, []);
  await importPortions(client, IFCT_SOURCE, []);
  await client.query('delete from app.foods where source = $1 and code = any($2)', [IFCT_SOURCE, [OIL.code, BANANA.code]]);
  await importFoods(client, [], INDB_SOURCE);
  await api.close();
  await client.end();
});

function meal(items: MealItem[]) {
  return { changeId: randomUUID(), type: 'meal.set', data: { id: randomUUID(), day: TODAY, mealType: 'lunch', tags: [], items, recordedAt: AT } };
}

async function syncOk(user: TestUser, changes: unknown[]): Promise<SyncResponse> {
  const response = await api.app.inject({ method: 'POST', url: '/v1/sync', headers: { authorization: `Bearer ${user.token}` }, payload: { cursor: null, changes } });
  expect(response.statusCode).toBe(200);
  return response.json();
}

const rice = (amount: MealItem['amount'], kcal = 100): MealItem => ({
  source: 'indb',
  ref: RECIPE.code,
  name: RECIPE.name,
  amount,
  kcal,
  proteinG: 2,
  carbsG: 20,
  fatG: 0.2,
  fibreG: 1,
  estimated: true,
});

describe('D-102 foods:import loads the units of the owner’s food database', () => {
  it('after the food’s own servings, a unit of the same name taking its grams; the page opens on the default; every serving kept in the history', async () => {
    const { rows } = await client.query('select label, grams::float from app.food_portions where source = $1 and code = $2 order by seq', [INDB_SOURCE, RECIPE.code]);
    expect(rows).toEqual([
      { label: 'Plate', grams: 301 },
      { label: 'Katori', grams: 129 },
      { label: 'ml', grams: 1.03 },
    ]);
    expect((await client.query('select opens_on from app.foods where source = $1 and code = $2', [INDB_SOURCE, RECIPE.code])).rows).toEqual([{ opens_on: 'Plate' }]);
    // An IFCT food has units now; one with none opens as before.
    expect((await client.query('select code, opens_on from app.foods where source = $1 and code = any($2) order by code', [IFCT_SOURCE, [OIL.code, BANANA.code]])).rows).toEqual([
      { code: OIL.code, opens_on: null },
      { code: BANANA.code, opens_on: 'Medium' },
    ]);
    expect((await client.query(`select label, grams::float from app.food_portion_history where source = 'barcode' and code = $1 order by label`, [CHIPS.barcode])).rows).toEqual([
      { label: 'Katori', grams: 150 },
      { label: 'Serving', grams: 25 },
    ]);
  });

  it('GET /v1/foods sends each food’s units and the measure it opens on; a packaged food’s beside its label’s serving', async () => {
    const user = await api.signUpWithAccount();
    const response = await api.app.inject({ method: 'GET', url: '/v1/foods', headers: { authorization: `Bearer ${user.token}` } });
    expect(response.statusCode).toBe(200);
    const body: FoodsResponse = response.json();
    expect(body.items?.find((food) => food.code === RECIPE.code)).toMatchObject({
      portions: [
        { label: 'Plate', grams: 301 },
        { label: 'Katori', grams: 129 },
        { label: 'ml', grams: 1.03 },
      ],
      opensOn: 'Plate',
    });
    expect(body.items?.find((food) => food.code === OIL.code)).not.toHaveProperty('opensOn');
    expect(body.packaged?.find((food) => food.barcode === BAR.barcode)).toMatchObject({ servingGrams: null, portions: [{ label: 'Bar', grams: 20 }, { label: 'Pack', grams: 20 }], opensOn: 'Bar' });
    // R3: the label's serving kept, the database's left out.
    expect(body.packaged?.find((food) => food.barcode === CHIPS.barcode)).toMatchObject({ servingGrams: 25, portions: [{ label: 'Katori', grams: 150 }], opensOn: 'Serving' });
  });
});

describe('D-102 the sync accepts the new units and typed counts', () => {
  it('accepts a unit, a count with two decimals, ml, an IFCT unit and a packaged unit, with the grams they came to', async () => {
    const user = await api.signUpWithAccount();
    const banana: MealItem = { ...rice({ unit: 'serving', label: 'Medium', value: 1, grams: 120 }, 126), source: 'ifct2017', ref: BANANA.code, name: BANANA.name, estimated: false };
    const bar: MealItem = { ...banana, source: 'barcode', ref: BAR.barcode, name: 'Test dark bar (Test Sweets)', amount: { unit: 'serving', label: 'Bar', value: 0.25, grams: 5 }, fibreG: null };
    const chips: MealItem = { ...bar, ref: CHIPS.barcode, name: 'Test chips (Test Sweets)', amount: { unit: 'serving', label: 'Serving', value: 2, grams: 50 } };
    const reply = await syncOk(user, [
      meal([rice({ unit: 'serving', label: 'Katori', value: 1.25, grams: 161.25 })]),
      meal([rice({ unit: 'serving', label: 'Katori', value: 0.01, grams: 1.29 })]),
      meal([rice({ unit: 'serving', label: 'ml', value: 250, grams: 257.5 })]),
      meal([banana]),
      meal([bar]),
      meal([chips]),
    ]);
    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted', 'accepted', 'accepted', 'accepted', 'accepted']);
  });

  it.each([
    ['a unit the food does not have', rice({ unit: 'serving', label: 'Bowl', value: 1, grams: 215 })],
    ['grams that are not the unit’s', rice({ unit: 'serving', label: 'Katori', value: 1.25, grams: 170 })],
    ['ml not whole', rice({ unit: 'serving', label: 'ml', value: 2.5, grams: 2.58 })],
    ['a count of 0', rice({ unit: 'serving', label: 'Katori', value: 0, grams: 1 })],
    ['a count with three decimals', rice({ unit: 'serving', label: 'Katori', value: 1.255, grams: 161.9 })],
    ['the database’s serving of a packaged food whose label gives one', { ...rice({ unit: 'serving', label: 'Serving', value: 1, grams: 30 }), source: 'barcode' as const, ref: CHIPS.barcode, estimated: false }],
  ])('refuses a meal with %s', async (_case, item) => {
    const user = await api.signUpWithAccount();
    const reply = await syncOk(user, [meal([item])]);
    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
  });

  it('a meal logged before a unit’s grams changed is still accepted when saved again; the new grams too', async () => {
    const user = await api.signUpWithAccount();
    const before = meal([rice({ unit: 'serving', label: 'Plate', value: 1, grams: 301 })]);
    expect((await syncOk(user, [before])).results[0]?.status).toBe('accepted');
    try {
      await importRice(150.5);
      const again = { ...before, changeId: randomUUID(), data: { ...before.data, recordedAt: '2026-11-13T06:10:00.000Z' } };
      const now = meal([rice({ unit: 'serving', label: 'Plate', value: 2, grams: 301 })]);
      const other = meal([rice({ unit: 'serving', label: 'Plate', value: 1, grams: 200 })]);
      expect((await syncOk(user, [again, now, other])).results.map((result) => result.status)).toEqual(['accepted', 'accepted', 'rejected']);
    } finally {
      await importRice(301);
    }
  });

  it('one food in a meal may be 10,000 g, and 30 of them fit the meal’s totals', async () => {
    const user = await api.signUpWithAccount();
    const oil: MealItem = { ...rice({ unit: 'g', value: 10_000 }, 90_000), source: 'ifct2017', ref: OIL.code, name: OIL.name, proteinG: 0, carbsG: 0, fatG: 10_000, fibreG: 0, estimated: false };
    const reply = await syncOk(user, [meal(Array.from({ length: 30 }, () => oil)), meal([{ ...oil, amount: { unit: 'g', value: 10_001 } }])]);
    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'rejected']);
    const { rows } = await api.db.query('select kcal::float, fat_g::float from app.meals where user_id = $1 and items is not null', [user.id]);
    expect(rows).toEqual([{ kcal: 2_700_000, fat_g: 300_000 }]);
  });
});
