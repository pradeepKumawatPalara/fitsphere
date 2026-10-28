// Migration runner (data-model, "Changes"; D-16). Each numbered SQL file runs in one transaction
// and is recorded with a checksum; a file that was edited after it was applied is refused.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

export type Migration = { name: string; sql: string };

export class MigrationError extends Error {}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

const FILE_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;
// Any fixed number; it only keeps two runners from applying files at the same time.
const LOCK_KEY = 4_200_001;

export async function readMigrations(dir: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  const numbers = new Set<string>();
  for (const name of names) {
    if (!FILE_NAME.test(name)) {
      throw new MigrationError(`${name}: migration files are named like 0001_name.sql`);
    }
    const number = name.slice(0, 4);
    if (numbers.has(number)) throw new MigrationError(`Two migrations are numbered ${number}`);
    numbers.add(number);
  }
  return Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), 'utf8') })),
  );
}

/** The same on Windows and Linux checkouts: line endings do not count. */
export function checksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

/** Applies the migrations not applied yet, in order, and returns their names. */
export async function migrate(client: pg.ClientBase, migrations: Migration[]): Promise<string[]> {
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    await client.query('create schema if not exists app');
    await client.query(`
      create table if not exists app.schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);
    await client.query('alter table app.schema_migrations enable row level security');

    const { rows } = await client.query<{ name: string; checksum: string }>(
      'select name, checksum from app.schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    const known = new Set(migrations.map((migration) => migration.name));
    for (const name of applied.keys()) {
      if (!known.has(name)) {
        throw new MigrationError(`${name} was applied but is missing from this checkout`);
      }
    }
    for (const migration of migrations) {
      const recorded = applied.get(migration.name);
      if (recorded !== undefined && recorded !== checksum(migration.sql)) {
        throw new MigrationError(
          `${migration.name} was edited after it was applied; add a new migration instead`,
        );
      }
    }

    const done: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query('insert into app.schema_migrations (name, checksum) values ($1, $2)', [
          migration.name,
          checksum(migration.sql),
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
      done.push(migration.name);
    }
    return done;
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
  }
}
