// Tokens signed by a key made for each test run; the API under test trusts only that key, and no
// test calls Supabase (test strategy, "Test levels").
import { createLocalJWKSet, decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { createSupabaseAuth, type Auth } from '../../src/auth.ts';

export const TEST_SUPABASE_URL = 'https://project-ref.supabase.test';
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

export type TestKeys = { privateKey: CryptoKey; kid: string };

export async function createTestKeys(kid = 'test-key') {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256' };
  return { keys: { privateKey, kid }, keySet: createLocalJWKSet({ keys: [jwk] }) };
}

type TokenOptions = {
  issuer?: string;
  audience?: string;
  /** Seconds since the epoch. */
  expiresAt?: number;
  claims?: Record<string, unknown>;
};

export function signToken(keys: TestKeys, subject: string, options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'authenticated', is_anonymous: false, ...options.claims })
    .setProtectedHeader({ alg: 'ES256', kid: keys.kid })
    .setSubject(subject)
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 3600)
    .sign(keys.privateKey);
}

export const TEST_SECRET_KEY = 'sb_secret_test-only-7e2d';

/**
 * Supabase Auth's `GET /auth/v1/user` and the admin `DELETE /auth/v1/admin/users/{id}`, answered
 * from a map of made-up users. Admin calls are recorded; `adminFailure` makes the next ones fail.
 */
export function fakeSupabaseUsers() {
  const users = new Map<string, { email: string; confirmed: boolean }>();
  const adminCalls: { method: string; url: string; headers: Headers; body: string }[] = [];
  const state: { adminFailure: number | null } = { adminFailure: null };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const admin = /\/auth\/v1\/admin\/users\/([^/]+)$/.exec(url);
    if (admin) {
      const headers = new Headers(init?.headers);
      adminCalls.push({ method: init?.method ?? 'GET', url, headers, body: String(init?.body ?? '') });
      if (headers.get('apikey') !== TEST_SECRET_KEY || headers.has('authorization')) {
        return Response.json({ message: 'Invalid API key' }, { status: 401 });
      }
      if (state.adminFailure !== null) return Response.json({ msg: 'failed' }, { status: state.adminFailure });
      const subject = decodeURIComponent(admin[1] ?? '');
      if (init?.method !== 'DELETE' || !users.has(subject)) return Response.json({ msg: 'User not found' }, { status: 404 });
      users.delete(subject);
      return Response.json({ id: subject });
    }
    const header = new Headers(init?.headers).get('authorization') ?? '';
    const subject = decodeJwt(header.replace(/^Bearer /, '')).sub ?? '';
    const user = users.get(subject);
    if (!user) return Response.json({ msg: 'invalid token' }, { status: 401 });
    return Response.json({
      id: subject,
      email: user.email,
      email_confirmed_at: user.confirmed ? '2026-10-28T03:00:00Z' : null,
    });
  };
  return { users, adminCalls, state, fetch: fetchImpl };
}

/** The API's auth module on a local key and the fake Supabase. It has the test secret key unless
 * `secretKey` is null, as a server without one would be. */
export async function createTestAuth(options: { secretKey?: string | null } = {}): Promise<{
  auth: Auth;
  keys: TestKeys;
  supabase: ReturnType<typeof fakeSupabaseUsers>;
}> {
  const { keys, keySet } = await createTestKeys();
  const supabase = fakeSupabaseUsers();
  const auth = createSupabaseAuth({
    supabaseUrl: TEST_SUPABASE_URL,
    publishableKey: 'sb_publishable_test',
    ...(options.secretKey === null ? {} : { secretKey: options.secretKey ?? TEST_SECRET_KEY }),
    keySet,
    fetch: supabase.fetch,
  });
  return { auth, keys, supabase };
}
