// npm run check:pooler -w @fitsphere/api: before the API moves to Cloud Run (D-101), checks that
// the kinds of query the API sends work through Supabase's transaction pooler (port 6543), which
// suits Cloud Run but does not keep prepared statements (runbook step 5, item 8). It takes
// DATABASE_URL from apps/api/.env (the session pooler, port 5432) and changes only the port.
// Read only: it changes nothing, and prints no value from the database or the settings.
import { createPool } from '../src/db/pool.ts';
import { transactionPoolerUrl } from '../src/db/transactionPooler.ts';

const url = process.env.DATABASE_URL ? transactionPoolerUrl(process.env.DATABASE_URL) : null;
if (!url) {
  console.error(
    "DATABASE_URL in apps/api/.env must be Supabase's session or transaction pooler (…pooler.supabase.com, port 5432 or 6543).",
  );
  process.exit(1);
}

// The API's own pool (src/db/pool.ts): 5 connections at most.
const pool = createPool(url);

const NO_USER = '00000000-0000-4000-8000-000000000000';
const checks: [label: string, run: () => Promise<unknown>][] = [
  ['A query with values, twice with the same text', async () => {
    for (const n of [1, 2]) await pool.query('select $1::int + 1 as n', [n]);
  }],
  ['10 queries at once on 5 connections', () =>
    Promise.all(
      Array.from({ length: 10 }, (_, kcal) =>
        pool.query('select count(*)::int as n from app.foods where source = $1 and kcal > $2', ['ifct2017', kcal]),
      ),
    )],
  ['Lists and JSON as values', async () => {
    await pool.query('select count(*)::int as n from app.foods where source = any($1::text[])', [['ifct2017', 'indb']]);
    await pool.query('select $1::jsonb ->> $2 as v', [JSON.stringify({ kind: 'weight' }), 'kind']);
  }],
  ['Different value types on one connection', async () => {
    const client = await pool.connect();
    try {
      await client.query('select $1::text as v', ['text']);
      await client.query('select $1::int as v', [1]);
      await client.query('select $1::date as v', ['2026-11-13']);
      await client.query('select $1::uuid as v', [NO_USER]);
    } finally {
      client.release();
    }
  }],
  ['A transaction with values, as sync and account set-up use (read only, rolled back)', async () => {
    const client = await pool.connect();
    try {
      await client.query('begin read only');
      await client.query('select id from app.users where id = $1', [NO_USER]);
      await client.query('select count(*)::int as n from app.exercises where name ilike $1', ['%press%']);
      await client.query('rollback');
    } finally {
      client.release();
    }
  }],
];

let failed = 0;
for (const [label, run] of checks) {
  try {
    await run();
    console.log(`ok    ${label}`);
  } catch (error) {
    failed += 1;
    // The code and message only: PostgreSQL's messages hold no password or row values.
    const { code, message } = error as { code?: string; message?: string };
    console.log(`FAIL  ${label}: ${code ?? ''} ${(message ?? '').slice(0, 120)}`);
  }
}
await pool.end();

console.log(
  failed > 0
    ? `FAIL: ${failed} of ${checks.length} checks failed. Give Cloud Run the session pooler (port 5432) as database-url.`
    : 'PASS: the transaction pooler (port 6543) runs the API\'s kinds of query. Give Cloud Run its address as database-url.',
);
process.exit(failed > 0 ? 1 : 0);
