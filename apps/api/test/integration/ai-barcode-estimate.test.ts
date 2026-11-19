import { AI_CONSENT_OLDER_TEXT_VERSIONS, AI_CONSENT_TEXT_VERSION, type BarcodeEstimateResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProductEstimatorFailed, type ProductEstimateRequest, type ProductEstimator } from '../../src/ai/productEstimator.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// POST /v1/ai/barcode-estimate (ADR-0010's amendment, D-117; REQ-LOG-007, REQ-ACC-004): consent checked
// before any call (invariant #3), the reading counted, failures as SERVICE_UNAVAILABLE and not counted,
// nothing of the name, barcode or answer in the logs (invariant #7). The estimator is a fake that
// counts its calls: no test calls OpenAI. Made-up products only.

const BARCODE = '8901234567895';
const NAME = 'Zorblax Crunch Bar';
const ANSWER: BarcodeEstimateResponse = { name: 'Zorblax Crunch Bar', brand: 'Zorblax', kcal: 430, proteinG: 9, carbsG: 60, fatG: 17, fibreG: 3 };

const fake = { requests: [] as ProductEstimateRequest[], failWith: null as Error | null };
const estimator: ProductEstimator = {
  async estimate(request) {
    fake.requests.push(request);
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
  api = await startTestApi({ now: () => clock, productEstimator: estimator, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
  noKeyApi = await startTestApi({ now: () => clock });
});
afterAll(async () => {
  await api.close();
  await noKeyApi.close();
});
beforeEach(() => {
  fake.requests = [];
  fake.failWith = null;
});

function estimate(token: string | undefined, payload: unknown, target = api) {
  return target.app.inject({
    method: 'POST',
    url: '/v1/ai/barcode-estimate',
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

describe('authorization: POST /v1/ai/barcode-estimate', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401, with no AI call', async () => {
    const user = await consentingUser();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];
    for (const token of tokens) {
      const response = await estimate(token, { barcode: BARCODE, name: NAME });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(fake.requests).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED, with no AI call', async () => {
    const user = await api.signUp();
    const response = await estimate(user.token, { barcode: BARCODE, name: NAME });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
    expect(fake.requests).toEqual([]);
  });

  it('REQ-NFR-001 a user ID in the body is refused; each user’s readings are counted as their own', async () => {
    const userA = await consentingUser();
    const userB = await consentingUser();
    expect((await estimate(userB.token, { barcode: BARCODE, name: NAME, userId: userA.id })).statusCode).toBe(400);
    expect((await estimate(userA.token, { barcode: BARCODE, name: NAME })).statusCode).toBe(200);
    expect(await readingsCounted(userA.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
    expect(await readingsCounted(userB.id)).toEqual([]);
  });
});

describe('REQ-LOG-007 an estimate', () => {
  it('returns the estimate, sending the module only the barcode and the trimmed name, and counts it', async () => {
    const user = await consentingUser();
    const response = await estimate(user.token, { barcode: BARCODE, name: `  ${NAME}  ` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(ANSWER);
    expect(fake.requests).toEqual([{ barcode: BARCODE, name: NAME }]);
    expect(await readingsCounted(user.id)).toEqual([{ day: '2026-11-19', count: 1 }]);
  });

  it('a bad barcode, a name under 2 or over 120 characters, a missing or unknown field: refused, no call, not counted', async () => {
    const user = await consentingUser();
    const bodies = [
      { barcode: '1234567', name: NAME },
      { barcode: '123456789012345', name: NAME },
      { barcode: '89012345678AB', name: NAME },
      { barcode: BARCODE, name: 'a' },
      { barcode: BARCODE, name: 'x'.repeat(121) },
      { barcode: BARCODE },
      { name: NAME },
      { barcode: BARCODE, name: NAME, kcal: 1 },
      null,
    ];
    for (const body of bodies) {
      const response = await estimate(user.token, body);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(fake.requests).toEqual([]);
    expect(await readingsCounted(user.id)).toEqual([]);
  });

  it('without OPENAI_API_KEY the route answers 503 SERVICE_UNAVAILABLE', async () => {
    const user = await noKeyApi.signUpWithAccount();
    const response = await estimate(user.token, { barcode: BARCODE, name: NAME }, noKeyApi);
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
      const response = await estimate(user.token, { barcode: BARCODE, name: NAME });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toMatchObject({ code: 'AI_CONSENT_REQUIRED', retryable: false });
    }
    expect(fake.requests).toEqual([]);
  });

  it('consent withdrawn: the next estimate is refused with no call', async () => {
    const user = await consentingUser();
    expect((await estimate(user.token, { barcode: BARCODE, name: NAME })).statusCode).toBe(200);
    await consent(user.token, false);
    expect((await estimate(user.token, { barcode: BARCODE, name: NAME })).json().error.code).toBe('AI_CONSENT_REQUIRED');
    expect(fake.requests).toHaveLength(1);
  });
});

describe('REQ-LOG-007 a failed estimate', () => {
  it('the provider failing or an unusable answer: 503 SERVICE_UNAVAILABLE, not counted', async () => {
    const user = await consentingUser();
    for (const failure of [new ProductEstimatorFailed('provider', 'insufficient_quota'), new ProductEstimatorFailed('answer'), new Error('unexpected')]) {
      fake.failWith = failure;
      const response = await estimate(user.token, { barcode: BARCODE, name: NAME });
      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
    }
    expect(await readingsCounted(user.id)).toEqual([]);
  });
});

describe('invariant #7 the logs hold neither the name, the barcode nor the answer', () => {
  it('an estimate and a failure log the route and the failure’s kind only', async () => {
    const user = await consentingUser();
    lines.length = 0;
    await estimate(user.token, { barcode: BARCODE, name: NAME });
    fake.failWith = new ProductEstimatorFailed('provider', '429');
    await estimate(user.token, { barcode: BARCODE, name: NAME });
    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.filter((entry) => entry.msg === 'request').map((entry) => [entry.route, entry.status])).toEqual([
      ['/v1/ai/barcode-estimate', 200],
      ['/v1/ai/barcode-estimate', 503],
    ]);
    expect(entries.find((entry) => entry.msg === 'ai estimate failed')).toMatchObject({ reason: 'provider', providerCode: '429' });
    const log = lines.join('');
    for (const secret of ['Zorblax', BARCODE, user.email]) expect(log).not.toContain(secret);
  });
});
