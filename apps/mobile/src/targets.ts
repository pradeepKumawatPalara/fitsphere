import { fromGrams, TARGET_KINDS, TARGET_RANGES, type BodyWeightUnit, type TargetKind } from '@fitsphere/shared';
import { formatInteger, parseWeightInput, parseWholeNumber, weightRule } from './format';

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

const WHOLE_NUMBER_TARGETS = {
  calories: wholeNumber('Daily calories', 'calories', 'kcal', () => 'kcal'),
  protein: wholeNumber('Daily protein', 'protein', 'g', () => 'g'),
  steps: wholeNumber('Daily steps', 'steps', 'steps', () => 'steps'),
  weekly_workouts: wholeNumber('Weekly workouts', 'weekly_workouts', 'workouts', (value) =>
    value === 1 ? 'workout' : 'workouts',
  ),
};

/** The targets' texts, with the target body weight in the body-weight unit setting (REQ-ACC-003). */
export function targetTexts(bodyWeightUnit: BodyWeightUnit): Record<TargetKind, TargetText> {
  return {
    ...WHOLE_NUMBER_TARGETS,
    body_weight: {
      label: 'Target body weight',
      unit: bodyWeightUnit,
      format: (grams) => `${fromGrams(grams, bodyWeightUnit).toFixed(1)} ${bodyWeightUnit}`,
      toText: (grams) => fromGrams(grams, bodyWeightUnit).toFixed(1),
      parse: (text) => parseWeightInput(text, bodyWeightUnit),
      rule: weightRule(bodyWeightUnit),
      decimal: true,
    },
  };
}

/** The order the targets are listed in. */
export const TARGET_ORDER: readonly TargetKind[] = TARGET_KINDS;
