import {
  formatWeight,
  fromGrams,
  hoursToMinutes,
  minutesToHours,
  SLEEP_MINUTES_MAX,
  SLEEP_SET,
  STEPS_MAX,
  STEPS_MIN,
  STEPS_SET,
  WEIGH_IN_SET,
} from '@fitsphere/shared';
import { BODY_WEIGHT_UNIT, formatInteger, parseOneDecimal, parseWeightInput, parseWholeNumber, WEIGHT_RULE } from './format';

// The Home quick tiles (REQ-HOME-006): one value per IST day each, typed in (Q-015), within the
// Q-028 ranges, and stored in canonical units (invariant #6): grams, steps, minutes.

export type DayValueKind = 'weighIn' | 'steps' | 'sleep';

type DayValueText = {
  changeType: string;
  label: string;
  /** The change's field that holds the value. */
  field: 'weightGrams' | 'steps' | 'sleepMinutes';
  format(value: number): string;
  /** The input's accessibility label. */
  inputLabel: string;
  unit: string;
  /** The value as typed into the sheet. */
  toText(value: number): string;
  parse(text: string): number | null;
  rule: string;
  decimal: boolean;
  /** How a rejected change's text starts (error model, "Texts the app shows"). */
  notSaved: string;
};

const SLEEP_HOURS_MAX = minutesToHours(SLEEP_MINUTES_MAX);

export const DAY_VALUES: Record<DayValueKind, DayValueText> = {
  weighIn: {
    changeType: WEIGH_IN_SET,
    label: 'Weight',
    field: 'weightGrams',
    // In the body-weight unit (Q-024); kg until the Settings slice (Skeleton decision 6).
    format: (grams) => formatWeight(grams, BODY_WEIGHT_UNIT),
    inputLabel: `Weight in ${BODY_WEIGHT_UNIT}`,
    unit: BODY_WEIGHT_UNIT,
    toText: (grams) => fromGrams(grams, BODY_WEIGHT_UNIT).toFixed(1),
    parse: parseWeightInput,
    rule: WEIGHT_RULE,
    decimal: true,
    notSaved: "This weight wasn't saved",
  },
  steps: {
    changeType: STEPS_SET,
    label: 'Steps',
    field: 'steps',
    format: (steps) => `${formatInteger(steps)} steps`,
    inputLabel: 'Steps',
    unit: 'steps',
    toText: String,
    parse: (text) => parseWholeNumber(text, STEPS_MIN, STEPS_MAX),
    rule: `Enter whole steps from ${formatInteger(STEPS_MIN)} to ${formatInteger(STEPS_MAX)}.`,
    decimal: false,
    notSaved: "These steps weren't saved",
  },
  sleep: {
    changeType: SLEEP_SET,
    label: 'Sleep',
    field: 'sleepMinutes',
    format: (minutes) => `${minutesToHours(minutes).toFixed(1)} h`,
    inputLabel: 'Sleep in hours',
    unit: 'h',
    toText: (minutes) => minutesToHours(minutes).toFixed(1),
    parse: (text) => {
      const hours = parseOneDecimal(text);
      return hours !== null && hours <= SLEEP_HOURS_MAX ? hoursToMinutes(hours) : null;
    },
    rule: `Enter hours of sleep from 0.0 to ${SLEEP_HOURS_MAX.toFixed(1)}, with at most one decimal.`,
    decimal: true,
    notSaved: "This sleep wasn't saved",
  },
};

export const DAY_VALUE_ORDER: readonly DayValueKind[] = ['weighIn', 'steps', 'sleep'];
