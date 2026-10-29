import { describe, expect, it } from 'vitest';
import {
  formatWeight,
  fromGrams,
  fromMillimetres,
  hoursToMinutes,
  isLiftWeightGramsInRange,
  isMeasurementMmInRange,
  isWeightGramsInRange,
  LIFT_WEIGHT_GRAMS_MAX,
  LIFT_WEIGHT_GRAMS_MIN,
  MEASUREMENT_MM_MAX,
  MEASUREMENT_MM_MIN,
  minutesToHours,
  SLEEP_MINUTES_MAX,
  toGrams,
  toMillimetres,
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

describe('REQ-TRN-005 lifting weight in whole grams (invariant #6)', () => {
  it('REQ-TRN-005 every one-decimal kg value from 0.1 to 500.0 converts to grams and back unchanged', () => {
    for (let tenths = 1; tenths <= 5000; tenths += 1) {
      const kg = tenths / 10;
      const grams = toGrams(kg, 'kg');
      expect(isLiftWeightGramsInRange(grams)).toBe(true);
      expect(fromGrams(grams, 'kg')).toBe(kg);
    }
  });

  it('D-29 accepts 0.1–500 kg in whole grams and refuses anything else', () => {
    expect(isLiftWeightGramsInRange(LIFT_WEIGHT_GRAMS_MIN)).toBe(true);
    expect(isLiftWeightGramsInRange(LIFT_WEIGHT_GRAMS_MAX)).toBe(true);
    expect(isLiftWeightGramsInRange(LIFT_WEIGHT_GRAMS_MIN - 1)).toBe(false);
    expect(isLiftWeightGramsInRange(LIFT_WEIGHT_GRAMS_MAX + 1)).toBe(false);
    expect(isLiftWeightGramsInRange(40_000.5)).toBe(false);
  });
});

describe('REQ-HOME-006 sleep in whole minutes', () => {
  it('REQ-HOME-006 every one-decimal hour value from 0.0 to 24.0 converts to minutes and back unchanged', () => {
    for (let tenths = 0; tenths <= 240; tenths += 1) {
      const hours = tenths / 10;
      const minutes = hoursToMinutes(hours);
      expect(Number.isInteger(minutes)).toBe(true);
      expect(minutesToHours(minutes)).toBe(hours);
    }
    expect(hoursToMinutes(24)).toBe(SLEEP_MINUTES_MAX);
    expect(hoursToMinutes(7.5)).toBe(450);
  });
});

describe('REQ-MEAS-003 measurements in whole millimetres (invariant #6)', () => {
  it('REQ-MEAS-003 every one-decimal cm value from 10.0 to 250.0 converts to millimetres and back unchanged', () => {
    for (let tenths = 100; tenths <= 2500; tenths += 1) {
      const cm = tenths / 10;
      const mm = toMillimetres(cm, 'cm');
      expect(mm).toBe(tenths);
      expect(fromMillimetres(mm, 'cm')).toBe(cm);
    }
  });

  it('REQ-MEAS-003 every one-decimal inch value in range converts to millimetres and back unchanged', () => {
    for (let tenths = 40; tenths <= 984; tenths += 1) {
      const inches = tenths / 10;
      const mm = toMillimetres(inches, 'in');
      expect(isMeasurementMmInRange(mm)).toBe(true);
      expect(fromMillimetres(mm, 'in')).toBe(inches);
    }
  });

  it('Q-028 accepts 10–250 cm in whole millimetres and refuses anything else, in either unit', () => {
    expect(isMeasurementMmInRange(MEASUREMENT_MM_MIN)).toBe(true);
    expect(isMeasurementMmInRange(MEASUREMENT_MM_MAX)).toBe(true);
    expect(isMeasurementMmInRange(MEASUREMENT_MM_MIN - 1)).toBe(false);
    expect(isMeasurementMmInRange(MEASUREMENT_MM_MAX + 1)).toBe(false);
    expect(isMeasurementMmInRange(812.5)).toBe(false);
    expect(isMeasurementMmInRange(toMillimetres(3.9, 'in'))).toBe(false);
    expect(isMeasurementMmInRange(toMillimetres(98.5, 'in'))).toBe(false);
  });
});
