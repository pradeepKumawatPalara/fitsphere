import { AI_CONSENT_OLDER_TEXT_VERSIONS, AI_CONSENT_TEXT_VERSION, type PhotoEstimateResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PhotoEstimatorFailed, type PhotoEstimator } from '../../src/ai/photoEstimator.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/voice-estimate (voice, owner 2026-11-24; ADR-0012's rule for a spoken meal; REQ-LOG-009): no
// consent step, a recorded "off" still holds, the reading counted, failures as SERVICE_UNAVAILABLE and not
// counted, nothing of the words or the answer in the logs (invariant #7). The estimator is a fake: no test
// calls OpenAI. Synthetic words and made-up values only.

const WORDS = 'two roti and a katori of dal';
const ANSWER: PhotoEstimateResponse = {
  items: [
    { spokenWords: 'two roti', name: 'roti', quantity: 2, unit: 'piece', grams: 80, kcal: 297, proteinG: 9.8, carbsG: 46, fatG: 7.5, fibreG: 4.9, ambiguity: [] },
  ],
};

const fake = { texts: [] as string[], failWith: null as Error | null };
const estimator: PhotoEstimator = {
  async estimate() {
    throw new Error('not used');
  },
  async estimateText(text) {
    fake.texts.push(text);
    if (fake.failWith) throw fake.failWith;
    return ANSWER;
  },
};

const clock = new Date('2026-11-24T04:30:00Z');
let api: Awaited<ReturnType<typeof startTestApi>>;
let noKeyApi: Awaited<ReturnType<typeof startTestApi>>;
const lines: string[] = [];

beforeAll(async () => {
  api = await startTestApi({ now: () => clock, photoEstimator: estimator, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
  noKeyApi = await startTestApi({ now: () => clock });
});
afterAll(async () => {
  await api.close();
  await noKeyApi.close();
});
beforeEach(() => {
  fake.texts = [];
  fake.failWith = null;
});

function estimate(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/voice-estimate',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object,
  });
}
async function setting(token: string, consented: boolean, textVersion: string = AI_CONSENT_TEXT_VERSION) {
  const response = await api.app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: { authorization: `Bearer ${token}` },
    payload: { consented, textVersion },
  });
  if (response.statusCode !== 200) throw new Error(`Setting failed: ${response.statusCode}`);
}
async function readingsCounted(userId: string) {
  const { rows } = await api.db.query<{ day: string; count: number }>(
    "select to_char(day, 'YYYY-MM-DD') as day, count from app.ai_readings where user_id = $1 order by day",
    [userId],
  );
  return rows;
}

describe('authorization: POST /v1/ai/voice-estimate', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no AI call', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await estimate(token, { text: WORDS });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.texts).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no AI call', async () => {
    const user = await api.signUp();
    const response = await estimate(user.token, { text: WORDS });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.texts).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user readings are counted as their own', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    expect((await estimate(userB.token, { text: WORDS, userId: userA.id })).statusCode).toBe(400);
    expect((await estimate(userA.token, { text: WORDS })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-24', count: 1 }]);
    expect(await readingsCounted(userB.id)).toEqual([]);
  });
});

describe('a spoken meal is read with no consent step', () => {
  it('a user who never chose, or chose on an older text, is read at once, and counted', async () => {
    const never = await api.signUpWithAccount();
    const older = await api.signUpWithAccount();
    await setting(older.token, true, AI_CONSENT_OLDER_TEXT_VERSIONS[0]);
    for (const user of [never, older]) {
      const response = await estimate(user.token, { text: WORDS });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(ANSWER);
      expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-24', count: 1 }]);
    }
    expect(fake.texts).toEqual([WORDS, WORDS]);
  });

  it('a recorded "off" in Settings still blocks it: 403 AI_CONSENT_REQUIRED and no call', async () => {
    const off = await api.signUpWithAccount();
    await setting(off.token, true);
    await setting(off.token, false);
    const response = await estimate(off.token, { text: WORDS });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    expect(fake.texts).toEqual([]);
    expect(await readingsCounted(off.id)).toEqual([]);
    await setting(off.token, true);
    expect((await estimate(off.token, { text: WORDS })).statusCode).toBe(200);
  });
});

describe('REQ-LOG-009 a voice estimate', () => {
  it('a missing, too short, too long or unknown-field body: refused, no call, not counted', async () => {
    const user = await api.signUpWithAccount();
    for (const body of [{}, { text: 'a' }, { text: 'x'.repeat(501) }, { text: WORDS, kcal: 1 }, null]) {
      const response = await estimate(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.texts).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('without OPENAI_API_KEY the route answers 503 SERVICE_UNAVAILABLE', async () => {
    const user = await noKeyApi.signUpWithAccount();
    const response = await estimate(user.token, { text: WORDS }, noKeyApi);
    expect(response.statusCode).toBe(503);
  });

  it('the provider failing or an unusable answer: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await api.signUpWithAccount();
    for (const failure of [new PhotoEstimatorFailed('provider', 'insufficient_quota'), new PhotoEstimatorFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await estimate(user.token, { text: WORDS });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the words nor the answer', () => {
  it('a reading and a failure log the route and the failure kind only', async () => {
    const user = await api.signUpWithAccount();
    lines.length = 0;
    await estimate(user.token, { text: WORDS });
    fake.failWith = new PhotoEstimatorFailed('provider', '429');
    await estimate(user.token, { text: WORDS });
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/voice-estimate', 200],
      ['/v1/ai/voice-estimate', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai voice estimate failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of [WORDS, 'roti', user.email]) expect(log).not.toContain(secret);
  });
});
