import { describe, expect, it } from 'vitest';
import {
  formatWeight,
  fromGrams,
  isWeightGramsInRange,
  toGrams,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
} from './units.ts';

describe('REQ-HOME-006 body weight in whole grams (invariant #6)', () => {
  it('REQ-HOME-006 every one-decimal kg value from 20.0 to 300.0 converts to grams and back unchanged', () => {
    for (let tenths = 200; tenths <= 3000; tenths += 1) {
      const kg = tenths / 10;
      const grams = toGrams(kg, 'kg');
      expect(Number.isInteger(grams)).toBe(true);
      expect(fromGrams(grams, 'kg')).toBe(kg);
    }
  });

  it('REQ-ACC-003 every one-decimal lb value in range converts to grams and back unchanged', () => {
    for (let tenths = 441; tenths <= 6613; tenths += 1) {
      const lb = tenths / 10;
      const grams = toGrams(lb, 'lb');
      expect(Number.isInteger(grams)).toBe(true);
      expect(fromGrams(grams, 'lb')).toBe(lb);
    }
  });

  it('REQ-HOME-006 shows one decimal with the unit', () => {
    expect(formatWeight(70_300, 'kg')).toBe('70.3 kg');
    expect(formatWeight(70_000, 'kg')).toBe('70.0 kg');
    expect(formatWeight(toGrams(155, 'lb'), 'lb')).toBe('155.0 lb');
  });

  it('REQ-HOME-006 accepts 20–300 kg in whole grams and refuses anything else', () => {
    expect(isWeightGramsInRange(WEIGHT_GRAMS_MIN)).toBe(true);
    expect(isWeightGramsInRange(WEIGHT_GRAMS_MAX)).toBe(true);
    expect(isWeightGramsInRange(WEIGHT_GRAMS_MIN - 1)).toBe(false);
    expect(isWeightGramsInRange(WEIGHT_GRAMS_MAX + 1)).toBe(false);
    expect(isWeightGramsInRange(70_250.5)).toBe(false);
    expect(isWeightGramsInRange(Number.NaN)).toBe(false);
  });
});
