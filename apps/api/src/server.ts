import pg from 'pg';
import { buildApp } from './app.ts';
import { createSupabaseAuth } from './auth.ts';
import { createOpenFoodFacts } from './foods/openFoodFacts.ts';
import { mediaStorageFromEnv } from './storage/mediaStorage.ts';

// Settings from apps/api/.env (runbook, "Configuration names").
const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing in apps/api/.env: ${missing.join(', ')}`);
  process.exit(1);
}

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
});
// An idle connection that drops (e.g. the Supabase project pauses) must not stop the API.
db.on('error', () => {});

const app = buildApp({
  db,
  auth: createSupabaseAuth({
    supabaseUrl: process.env.SUPABASE_URL!,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY!,
    // Optional: Delete account answers 503 until the owner adds the secret key (D-31, runbook).
    ...(process.env.SUPABASE_SECRET_KEY ? { secretKey: process.env.SUPABASE_SECRET_KEY } : {}),
  }),
  log: { level: process.env.LOG_LEVEL ?? 'info' },
  // Optional: barcode lookups answer 503 until the owner sets the contact (runbook).
  barcodes: createOpenFoodFacts({ contact: process.env.OFF_CONTACT }),
  // Optional: meal photo links answer 503 until the owner sets up storage (runbook).
  storage: mediaStorageFromEnv(process.env),
});

const port = Number(process.env.PORT ?? '3000');
// Loopback only: the phone reaches it through the development tunnel (runbook step 8), and it
// stays off the local network.
await app.listen({ host: '127.0.0.1', port });
