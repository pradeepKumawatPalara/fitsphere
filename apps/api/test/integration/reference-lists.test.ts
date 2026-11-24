import { gunzipSync } from 'node:zlib';
import type { FoodsResponse } from '@fitsphere/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildExerciseList } from '../../src/routes/exercises.ts';
import { buildFoodList } from '../../src/routes/foods.ts';
import { referenceList } from '../../src/routes/referenceList.ts';
import { startTestApi } from './app.ts';
import { connect, testDatabaseUrl } from './database.ts';

// D-126 (docs/plans/reference-list-egress.md): migration 0038 keeps each reference list's generation and
// version in app.reference_lists, moved by triggers on the list's tables; GET /v1/foods and
// GET /v1/exercises read those tables only when a phone is behind, once per generation. A synthetic
// dish with made-up values.

const DISH = 'test_reference_dal';
const FOOD_TABLES = ['dishes', 'food_measures', 'food_portions', 'foods', 'packaged_food_portions', 'packaged_foods'];
const EXERCISE_TABLES = ['exercise_details', 'exercise_speed_mets', 'exercises'];
// A column of each table, for statements that change no row.
const A_COLUMN: Record<string, string> = {
  foods: 'code',
  dishes: 'code',
  food_measures: 'code',
  food_portions: 'code',
  packaged_foods: 'barcode',
  packaged_food_portions: 'barcode',
  exercises: 'code',
  exercise_speed_mets: 'exercise_code',
  exercise_details: 'exercise_code',
};
const LIST_TABLE = /\bapp\.(foods|dishes|food_measures|food_portions|packaged_foods|packaged_food_portions|exercises|exercise_speed_mets|exercise_details)\b/;

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;
let auth: { authorization: string };
const lines: string[] = [];

