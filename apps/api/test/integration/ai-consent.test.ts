import { AI_CONSENT_TEXT_VERSION } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// GET and PUT /v1/me/ai-consent (REQ-ACC-004, C-004, A-007; Q-065 MVP default), their
// authorization cases (REQ-NFR-001, D-20) and the log rule (invariant #7).

let clock = new Date('2026-10-30T03:30:00Z');
let api: Awaited<ReturnType<typeof startTestApi>>;
const lines: string[] = [];

beforeAll(async () => {
  api = await startTestApi({ now: () => clock, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
});

afterAll(async () => {
  await api.close();
});

function getConsent(token?: string) {
  return api.app.inject({
    method: 'GET',
    url: '/v1/me/ai-consent',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function putConsent(token: string | undefined, payload: unknown) {
  return api.app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object,
  });
}

const on = { consented: true, textVersion: AI_CONSENT_TEXT_VERSION };
const off = { consented: false, textVersion: AI_CONSENT_TEXT_VERSION };

async function storedConsents(userId: string) {
  const { rows } = await api.db.query(
    'select consented, text_version, recorded_at from app.ai_consents where user_id = $1 order by id',
    [userId],
  );
  return rows;
}

async function invalidTokens(subject: string) {
  const other = await createTestKeys();
  return [
    undefined,
    await signToken(api.keys, subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
    await signToken(other.keys, subject),
  ];
}

describe('authorization: GET /v1/me/ai-consent', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401', async () => {
    const user = await api.signUpWithAccount();
    for (const token of await invalidTokens(user.subject)) {
      const response = await getConsent(token);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();
    const response = await getConsent(user.token);
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-NFR-001 returns only the caller’s own record, never another user’s', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    await putConsent(userA.token, on);

    expect((await getConsent(userB.token)).json()).toEqual({ aiConsent: null });
    expect((await getConsent(userA.token)).json().aiConsent.consented).toBe(true);
  });
});

describe('authorization: PUT /v1/me/ai-consent', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401 and records nothing', async () => {
    const user = await api.signUpWithAccount();
    for (const token of await invalidTokens(user.subject)) {
      expect((await putConsent(token, on)).statusCode).toBe(401);
    }
    expect(await storedConsents(user.id)).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();
    const response = await putConsent(user.token, on);
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-NFR-001 a user’s change never reaches another user’s record, even with a user ID in the body', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    await putConsent(userA.token, on);

    const named = await putConsent(userB.token, { ...off, userId: userA.id });
    await putConsent(userB.token, off);

    expect(named.statusCode).toBe(400);
    expect((await storedConsents(userA.id)).map((row) => row.consented)).toEqual([true]);
    expect((await storedConsents(userB.id)).map((row) => row.consented)).toEqual([false]);
  });
});

describe('REQ-ACC-004 the AI meal-reading consent record', () => {
  it('A-007 a new user has no record, so AI is off', async () => {
    const user = await api.signUpWithAccount();
    const response = await getConsent(user.token);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ aiConsent: null });
  });

  it('Q-065 each change is kept with the server’s time and the text version, and the latest is returned', async () => {
    const user = await api.signUpWithAccount();
    clock = new Date('2026-10-30T04:00:00Z');
    const first = await putConsent(user.token, on);
    clock = new Date('2026-10-30T05:00:00Z');
    const second = await putConsent(user.token, off);

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({
      aiConsent: { consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: '2026-10-30T04:00:00.000Z' },
    });
    expect(second.json().aiConsent).toEqual({
      consented: false,
      textVersion: AI_CONSENT_TEXT_VERSION,
      recordedAt: '2026-10-30T05:00:00.000Z',
    });
    expect((await getConsent(user.token)).json()).toEqual(second.json());
    expect(await storedConsents(user.id)).toEqual([
      { consented: true, text_version: AI_CONSENT_TEXT_VERSION, recorded_at: new Date('2026-10-30T04:00:00Z') },
      { consented: false, text_version: AI_CONSENT_TEXT_VERSION, recorded_at: new Date('2026-10-30T05:00:00Z') },
    ]);
  });

  it('Q-065 two changes at the same time: the one received last is the current choice', async () => {
    const user = await api.signUpWithAccount();
    await putConsent(user.token, on);
    await putConsent(user.token, off);
    expect((await getConsent(user.token)).json().aiConsent.consented).toBe(false);
  });

  it('REQ-ACC-004 a version other than the text shown, a missing field or an unknown field is refused and records nothing', async () => {
    const user = await api.signUpWithAccount();
    const bodies = [
      { consented: true, textVersion: '2020-01-01' },
      { consented: true },
      { consented: 'yes', textVersion: AI_CONSENT_TEXT_VERSION },
      { ...on, provider: 'other' },
      null,
    ];
    for (const body of bodies) {
      const response = await putConsent(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(await storedConsents(user.id)).toEqual([]);
  });

  it('invariant #7 the log holds the route but not the choice or the text version', async () => {
    const user = await api.signUpWithAccount();
    lines.length = 0;
    await putConsent(user.token, on);
    await getConsent(user.token);

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.method, entry.route])).toEqual([
      ['PUT', '/v1/me/ai-consent'],
      ['GET', '/v1/me/ai-consent'],
    ]);
    const log = lines.join('');
    expect(log).not.toContain('consented');
    expect(log).not.toContain(AI_CONSENT_TEXT_VERSION);
    expect(log).not.toContain(user.email);
  });
});
