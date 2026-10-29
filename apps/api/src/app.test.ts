import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestAuth, signToken, type TestKeys } from '../test/helpers/auth.ts';
import { buildApp } from './app.ts';

// Unit tests: no database. The pool points at a closed port, so any query fails as if the
// database were down.
const db = new pg.Pool({ connectionString: 'postgres://nobody@127.0.0.1:1/none', connectionTimeoutMillis: 1000 });
db.on('error', () => {});
let app: ReturnType<typeof buildApp>;
let keys: TestKeys;

beforeAll(async () => {
  const test = await createTestAuth();
  keys = test.keys;
  app = buildApp({ db, auth: test.auth });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await db.end();
});

describe('authorization: GET /v1/health', () => {
  it('returns status ok without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('Error model', () => {
  it('gives every response a new request ID that a client cannot choose', async () => {
    const first = await app.inject({ method: 'GET', url: '/v1/health', headers: { 'request-id': 'mine' } });
    const second = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(first.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('answers an unknown route with 404 NOT_FOUND and the request ID', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nothing-here' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not available.',
        retryable: false,
        requestId: response.headers['x-request-id'],
        details: null,
      },
    });
  });

  it('allows no cross-origin access', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/me',
      headers: { origin: 'https://example.com', 'access-control-request-method': 'GET' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses a body over 100 KB with 413 PAYLOAD_TOO_LARGE', async () => {
    const token = await signToken(keys, 'user-a');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: JSON.stringify({ padding: 'x'.repeat(101 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('refuses a body that is not JSON with 400 VALIDATION_FAILED', async () => {
    const token = await signToken(keys, 'user-a');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      payload: '{"ageConfirmed": tru',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 503 SERVICE_UNAVAILABLE, retryable, when the database cannot be reached', async () => {
    const token = await signToken(keys, 'user-a');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
  });
});

describe('REQ-NFR-001 access rules', () => {
  it('REQ-NFR-001 refuses to register a route without an access rule', async () => {
    const test = await createTestAuth();
    const other = buildApp({ db, auth: test.auth });

    expect(() => other.get('/v1/undeclared', async () => ({}))).toThrow(/no access rule/);
    await other.close();
  });

  it('REQ-NFR-001 a token that fails a check gets 401 before any data is read', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Bearer not-a-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.json().error).toMatchObject({ code: 'AUTH_REQUIRED', details: null });
  });
});