beforeAll(async () => {
  client = await connect();
  await client.query(
    `insert into app.dishes (code, name, portion_unit, kcal, protein_g, carbs_g, fat_g, fibre_g)
     values ($1, 'Test reference dal', 'katori', 120, 7, 18, 3, 3)`,
    [DISH],
  );
  api = await startTestApi({ log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
  const user = await api.signUpWithAccount();
  auth = { authorization: `Bearer ${user.token}` };
});

afterAll(async () => {
  await client.query('delete from app.dishes where code = $1', [DISH]);
  await api.close();
  await client.end();
});

async function stored(name: 'foods' | 'exercises') {
  const { rows } = await client.query<{ generation: string; version: string | null }>(
    'select generation, version from app.reference_lists where name = $1',
    [name],
  );
  return { generation: Number(rows[0]!.generation), version: rows[0]!.version };
}

function get(path: string, headers: Record<string, string> = {}) {
  return api.app.inject({ method: 'GET', url: `/v1/${path}`, headers: { ...auth, ...headers } });
}

/** How many times the list was read whole, from the API's log lines. */
function readsOf(logLines: string[], list: 'foods' | 'exercises') {
  return logLines.map((line) => JSON.parse(line) as { msg?: string; list?: string }).filter((entry) => entry.msg === 'reference list built' && entry.list === list).length;
}

function storedVersionBecomes(name: 'foods' | 'exercises', version: string) {
  return vi.waitFor(async () => expect((await stored(name)).version).toBe(version), { timeout: 5_000 });
}

/** The tables a list's read names, from its SQL. */
async function tablesRead(build: (client: pg.ClientBase) => Promise<unknown>) {
  const sql: string[] = [];
  const recording = {
    query: (text: string, values?: unknown[]) => {
      sql.push(text);
      return client.query(text, values);
    },
  } as unknown as pg.ClientBase;
  await build(recording);
  return [...new Set(sql.flatMap((text) => [...text.matchAll(/\bapp\.(\w+)/g)].map((match) => match[1]!)))].sort();
}

describe('D-126 migration 0038: app.reference_lists', () => {
  it('has one row for each list', async () => {
    const { rows } = await client.query<{ name: string }>('select name from app.reference_lists order by name');
    expect(rows.map((row) => row.name)).toEqual(['exercises', 'foods']);
  });

  it('has the trigger on every table the lists are read from, on every kind of statement, and on no other table', async () => {
    const foodTables = await tablesRead(buildFoodList);
    const exerciseTables = await tablesRead(buildExerciseList);
    expect(foodTables).toEqual(FOOD_TABLES);
    expect(exerciseTables).toEqual(EXERCISE_TABLES);

    const { rows } = await client.query<{ relname: string; definition: string }>(
      `select c.relname, pg_get_triggerdef(t.oid) as definition
       from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and t.tgname = 'reference_list_changed'`,
    );
    const triggers = new Map(rows.map((row) => [row.relname, row.definition]));
    for (const [list, tables] of [['foods', foodTables], ['exercises', exerciseTables]] as const) {
      for (const table of tables) {
        const definition = triggers.get(table) ?? '';
        expect(definition, table).toContain(`app.reference_list_changed('${list}')`);
        for (const words of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'FOR EACH STATEMENT']) expect(definition, table).toContain(words);
      }
    }
    expect([...triggers.keys()].sort()).toEqual([...foodTables, ...exerciseTables].sort());
  });

  it("moves a list's generation and clears its version on every statement on its tables, even one changing no row, and leaves the other list alone", async () => {
    for (const [list, other, tables] of [['foods', 'exercises', FOOD_TABLES], ['exercises', 'foods', EXERCISE_TABLES]] as const) {
      for (const table of tables) {
        const column = A_COLUMN[table]!;
        await client.query('begin');
        try {
          await client.query(`update app.reference_lists set version = 'test-version'`);
          const before = { own: await stored(list), other: await stored(other) };
          await client.query(`insert into app.${table} (${column}) select ${column} from app.${table} where false`);
          await client.query(`update app.${table} set ${column} = ${column} where false`);
          await client.query(`delete from app.${table} where false`);
          const after = await stored(list);
          expect(after, table).toEqual({ generation: before.own.generation + 3, version: null });
          expect(await stored(other), table).toEqual(before.other);
          await client.query(`truncate app.${table} cascade`);
          expect((await stored(list)).generation, `${table} truncated`).toBeGreaterThan(after.generation);
        } finally {
          await client.query('rollback');
        }
      }
    }
  });

  it('leaves both lists alone for the tables the phone never receives', async () => {
    await client.query('begin');
    try {
      const before = [await stored('foods'), await stored('exercises')];
      for (const table of ['usda_foods', 'usda_food_portions', 'food_portion_history']) await client.query(`delete from app.${table} where false`);
      expect([await stored('foods'), await stored('exercises')]).toEqual(before);
    } finally {
      await client.query('rollback');
    }
  });
});

describe('D-126 GET /v1/foods and GET /v1/exercises answer from the stored version', () => {
  let current = '';

  it('sends a phone that is behind the whole list, and stores its version for the next request', async () => {
    const response = await get('foods');
    expect(response.statusCode).toBe(200);
    const body = response.json<FoodsResponse>();
    expect(body.dishes?.map((dish) => dish.code)).toContain(DISH);
    current = body.version;
    await storedVersionBecomes('foods', current);
  });

  it('answers a current phone with one small read: the list is not read, nor its tables named', async () => {
    const reads = readsOf(lines, 'foods');
    const query = vi.spyOn(api.db, 'query');
    const connectSpy = vi.spyOn(api.db, 'connect');
    try {
      const response = await get(`foods?version=${encodeURIComponent(current)}`);
      expect(response.json()).toEqual({ version: current, items: null, dishes: null, packaged: null });
      const sql = query.mock.calls.map(([text]) => (typeof text === 'string' ? text : (text as { text: string }).text));
      expect(sql.filter((text) => text.includes('app.reference_lists'))).toHaveLength(1);
      expect(sql.some((text) => LIST_TABLE.test(text))).toBe(false);
      // A read of the list takes a connection of its own (connect() with no callback); pool.query's own do not.
      expect(connectSpy.mock.calls.filter((args) => (args as unknown[]).length === 0)).toHaveLength(0);
      expect(readsOf(lines, 'foods')).toBe(reads);
    } finally {
      query.mockRestore();
      connectSpy.mockRestore();
    }
  });

  it('answers a current phone after a cold start (a new API, nothing in memory) without reading the list', async () => {
    const freshLines: string[] = [];
    const fresh = await startTestApi({ log: { level: 'info', stream: { write: (line) => freshLines.push(line) } } });
    try {
      const user = await fresh.signUpWithAccount();
      const response = await fresh.app.inject({
        method: 'GET',
        url: `/v1/foods?version=${encodeURIComponent(current)}`,
        headers: { authorization: `Bearer ${user.token}` },
      });
      expect(response.json()).toEqual({ version: current, items: null, dishes: null, packaged: null });
      expect(readsOf(freshLines, 'foods')).toBe(0);
    } finally {
      await fresh.close();
    }
  });

  it('gives a new version and the new value after a change made with plain SQL', async () => {
    await client.query('update app.dishes set kcal = 150 where code = $1', [DISH]);
    expect((await stored('foods')).version).toBeNull();
    const body = (await get(`foods?version=${encodeURIComponent(current)}`)).json<FoodsResponse>();
    expect(body.version).not.toBe(current);
    expect(body.dishes?.find((dish) => dish.code === DISH)?.kcal).toBe(150);
    current = body.version;
    await storedVersionBecomes('foods', current);
  });

  it('keeps the version when the same values are written again, as an import run twice does: a current phone still gets null', async () => {
    const before = await stored('foods');
    const reads = readsOf(lines, 'foods');
    await client.query('update app.dishes set kcal = kcal where code = $1', [DISH]);
    expect(await stored('foods')).toEqual({ generation: before.generation + 1, version: null });
    const response = await get(`foods?version=${encodeURIComponent(current)}`);
    expect(response.json()).toEqual({ version: current, items: null, dishes: null, packaged: null });
    expect(readsOf(lines, 'foods')).toBe(reads + 1);
    await storedVersionBecomes('foods', current);
  });

  it('reads the list once for requests that come at once', async () => {
    await client.query('update app.dishes set kcal = kcal where code = $1', [DISH]);
    const reads = readsOf(lines, 'foods');
    const responses = await Promise.all([get(`foods?version=${encodeURIComponent(current)}`), get('foods'), get('foods?version=old-version')]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect(responses.map((response) => response.json<FoodsResponse>().items === null)).toEqual([true, false, false]);
    expect(readsOf(lines, 'foods')).toBe(reads + 1);
  });

  it('sends the same list gzipped and plain', async () => {
    const plain = await get('foods');
    const packed = await get('foods', { 'accept-encoding': 'gzip' });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(packed.headers['content-encoding']).toBe('gzip');
    expect(packed.headers['content-type']).toMatch(/^application\/json/);
    expect(JSON.parse(gunzipSync(packed.rawPayload).toString('utf8'))).toEqual(plain.json());
  });

  it('does the same for the exercise list', async () => {
    const version: string = (await get('exercises')).json().version;
    await storedVersionBecomes('exercises', version);
    const reads = readsOf(lines, 'exercises');
    expect((await get(`exercises?version=${encodeURIComponent(version)}`)).json()).toEqual({ version, items: null });
    expect(readsOf(lines, 'exercises')).toBe(reads);

    // A statement on one of its tables: read again, the same values give the same version.
    await client.query('update app.exercise_speed_mets set met = met where false');
    expect((await stored('exercises')).version).toBeNull();
    expect((await get(`exercises?version=${encodeURIComponent(version)}`)).json()).toEqual({ version, items: null });
    expect(readsOf(lines, 'exercises')).toBe(reads + 1);
  });
});

describe('D-126 the version written back', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: testDatabaseUrl(), max: 3 });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('is not written when the list changed while it was read', async () => {
    await client.query('update app.dishes set kcal = kcal where code = $1', [DISH]);
    const before = await stored('foods');
    const lists = referenceList({
      name: 'foods',
      db: pool,
      build: async (inside) => {
        const read = await buildFoodList(inside);
        // Committed on another connection while this read is under way, as an import would be.
        await client.query('update app.dishes set kcal = kcal + 1 where code = $1', [DISH]);
        return read;
      },
    });
    expect((await lists.answer(undefined)).current).toBe(false);
    await lists.settled();
    expect(await stored('foods')).toEqual({ generation: before.generation + 1, version: null });
  });

  it("gives up while an import holds the list's row, and the reply does not wait for it", async () => {
    await client.query('update app.dishes set kcal = kcal where code = $1', [DISH]);
    const holder = await connect();
    try {
      // As an import part-way: the list's row is held until this transaction ends.
      await holder.query('begin');
      await holder.query('update app.dishes set kcal = kcal where code = $1', [DISH]);
      const lists = referenceList({ name: 'foods', db: pool, build: buildFoodList });
      const answer = await lists.answer(undefined);
      const answeredAt = Date.now();
      expect(answer.current).toBe(false);
      await lists.settled();
      expect(Date.now() - answeredAt).toBeGreaterThanOrEqual(1_500);
      expect((await stored('foods')).version).toBeNull();
    } finally {
      await holder.query('rollback');
      await holder.end();
    }
  });
});
