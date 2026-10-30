// Body weight (invariant #6, REQ-HOME-006). Stored and sent in whole grams; kg and lb exist only
// for display and input, with one decimal.

export type BodyWeightUnit = 'kg' | 'lb';
/** The units a weight can be typed and shown in; the lifting unit uses the same two (REQ-ACC-002). */
export const WEIGHT_UNITS = ['kg', 'lb'] as const satisfies readonly BodyWeightUnit[];

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

// Lifting weight (invariant #6, REQ-TRN-005): stored and sent in whole grams like body weight, and
// typed and shown with one decimal in the lifting unit. 0.1–500 kg (MVP default, D-29).
export const LIFT_WEIGHT_GRAMS_MIN = 100;
export const LIFT_WEIGHT_GRAMS_MAX = 500_000;

export function isLiftWeightGramsInRange(grams: number): boolean {
  return Number.isInteger(grams) && grams >= LIFT_WEIGHT_GRAMS_MIN && grams <= LIFT_WEIGHT_GRAMS_MAX;
}

// Steps (REQ-HOME-006): whole steps per day, 0–100,000 (Q-028 MVP default).
export const STEPS_MIN = 0;
export const STEPS_MAX = 100_000;

// Sleep (REQ-HOME-006): typed in hours with one decimal (Q-015, Q-028), stored as whole minutes.
export const SLEEP_MINUTES_MIN = 0;
export const SLEEP_MINUTES_MAX = 24 * 60;

/** Hours with one decimal to whole minutes; 0.1 h is 6 minutes. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/** Whole minutes to hours, rounded to one decimal. */
export function minutesToHours(minutes: number): number {
  return Math.round(minutes / 6) / 10;
}

// Body measurements (invariant #6, REQ-MEAS-003): stored and sent in whole millimetres; cm and in
// exist only for display and input, with one decimal. 10–250 cm for every field (Q-028).
export type LengthUnit = 'cm' | 'in';

export const MEASUREMENT_MM_MIN = 100;
export const MEASUREMENT_MM_MAX = 2_500;

const MM_PER_UNIT: Record<LengthUnit, number> = {
  cm: 10,
  in: 25.4,
};

export function isMeasurementMmInRange(mm: number): boolean {
  return Number.isInteger(mm) && mm >= MEASUREMENT_MM_MIN && mm <= MEASUREMENT_MM_MAX;
}

/** Converts a length entered in `unit` to whole millimetres. */
export function toMillimetres(value: number, unit: LengthUnit): number {
  return Math.round(value * MM_PER_UNIT[unit]);
}

/** Converts whole millimetres to `unit`, rounded to one decimal. */
export function fromMillimetres(mm: number, unit: LengthUnit): number {
  return Math.round((mm / MM_PER_UNIT[unit]) * 10) / 10;
}
