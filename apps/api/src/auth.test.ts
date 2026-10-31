import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createTestAuth, createTestKeys, signToken, TEST_SUPABASE_URL } from '../test/helpers/auth.ts';
import { createSupabaseAuth } from './auth.ts';
import { ApiError } from './errors.ts';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'accepted';
  } catch (error) {
    return error instanceof ApiError ? error.code : 'other error';
  }
}

describe('ADR-0004 rule 3: token checks', () => {
  it('ADR-0004 accepts a valid token and returns its subject', async () => {
    const { auth, keys } = await createTestAuth();
    const token = await signToken(keys, 'subject-1');

    await expect(auth.verify(token)).resolves.toEqual({ subject: 'subject-1', token });
  });

  it('ADR-0004 refuses an expired token', async () => {
    const { auth, keys } = await createTestAuth();
    const token = await signToken(keys, 'subject-1', { expiresAt: Math.floor(Date.now() / 1000) - 60 });

    expect(await codeOf(auth.verify(token))).toBe('AUTH_REQUIRED');
  });

  it('ADR-0004 refuses a token signed by another key', async () => {
    const { auth } = await createTestAuth();
    const other = await createTestKeys('test-key');
    const token = await signToken(other.keys, 'subject-1');

    expect(await codeOf(auth.verify(token))).toBe('AUTH_REQUIRED');
  });

  it('ADR-0004 refuses the wrong audience, the wrong issuer and a role other than authenticated', async () => {
    const { auth, keys } = await createTestAuth();

    expect(await codeOf(auth.verify(await signToken(keys, 's', { audience: 'anon' })))).toBe('AUTH_REQUIRED');
    expect(
      await codeOf(auth.verify(await signToken(keys, 's', { issuer: 'https://other.supabase.test/auth/v1' }))),
    ).toBe('AUTH_REQUIRED');
    expect(await codeOf(auth.verify(await signToken(keys, 's', { claims: { role: 'anon' } })))).toBe(
      'AUTH_REQUIRED',
    );
  });

  it('ADR-0004 refuses an anonymous session', async () => {
    const { auth, keys } = await createTestAuth();
    const token = await signToken(keys, 'subject-1', { claims: { is_anonymous: true } });

    expect(await codeOf(auth.verify(token))).toBe('AUTH_REQUIRED');
  });

  it('ADR-0004 refuses a token signed with a shared secret (legacy HS256)', async () => {
    const { auth } = await createTestAuth();
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
      .setSubject('subject-1')
      .setAudience('authenticated')
      .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-shared-secret-of-at-least-32-bytes!'));

    expect(await codeOf(auth.verify(token))).toBe('AUTH_REQUIRED');
  });

  it('ADR-0004 answers 503 when the signing keys cannot be fetched', async () => {
    const auth = createSupabaseAuth({
      supabaseUrl: TEST_SUPABASE_URL,
      publishableKey: 'sb_publishable_test',
      keySet: async () => {
        throw new TypeError('fetch failed');
      },
    });
    const { keys } = await createTestKeys();

    expect(await codeOf(auth.verify(await signToken(keys, 'subject-1')))).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('REQ-ACC-010 reading the signed-in user', () => {
  it('REQ-ACC-010 reads the confirmed email, in lower case, with the caller’s token', async () => {
    const { auth, keys, supabase } = await createTestAuth();
    supabase.users.set('subject-1', { email: 'Someone@Example.test', confirmed: true });
    const token = await signToken(keys, 'subject-1');

    await expect(auth.readSignedInUser({ subject: 'subject-1', token })).resolves.toEqual({
      subject: 'subject-1',
      email: 'someone@example.test',
      emailConfirmed: true,
    });
  });

  it('REQ-ACC-010 reports an unconfirmed email', async () => {
    const { auth, keys, supabase } = await createTestAuth();
    supabase.users.set('subject-1', { email: 'someone@example.test', confirmed: false });
    const token = await signToken(keys, 'subject-1');

    await expect(auth.readSignedInUser({ subject: 'subject-1', token })).resolves.toMatchObject({
      emailConfirmed: false,
    });
  });

  it('REQ-ACC-010 a session Supabase no longer accepts gets 401, and Supabase being down 503', async () => {
    const { auth, keys } = await createTestAuth();
    const token = await signToken(keys, 'unknown-subject');
    expect(await codeOf(auth.readSignedInUser({ subject: 'unknown-subject', token }))).toBe('AUTH_REQUIRED');

    const down = createSupabaseAuth({
      supabaseUrl: TEST_SUPABASE_URL,
      publishableKey: 'sb_publishable_test',
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(await codeOf(down.readSignedInUser({ subject: 's', token }))).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('REQ-ACC-009 deleting a sign-in account (D-31 answer 4)', () => {
  it('D-31 answer 4 without the secret key nothing can be deleted, and Supabase is not called', async () => {
    let called = false;
    const auth = createSupabaseAuth({
      supabaseUrl: TEST_SUPABASE_URL,
      publishableKey: 'sb_publishable_test',
      fetch: async () => {
        called = true;
        return Response.json({});
      },
    });

    expect(auth.canDeleteUsers).toBe(false);
    expect(await codeOf(auth.deleteUser('subject-1'))).toBe('SERVICE_UNAVAILABLE');
    expect(called).toBe(false);
  });

  it('REQ-ACC-009 deletes the user, and a user already gone counts as deleted', async () => {
    const { auth, supabase } = await createTestAuth();
    supabase.users.set('subject-1', { email: 'someone@example.test', confirmed: true });

    expect(auth.canDeleteUsers).toBe(true);
    expect(await codeOf(auth.deleteUser('subject-1'))).toBe('accepted');
    expect(supabase.users.has('subject-1')).toBe(false);
    expect(await codeOf(auth.deleteUser('subject-1'))).toBe('accepted');
  });

  it('REQ-ACC-009 Supabase refusing, failing or not answering gives 503', async () => {
    const { auth, supabase } = await createTestAuth({ secretKey: 'sb_secret_wrong' });
    supabase.users.set('subject-1', { email: 'someone@example.test', confirmed: true });
    expect(await codeOf(auth.deleteUser('subject-1'))).toBe('SERVICE_UNAVAILABLE');

    const failing = await createTestAuth();
    failing.supabase.users.set('subject-1', { email: 'someone@example.test', confirmed: true });
    failing.supabase.state.adminFailure = 500;
    expect(await codeOf(failing.auth.deleteUser('subject-1'))).toBe('SERVICE_UNAVAILABLE');

    const down = createSupabaseAuth({
      supabaseUrl: TEST_SUPABASE_URL,
      publishableKey: 'sb_publishable_test',
      secretKey: 'sb_secret_test',
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(await codeOf(down.deleteUser('subject-1'))).toBe('SERVICE_UNAVAILABLE');
  });
});
