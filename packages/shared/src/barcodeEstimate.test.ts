import { describe, expect, it } from 'vitest';
import { barcodeEstimateRequestSchema, barcodeEstimateResponseSchema } from './contracts.ts';

// POST /v1/ai/barcode-estimate (ADR-0010's amendment, D-117).

const GOOD = { name: 'Zorblax Crunch Bar', brand: null, kcal: 430, proteinG: 9, carbsG: 60, fatG: 17, fibreG: null };

describe('D-117 the estimate request', () => {
  it('takes 8 to 14 digits and a name of 2 to 120 characters, trimmed', () => {
    expect(barcodeEstimateRequestSchema.parse({ barcode: '8901234567895', name: '  Zorblax  ' }).name).toBe('Zorblax');
    for (const barcode of ['1234567', '123456789012345', '89012345678AB', '']) {
      expect(barcodeEstimateRequestSchema.safeParse({ barcode, name: 'Zorblax' }).success).toBe(false);
    }
    for (const name of ['a', '  ', 'x'.repeat(121)]) {
      expect(barcodeEstimateRequestSchema.safeParse({ barcode: '8901234567895', name }).success).toBe(false);
    }
  });

  it('refuses any other field, a user ID included', () => {
    expect(barcodeEstimateRequestSchema.safeParse({ barcode: '8901234567895', name: 'Zorblax', userId: 'x' }).success).toBe(false);
  });
});

describe('D-117 the estimate answer', () => {
  it('accepts values within My foods’ limits per 100 g, with no brand or fibre', () => {
    expect(barcodeEstimateResponseSchema.safeParse(GOOD).success).toBe(true);
  });

  it('refuses a value out of range, a missing value and an extra field', () => {
    for (const bad of [{ ...GOOD, kcal: 901 }, { ...GOOD, kcal: -1 }, { ...GOOD, fatG: 101 }, { ...GOOD, proteinG: undefined }, { ...GOOD, sodiumMg: 4 }]) {
      expect(barcodeEstimateResponseSchema.safeParse(bad).success).toBe(false);
    }
  });
});
