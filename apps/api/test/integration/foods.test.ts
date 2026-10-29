import { readFileSync } from 'node:fs';
import type { FoodsResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readIfctCsv } from '../../src/foods/ifct.ts';
import { importFoods } from '../../src/foods/importFoods.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';
import { connect } from './database.ts';

// The food-list import into PostgreSQL and GET /v1/foods (ADR-0006 rule 1; D-25, D-26).

const FOODS = readIfctCsv(readFileSync(new URL('../../../../data/foods/ifct2017-foods.csv', import.meta.url), 'utf8'));

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  client = await connect();
  await importFoods(client, FOODS);
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
    });
    expect(body.items?.find((food) => food.code === 'E021')?.aliases).toEqual(['Gooseberry']);
  });
});

describe('ADR-0006 rule 1 the list version', () => {
  it('leaves the items out when the phone already holds the current version, and changes with the list', async () => {
    const user = await api.signUpWithAccount();
    const first: FoodsResponse = (await getFoods(user.token)).json();

    const same: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();
    expect(same).toEqual({ version: first.version, items: null });

    await client.query(`update app.foods set name = 'Gooseberry' where code = 'E021'`);
    try {
      const changed: FoodsResponse = (await getFoods(user.token, `?version=${first.version}`)).json();
      expect(changed.version).not.toBe(first.version);
      expect(changed.items).toHaveLength(539);
    } finally {
      await importFoods(client, FOODS);
    }
  });

  it('error model: an unknown query field is refused', async () => {
    const user = await api.signUpWithAccount();

    const response = await getFoods(user.token, '?limit=5');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([{ field: 'limit', issue: 'unknown_field' }]);
  });
});
