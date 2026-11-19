import { AI_CONSENT_OLDER_TEXT_VERSIONS, AI_CONSENT_TEXT_VERSION, PHOTO_PARSE_IMAGE_MAX_CHARS, type MealParseResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PhotoParserFailed, type PhotoParser } from '../../src/ai/photoParser.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/photo-parse (D-118; REQ-LOG-006, REQ-LOG-009, REQ-ACC-004): consent checked before any
// call (invariant #3), the reading counted, failures as SERVICE_UNAVAILABLE and not counted, nothing of
// the picture or the answer in the logs (invariant #7). The parser is a fake that counts its calls: no
// test calls OpenAI. Synthetic picture data only.

const IMAGE = 'QUJD'.repeat(60);
const ANSWER: MealParseResponse = {
  items: [{ spokenWords: '2 roti on the plate', name: 'roti', quantity: 2, unit: 'piece', preparation: null, ambiguity: [] }],
};

const fake = { images: [] as string[], failWith: null as Error | null };
const parser: PhotoParser = {
  async parse(imageBase64) {
    fake.images.push(imageBase64);
    if (fake.failWith) throw fake.failWith;
    return ANSWER;
  },
};

// 2026-11-19 10:00 in India.
const clock = new Date('2026-11-19T04:30:00Z');
let api: Awaited<ReturnType<typeof startTestApi>>;
let noKeyApi: Awaited<ReturnType<typeof startTestApi>>;
const lines: string[] = [];

beforeAll(async () => {
  api = await startTestApi({ now: () => clock, photoParser: parser, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
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

function read(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/photo-parse',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object,
  });
}

async function consent(token: string, consented: boolean, textVersion: string = AI_CONSENT_TEXT_VERSION) {
  const response = await api.app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: { authorization: `Bearer ${token}` },
    payload: { consented, textVersion },
  });
  if (response.statusCode !== 200) throw new Error(`Consent failed: ${response.statusCode}`);
}
async function consentingUser() {
  const user = await api.signUpWithAccount();
  await consent(user.token, true);
  return user;
}
async function readingsCounted(userId: string) {
  const { rows } = await api.db.query<{ day: string; count: number }>(
    "select to_char(day, 'YYYY-MM-DD') as day, count from app.ai_readings where user_id = $1 order by day",
    [userId],
  );
  return rows;
}

describe('authorization: POST /v1/ai/photo-parse', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no AI call', async () => {
    const user = await consentingUser();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await read(token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.images).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no AI call', async () => {
    const user = await api.signUp();
    const response = await read(user.token, { imageBase64: IMAGE });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.images).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user’s readings are counted as their own', async () => {
    const userA = await consentingUser();
    const userB = await consentingUser();
    expect((await read(userB.token, { imageBase64: IMAGE, userId: userA.id })).statusCode).toBe(400);
    expect((await read(userA.token, { imageBase64: IMAGE })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
    expect(await readingsCounted(userB.id)).toEqual([]);
  });
});

describe('REQ-LOG-009 a photo reading', () => {
  it('returns the foods seen, sending the parser only the picture, and counts it', async () => {
    const user = await consentingUser();
    const response = await read(user.token, { imageBase64: IMAGE });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ANSWER);
    expect(fake.images).toEqual([IMAGE]);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
  });

  it('a picture of about 500 KB passes the route’s larger body limit', async () => {
    const user = await consentingUser();
    const big = 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS);
    expect((await read(user.token, { imageBase64: big })).statusCode).toBe(200);
  });

  it('a missing, tiny, oversized or not-base64 picture, or an unknown field: refused, no call, not counted', async () => {
    const user = await consentingUser();
    const bodies = [
      {},
      { imageBase64: 'QUJD' },
      { imageBase64: 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS + 1) },
      { imageBase64: `data:image/jpeg;base64,${IMAGE}` },
      { imageBase64: IMAGE, kcal: 1 },
      null,
    ];
    for (const body of bodies) {
      const response = await read(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.images).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('without OPENAI_API_KEY the route answers 503 SERVICE_UNAVAILABLE', async () => {
    const user = await noKeyApi.signUpWithAccount();
    const response = await read(user.token, { imageBase64: IMAGE }, noKeyApi);
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('invariant #3 consent is checked before any call', () => {
  it('never chosen, turned off, or on an older text: 403 AI_CONSENT_REQUIRED and no call', async () => {
    const never = await api.signUpWithAccount();
    const off = await api.signUpWithAccount();
    await consent(off.token, true);
    await consent(off.token, false);
    const older = await api.signUpWithAccount();
    await consent(older.token, true, AI_CONSENT_OLDER_TEXT_VERSIONS[0]);
    for (const user of [never, off, older]) {
      const response = await read(user.token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    }
    expect(fake.images).toEqual([]);
  });

  it('consent withdrawn: the next reading is refused with no call', async () => {
    const user = await consentingUser();
    expect((await read(user.token, { imageBase64: IMAGE })).statusCode).toBe(200);
    await consent(user.token, false);
    expect((await read(user.token, { imageBase64: IMAGE })).json().error.code).toBe('AI_CONSENT_REQUIRED');
    expect(fake.images).toHaveLength(1);
  });
});

describe('REQ-LOG-009 a failed photo reading', () => {
  it('the provider failing or an unusable answer: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await consentingUser();
    for (const failure of [new PhotoParserFailed('provider', 'insufficient_quota'), new PhotoParserFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await read(user.token, { imageBase64: IMAGE });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the picture nor the answer', () => {
  it('a reading and a failure log the route and the failure’s kind only', async () => {
    const user = await consentingUser();
    lines.length = 0;
    await read(user.token, { imageBase64: IMAGE });
    fake.failWith = new PhotoParserFailed('provider', '429');
    await read(user.token, { imageBase64: IMAGE });
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/photo-parse', 200],
      ['/v1/ai/photo-parse', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai photo reading failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of [IMAGE, 'roti', user.email]) expect(log).not.toContain(secret);
  });
});
