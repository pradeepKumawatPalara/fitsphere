import { readFileSync } from 'node:fs';
import type { FoodsResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readRecipeSheet, type ImportedDish } from '../../src/foods/dishes.ts';
import { BRAND_LABEL_SOURCE, readBrandLabelsSheet } from '../../src/foods/brandLabels.ts';
import { DISH_ESTIMATE_SOURCE, readDishEstimatesSheet } from '../../src/foods/dishEstimates.ts';
import { HOME_FOOD_SOURCE, readHomeFoodsSheet } from '../../src/foods/homeFoods.ts';
import { readIfctCsv } from '../../src/foods/ifct.ts';
import { INDB_GROUP, INDB_SOURCE, readIndbCsv } from '../../src/foods/indb.ts';
import { importDishes, importFoods, importMeasures, importPackagedFoods, importPortions, importUsdaArchive } from '../../src/foods/importFoods.ts';
import { readMeasuresSheet } from '../../src/foods/measures.ts';
import { readPackagedCsv, withExtraPackaged } from '../../src/foods/offIndia.ts';
import { readUsdaCsv } from '../../src/foods/usda.ts';
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
    expect(same).toEqual({ version: first.version, items: null, dishes: null, packaged: null });

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
describe('D-47 USDA foods: kept in their archive by foods:import, not in the food list', () => {
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

  it('archives the committed USDA files whole, within the tables’ limits', async () => {
    const read = (name: string) => readFileSync(new URL(`../../../../data/foods/${name}`, import.meta.url), 'utf8');
    const usda = readUsdaCsv(read('usda-fndds-foods.csv'), read('usda-fndds-portions.csv'));
    try {
      expect(await importUsdaArchive(client, usda.foods, usda.portions)).toBe(5_431);
      const { rows } = await client.query(
        'select (select count(*)::int from app.usda_foods) as foods, (select count(*)::int from app.usda_food_portions) as portions',
      );
      expect(rows).toEqual([{ foods: 5_431, portions: 14_738 }]);
    } finally {
      await importUsdaArchive(client, [], []);
    }
  });

  it('serves no USDA food: GET /v1/foods lists IFCT’s foods only', async () => {
    const user = await api.signUpWithAccount();
    await importUsdaArchive(client, [TEST_BREAD], [{ code: TEST_BREAD.code, seq: 1, label: 'Medium or regular slice', grams: 28 }]);
    try {
      const body: FoodsResponse = (await getFoods(user.token)).json();

      expect(body.items?.some((food) => food.code === TEST_BREAD.code)).toBe(false);
      expect(new Set(body.items?.map((food) => food.source))).toEqual(new Set(['ifct2017']));
    } finally {
      await importUsdaArchive(client, [], []);
    }
  });
});

