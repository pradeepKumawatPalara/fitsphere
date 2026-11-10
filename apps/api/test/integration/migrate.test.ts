import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { checksum, migrate, MigrationError, readMigrations } from '../../src/db/migrate.ts';
import { connect, testDatabaseUrl } from './database.ts';

// Each test gets its own empty database, so the runner starts from nothing.
let admin: pg.Client;
let scratch: string;
let client: pg.Client;

beforeAll(async () => {
  admin = await connect();
});

afterAll(async () => {
  await admin.end();
});

beforeEach(async () => {
  scratch = `fitsphere_migrate_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`create database ${scratch}`);
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${scratch}`;
  client = await connect(url.toString());
});

afterEach(async () => {
  await client.end();
  await admin.query(`drop database ${scratch} with (force)`);
});

const first = { name: '0001_first.sql', sql: 'create table app.first (id int primary key);' };
const second = { name: '0002_second.sql', sql: 'create table app.second (id int primary key);' };

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await client.query('select to_regclass($1) as found', [`app.${name}`]);
  return rows[0].found !== null;
}

describe('Migration runner (data model, "Changes")', () => {
  it('applies every migration in order and records it; a second run applies nothing', async () => {
    expect(await migrate(client, [first, second])).toEqual(['0001_first.sql', '0002_second.sql']);
    expect(await migrate(client, [first, second])).toEqual([]);

    const { rows } = await client.query('select name, checksum from app.schema_migrations order by name');
    expect(rows).toEqual([
      { name: first.name, checksum: checksum(first.sql) },
      { name: second.name, checksum: checksum(second.sql) },
    ]);
  });

  it('applies only the new migration on a later run', async () => {
    await migrate(client, [first]);

    expect(await migrate(client, [first, second])).toEqual(['0002_second.sql']);
    expect(await tableExists('second')).toBe(true);
  });

  it('runs each file in one transaction: a failing file leaves nothing behind', async () => {
    const failing = {
      name: '0002_failing.sql',
      sql: 'create table app.half (id int); select 1 / 0;',
    };

    await expect(migrate(client, [first, failing])).rejects.toThrow();

    expect(await tableExists('first')).toBe(true);
    expect(await tableExists('half')).toBe(false);
    const { rows } = await client.query('select name from app.schema_migrations');
    expect(rows.map((row) => row.name)).toEqual(['0001_first.sql']);
  });

  it('refuses an applied file that was later edited, and applies nothing', async () => {
    await migrate(client, [first]);
    const edited = { ...first, sql: `${first.sql}\ncreate table app.extra (id int);` };

    await expect(migrate(client, [edited, second])).rejects.toThrow(MigrationError);
    expect(await tableExists('extra')).toBe(false);
    expect(await tableExists('second')).toBe(false);
  });

  it('refuses when an applied migration is missing from the checkout', async () => {
    await migrate(client, [first, second]);

    await expect(migrate(client, [first])).rejects.toThrow(MigrationError);
  });

  it('does not count line endings, so Windows and Linux checkouts agree', () => {
    expect(checksum('select 1;\r\nselect 2;\r\n')).toBe(checksum('select 1;\nselect 2;\n'));
  });

  it('D-47 0013 moves the USDA foods and servings already in the food list to their archive, and the list takes none again', async () => {
    const all = await readMigrations();
    await migrate(client, all.filter((migration) => migration.name < '0013'));
    const food = (source: string, code: string, name: string) =>
      client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated, needs_review, hidden)
         values ($1, $2, $3, 'Test', 9.4, 2.3, 3.6, 49.2, 267, 'published', false, false, false)`,
        [source, code, name],
      );
    // Synthetic rows: made-up values.
    await food('usda_fndds', '99999901', 'Test bread');
    await food('ifct2017', 'A019', 'Test atta');
    await client.query(`insert into app.food_portions (source, code, seq, label, grams) values ('usda_fndds', '99999901', 1, 'Slice', 28)`);

    expect(await migrate(client, all.filter((migration) => migration.name <= '0013_usda_archive.sql'))).toEqual(['0013_usda_archive.sql']);

    expect((await client.query('select source, code from app.foods')).rows).toEqual([{ source: 'ifct2017', code: 'A019' }]);
    expect((await client.query('select code, name, kcal from app.usda_foods')).rows).toEqual([{ code: '99999901', name: 'Test bread', kcal: '267.00' }]);
    expect((await client.query('select code, seq, label, grams from app.usda_food_portions')).rows).toEqual([
      { code: '99999901', seq: 1, label: 'Slice', grams: '28.00' },
    ]);
    expect((await client.query('select count(*)::int as n from app.food_portions')).rows).toEqual([{ n: 0 }]);
    await expect(food('usda_fndds', '99999902', 'Another bread')).rejects.toThrow(/foods_source_check/);
  });

  it('applies the real migrations to an empty database', async () => {
    expect(await migrate(client, await readMigrations())).toEqual([
      '0001_skeleton.sql',
      '0002_daily_tracking.sql',
      '0003_food_list.sql',
      '0004_meals.sql',
      '0005_meal_photos.sql',
      '0006_dishes.sql',
      '0007_workouts.sql',
      '0008_settings.sql',
      '0009_food_measures.sql',
      '0010_profiles.sql',
      '0011_more_foods.sql',
      '0012_indb_foods.sql',
      '0013_usda_archive.sql',
      '0014_packaged_foods.sql',
      '0015_brand_labels.sql',
      '0016_exercises.sql',
      '0017_exercise_speed_mets.sql',
      '0018_food_flag.sql',
      '0019_food_flag_llm.sql',
      '0020_home_foods.sql',
      '0021_dish_estimates.sql',
    ]);
    for (const table of ['weigh_ins', 'step_counts', 'sleep_logs', 'measurements', 'targets', 'foods', 'barcode_products', 'media', 'dishes', 'workouts', 'settings', 'ai_consents', 'food_measures', 'profiles', 'food_portions', 'my_foods', 'usda_foods', 'usda_food_portions', 'packaged_foods', 'exercises', 'exercise_speed_mets']) {
      expect(await tableExists(table)).toBe(true);
    }
  });
});

describe('Migration files', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fitsphere-migrations-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads numbered files in order', async () => {
    await writeFile(path.join(dir, '0002_b.sql'), 'select 2;');
    await writeFile(path.join(dir, '0001_a.sql'), 'select 1;');

    expect((await readMigrations(dir)).map((migration) => migration.name)).toEqual([
      '0001_a.sql',
      '0002_b.sql',
    ]);
  });

  it('refuses files that are not numbered, and two files with one number', async () => {
    await writeFile(path.join(dir, 'skeleton.sql'), 'select 1;');
    await expect(readMigrations(dir)).rejects.toThrow(MigrationError);

    await rm(path.join(dir, 'skeleton.sql'));
    await writeFile(path.join(dir, '0001_a.sql'), 'select 1;');
    await writeFile(path.join(dir, '0001_b.sql'), 'select 1;');
    await expect(readMigrations(dir)).rejects.toThrow(MigrationError);
  });
});
