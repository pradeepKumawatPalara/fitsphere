// Supabase's shared pooler answers on one host in two modes: session (port 5432, the PC's
// DATABASE_URL) and transaction (port 6543, for Cloud Run; runbook step 5, item 8, and D-101).

const SHARED_POOLER_HOST = '.pooler.supabase.com';
const SESSION_PORT = '5432';
const TRANSACTION_PORT = '6543';

/**
 * The transaction pooler's connection string for a connection string on Supabase's shared pooler
 * (either mode); null for anything else. Only the port changes.
 */
export function transactionPoolerUrl(connectionString: string): string | null {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return null;
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null;
  if (!url.hostname.endsWith(SHARED_POOLER_HOST)) return null;
  if (url.port !== SESSION_PORT && url.port !== TRANSACTION_PORT) return null;
  url.port = TRANSACTION_PORT;
  return url.toString();
}
