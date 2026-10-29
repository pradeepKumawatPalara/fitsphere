// npm run migrate -w @fitsphere/api: applies new migrations to MIGRATION_DATABASE_URL.
import pg from 'pg';
import { migrate, readMigrations } from '../src/db/migrate.ts';

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  console.error('MIGRATION_DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const applied = await migrate(client, await readMigrations());
  console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Nothing to apply.');
} finally {
  await client.end();
}
