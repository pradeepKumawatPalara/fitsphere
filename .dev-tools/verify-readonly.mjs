// Read-only check before the Settings and Progress phone checks (D-31, D-32): the Supabase secret
// key as the API loads it, the database the API points at, and the migration records. It prints
// only yes/no answers, migration names and dates: never a value, a length, a host or a connection
// string. It writes nothing: every query runs in one READ ONLY transaction that is rolled back.
//
// Run it with the API's own settings loading (apps/api/package.json, "dev"), from apps/api:
//   node --env-file-if-exists=.env ../../.dev-tools/verify-readonly.mjs [fitsphere-dev project ID]
// The project ID is not secret: it is the part before .supabase.co in fitsphere-dev's project URL.
// Without it, the target is checked for consistency only, not against fitsphere-dev.
/* global console, process, URL */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { createSupabaseAuth } from '../apps/api/src/auth.ts';
import { checksum, readMigrations } from '../apps/api/src/db/migrate.ts';

const API_DIR = path.resolve(import.meta.dirname, '../apps/api');
/** The tables each migration under review creates. */
const NEW_TABLES = {
  '0006_dishes.sql': ['app.dishes'],
  '0007_workouts.sql': ['app.workouts'],
  '0008_settings.sql': ['app.settings', 'app.ai_consents'],
};
/** The private bucket the owner created on fitsphere-dev (runbook step 5, item 9). */
const PHOTO_BUCKET = 'meal-photos';
// Made from char codes so that no editor or tool turns them into invisible characters.
const BOM = String.fromCharCode(0xfeff);
const NUL = String.fromCharCode(0);

const expectedRef = process.argv[2]?.trim().toLowerCase() || null;
const yn = (value) => (value ? 'yes' : 'no');
const say = (label, value) => console.log(`  ${label}: ${value}`);
/** An error message with anything that could locate or open the database removed. */
const clean = (text) =>
  String(text ?? '')
    .replace(/postgres(ql)?:\/\/\S+/gi, '<connection string>')
    .replace(/sb_(secret|publishable)_\S+/gi, '<key>')
    .replace(/\S+\.supabase\.(com|co)\S*/gi, '<host>')
    .replace(/user "[^"]*"/g, 'user "<hidden>"')
    .replace(/postgres\.[a-z0-9]+/gi, 'postgres.<project>')
    .replace(/\S+@\S+/g, '<hidden>');

console.log('1. How it was run');
const fromApiDir = path.resolve(process.cwd()).toLowerCase() === API_DIR.toLowerCase();
say("From apps/api, so Node loaded the API's own .env", yn(fromApiDir));
if (!fromApiDir) {
  console.log('  Run it from apps/api, as shown at the top of this file.');
  process.exit(1);
}

console.log('2. The Supabase secret key, as the API loads it');
const secret = process.env.SUPABASE_SECRET_KEY ?? '';
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const secretForm = /^sb_secret_\S{10,}$/.test(secret);
say('SUPABASE_SECRET_KEY loaded', yn(secret !== ''));
say('It has the sb_secret_ form', yn(secretForm));
say('It differs from SUPABASE_PUBLISHABLE_KEY', yn(secret !== '' && secret !== publishable));
say('SUPABASE_PUBLISHABLE_KEY has the sb_publishable_ form', yn(/^sb_publishable_\S{10,}$/.test(publishable)));
if (process.env.SUPABASE_URL && publishable) {
  // The same call src/server.ts makes at startup; it makes no network request.
  const auth = createSupabaseAuth({
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: publishable,
    ...(secret ? { secretKey: secret } : {}),
  });
  say("The API's auth module can delete sign-in accounts", yn(auth.canDeleteUsers));
} else {
  say("The API's auth module can delete sign-in accounts", 'not checked: SUPABASE_URL or the publishable key is missing');
}
if (!secretForm) describeEnvFile();

console.log('3. The database the API uses');
let dbUrl = null;
let urlRef = null;
try {
  dbUrl = new URL(process.env.DATABASE_URL ?? '');
} catch {
  /* missing or not a URL: reported below */
}
try {
  urlRef = new URL(process.env.SUPABASE_URL ?? '').hostname.split('.')[0].toLowerCase();
} catch {
  /* missing or not a URL: the comparison below answers no */
}
if (!dbUrl) {
  say('DATABASE_URL loaded', 'no');
} else {
  const user = decodeURIComponent(dbUrl.username).toLowerCase();
  const dbRef = user.startsWith('postgres.') ? user.slice('postgres.'.length) : null;
  say('Supabase session pooler (*.pooler.supabase.com, port 5432)',
    yn(dbUrl.hostname.endsWith('.pooler.supabase.com') && (dbUrl.port || '5432') === '5432'));
  // Only the AWS region code, which names neither the project nor the host.
  const region = /^aws-\d+-([a-z]{2}-[a-z]+-\d)\.pooler\.supabase\.com$/.exec(dbUrl.hostname)?.[1] ?? null;
  say('Region in the pooler address', region
    ? `${region}${region === 'ap-south-1' ? ' (Mumbai)' : ' - NOT ap-south-1 (Mumbai)'}`
    : 'not recognised (expected aws-<n>-<region>.pooler.supabase.com)');
  say('Same project as SUPABASE_URL', yn(dbRef !== null && dbRef === urlRef));
  if (expectedRef) {
    say('DATABASE_URL is the project ID given (fitsphere-dev)', yn(dbRef === expectedRef));
    say('SUPABASE_URL is the project ID given (fitsphere-dev)', yn(urlRef === expectedRef));
  } else {
    say('Is it fitsphere-dev?', 'not checked: no project ID given');
  }
}

