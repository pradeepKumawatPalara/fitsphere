import { describe, expect, it } from 'vitest';
import {
  barcodeEstimateRequestSchema,
  barcodeEstimateResponseSchema,
  foodLookupRequestSchema,
  foodLookupResponseSchema,
  PHOTO_ESTIMATE_MAX_ITEMS,
  PHOTO_PARSE_IMAGE_MAX_CHARS,
  photoEstimateResponseSchema,
  photoParseRequestSchema,
} from './contracts.ts';

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

// POST /v1/ai/photo-parse and POST /v1/ai/food-lookup (D-118).

describe('D-118 the photo reading request', () => {
  const image = 'QUJD'.repeat(40);
  it('accepts base64 of a plausible size and nothing else', () => {
    expect(photoParseRequestSchema.safeParse({ imageBase64: image }).success).toBe(true);
    expect(photoParseRequestSchema.safeParse({ imageBase64: 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS) }).success).toBe(true);
  });
  it('refuses a tiny or oversized image, characters that are not base64, a missing field and an extra one', () => {
    for (const body of [
      { imageBase64: 'QUJD' },
      { imageBase64: 'A'.repeat(PHOTO_PARSE_IMAGE_MAX_CHARS + 1) },
      { imageBase64: `data:image/jpeg;base64,${image}` },
      { imageBase64: `${image} ${image}` },
      {},
      { imageBase64: image, userId: 'x' },
      null,
    ]) {
      expect(photoParseRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe('D-118 the food lookup', () => {
  it('the request takes a name of 2 to 120 characters, trimmed, and nothing else', () => {
    expect(foodLookupRequestSchema.parse({ name: '  paneer tikka ' })).toEqual({ name: 'paneer tikka' });
    for (const body of [{ name: 'a' }, { name: 'x'.repeat(121) }, {}, { name: 'paneer', barcode: '1' }]) {
      expect(foodLookupRequestSchema.safeParse(body).success).toBe(false);
    }
  });
  it('the answer carries its source, one of the two, with values in range', () => {
    const base = { name: 'Paneer tikka', brand: null, kcal: 260, proteinG: 18, carbsG: 6, fatG: 18, fibreG: null };
    expect(foodLookupResponseSchema.safeParse({ ...base, source: 'open_food_facts' }).success).toBe(true);
    expect(foodLookupResponseSchema.safeParse({ ...base, source: 'ai_estimate' }).success).toBe(true);
    expect(foodLookupResponseSchema.safeParse(base).success).toBe(false);
    expect(foodLookupResponseSchema.safeParse({ ...base, source: 'web' }).success).toBe(false);
    expect(foodLookupResponseSchema.safeParse({ ...base, source: 'ai_estimate', kcal: 950 }).success).toBe(false);
  });
});

// POST /v1/ai/photo-estimate (D-120, ADR-0012): the foods seen with their weight and values per 100 g.
describe('D-120 the photo estimate answer', () => {
  const item = {
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
  };

  it('takes foods with a weight and values in range, and an empty list', () => {
    expect(photoEstimateResponseSchema.safeParse({ items: [item] }).success).toBe(true);
    expect(photoEstimateResponseSchema.safeParse({ items: [{ ...item, quantity: null, unit: null, fibreG: null }] }).success).toBe(true);
    expect(photoEstimateResponseSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it('refuses a value out of range, a weight of 0 or over 2,000 g, an unknown unit and any other field', () => {
    for (const bad of [
      { ...item, kcal: 950 },
      { ...item, proteinG: -1 },
      { ...item, carbsG: 101 },
      { ...item, grams: 0 },
      { ...item, grams: 2001 },
      { ...item, unit: 'bucket' },
      { ...item, name: '' },
      { ...item, totalKcal: 1 },
    ]) {
      expect(photoEstimateResponseSchema.safeParse({ items: [bad] }).success).toBe(false);
    }
    const { kcal: _kcal, ...withoutKcal } = item;
    expect(photoEstimateResponseSchema.safeParse({ items: [withoutKcal] }).success).toBe(false);
    expect(photoEstimateResponseSchema.safeParse({ items: [item], total: 1 }).success).toBe(false);
  });

  it('holds at most 20 foods', () => {
    expect(photoEstimateResponseSchema.safeParse({ items: Array(PHOTO_ESTIMATE_MAX_ITEMS).fill(item) }).success).toBe(true);
    expect(photoEstimateResponseSchema.safeParse({ items: Array(PHOTO_ESTIMATE_MAX_ITEMS + 1).fill(item) }).success).toBe(false);
  });
});
