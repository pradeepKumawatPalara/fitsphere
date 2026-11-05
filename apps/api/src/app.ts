import { randomUUID } from 'node:crypto';
import { API_BASE_PATH, SYNC_PAGE_SIZE } from '@fitsphere/shared';
import Fastify, { LogController } from 'fastify';
import type pg from 'pg';
import { registerAccess } from './access.ts';
import type { Auth } from './auth.ts';
import { errorBody, handleError } from './errors.ts';
import { createOpenFoodFacts, type BarcodeSource } from './foods/openFoodFacts.ts';
import { registerAiConsentRoutes } from './routes/aiConsent.ts';
import { registerBarcodesRoute } from './routes/barcodes.ts';
import { registerExercisesRoute } from './routes/exercises.ts';
import { registerFoodsRoute } from './routes/foods.ts';
import { registerMediaRoutes } from './routes/media.ts';
import { registerMeRoutes } from './routes/me.ts';
import { registerSyncRoute } from './routes/sync.ts';
import { registerWeighInsRoute } from './routes/weighIns.ts';
import { registerWorkoutsRoute } from './routes/workouts.ts';
import type { MediaStorage } from './storage/mediaStorage.ts';

export type LogOptions = { level: string; stream?: { write(line: string): void } };

export type AppDeps = {
  db: pg.Pool;
  auth: Auth;
  /** Leave out for no logs (most tests). */
  log?: LogOptions;
  /** The clock for "today in IST"; tests set it. */
  now?: () => Date;
  /** Weigh-ins per sync response (api-conventions: 500); tests use a small page. */
  syncPageSize?: number;
  /** Open Food Facts (ADR-0006 rule 2); tests pass a fake. Without one, barcode lookups answer 503. */
  barcodes?: BarcodeSource;
  /** File storage for meal photos (ADR-0002 rule 4); tests pass a fake. Without it, photo links answer 503. */
  storage?: MediaStorage | null;
};

// Never logged (api-conventions, "Logging"; invariant #7): bodies, headers including
// Authorization, tokens, email addresses and query values. The API writes only its own fields,
// and these paths are removed as a second guard.
const REDACTED = ['req', 'res', 'headers', 'body', 'query', 'params', 'email', 'token', 'authorization'];

export function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: deps.log
      ? {
          level: deps.log.level,
          ...(deps.log.stream ? { stream: deps.log.stream } : {}),
          redact: { paths: [...REDACTED, ...REDACTED.map((path) => `*.${path}`)], remove: true },
        }
      : false,
    // Fastify's default request log includes the full URL with query values, which the log rule
    // forbids. The API writes its own request line below.
    logController: new LogController({ disableRequestLogging: true, requestIdLogLabel: 'requestId' }),
    bodyLimit: 100 * 1024,
    // Every request gets a new UUID; a client cannot choose it.
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    exposeHeadRoutes: false,
  });

  registerAccess(app, deps);
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(errorBody('NOT_FOUND', request.id)),
  );
  app.addHook('onSend', async (request, reply) => {
    void reply.header('X-Request-Id', request.id);
  });
  // One line per request: the route pattern, never the filled-in path or query.
  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: request.is404 ? null : request.routeOptions.url,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        userId: request.account?.id ?? null,
      },
      'request',
    );
  });

  app.get(`${API_BASE_PATH}/health`, { config: { access: 'public' } }, async () => ({
    status: 'ok',
  }));
  registerMeRoutes(app, deps);
  registerAiConsentRoutes(app, { db: deps.db, now: deps.now ?? (() => new Date()) });
  registerSyncRoute(app, {
    db: deps.db,
    now: deps.now ?? (() => new Date()),
    syncPageSize: deps.syncPageSize ?? SYNC_PAGE_SIZE,
    storage: deps.storage ?? null,
  });
  registerWorkoutsRoute(app, deps);
  registerWeighInsRoute(app, deps);
  registerFoodsRoute(app, deps);
  registerExercisesRoute(app, deps);
  registerBarcodesRoute(app, {
    db: deps.db,
    barcodes: deps.barcodes ?? createOpenFoodFacts({ contact: undefined }),
    now: deps.now ?? (() => new Date()),
  });
  registerMediaRoutes(app, { db: deps.db, storage: deps.storage ?? null, now: deps.now ?? (() => new Date()) });

  return app;
}
