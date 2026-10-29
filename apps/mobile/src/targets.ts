import { fromGrams, TARGET_KINDS, TARGET_RANGES, type TargetKind } from '@fitsphere/shared';
import { BODY_WEIGHT_UNIT, formatInteger, parseWeightInput, parseWholeNumber, WEIGHT_RULE } from './format';

// The user's own targets for display and input (REQ-ROLE-007; MVP defaults, D-23). Values are
// stored in canonical units (invariant #6): kcal, grams of protein, steps, workouts a week, and
// body weight in grams, shown in the body-weight unit.

type TargetText = {
  label: string;
  /** For the input's accessibility label, e.g. "Daily calories in kcal". */
  unit: string;
  format(value: number): string;
  /** The value as typed into the sheet. */
  toText(value: number): string;
  parse(text: string): number | null;
  rule: string;
  decimal: boolean;
};

function wholeNumber(label: string, kind: TargetKind, unit: string, valueUnit: (value: number) => string): TargetText {
  const { min, max } = TARGET_RANGES[kind];
  return {
    label,
    unit,
    format: (value) => `${formatInteger(value)} ${valueUnit(value)}`,
    toText: String,
    parse: (text) => parseWholeNumber(text, min, max),
    rule: `Enter a whole number from ${formatInteger(min)} to ${formatInteger(max)}.`,
    decimal: false,
  };
}

export const TARGETS: Record<TargetKind, TargetText> = {
  calories: wholeNumber('Daily calories', 'calories', 'kcal', () => 'kcal'),
  protein: wholeNumber('Daily protein', 'protein', 'g', () => 'g'),
  steps: wholeNumber('Daily steps', 'steps', 'steps', () => 'steps'),
  weekly_workouts: wholeNumber('Weekly workouts', 'weekly_workouts', 'workouts', (value) =>
    value === 1 ? 'workout' : 'workouts',
  ),
  body_weight: {
    label: 'Target body weight',
    unit: BODY_WEIGHT_UNIT,
    format: (grams) => `${fromGrams(grams, BODY_WEIGHT_UNIT).toFixed(1)} ${BODY_WEIGHT_UNIT}`,
    toText: (grams) => fromGrams(grams, BODY_WEIGHT_UNIT).toFixed(1),
    parse: parseWeightInput,
    rule: WEIGHT_RULE,
    decimal: true,
  },
};

/** The order the targets are listed in. */
export const TARGET_ORDER: readonly TargetKind[] = TARGET_KINDS;
