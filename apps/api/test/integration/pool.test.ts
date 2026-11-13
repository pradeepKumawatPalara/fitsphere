import { describe, expect, it } from 'vitest';
import { createPool } from '../../src/db/pool.ts';
import { connect, testDatabaseUrl } from './database.ts';

// The API's pool (src/db/pool.ts, D-101). A pooler that restarts, or a Supabase project that
// pauses, ends connections the API may be holding; that must fail one request, not stop the API.
// Without the pool's listener, the dropped connection's 'error' event is not caught and this test
// file fails with an unhandled error.

describe('createPool', () => {
  it('fails only the request whose connection drops while it is held, and keeps serving', async () => {
    const pool = createPool(testDatabaseUrl());
    const held = await pool.connect();
    const { rows } = await held.query<{ pid: number }>('select pg_backend_pid() as pid');

    // As if the pooler ended the connection in the middle of a sync's transaction.
    const admin = await connect();
    try {
      await admin.query('select pg_terminate_backend($1)', [rows[0]!.pid]);
    } finally {
      await admin.end();
    }

    await expect(held.query('select 1')).rejects.toThrow();
    held.release();

    // The next request gets a new connection.
    const next = await pool.query<{ n: number }>('select 1 as n');
    expect(next.rows).toEqual([{ n: 1 }]);
    await pool.end();
  });
});
