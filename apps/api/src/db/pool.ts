// The API's connection pool (ADR-0002): Supabase's session pooler on the PC (port 5432), its
// transaction pooler on Cloud Run (port 6543, D-101).
import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
  // An idle connection that drops (e.g. the Supabase project pauses) must not stop the API.
  pool.on('error', () => {});
  // Nor one that drops while a request holds it for a transaction (sync, account set-up and
  // deletion): pg reports that as an 'error' event on the connection, and with no listener the
  // process stops. Instead that request's query fails, and the pool lets the connection go.
  pool.on('connect', (client) => {
    client.on('error', () => {});
  });
  return pool;
}
