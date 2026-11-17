import { AI_CONSENT_OLDER_TEXT_VERSIONS, AI_CONSENT_TEXT_VERSION, type MealParseResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MealParserFailed, type MealParser } from '../../src/ai/mealParser.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/meal-parse (ADR-0010, D-115; REQ-LOG-009, REQ-ACC-004): consent checked before any
// call (invariant #3; ADR-0005 validation 4), readings counted by India day with no daily limit
// (D-115), failures as SERVICE_UNAVAILABLE and not counted, nothing of the text in the logs (invariant #7).
// The AI module is a fake that counts its calls: no test calls OpenAI. Made-up meals only.

const ANSWER: MealParseResponse = {
  items: [{ spokenWords: 'do roti', name: 'roti', quantity: 2, unit: 'piece', preparation: null, ambiguity: [] }],
};
const MEAL = 'do roti aur ek katori dal';

const fake = {
  texts: [] as string[],
  failWith: null as Error | null,
};
const parser: MealParser = {
  async parse(text) {
    fake.texts.push(text);
    if (fake.failWith) throw fake.failWith;
    return ANSWER;
  },
};

// 2026-11-17 10:00 in India.
let clock = new Date('2026-11-17T04:30:00Z');
let api: Awaited<ReturnType<typeof startTestApi>>;
let noKeyApi: Awaited<ReturnType<typeof startTestApi>>;
const lines: string[] = [];

beforeAll(async () => {
  api = await startTestApi({
    now: () => clock,
    mealParser: parser,
    log: { level: 'info', stream: { write: (line) => lines.push(line) } },
  });
  noKeyApi = await startTestApi({ now: () => clock });
});

afterAll(async () => {
  await api.close();
  await noKeyApi.close();
});

beforeEach(() => {
  fake.texts = [];
  fake.failWith = null;
  clock = new Date('2026-11-17T04:30:00Z');
});

function read(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/meal-parse',
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

describe('authorization: POST /v1/ai/meal-parse', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no AI call', async () => {
    const user = await consentingUser();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await read(token, { text: MEAL });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.texts).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no AI call', async () => {
    const user = await api.signUp();
    const response = await read(user.token, { text: MEAL });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.texts).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user’s readings are counted as their own', async () => {
    const userA = await consentingUser();
    const userB = await consentingUser();
    const named = await read(userB.token, { text: MEAL, userId: userA.id });
    expect(named.statusCode).toBe(400);

    for (let i = 0; i < 3; i += 1) expect((await read(userA.token, { text: MEAL })).statusCode).toBe(200);
    expect((await read(userB.token, { text: MEAL })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-17', count: 3 }]);
    expect(await readingsCounted(userB.id)).toEqual([{ day: '2026-11-17', count: 1 }]);
  });
});

describe('REQ-LOG-009 a reading', () => {
  it('returns the foods the AI module named, sending it only the trimmed text', async () => {
    const user = await consentingUser();
    const response = await read(user.token, { text: `  ${MEAL}  ` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ANSWER);
    expect(fake.texts).toEqual([MEAL]);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-17', count: 1 }]);
  });

  it('Devanagari text is read like any other', async () => {
    const user = await consentingUser();
    const response = await read(user.token, { text: 'दो रोटी और एक कटोरी दाल' });
    expect(response.statusCode).toBe(200);
    expect(fake.texts).toEqual(['दो रोटी और एक कटोरी दाल']);
  });

  it('text under 2 or over 500 characters, a missing or unknown field, or no JSON is refused, with no call and nothing counted', async () => {
    const user = await consentingUser();
    for (const body of [{ text: 'a' }, { text: '   ' }, { text: 'x'.repeat(501) }, {}, { text: MEAL, kcal: 1 }, null]) {
      const response = await read(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.texts).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('D-115 without OPENAI_API_KEY the route answers 503 SERVICE_UNAVAILABLE', async () => {
    const user = await noKeyApi.signUpWithAccount();
    const response = await read(user.token, { text: MEAL }, noKeyApi);
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('invariant #3 consent is checked before any call (ADR-0005 validation 4)', () => {
  it('never chosen, turned off, or given on the older Gemini text: 403 AI_CONSENT_REQUIRED and no call', async () => {
    const never = await api.signUpWithAccount();
    const off = await api.signUpWithAccount();
    await consent(off.token, true);
    await consent(off.token, false);
    const older = await api.signUpWithAccount();
    await consent(older.token, true, AI_CONSENT_OLDER_TEXT_VERSIONS[0]);

    for (const user of [never, off, older]) {
      const response = await read(user.token, { text: MEAL });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    }
    expect(fake.texts).toEqual([]);
  });

  it('a refusal for consent is not counted as a reading', async () => {
    const user = await api.signUpWithAccount();
    for (let i = 0; i < 3; i += 1) {
      expect((await read(user.token, { text: MEAL })).statusCode).toBe(403);
    }
    await consent(user.token, true);
    expect((await read(user.token, { text: MEAL })).statusCode).toBe(200);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-17', count: 1 }]);
  });

  it('consent withdrawn: the next reading is refused with no call', async () => {
    const user = await consentingUser();
    expect((await read(user.token, { text: MEAL })).statusCode).toBe(200);
    await consent(user.token, false);
    expect((await read(user.token, { text: MEAL })).json().error.code).toBe('AI_CONSENT_REQUIRED');
    expect(fake.texts).toEqual([MEAL]);
  });
});

describe('D-115 no daily limit: readings are counted by India day', () => {
  it('20 readings in a day are all read, none refused; each is counted on its India day', async () => {
    const user = await consentingUser();
    for (let i = 0; i < 20; i += 1) expect((await read(user.token, { text: MEAL })).statusCode).toBe(200);
    expect(fake.texts).toHaveLength(20);

    // 23:59 in India is still the 17th; 00:01 is the 18th (invariant #5).
    clock = new Date('2026-11-17T18:29:00Z');
    expect((await read(user.token, { text: MEAL })).statusCode).toBe(200);
    clock = new Date('2026-11-17T18:31:00Z');
    expect((await read(user.token, { text: MEAL })).statusCode).toBe(200);
    expect(await readingsCounted(user.id)).toEqual([
      { day: '2026-11-17', count: 21 },
      { day: '2026-11-18', count: 1 },
    ]);
  });

  it('requests at the same time are each read and each counted', async () => {
    const user = await consentingUser();
    const responses = await Promise.all(Array.from({ length: 10 }, () => read(user.token, { text: MEAL })));
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-17', count: 10 }]);
  });
});

describe('REQ-LOG-009 a failed reading', () => {
  it('the provider failing, its monthly limit included, or an unusable answer: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await consentingUser();
    for (const failure of [new MealParserFailed('provider', 'insufficient_quota'), new MealParserFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await read(user.token, { text: MEAL });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(fake.texts).toHaveLength(3);
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the meal text nor the answer', () => {
  it('a reading and a failure log the route and the failure’s kind only', async () => {
    const user = await consentingUser();
    lines.length = 0;
    await read(user.token, { text: MEAL });
    fake.failWith = new MealParserFailed('provider', '429');
    await read(user.token, { text: MEAL });

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/meal-parse', 200],
      ['/v1/ai/meal-parse', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai reading failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of ['roti', 'katori', 'dal', user.email]) expect(log).not.toContain(secret);
  });
});
