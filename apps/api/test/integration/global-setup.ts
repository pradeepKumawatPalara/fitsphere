// Runs once before the integration tests: a fresh schema app with every migration applied.
import { migrate, readMigrations } from '../../src/db/migrate.ts';
import { connect } from './database.ts';

export default async function setup() {
  const client = await connect();
  try {
    await client.query('drop schema if exists app cascade');
    await migrate(client, await readMigrations());
  } finally {
    await client.end();
  }
}
