// npm run db:growth -w @fitsphere/api: measures growth per 10,000 synthetic weigh-ins on
// MIGRATION_DATABASE_URL, then rolls them back (R-005). Run it once, on an empty weigh_ins table.
import pg from 'pg';
import { measureWeighInGrowth } from '../src/db/growth.ts';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error('MIGRATION_DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const result = await measureWeighInGrowth(client);
  const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
  console.log(`PostgreSQL ${result.serverVersion}`);
  console.log(`Synthetic weigh-ins: ${result.weighIns} (rolled back, none kept)`);
  console.log(`weigh_ins table and indexes grew by ${kb(result.weighInsTableBytes)}`);
  console.log(`Database grew by ${kb(result.databaseBytes)}`);
} finally {
  await client.end();
}
