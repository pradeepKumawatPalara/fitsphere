// The local or CI test database (test strategy, "Test levels"). Synthetic data only.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';

/** TEST_DATABASE_URL from the environment (CI) or from apps/api/.env (the PC). */
export function testDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  const envFile = new URL('../../.env', import.meta.url);
  if (!url && existsSync(envFile)) {
    // Only this one value is taken from the file.
    url = parseEnv(readFileSync(envFile, 'utf8')).TEST_DATABASE_URL;
  }
  if (!url) throw new Error('TEST_DATABASE_URL is not set: see apps/api/.env.example');
  if (!/^postgres(ql)?:\/\/[^/]+\/[^/?]+/.test(url)) {
    throw new Error(
      'TEST_DATABASE_URL must look like postgres://postgres:<password>@localhost:5432/fitsphere_test',
    );
  }
  // The tests drop and recreate schema app, so they never run against the Supabase project.
  if (/supabase\.(co|com)/i.test(url)) {
    throw new Error('TEST_DATABASE_URL must be a local or CI database, never Supabase');
  }
  return url;
}

export async function connect(url: string = testDatabaseUrl()): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/** A synthetic user row, for tests that need one without going through the API. */
export async function insertUser(client: pg.ClientBase): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into app.users (id, auth_subject, email, age_confirmed_at, age_confirmation_text_version)
     values ($1, $2, $3, now(), 'synthetic')`,
    [id, `test-${id}`, `user-${id}@example.test`],
  );
  return id;
}
