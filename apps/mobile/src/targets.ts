import {
  addDays,
  fromGrams,
  istWeekStart,
  TARGET_KINDS,
  TARGET_RANGES,
  type BodyWeightUnit,
  type IstDay,
  type TargetKind,
} from '@fitsphere/shared';
import { dayParts, formatInteger, parseWeightInput, parseWholeNumber, weightRule } from './format';

// The user's own targets for display and input (REQ-ROLE-007; MVP defaults, D-23, D-70). Values
// are stored in canonical units (invariant #6): kcal, grams of protein, carbs, fat and fibre, steps,
// workouts a week, and body weight in grams, shown in the body-weight unit.

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
  // D-70: shown against what was eaten on the Insight page.
  carbs: wholeNumber('Daily carbs', 'carbs', 'g', () => 'g'),
  fat: wholeNumber('Daily fat', 'fat', 'g', () => 'g'),
  fibre: wholeNumber('Daily fibre', 'fibre', 'g', () => 'g'),
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

/** Your targets' groups (D-70, the redesign's 6.2 locked again 2026-11-10): food, then activity
 * and body. The first and last of each group span the row. */
export const TARGET_GROUPS: readonly { title: string; kinds: readonly TargetKind[]; wide: readonly TargetKind[] }[] = [
  { title: 'Food', kinds: ['calories', 'protein', 'carbs', 'fat', 'fibre'], wide: ['calories'] },
  { title: 'Activity and body', kinds: ['steps', 'weekly_workouts', 'body_weight'], wide: ['body_weight'] },
];

// Targets by date (D-77, REQ-ROLE-018): each value holds from its IST day on, until the next value of
// its kind; the days before it keep theirs.

/** A target value as kept: its kind, the IST day it starts and its value. */
export type DatedTarget = { kind: TargetKind; day: IstDay; value: number };

/** The values of the targets given, by kind. */
export function targetValues(list: readonly { kind: TargetKind; value: number }[]): Partial<Record<TargetKind, number>> {
  return Object.fromEntries(list.map((target) => [target.kind, target.value]));
}

/** "from today", or "since 8 Nov": since when a target's value holds. */
export function sinceText(day: IstDay, today: IstDay): string {
  if (day >= today) return 'from today';
  const parts = dayParts(day);
  return `since ${parts.date} ${parts.month}`;
}

/** The day a week's weekly workout target is read on: its Sunday, so a change counts for its whole
 * week, and this week's is today's (D-77). */
export function weekTargetDay(day: IstDay): IstDay {
  return addDays(istWeekStart(day), 6);
}

/** Each kind's values, oldest first, a value the same as the one before it left out: it changed nothing. */
function valuesByKind(list: readonly DatedTarget[]): Map<TargetKind, DatedTarget[]> {
  const byKind = new Map<TargetKind, DatedTarget[]>();
  for (const target of [...list].sort((a, b) => a.day.localeCompare(b.day))) {
    const values = byKind.get(target.kind) ?? [];
    if (values.at(-1)?.value !== target.value) values.push(target);
    byKind.set(target.kind, values);
  }
  return byKind;
}

/** One change: a target set for the first time (`from` null) or changed, on its day. */
export type TargetChange = { kind: TargetKind; from: number | null; to: number };

/** Target history's All (REQ-ROLE-018): the changes by day, the newest day first, each day's in the
 * targets' order. */
export function targetChanges(list: readonly DatedTarget[]): { day: IstDay; changes: TargetChange[] }[] {
  const byDay = new Map<IstDay, TargetChange[]>();
  for (const kind of TARGET_ORDER) {
    const values = valuesByKind(list).get(kind) ?? [];
    values.forEach((target, index) => {
      const changes = byDay.get(target.day) ?? [];
      changes.push({ kind, from: index === 0 ? null : values[index - 1]!.value, to: target.value });
      byDay.set(target.day, changes);
    });
  }
  return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, changes]) => ({ day, changes }));
}

/** A value of one target and the days it held: `to` is the day before the next value. */
export type TargetPeriod = { from: IstDay; to: IstDay; days: number; value: number };

/**
 * One target's history (REQ-ROLE-018): its value now and since when, the earlier values newest
 * first with their days, and the first day any value held (the days before it had none). Null when
 * the target was never set.
 */
export function targetPeriods(
  list: readonly DatedTarget[],
  kind: TargetKind,
): { now: { value: number; since: IstDay }; earlier: TargetPeriod[]; firstDay: IstDay } | null {
  const values = valuesByKind(list).get(kind) ?? [];
  const last = values.at(-1);
  if (!last) return null;
  const earlier = values.slice(0, -1).map((target, index) => {
    const to = addDays(values[index + 1]!.day, -1);
    return { from: target.day, to, days: daysFrom(target.day, to), value: target.value };
  });
  return { now: { value: last.value, since: last.day }, earlier: earlier.reverse(), firstDay: values[0]!.day };
}

/** The days from one IST day to another, both counted. */
function daysFrom(from: IstDay, to: IstDay): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
