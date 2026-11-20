import {
  AI_CONSENT_OLDER_TEXT_VERSIONS,
  AI_CONSENT_TEXT_VERSION,
  PHOTO_PARSE_IMAGE_MAX_CHARS,
  type PhotoEstimateResponse,
} from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PhotoEstimatorFailed, type PhotoEstimator } from '../../src/ai/photoEstimator.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/photo-estimate (D-120, ADR-0012; REQ-LOG-006, REQ-LOG-009): no consent step for a photo, a
// recorded "off" still holds, the reading counted, failures as SERVICE_UNAVAILABLE and not counted,
// nothing of the picture or the answer in the logs (invariant #7). The estimator is a fake that counts
// its calls: no test calls OpenAI. Synthetic picture data and made-up values only.

const IMAGE = 'QUJD'.repeat(60);
const ANSWER: PhotoEstimateResponse = {
  items: [
    {
      spokenWords: '2 roti on the plate',
      name: 'roti',
      quantity: 2,
      unit: 'piece',
      grams: 80,
      kcal: 297,
      proteinG: 9.8,
      carbsG: 46,
      fatG: 7.5,
      fibreG: 4.9,
      ambiguity: [],
    },
  ],
};

const fake = { images: [] as string[], failWith: null as Error | null };
const estimator: PhotoEstimator = {
  async estimate(imageBase64) {
    fake.images.push(imageBase64);
    if (fake.failWith) throw fake.failWith;
    return ANSWER;
  },
};

// 2026-11-20 10:00 in India.
const clock = new Date('2026-11-20T04:30:00Z');
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
  fake.images = [];
  fake.failWith = null;
});

function estimate(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/photo-estimate',
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

describe('authorization: POST /v1/ai/photo-estimate', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no AI call', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await estimate(token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.images).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no AI call', async () => {
    const user = await api.signUp();
    const response = await estimate(user.token, { imageBase64: IMAGE });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.images).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user’s readings are counted as their own', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    expect((await estimate(userB.token, { imageBase64: IMAGE, userId: userA.id })).statusCode).toBe(400);
    expect((await estimate(userA.token, { imageBase64: IMAGE })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-20', count: 1 }]);
    expect(await readingsCounted(userB.id)).toEqual([]);
  });
});

describe('ADR-0012 a photo is read with no consent step', () => {
  it('a user who never chose, or chose on an older text, is read at once, sending the estimator only the picture, and counted', async () => {
    const never = await api.signUpWithAccount();
    const older = await api.signUpWithAccount();
    await setting(older.token, true, AI_CONSENT_OLDER_TEXT_VERSIONS[0]);
    for (const user of [never, older]) {
      const response = await estimate(user.token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(ANSWER);
      expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-20', count: 1 }]);
    }
    expect(fake.images).toEqual([IMAGE, IMAGE]);
  });

  it('a user who agreed is read too', async () => {
    const user = await api.signUpWithAccount();
    await setting(user.token, true);
    expect((await estimate(user.token, { imageBase64: IMAGE })).statusCode).toBe(200);
  });

  it('Q-A a recorded "off" in Settings still blocks it: 403 AI_CONSENT_REQUIRED and no call', async () => {
    const off = await api.signUpWithAccount();
    await setting(off.token, true);
    await setting(off.token, false);
    const response = await estimate(off.token, { imageBase64: IMAGE });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    expect(fake.images).toEqual([]);
    expect(await readingsCounted(off.id)).toEqual([]);
    // Turned on again, it reads.
    await setting(off.token, true);
    expect((await estimate(off.token, { imageBase64: IMAGE })).statusCode).toBe(200);
  });
});

describe('REQ-LOG-009 a photo estimate', () => {
  it('a picture of about 500 KB passes the route’s larger body limit', async () => {
    const user = await api.signUpWithAccount();
    const big = 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS);
    expect((await estimate(user.token, { imageBase64: big })).statusCode).toBe(200);
  });

  it('a missing, tiny, oversized or not-base64 picture, or an unknown field: refused, no call, not counted', async () => {
    const user = await api.signUpWithAccount();
    const bodies = [
      {},
      { imageBase64: 'QUJD' },
      { imageBase64: 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS + 1) },
      { imageBase64: `data:image/jpeg;base64,${IMAGE}` },
      { imageBase64: IMAGE, kcal: 1 },
      null,
    ];
    for (const body of bodies) {
      const response = await estimate(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.images).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('without OPENAI_API_KEY the route answers 503 SERVICE_UNAVAILABLE', async () => {
    const user = await noKeyApi.signUpWithAccount();
    const response = await estimate(user.token, { imageBase64: IMAGE }, noKeyApi);
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('the provider failing or an unusable answer: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await api.signUpWithAccount();
    for (const failure of [new PhotoEstimatorFailed('provider', 'insufficient_quota'), new PhotoEstimatorFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await estimate(user.token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the picture nor the answer', () => {
  it('a reading and a failure log the route and the failure’s kind only', async () => {
    const user = await api.signUpWithAccount();
    lines.length = 0;
    await estimate(user.token, { imageBase64: IMAGE });
    fake.failWith = new PhotoEstimatorFailed('provider', '429');
    await estimate(user.token, { imageBase64: IMAGE });
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/photo-estimate', 200],
      ['/v1/ai/photo-estimate', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai photo estimate failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of [IMAGE, 'roti', user.email]) expect(log).not.toContain(secret);
  });
});
