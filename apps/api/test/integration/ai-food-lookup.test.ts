import {
  AI_CONSENT_OLDER_TEXT_VERSIONS,
  AI_CONSENT_TEXT_VERSION,
  type BarcodeEstimateResponse,
  type FoodLookupResponse,
} from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProductEstimatorFailed, type ProductEstimateRequest, type ProductEstimator } from '../../src/ai/productEstimator.ts';
import type { FoodNameSource } from '../../src/foods/openFoodFacts.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/food-lookup (D-118; REQ-LOG-009, REQ-ACC-004): Open Food Facts by name first, then an AI
// estimate; consent is checked before either (invariant #3); only an AI estimate is counted; failures
// are SERVICE_UNAVAILABLE; nothing of the name or the answer is logged (invariant #7). Both sources are
// fakes that count their calls: no test calls OpenAI or Open Food Facts. Made-up foods only.

const NAME = 'Zorblax Crunch Bar';
const LISTED: BarcodeEstimateResponse = { name: 'Zorblax Crunch Bar', brand: 'Zorblax', kcal: 430, proteinG: 9, carbsG: 60, fatG: 17, fibreG: 3 };
const ESTIMATED: BarcodeEstimateResponse = { name: 'Zorblax Crunch Bar', brand: null, kcal: 410, proteinG: 8, carbsG: 58, fatG: 16, fibreG: null };

const fake = {
  searches: [] as string[],
  estimates: [] as ProductEstimateRequest[],
  listed: null as BarcodeEstimateResponse | null,
  failWith: null as Error | null,
};
const foodNames: FoodNameSource = {
  async searchByName(name) {
    fake.searches.push(name);
    return fake.listed;
  },
};
const estimator: ProductEstimator = {
  async estimate(request) {
    fake.estimates.push(request);
    if (fake.failWith) throw fake.failWith;
    return ESTIMATED;
  },
};

// 2026-11-19 10:00 in India.
const clock = new Date('2026-11-19T04:30:00Z');
let api: Awaited<ReturnType<typeof startTestApi>>;
let noKeyApi: Awaited<ReturnType<typeof startTestApi>>;
const lines: string[] = [];

beforeAll(async () => {
  api = await startTestApi({ now: () => clock, productEstimator: estimator, foodNames, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
  noKeyApi = await startTestApi({ now: () => clock, foodNames });
});
afterAll(async () => {
  await api.close();
  await noKeyApi.close();
});
beforeEach(() => {
  fake.searches = [];
  fake.estimates = [];
  fake.listed = null;
  fake.failWith = null;
});

function lookUp(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/food-lookup',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as object,
  });
}

async function consent(token: string, consented: boolean, textVersion: string = AI_CONSENT_TEXT_VERSION, target = api) {
  const response = await target.app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: { authorization: `Bearer ${token}` },
    payload: { consented, textVersion },
  });
  if (response.statusCode !== 200) throw new Error(`Consent failed: ${response.statusCode}`);
}
async function consentingUser(target = api) {
  const user = await target.signUpWithAccount();
  await consent(user.token, true, AI_CONSENT_TEXT_VERSION, target);
  return user;
}
async function readingsCounted(userId: string) {
  const { rows } = await api.db.query<{ day: string; count: number }>(
    "select to_char(day, 'YYYY-MM-DD') as day, count from app.ai_readings where user_id = $1 order by day",
    [userId],
  );
  return rows;
}

describe('authorization: POST /v1/ai/food-lookup', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no lookup', async () => {
    const user = await consentingUser();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await lookUp(token, { name: NAME });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.searches).toEqual([]);
    expect(fake.estimates).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no lookup', async () => {
    const user = await api.signUp();
    const response = await lookUp(user.token, { name: NAME });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.searches).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user’s readings are counted as their own', async () => {
    const userA = await consentingUser();
    const userB = await consentingUser();
    expect((await lookUp(userB.token, { name: NAME, userId: userA.id })).statusCode).toBe(400);
    expect((await lookUp(userA.token, { name: NAME })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
    expect(await readingsCounted(userB.id)).toEqual([]);
  });
});

describe('REQ-LOG-009 a food looked up by name', () => {
  it('Open Food Facts first: its values are returned as such, with no AI call and no reading counted', async () => {
    fake.listed = LISTED;
    const user = await consentingUser();
    const response = await lookUp(user.token, { name: `  ${NAME}  ` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...LISTED, source: 'open_food_facts' } satisfies FoodLookupResponse);
    expect(fake.searches).toEqual([NAME]);
    expect(fake.estimates).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('not in Open Food Facts: an AI estimate from the name alone, counted', async () => {
    const user = await consentingUser();
    const response = await lookUp(user.token, { name: NAME });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...ESTIMATED, source: 'ai_estimate' } satisfies FoodLookupResponse);
    expect(fake.searches).toEqual([NAME]);
    expect(fake.estimates).toEqual([{ name: NAME }]);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
  });

  it('a name under 2 or over 120 characters, a missing or unknown field: refused, no lookup, not counted', async () => {
    const user = await consentingUser();
    for (const body of [{ name: 'a' }, { name: 'x'.repeat(121) }, {}, { name: NAME, barcode: '8901234567895' }, null]) {
      const response = await lookUp(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.searches).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('without OPENAI_API_KEY: Open Food Facts still answers; otherwise 503 SERVICE_UNAVAILABLE', async () => {
    const user = await consentingUser(noKeyApi);
    fake.listed = LISTED;
    expect((await lookUp(user.token, { name: NAME }, noKeyApi)).json()).toMatchObject({ source: 'open_food_facts' });
    fake.listed = null;
    const response = await lookUp(user.token, { name: NAME }, noKeyApi);
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('invariant #3 consent is checked before any lookup', () => {
  it('never chosen, turned off, or on an older text: 403 AI_CONSENT_REQUIRED, no search and no call', async () => {
    const never = await api.signUpWithAccount();
    const off = await api.signUpWithAccount();
    await consent(off.token, true);
    await consent(off.token, false);
    const older = await api.signUpWithAccount();
    await consent(older.token, true, AI_CONSENT_OLDER_TEXT_VERSIONS[0]);
    for (const user of [never, off, older]) {
      const response = await lookUp(user.token, { name: NAME });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    }
    expect(fake.searches).toEqual([]);
    expect(fake.estimates).toEqual([]);
  });
});

describe('REQ-LOG-009 a failed lookup', () => {
  it('the estimate failing or unusable: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await consentingUser();
    for (const failure of [new ProductEstimatorFailed('provider', 'insufficient_quota'), new ProductEstimatorFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await lookUp(user.token, { name: NAME });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the name nor the answer', () => {
  it('a lookup and a failure log the route and the failure’s kind only', async () => {
    const user = await consentingUser();
    lines.length = 0;
    await lookUp(user.token, { name: NAME });
    fake.failWith = new ProductEstimatorFailed('provider', '429');
    await lookUp(user.token, { name: NAME });
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/food-lookup', 200],
      ['/v1/ai/food-lookup', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai food lookup failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of ['Zorblax', user.email]) expect(log).not.toContain(secret);
  });
});
