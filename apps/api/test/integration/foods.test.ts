import { readFileSync } from 'node:fs';
import type { FoodsResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readRecipeSheet, type ImportedDish } from '../../src/foods/dishes.ts';
import { readIfctCsv } from '../../src/foods/ifct.ts';
import { INDB_GROUP, INDB_SOURCE, readIndbCsv } from '../../src/foods/indb.ts';
import { importDishes, importFoods, importMeasures, importPortions } from '../../src/foods/importFoods.ts';
import { readMeasuresSheet } from '../../src/foods/measures.ts';
import { readUsdaCsv, USDA_SOURCE } from '../../src/foods/usda.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';
import { connect } from './database.ts';

// The food-list import into PostgreSQL and GET /v1/foods (ADR-0006 rule 1; D-25, D-26), with the
// approved dishes of the standard-recipe sheet (D-28).

const FOODS = readIfctCsv(readFileSync(new URL('../../../../data/foods/ifct2017-foods.csv', import.meta.url), 'utf8'));
const SHEET = readRecipeSheet(readFileSync(new URL('../../../../docs/data/standard-recipe-sheet.csv', import.meta.url), 'utf8'), FOODS);
const MEASURES = readMeasuresSheet(readFileSync(new URL('../../../../docs/data/household-measures-sheet.csv', import.meta.url), 'utf8'), FOODS);

// Synthetic dishes: made-up values, not recipe data.
const TEST_DAL: ImportedDish = { code: 'test_dal', name: 'Test dal', portionUnit: 'katori', kcal: 138.82, proteinG: 7.42, carbsG: 19.6, fatG: 3.05, fibreG: 3.33 };
const TEST_FLATBREAD: ImportedDish = { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 173, proteinG: 4.23, carbsG: 25.67, fatG: 5.61, fibreG: 4.54 };

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  client = await connect();
  await importFoods(client, FOODS);
  await importDishes(client, SHEET.dishes);
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
  await client.end();
});

