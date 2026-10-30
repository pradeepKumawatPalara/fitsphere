import { readFileSync } from 'node:fs';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { createTestAuth } from '../test/helpers/auth.ts';
import { buildApp } from './app.ts';

// The route-listing test (api-conventions "Authorization", test strategy): every registered route
// has an access rule and an authorization test. A new route fails this test until it is added
// here with a `describe('authorization: <METHOD> <path>')` block in the named file.
const AUTHORIZATION_TESTS: Record<string, string> = {
  'GET /v1/health': 'src/app.test.ts',
  'GET /v1/me': 'test/integration/me.test.ts',
  'POST /v1/me': 'test/integration/me.test.ts',
  'GET /v1/me/ai-consent': 'test/integration/ai-consent.test.ts',
  'PUT /v1/me/ai-consent': 'test/integration/ai-consent.test.ts',
  'POST /v1/sync': 'test/integration/sync.test.ts',
  'GET /v1/users/:userId/workouts': 'test/integration/workouts.test.ts',
  'GET /v1/users/:userId/weigh-ins': 'test/integration/weigh-ins.test.ts',
  'GET /v1/foods': 'test/integration/foods.test.ts',
  'GET /v1/barcodes/:barcode': 'test/integration/barcodes.test.ts',
  'POST /v1/users/:userId/media/:mediaId/upload': 'test/integration/media.test.ts',
  'GET /v1/users/:userId/media/:mediaId': 'test/integration/media.test.ts',
};

describe('REQ-NFR-001 route listing', () => {
  it('REQ-NFR-001 every route has an access rule and an authorization test', async () => {
    const { auth } = await createTestAuth();
    const db = new pg.Pool();
    const app = buildApp({ db, auth });
    await app.ready();

    const routes = app.registeredRoutes.map((route) => `${route.method} ${route.url}`);
    expect(routes.sort()).toEqual(Object.keys(AUTHORIZATION_TESTS).sort());
    for (const route of app.registeredRoutes) {
      expect(['public', 'signedIn', 'account']).toContain(route.access);
    }
    for (const [route, file] of Object.entries(AUTHORIZATION_TESTS)) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source, `${file} has no authorization tests for ${route}`).toContain(
        `describe('authorization: ${route}'`,
      );
    }

    await app.close();
    await db.end();
  });

  it('REQ-NFR-001 only the health check is public', async () => {
    const { auth } = await createTestAuth();
    const db = new pg.Pool();
    const app = buildApp({ db, auth });
    await app.ready();

    const publicRoutes = app.registeredRoutes.filter((route) => route.access === 'public');
    expect(publicRoutes.map((route) => `${route.method} ${route.url}`)).toEqual(['GET /v1/health']);

    await app.close();
    await db.end();
  });
});
