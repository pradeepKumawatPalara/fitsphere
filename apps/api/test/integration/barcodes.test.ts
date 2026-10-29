import type { BarcodeLookup, BarcodeProduct } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProductAnswer } from '../../src/foods/openFoodFacts.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';

// GET /v1/barcodes/{barcode} (ADR-0006 rule 2) with a fake Open Food Facts. Synthetic products.

const PRODUCT: BarcodeProduct = {
  name: 'Synthetic biscuits',
  brand: 'Synthetic brand',
  kcal: 480,
  proteinG: 7,
  carbsG: 68,
  fatG: 20,
  fibreG: null,
  sourceUrl: 'https://world.openfoodfacts.org/product/8901234567890',
};

let clock = new Date('2026-10-28T03:30:00Z');
const answers = new Map<string, ProductAnswer>();
const asked: string[] = [];
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({
    now: () => clock,
    barcodes: {
      async lookup(barcode) {
        asked.push(barcode);
        return answers.get(barcode) ?? { found: false };
      },
    },
  });
});

afterAll(async () => {
  await api.close();
});

beforeEach(async () => {
  asked.length = 0;
  answers.clear();
  clock = new Date('2026-10-28T03:30:00Z');
  await api.db.query('delete from app.barcode_products');
});

async function lookUp(token: string | null, barcode: string) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/barcodes/${barcode}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('authorization: GET /v1/barcodes/:barcode', () => {
  it('REQ-NFR-001 no token, an expired token or another key get 401', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ]) {
      expect((await lookUp(token, '8901234567890')).statusCode).toBe(401);
    }
    expect(asked).toEqual([]);
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await lookUp(user.token, '8901234567890');

    expect(response.statusCode).toBe(403);
    expect(asked).toEqual([]);
  });

  it('REQ-LOG-007 a user with an account gets the product', async () => {
    const user = await api.signUpWithAccount();
    answers.set('8901234567890', { found: true, product: PRODUCT });

    const response = await lookUp(user.token, '8901234567890');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ barcode: '8901234567890', found: true, product: PRODUCT } satisfies BarcodeLookup);
  });
});

describe('ADR-0006 rule 2 the barcode cache', () => {
  it('asks Open Food Facts once, then answers from the table for every user', async () => {
    const [userA, userB] = [await api.signUpWithAccount(), await api.signUpWithAccount()];
    answers.set('8901234567890', { found: true, product: PRODUCT });

    await lookUp(userA.token, '8901234567890');
    const second = await lookUp(userB.token, '8901234567890');

    expect(second.json().product).toEqual(PRODUCT);
    expect(asked).toEqual(['8901234567890']);
  });

  it('remembers "not found" for 24 hours, then asks again', async () => {
    const user = await api.signUpWithAccount();

    expect((await lookUp(user.token, '12345670')).json()).toEqual({ barcode: '12345670', found: false, product: null });
    clock = new Date(clock.getTime() + 23 * 60 * 60 * 1000);
    await lookUp(user.token, '12345670');
    expect(asked).toEqual(['12345670']);

    answers.set('12345670', { found: true, product: PRODUCT });
    clock = new Date(clock.getTime() + 2 * 60 * 60 * 1000);
    expect((await lookUp(user.token, '12345670')).json().found).toBe(true);
    expect(asked).toEqual(['12345670', '12345670']);
  });

  it('error model: when Open Food Facts cannot answer, 503 and nothing is stored', async () => {
    const user = await api.signUpWithAccount();
    answers.set('8901234567890', 'unavailable');

    const response = await lookUp(user.token, '8901234567890');

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    expect((await api.db.query('select 1 from app.barcode_products')).rowCount).toBe(0);
  });

  it('error model: a barcode that is not 8 to 14 digits is refused without asking', async () => {
    const user = await api.signUpWithAccount();

    for (const barcode of ['1234567', '123456789012345', '89012345a7890']) {
      const response = await lookUp(user.token, barcode);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual([{ field: 'barcode', issue: 'invalid_format' }]);
    }
    expect(asked).toEqual([]);
  });

  it('REQ-NFR-002 the table records no user', async () => {
    const { rows } = await api.db.query(
      `select column_name from information_schema.columns where table_schema = 'app' and table_name = 'barcode_products'`,
    );
    expect(rows.map((row) => row.column_name).some((name: string) => name.includes('user'))).toBe(false);
  });
});