describe('D-59 home-style foods: foods:import and GET /v1/foods', () => {
  const homeFlags = async () =>
    (await client.query<{ flag: string | null; n: number }>(
      `select flag, count(*)::int as n from app.foods where source = 'home' group by flag order by flag nulls first`,
    )).rows;

  it('imports the approved rows of the committed sheet whole, each with its serving, flagged llm', async () => {
    const home = readHomeFoodsSheet(readFileSync(new URL('../../../../docs/data/home-foods-sheet.csv', import.meta.url), 'utf8'));
    try {
      expect((await importFoods(client, home.foods, HOME_FOOD_SOURCE)).total).toBe(92);
      expect(await importPortions(client, HOME_FOOD_SOURCE, home.portions)).toBe(92);
      expect(await homeFlags()).toEqual([{ flag: 'llm', n: 92 }]);
    } finally {
      await importFoods(client, [], HOME_FOOD_SOURCE);
    }
  });

  it('serves a home-style food with its item and search words as aliases and its serving, never its flag', async () => {
    const user = await api.signUpWithAccount();
    const home = readHomeFoodsSheet(readFileSync(new URL('../../../../docs/data/home-foods-sheet.csv', import.meta.url), 'utf8'));
    await importFoods(client, home.foods, HOME_FOOD_SOURCE);
    await importPortions(client, HOME_FOOD_SOURCE, home.portions);
    try {
      const response = await getFoods(user.token);
      const body: FoodsResponse = response.json();

      expect(body.items?.find((food) => food.code === 'home-bread-butter-toast')).toEqual({
        source: 'home',
        code: 'home-bread-butter-toast',
        name: 'Butter toast (Makhan toast)',
        foodGroup: 'Bread',
        aliases: ['bread', 'makhan toast', 'buttered toast', 'butter toast', 'toast butter'],
        proteinG: 7.8,
        fibreG: 2.1,
        fatG: 17.3,
        carbsG: 44.6,
        kcal: 365.2,
        kcalEstimated: false,
        measures: [],
        portions: [{ label: '2 slices', grams: 56 }],
      });
      expect(response.body).not.toContain('llm');
    } finally {
      await importFoods(client, [], HOME_FOOD_SOURCE);
    }
  });

  it('refuses any other source in the food list', async () => {
    await expect(
      client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated, needs_review, hidden, aliases)
         values ('other', 'x', 'x', 'x', 1, 1, 1, 1, 17, 'published', false, false, false, '{}')`,
      ),
    ).rejects.toThrow(/foods_source_check/);
  });
});

describe('D-62 estimated dishes: foods:import and GET /v1/foods', () => {
  const ESTIMATES = readDishEstimatesSheet(readFileSync(new URL('../../../../docs/data/dish-estimates-sheet.csv', import.meta.url), 'utf8'));

  it('imports the approved rows of the committed sheet whole, each with its serving, flagged llm; the held rows stay out', async () => {
    try {
      expect((await importFoods(client, ESTIMATES.foods, DISH_ESTIMATE_SOURCE)).total).toBe(5_025);
      expect(await importPortions(client, DISH_ESTIMATE_SOURCE, ESTIMATES.portions)).toBe(5_025);
      expect(
        (await client.query(`select flag, estimated, count(*)::int as n from app.foods where source = 'dish_estimate' group by flag, estimated`)).rows,
      ).toEqual([{ flag: 'llm', estimated: true, n: 5_025 }]);
      expect((await client.query(`select count(*)::int as n from app.foods where code = 'est-classic-south-indian-rava-idli'`)).rows).toEqual([{ n: 0 }]);
    } finally {
      await importFoods(client, [], DISH_ESTIMATE_SOURCE);
    }
  });

  it('serves an estimated dish, marked estimated, with its base food words as aliases and its serving, never its flag', async () => {
    const user = await api.signUpWithAccount();
    await importFoods(client, ESTIMATES.foods, DISH_ESTIMATE_SOURCE);
    await importPortions(client, DISH_ESTIMATE_SOURCE, ESTIMATES.portions);
    try {
      const response = await getFoods(user.token);
      const body: FoodsResponse = response.json();

      expect(body.items?.find((food) => food.code === 'est-bhindi-masala')).toEqual({
        source: 'dish_estimate',
        code: 'est-bhindi-masala',
        name: 'Bhindi Masala',
        foodGroup: 'Okra / Bhindi',
        aliases: ['okra', 'bhindi'],
        proteinG: 2.5,
        fibreG: 2.5,
        fatG: 6.5,
        carbsG: 9,
        kcal: 100,
        kcalEstimated: true,
        measures: [],
        portions: [{ label: 'Katori', grams: 150 }],
      });
      expect(response.body).not.toContain('llm');
    } finally {
      await importFoods(client, [], DISH_ESTIMATE_SOURCE);
    }
  });
});

// Synthetic brand labels: made-up values, not real products'.
describe('D-49 brand labels: foods:import and GET /v1/foods', () => {
  const SHEET_HEADER = 'code,brand,product,status,basis,kcal,protein_g,carbs_g,fat_g,fibre_g,serving,serving_grams,source_url,read_on,notes,flag,search_words';
  const BUTTER_TO_NOTES = 'test-dairy-butter,Test Dairy,Salted Butter,approved,100 g,720,0.5,0.5,80,,1 serving,10,https://example.com/butter,2026-11-04,';
  const butterRow = (flag = '', searchWords = '') => `${BUTTER_TO_NOTES},${flag},${searchWords}`;
  const BUTTER = butterRow();

  const flags = async () =>
    (await client.query<{ flag: string | null; n: number }>(
      `select flag, count(*)::int as n from app.foods where source = 'brand_label' group by flag order by flag nulls first`,
    )).rows;

  it('imports the approved rows of the committed sheet whole, with their servings and their flags (D-52, D-53)', async () => {
    const labels = readBrandLabelsSheet(readFileSync(new URL('../../../../docs/data/brand-labels-sheet.csv', import.meta.url), 'utf8'));
    try {
      expect((await importFoods(client, labels.foods, BRAND_LABEL_SOURCE)).total).toBe(630);
      expect(await importPortions(client, BRAND_LABEL_SOURCE, labels.portions)).toBe(115);
      expect(await flags()).toEqual([
        { flag: null, n: 23 },
        { flag: 'llm', n: 408 },
        { flag: 'scrap', n: 199 },
      ]);
    } finally {
      await importFoods(client, [], BRAND_LABEL_SOURCE);
    }
  });

  it('serves an approved label with its brand, its serving, and its fibre unknown when the label gives none', async () => {
    const user = await api.signUpWithAccount();
    const labels = readBrandLabelsSheet([SHEET_HEADER, BUTTER].join('\n'));
    await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
    await importPortions(client, BRAND_LABEL_SOURCE, labels.portions);
    try {
      const body: FoodsResponse = (await getFoods(user.token)).json();

      expect(body.items?.find((food) => food.code === 'test-dairy-butter')).toEqual({
        source: 'brand_label',
        code: 'test-dairy-butter',
        name: 'Test Dairy Salted Butter',
        foodGroup: 'Test Dairy',
        aliases: ['Test Dairy'],
        proteinG: 0.5,
        fibreG: null,
        fatG: 80,
        carbsG: 0.5,
        kcal: 720,
        kcalEstimated: false,
        measures: [],
        portions: [{ label: 'Serving', grams: 10 }],
      });
    } finally {
      await importFoods(client, [], BRAND_LABEL_SOURCE);
    }
  });

  it('keeps a flag on the server: stored with the food, never sent to the phone (D-52)', async () => {
    const user = await api.signUpWithAccount();
    const labels = readBrandLabelsSheet([SHEET_HEADER, butterRow('scrap')].join('\n'));
    await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
    try {
      expect(await flags()).toEqual([{ flag: 'scrap', n: 1 }]);
      const body: FoodsResponse = (await getFoods(user.token)).json();
      const butter = body.items?.find((food) => food.code === 'test-dairy-butter');

      expect(butter).toBeDefined();
      expect(butter).not.toHaveProperty('flag');
      expect(JSON.stringify(body)).not.toContain('scrap');
    } finally {
      await importFoods(client, [], BRAND_LABEL_SOURCE);
    }
  });

  it('sends a label’s search words to the phone as its aliases, after the brand (D-55)', async () => {
    const user = await api.signUpWithAccount();
    const labels = readBrandLabelsSheet([SHEET_HEADER, butterRow('', 'makhan; table butter')].join('\n'));
    await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
    try {
      const body: FoodsResponse = (await getFoods(user.token)).json();
      expect(body.items?.find((food) => food.code === 'test-dairy-butter')?.aliases).toEqual(['Test Dairy', 'makhan', 'table butter']);
    } finally {
      await importFoods(client, [], BRAND_LABEL_SOURCE);
    }
  });

  it('keeps an llm flag on the server too, never sent to the phone (D-53)', async () => {
    const user = await api.signUpWithAccount();
    const labels = readBrandLabelsSheet([SHEET_HEADER, butterRow('llm').replace('https://example.com/butter', '')].join('\n'));
    await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
    try {
      expect(await flags()).toEqual([{ flag: 'llm', n: 1 }]);
      const body: FoodsResponse = (await getFoods(user.token)).json();

      expect(body.items?.find((food) => food.code === 'test-dairy-butter')).not.toHaveProperty('flag');
      expect(JSON.stringify(body)).not.toContain('llm');
    } finally {
      await importFoods(client, [], BRAND_LABEL_SOURCE);
    }
  });

  it('takes no flag but scrap or llm (D-52, D-53)', async () => {
    await expect(
      client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated, needs_review, hidden, flag)
         values ('brand_label', 'test-flag', 'Test', 'Test', 1, null, 1, 1, 21, 'published', false, false, false, 'other')`,
      ),
    ).rejects.toThrow(/foods_flag_check/);
  });

  it('keeps fibre required for every other source', async () => {
    await expect(
      client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated, needs_review, hidden)
         values ('indb', 'BFP998', 'Test', 'Test', 1, null, 1, 1, 21, 'published', true, false, false)`,
      ),
    ).rejects.toThrow(/foods_fibre_known/);
  });
});

// A synthetic packaged food: made-up values, not a real product's.
describe('D-48 packaged foods sold in India: foods:import and GET /v1/foods', () => {
  const TEST_BREAD = {
    barcode: '8901234567890',
    name: 'Test sandwich bread',
    brand: 'Test Foods',
    kcal: 250,
    proteinG: 8,
    carbsG: 50,
    fatG: 2,
    fibreG: null,
    servingGrams: 50,
  };

  it('imports the committed file whole', async () => {
    const packaged = readPackagedCsv(readFileSync(new URL('../../../../data/foods/off-india-products.csv', import.meta.url), 'utf8'));
    try {
      expect(await importPackagedFoods(client, packaged)).toBe(9_764);
      expect((await client.query('select count(*)::int as n from app.packaged_foods')).rows).toEqual([{ n: 9_764 }]);
    } finally {
      await importPackagedFoods(client, []);
    }
  });

  it('D-62 imports the 11 extra products from the owner’s dish database with them', async () => {
    const read = (file: string) => readPackagedCsv(readFileSync(new URL(`../../../../data/foods/${file}`, import.meta.url), 'utf8'));
    try {
      expect(await importPackagedFoods(client, withExtraPackaged(read('off-india-products.csv'), read('off-india-extra.csv')))).toBe(9_775);
    } finally {
      await importPackagedFoods(client, []);
    }
  });

  it('serves them apart from the food list, with their serving; the version changes with them', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();
    await importPackagedFoods(client, [TEST_BREAD]);
    try {
      const body: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();

      expect(body.version).not.toBe(first.version);
      expect(body.packaged).toEqual([TEST_BREAD]);
      expect(body.items?.some((food) => food.code === TEST_BREAD.barcode)).toBe(false);
      expect((await getFoods(user.token, `?version=${body.version}`)).json()).toEqual({ version: body.version, items: null, dishes: null, packaged: null });
    } finally {
      await importPackagedFoods(client, []);
    }
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
