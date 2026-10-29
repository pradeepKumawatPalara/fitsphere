// Database growth per 10,000 synthetic weigh-ins (test strategy, "Database"; R-005). Everything is
// written inside one transaction that is rolled back, so no synthetic row is kept.
import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export type GrowthResult = {
  serverVersion: string;
  weighIns: number;
  weighInsTableBytes: number;
  databaseBytes: number;
};

const USERS = 100;
const DAYS_PER_USER = 100;

export async function measureWeighInGrowth(client: pg.ClientBase): Promise<GrowthResult> {
  const sizes = async () => {
    const { rows } = await client.query<{ table_bytes: string; database_bytes: string }>(
      `select pg_total_relation_size('app.weigh_ins') as table_bytes,
              pg_database_size(current_database()) as database_bytes`,
    );
    const row = rows[0]!;
    return { table: Number(row.table_bytes), database: Number(row.database_bytes) };
  };

  const { rows: version } = await client.query<{ server_version: string }>('show server_version');
  await client.query('begin');
  try {
    const before = await sizes();
    const run = randomUUID();
    await client.query(
      `with new_users as (
         insert into app.users (auth_subject, email, age_confirmed_at, age_confirmation_text_version)
         select 'synthetic-growth-' || $1 || '-' || n, 'growth-' || $1 || '-' || n || '@example.test',
                now(), 'synthetic'
         from generate_series(1, $2::int) as n
         returning id
       )
       insert into app.weigh_ins (user_id, day, weight_grams, recorded_at)
       select u.id, date '2026-01-01' + d, 50000 + floor(random() * 50000)::int, now()
       from new_users u cross join generate_series(0, $3::int - 1) as d`,
      [run, USERS, DAYS_PER_USER],
    );
    const after = await sizes();
    return {
      serverVersion: version[0]!.server_version,
      weighIns: USERS * DAYS_PER_USER,
      weighInsTableBytes: after.table - before.table,
      databaseBytes: after.database - before.database,
    };
  } finally {
    await client.query('rollback');
  }
}
