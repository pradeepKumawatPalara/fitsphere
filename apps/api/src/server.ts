import { mealParserFromEnv } from './ai/mealParser.ts';
import { photoEstimatorFromEnv } from './ai/photoEstimator.ts';
import { photoParserFromEnv } from './ai/photoParser.ts';
import { productEstimatorFromEnv } from './ai/productEstimator.ts';
import { buildApp } from './app.ts';
import { createSupabaseAuth } from './auth.ts';
import { createPool } from './db/pool.ts';
import { createOpenFoodFacts } from './foods/openFoodFacts.ts';
import { listenAddress, type ListenAddress } from './listenAddress.ts';
import { mediaStorageFromEnv } from './storage/mediaStorage.ts';

// Settings from apps/api/.env on the PC, and from the service's variables and secrets on Cloud Run
// (runbook, "Configuration names"). Only the names are ever printed, never a value.
const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Missing settings: ${missing.join(', ')} (apps/api/.env on the PC; the service's variables on Cloud Run)`,
  );
  process.exit(1);
}

let address: ListenAddress;
try {
  address = listenAddress(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const db = createPool(process.env.DATABASE_URL!);

// Optional: barcode lookups and food-name lookups answer 503 or find nothing until the owner sets the contact (runbook).
const offClient = createOpenFoodFacts({ contact: process.env.OFF_CONTACT });

const app = buildApp({
  db,
  auth: createSupabaseAuth({
    supabaseUrl: process.env.SUPABASE_URL!,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY!,
    // Optional: Delete account answers 503 until the owner adds the secret key (D-31, runbook).
    ...(process.env.SUPABASE_SECRET_KEY ? { secretKey: process.env.SUPABASE_SECRET_KEY } : {}),
  }),
  log: { level: process.env.LOG_LEVEL ?? 'info' },
  barcodes: offClient,
  foodNames: offClient,
  // Optional: meal photo links answer 503 until the owner sets up storage (runbook).
  storage: mediaStorageFromEnv(process.env),
  // Optional: AI meal reading answers 503 until OPENAI_API_KEY is set (D-115, runbook). The key is
  // never printed or logged.
  mealParser: mealParserFromEnv(process.env),
  productEstimator: productEstimatorFromEnv(process.env),
  photoParser: photoParserFromEnv(process.env),
  photoEstimator: photoEstimatorFromEnv(process.env),
});

// Cloud Run stops an instance with SIGTERM, and SIGKILL 10 seconds later. In a container the API
// is process 1, which SIGTERM alone does not stop: finish the requests in progress, close the
// database connections, then exit.
process.once('SIGTERM', () => {
  void app
    .close()
    .then(() => db.end())
    .finally(() => process.exit(0));
});

// Loopback on the PC (HOST not set); every address in the Cloud Run image (listenAddress.ts).
await app.listen(address);
