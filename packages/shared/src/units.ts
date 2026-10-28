// Body weight (invariant #6, REQ-HOME-006). Stored and sent in whole grams; kg and lb exist only
// for display and input, with one decimal.

export type BodyWeightUnit = 'kg' | 'lb';

/** 20–300 kg (Q-028 MVP default). */
export const WEIGHT_GRAMS_MIN = 20_000;
export const WEIGHT_GRAMS_MAX = 300_000;

const GRAMS_PER_UNIT: Record<BodyWeightUnit, number> = {
  kg: 1000,
  lb: 453.592_37,
};

export function isWeightGramsInRange(grams: number): boolean {
  return Number.isInteger(grams) && grams >= WEIGHT_GRAMS_MIN && grams <= WEIGHT_GRAMS_MAX;
}

/** Converts a value entered in `unit` to whole grams. */
export function toGrams(value: number, unit: BodyWeightUnit): number {
  return Math.round(value * GRAMS_PER_UNIT[unit]);
}

/** Converts whole grams to `unit`, rounded to one decimal. */
export function fromGrams(grams: number, unit: BodyWeightUnit): number {
  return Math.round((grams / GRAMS_PER_UNIT[unit]) * 10) / 10;
}

/** For display, e.g. "70.3 kg". */
export function formatWeight(grams: number, unit: BodyWeightUnit): string {
  return `${fromGrams(grams, unit).toFixed(1)} ${unit}`;
}
