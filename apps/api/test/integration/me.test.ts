import { AGE_CONFIRMATION_TEXT_VERSION } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// Test strategy, "Account and sign-in" and the 401 cases (REQ-ACC-010, REQ-ROLE-001, D-18).

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

const setup = { ageConfirmed: true, ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION };

function postMe(token: string, payload: unknown) {
  return api.app.inject({
    method: 'POST',
    url: '/v1/me',
    headers: { authorization: `Bearer ${token}` },
    payload: payload as object,
  });
}

function getMe(token?: string) {
  return api.app.inject({
    method: 'GET',
    url: '/v1/me',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function userRows(subject: string) {
  const { rows } = await api.db.query(
    `select u.email, u.age_confirmed_at, u.age_confirmation_text_version, array_agg(r.role) as roles
     from app.users u left join app.user_roles r on r.user_id = u.id
     where u.auth_subject = $1 group by u.id`,
    [subject],
  );
  return rows;
}

describe('authorization: GET /v1/me', () => {
  it('REQ-NFR-001 no token, an expired token, another key, another audience or an anonymous session get 401', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
      await signToken(api.keys, user.subject, { audience: 'anon' }),
      await signToken(api.keys, user.subject, { claims: { is_anonymous: true } }),
    ];

    for (const token of tokens) {
      const response = await getMe(token);
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toMatchObject({ code: 'AUTH_REQUIRED', details: null });
      expect(response.json().error.requestId).toBe(response.headers['x-request-id']);
    }
  });

  it('REQ-ACC-010 signed in without an account set up gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await getMe(user.token);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-ROLE-001 returns the caller’s own account and roles, and only theirs', async () => {
    const userA = await api.signUpWithAccount();
    await api.signUpWithAccount();

    const response = await getMe(userA.token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: userA.id, email: userA.email, createdAt: expect.stringMatching(/Z$/) },
      roles: ['personal'],
    });
  });
});

describe('authorization: POST /v1/me', () => {
  it('REQ-NFR-001 no token or an invalid token gets 401 and creates nothing', async () => {
    const user = await api.signUp();
    const response = await api.app.inject({ method: 'POST', url: '/v1/me', payload: setup });
    expect(response.statusCode).toBe(401);

    const expired = await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 });
    expect((await postMe(expired, setup)).statusCode).toBe(401);
    expect(await userRows(user.subject)).toEqual([]);
  });

  it('REQ-ACC-010 sets up the account with the 18+ confirmation, its text version and the Personal Training User role', async () => {
    const user = await api.signUp();

    const response = await postMe(user.token, setup);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ user: { email: user.email }, roles: ['personal'] });
    const rows = await userRows(user.subject);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: user.email,
      age_confirmation_text_version: AGE_CONFIRMATION_TEXT_VERSION,
      roles: ['personal'],
    });
    expect(rows[0].age_confirmed_at).toBeInstanceOf(Date);
  });

  it('REQ-ACC-010 without ageConfirmed: true returns AGE_CONFIRMATION_REQUIRED and creates nothing', async () => {
    const user = await api.signUp();

    for (const payload of [
      { ageConfirmed: false, ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION },
      { ageConfirmationTextVersion: AGE_CONFIRMATION_TEXT_VERSION },
      {},
    ]) {
      const response = await postMe(user.token, payload);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('AGE_CONFIRMATION_REQUIRED');
    }
    expect(await userRows(user.subject)).toEqual([]);
  });

  it('REQ-ACC-010 an email in the body is refused as unknown; the stored email comes from Supabase', async () => {
    const user = await api.signUp();

    const refused = await postMe(user.token, { ...setup, email: 'someone-else@example.test' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'email', issue: 'unknown_field' }],
    });
    expect(refused.body).not.toContain('someone-else');
    expect(await userRows(user.subject)).toEqual([]);

    await postMe(user.token, setup);
    expect((await userRows(user.subject))[0].email).toBe(user.email);
  });

  it('Q-080 an unverified email gets 403 EMAIL_NOT_VERIFIED and creates nothing', async () => {
    const user = await api.signUp(false);

    const response = await postMe(user.token, setup);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(await userRows(user.subject)).toEqual([]);
  });

  it('REQ-ACC-010 a second setup call returns 200 and changes nothing', async () => {
    const user = await api.signUp();
    await postMe(user.token, setup);
    const before = await userRows(user.subject);

    const again = await postMe(user.token, { ...setup, ageConfirmationTextVersion: 'another-version' });

    expect(again.statusCode).toBe(200);
    expect(await userRows(user.subject)).toEqual(before);
  });

  it('REQ-ACC-010 two setup calls at once create one account', async () => {
    const user = await api.signUp();

    const responses = await Promise.all([postMe(user.token, setup), postMe(user.token, setup)]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(await userRows(user.subject)).toHaveLength(1);
  });
});