console.log('4. Migration records (read-only)');
if (dbUrl) await checkMigrations();
else say('Skipped', 'no DATABASE_URL');

async function checkMigrations() {
  const local = await readMigrations();
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
  });
  try {
    await client.connect();
    await client.query('begin transaction read only');
    const [{ read_only }] = (await client.query("select current_setting('transaction_read_only') as read_only")).rows;
    say('Transaction is read-only', read_only);
    if (read_only !== 'on') throw new Error('the transaction is not read-only, so nothing else was run');

    const [{ present }] = (await client.query("select to_regclass('app.schema_migrations') is not null as present")).rows;
    const applied = present
      ? (await client.query(
          `select name, checksum, to_char(applied_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as applied_ist
           from app.schema_migrations order by name`,
        )).rows
      : [];
    const recorded = new Map(applied.map((row) => [row.name, row]));
    for (const migration of local) {
      const row = recorded.get(migration.name);
      say(migration.name, row
        ? `applied ${row.applied_ist} IST; checksum ${row.checksum === checksum(migration.sql) ? 'matches' : 'DIFFERS (npm run migrate would refuse)'}`
        : 'PENDING');
    }
    for (const row of applied) {
      if (!local.some((migration) => migration.name === row.name)) {
        say(row.name, 'recorded but missing from this checkout (npm run migrate would refuse)');
      }
    }

    const tables = Object.values(NEW_TABLES).flat();
    const { rows: found } = await client.query(
      'select t as table_name, to_regclass(t) is not null as present from unnest($1::text[]) as t',
      [tables],
    );
    const exists = new Map(found.map((row) => [row.table_name, row.present]));
    say('Tables from 0006 to 0008', tables.map((table) => `${table} ${exists.get(table) ? 'present' : 'absent'}`).join(', '));
    for (const [name, names] of Object.entries(NEW_TABLES)) {
      if (!recorded.has(name) && names.some((table) => exists.get(table))) {
        say(name, 'NOT recorded, but its table exists (npm run migrate would stop on it)');
      }
    }

    // Last, because an error here ends the transaction: a sign that this is fitsphere-dev.
    try {
      const [{ bucket }] = (await client.query(
        'select exists (select 1 from storage.buckets where id = $1) as bucket',
        [PHOTO_BUCKET],
      )).rows;
      say(`Bucket "${PHOTO_BUCKET}" (made on fitsphere-dev)`, bucket ? 'present' : 'not seen');
    } catch (error) {
      say(`Bucket "${PHOTO_BUCKET}" (made on fitsphere-dev)`, `could not check (${error.code ?? 'error'})`);
    }
    await client.query('rollback');
    say('Wrote nothing', 'yes (the transaction was rolled back)');
  } catch (error) {
    say('Could not check', `${error.code ?? 'error'}: ${clean(error.message)}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Explains a missing or malformed key from the file Node actually loaded: counts and variable
 * names only, and never a name that looks like a key pasted in the wrong place.
 */
function describeEnvFile() {
  const arg = process.execArgv.map((value) => /^--env-file(?:-if-exists)?=(.+)$/.exec(value)).find(Boolean);
  const file = arg ? path.resolve(arg[1]) : null;
  if (!file || !existsSync(file)) {
    say('Env file Node loaded', 'none (run it with --env-file-if-exists=.env from apps/api)');
    return;
  }
  const raw = readFileSync(file);
  const decoded = raw.toString('utf8');
  const text = decoded.startsWith(BOM) ? decoded.slice(1) : decoded;
  const lines = text.split(/\r?\n/);
  const defining = lines.filter((line) => /^\s*(export\s+)?SUPABASE_SECRET_KEY\s*=/.test(line)).length;
  const commented = lines.filter((line) => /^\s*#.*SUPABASE_SECRET_KEY/.test(line)).length;
  const naming = lines.filter((line) => line.replaceAll(NUL, '').includes('SUPABASE_SECRET_KEY')).length;
  const printable = (name) => /^[A-Za-z_$][A-Za-z0-9_$:]{0,40}$/.test(name) && !/^sb_/i.test(name);
  const lookAlikes = Object.keys(parseEnv(text)).filter(
    (name) => name !== 'SUPABASE_SECRET_KEY' && name !== 'STORAGE_S3_SECRET_ACCESS_KEY' && /secret|service_?role|^sb_/i.test(name),
  );
  say('Lines defining SUPABASE_SECRET_KEY', defining + (defining > 1 ? ' (keep exactly one)' : ''));
  say('Commented-out lines naming it', commented);
  say('Malformed lines naming it (e.g. "$env:", "set ", ":" for "=")', Math.max(0, naming - defining - commented));
  say('Saved partly as UTF-16 (NUL bytes, unreadable to Node)', yn(raw.includes(0)));
  say('Look-alike names', lookAlikes.filter(printable).join(', ') || 'none');
  const hidden = lookAlikes.filter((name) => !printable(name)).length;
  if (hidden > 0) say('Lines whose name looks like a pasted key (not shown)', hidden);
}