async function getFoods(token: string | null, query = '') {
  return api.app.inject({
    method: 'GET',
    url: `/v1/foods${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('ADR-0006 rule 1 foods:import', () => {
  it('imports all 542 foods, with 3 hidden and 14 estimated', async () => {
    const { rows } = await client.query<{ total: number; hidden: number; estimated: number }>(
      `select count(*)::int as total, count(*) filter (where hidden)::int as hidden,
              count(*) filter (where estimated)::int as estimated
       from app.foods where source = 'ifct2017'`,
    );
    expect(rows[0]).toEqual({ total: 542, hidden: 3, estimated: 14 });
  });

  it('stores the values as printed, and ghee with 900 kcal estimated', async () => {
    const { rows } = await client.query(
      `select code, protein_g::text, kcal::text, kcal_source from app.foods where code in ('A019', 'T013') order by code`,
    );
    expect(rows).toEqual([
      { code: 'A019', protein_g: '10.57', kcal: '320.00', kcal_source: 'published' },
      { code: 'T013', protein_g: '0.00', kcal: '900.00', kcal_source: 'estimated_fat_factor' },
    ]);
  });

  it('gives the same table when run again, and removes a food no longer in the file', async () => {
    const result = await importFoods(client, FOODS);
    expect(result).toEqual({ total: 542, hidden: 3, estimated: 14 });

    await importFoods(client, FOODS.filter((food) => food.code !== 'E021'));
    const { rowCount } = await client.query(`select 1 from app.foods where code = 'E021'`);
    expect(rowCount).toBe(0);

    await importFoods(client, FOODS);
    const { rows } = await client.query<{ n: number }>(`select count(*)::int as n from app.foods`);
    expect(rows[0]?.n).toBe(542);
  });

  it('a failure part-way leaves the table as it was', async () => {
    const broken = [...FOODS.slice(0, 10), { ...FOODS[10]!, proteinG: '-1.00' }];

    await expect(importFoods(client, broken)).rejects.toThrow();

    const { rows } = await client.query<{ n: number }>(`select count(*)::int as n from app.foods`);
    expect(rows[0]?.n).toBe(542);
  });
});

describe('authorization: GET /v1/foods', () => {
  it('REQ-NFR-001 no token, an expired token or another key get 401', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ]) {
      expect((await getFoods(token)).statusCode).toBe(401);
    }
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await getFoods(user.token);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('ADR-0006 rule 1 a user with an account gets the list, without the hidden rows', async () => {
    const user = await api.signUpWithAccount();

    const response = await getFoods(user.token);

    expect(response.statusCode).toBe(200);
    const body: FoodsResponse = response.json();
    expect(body.items).toHaveLength(539);
    expect(body.items?.some((food) => ['N001', 'Q001', 'S007'].includes(food.code))).toBe(false);
    expect(body.items?.find((food) => food.code === 'T013')).toEqual({
      source: 'ifct2017',
      code: 'T013',
      name: 'Ghee',
      foodGroup: 'Edible Oils and Fats',
      aliases: [],
      proteinG: 0,
      fibreG: 0,
      fatG: 100,
      carbsG: 0,
      kcal: 900,
      kcalEstimated: true,
      measures: [],
      portions: [],
    });
    expect(body.items?.find((food) => food.code === 'E021')?.aliases).toEqual(['Gooseberry']);
  });
});

describe('ADR-0006 rule 1 the list version', () => {
  it('leaves the items out when the phone already holds the current version, and changes with the list', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();

    const same: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();
    expect(same).toEqual({ version: first.version, items: null, dishes: null });

    await client.query(`update app.foods set name = 'Gooseberry' where code = 'E021'`);
    try {
      const changed: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();
      expect(changed.version).not.toBe(first.version);
      expect(changed.items).toHaveLength(539);
    } finally {
      await importFoods(client, FOODS);
    }
  });

  it('D-28 changes when a dish changes', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();

    await importDishes(client, [TEST_DAL]);
    try {
      const changed: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();
      expect(changed.version).not.toBe(first.version);
      expect(changed.dishes).toHaveLength(1);
    } finally {
      await importDishes(client, SHEET.dishes);
    }
  });

  it('error model: an unknown query field is refused', async () => {
    const user = await api.signUpWithAccount();

    const response = await getFoods(user.token, '?limit=5');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([{ field: 'limit', issue: 'unknown_field' }]);
  });
});

describe('D-28 dishes: foods:import and GET /v1/foods', () => {
  it('imports exactly the approved rows of the committed sheet; pending and blocked rows stay out', async () => {
    const { rows } = await client.query<{ code: string }>('select code from app.dishes order by code');
    expect(rows.map((row) => row.code)).toEqual(SHEET.dishes.map((dish) => dish.code).sort());
    expect(rows.map((row) => row.code)).not.toContain('chicken_curry');
  });

  it('serves each dish with its values for one portion, and no ingredients or grams', async () => {
    const user = await api.signUpWithAccount();
    await importDishes(client, [TEST_FLATBREAD, TEST_DAL]);
    try {
      const body: FoodsResponse = (await getFoods(user.token)).json();

      expect(body.dishes).toEqual([
        { code: 'test_dal', name: 'Test dal', portionUnit: 'katori', kcal: 138.82, proteinG: 7.42, carbsG: 19.6, fatG: 3.05, fibreG: 3.33 },
        { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 173, proteinG: 4.23, carbsG: 25.67, fatG: 5.61, fibreG: 4.54 },
      ]);
      expect(body.items).toHaveLength(539);
    } finally {
      await importDishes(client, SHEET.dishes);
    }
  });

  it('a dish no longer approved is removed at the next import, so the phones stop offering it', async () => {
    await importDishes(client, [TEST_FLATBREAD, TEST_DAL]);

    expect(await importDishes(client, [TEST_DAL])).toBe(1);

    const { rows } = await client.query<{ code: string }>('select code from app.dishes order by code');
    expect(rows).toEqual([{ code: 'test_dal' }]);
    await importDishes(client, SHEET.dishes);
  });

  it('a failure part-way leaves the dishes as they were', async () => {
    await importDishes(client, [TEST_DAL]);

    await expect(importDishes(client, [TEST_FLATBREAD, { ...TEST_DAL, kcal: -1 }])).rejects.toThrow();

    const { rows } = await client.query<{ code: string }>('select code from app.dishes order by code');
    expect(rows).toEqual([{ code: 'test_dal' }]);
    await importDishes(client, SHEET.dishes);
  });
});

// A synthetic USDA food: made-up values, not USDA's.
describe('D-39 USDA foods: foods:import and GET /v1/foods', () => {
  const TEST_BREAD = {
    code: '99999901',
    name: 'Test bread',
    foodGroup: 'Test breads',
    proteinG: '9.4',
    fibreG: '2.3',
    fatG: '3.6',
    carbsG: '49.2',
    kcal: '267',
    kcalSource: 'published' as const,
    estimated: false,
    needsReview: false,
    hidden: false,
    note: null,
    aliases: [],
  };

  it('imports the committed USDA files whole, within the tables’ limits', async () => {
    const read = (name: string) => readFileSync(new URL(`../../../../data/foods/${name}`, import.meta.url), 'utf8');
    const usda = readUsdaCsv(read('usda-fndds-foods.csv'), read('usda-fndds-portions.csv'));
    try {
      expect((await importFoods(client, usda.foods, USDA_SOURCE)).total).toBe(5_431);
      expect(await importPortions(client, USDA_SOURCE, usda.portions)).toBe(14_738);
      const { rows } = await client.query(`select count(*)::int as n from app.foods where source = 'usda_fndds'`);
      expect(rows).toEqual([{ n: 5_431 }]);
    } finally {
      await importFoods(client, [], USDA_SOURCE);
    }
  });

  it('serves a USDA food with its source and servings in USDA’s order; the version changes with them', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();
    await importFoods(client, [TEST_BREAD], USDA_SOURCE);
    await importPortions(client, USDA_SOURCE, [
      { code: TEST_BREAD.code, seq: 2, label: 'Cup', grams: 40 },
      { code: TEST_BREAD.code, seq: 1, label: 'Medium or regular slice', grams: 28 },
    ]);
    try {
      const body: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();

      expect(body.version).not.toBe(first.version);
      expect(body.items?.find((food) => food.code === TEST_BREAD.code)).toEqual({
        source: 'usda_fndds',
        code: TEST_BREAD.code,
        name: 'Test bread',
        foodGroup: 'Test breads',
        aliases: [],
        proteinG: 9.4,
        fibreG: 2.3,
        fatG: 3.6,
        carbsG: 49.2,
        kcal: 267,
        kcalEstimated: false,
        measures: [],
        portions: [
          { label: 'Medium or regular slice', grams: 28 },
          { label: 'Cup', grams: 40 },
        ],
      });
      // The IFCT foods stay as they were.
      expect(body.items?.filter((food) => food.source === 'ifct2017')).toHaveLength(539);
    } finally {
      await importFoods(client, [], USDA_SOURCE);
    }
    const { rows } = await client.query(`select 1 from app.food_portions where source = 'usda_fndds'`);
    expect(rows).toEqual([]);
  });
});

// A synthetic INDB recipe: made-up values, not INDB's.
describe('D-46 INDB recipes: foods:import and GET /v1/foods', () => {
  const TEST_CURRY = {
    code: 'BFP999',
    name: 'Test curry',
    foodGroup: INDB_GROUP,
    proteinG: '4.1',
    fibreG: '1.8',
    fatG: '5.2',
    carbsG: '8.3',
    kcal: '96',
    kcalSource: 'published' as const,
    estimated: true,
    needsReview: false,
    hidden: false,
    note: null,
    aliases: [],
  };

  it('imports the committed INDB files whole, every recipe estimated', async () => {
    const read = (name: string) => readFileSync(new URL(`../../../../data/foods/${name}`, import.meta.url), 'utf8');
    const indb = readIndbCsv(read('indb-foods.csv'), read('indb-portions.csv'));
    try {
      expect((await importFoods(client, indb.foods, INDB_SOURCE)).total).toBe(1_014);
      expect(await importPortions(client, INDB_SOURCE, indb.portions)).toBe(917);
      const { rows } = await client.query(`select count(*)::int as n, bool_and(estimated) as estimated from app.foods where source = 'indb'`);
      expect(rows).toEqual([{ n: 1_014, estimated: true }]);
    } finally {
      await importFoods(client, [], INDB_SOURCE);
    }
  });

  it('serves an INDB recipe with its source, its serving and its values estimated', async () => {
    const user = await api.signUpWithAccount();
    await importFoods(client, [TEST_CURRY], INDB_SOURCE);
    await importPortions(client, INDB_SOURCE, [{ code: TEST_CURRY.code, seq: 1, label: 'Bowl', grams: 180 }]);
    try {
      const body: FoodsResponse = (await getFoods(user.token)).json();

      expect(body.items?.find((food) => food.code === TEST_CURRY.code)).toEqual({
        source: 'indb',
        code: TEST_CURRY.code,
        name: 'Test curry',
        foodGroup: INDB_GROUP,
        aliases: [],
        proteinG: 4.1,
        fibreG: 1.8,
        fatG: 5.2,
        carbsG: 8.3,
        kcal: 96,
        kcalEstimated: true,
        measures: [],
        portions: [{ label: 'Bowl', grams: 180 }],
      });
    } finally {
      await importFoods(client, [], INDB_SOURCE);
    }
  });
});

// Synthetic units: made-up grams, not the owner's measurements.
describe('D-36 household units: foods:import and GET /v1/foods', () => {
  it('the committed sheet has no approved row yet, so no food has a unit', async () => {
    expect(await importMeasures(client, MEASURES.measures)).toBe(0);
    const { rows } = await client.query('select 1 from app.food_measures');
    expect(rows).toEqual([]);
  });

  it('serves each food’s units in a fixed order, with the grams one holds; the version changes with them', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();
    await importMeasures(client, [
      { code: 'T013', measure: 'tablespoon', grams: 13.5 },
      { code: 'T013', measure: 'teaspoon', grams: 4.6 },
      { code: 'L002', measure: 'glass', grams: 258 },
    ]);
    try {
      const body: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();

      expect(body.version).not.toBe(first.version);
      expect(body.items?.find((food) => food.code === 'T013')?.measures).toEqual([
        { measure: 'teaspoon', grams: 4.6 },
        { measure: 'tablespoon', grams: 13.5 },
      ]);
      expect(body.items?.find((food) => food.code === 'L002')?.measures).toEqual([{ measure: 'glass', grams: 258 }]);
      expect(body.items?.find((food) => food.code === 'A019')?.measures).toEqual([]);
    } finally {
      await importMeasures(client, MEASURES.measures);
    }
  });

  it('a unit no longer approved is removed at the next import, and a failure part-way changes nothing', async () => {
    await importMeasures(client, [
      { code: 'L002', measure: 'glass', grams: 258 },
      { code: 'T013', measure: 'teaspoon', grams: 4.6 },
    ]);
    expect(await importMeasures(client, [{ code: 'L002', measure: 'glass', grams: 258 }])).toBe(1);
    const units = () => client.query('select code, measure, grams::text from app.food_measures order by code');
    expect((await units()).rows).toEqual([{ code: 'L002', measure: 'glass', grams: '258.00' }]);

    await expect(importMeasures(client, [{ code: 'T013', measure: 'teaspoon', grams: 4.6 }, { code: 'L999', measure: 'glass', grams: 250 }])).rejects.toThrow();

    expect((await units()).rows).toEqual([{ code: 'L002', measure: 'glass', grams: '258.00' }]);
    await importMeasures(client, MEASURES.measures);
  });
});
