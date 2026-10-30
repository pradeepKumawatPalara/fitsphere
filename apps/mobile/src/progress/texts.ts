import { fromGrams, type BodyWeightUnit, type IstDay } from '@fitsphere/shared';
import { dayParts, formatDay, formatInteger } from '../format';

// Progress's texts (REQ-PRG-001…006; MVP defaults, D-P1). Weights are shown in the body-weight
// unit passed in, never a fixed one, so the Settings slice's unit applies here too (REQ-ACC-003).

export const PROGRESS_TEXTS = {
  noWeighIns: 'No weigh-ins yet. Log your weight on Home.',
  notEnoughForRate: 'Not enough data for a weekly rate yet. Log your weight for at least a week.',
  noMeals: 'No meals logged in the last 4 weeks.',
  noCalorieTarget: 'No calorie target',
  noMeasurements: 'No measurements yet.',
  measurementsHint: 'Track your upper and lower waist once a week.',
  chartEmpty: 'Your trend shows once you have 2 weigh-ins in this range.',
  chartLoading: 'Loading older weigh-ins…',
  /** The step named in "… needs an internet connection." for the ranges read online (ADR-0007 rule 6). */
  chartStep: { '26W': 'Showing 26 weeks of weight', All: 'Showing all your weight' },
} as const;

/** A weight with one decimal and its unit, e.g. "70.3 kg". */
export function weightText(grams: number, unit: BodyWeightUnit): string {
  return `${fromGrams(grams, unit).toFixed(1)} ${unit}`;
}

/** e.g. "Down 1.2 kg since Fri 2 Oct", or "No change since Fri 2 Oct" when it rounds to 0.0. */
export function weightChangeText(changeGrams: number, since: IstDay, unit: BodyWeightUnit): string {
  const size = fromGrams(Math.abs(changeGrams), unit);
  if (size === 0) return `No change since ${formatDay(since)}`;
  return `${changeGrams < 0 ? 'Down' : 'Up'} ${size.toFixed(1)} ${unit} since ${formatDay(since)}`;
}

/** e.g. "Down 0.3 kg a week", or "No weekly change" when it rounds to 0.0. */
export function weeklyRateText(rateGrams: number, unit: BodyWeightUnit): string {
  const size = fromGrams(Math.round(Math.abs(rateGrams)), unit);
  if (size === 0) return 'No weekly change';
  return `${rateGrams < 0 ? 'Down' : 'Up'} ${size.toFixed(1)} ${unit} a week`;
}

/** e.g. "1,850 kcal a day". */
export function averageCaloriesText(kcal: number): string {
  return `${formatInteger(kcal)} kcal a day`;
}

/** e.g. "Meals logged: 12 of 27 days". */
export function daysLoggedText({ logged, total }: { logged: number; total: number }): string {
  return `Meals logged: ${logged} of ${total} ${total === 1 ? 'day' : 'days'}`;
}

/** A week table cell for a weight: one decimal in the unit, "–" when there is none. */
export function weightCell(grams: number | null, unit: BodyWeightUnit): string {
  return grams === null ? '–' : fromGrams(grams, unit).toFixed(1);
}

/** A week table cell for kcal, grams of protein or steps: a whole number, "–" when there is none. */
export function wholeCell(value: number | null): string {
  return value === null ? '–' : formatInteger(value);
}

/** A week's label in the table: "This week", or its Monday, e.g. "19 Oct". */
export function weekLabel(weekStart: IstDay, thisWeek: IstDay): string {
  if (weekStart === thisWeek) return 'This week';
  const parts = dayParts(weekStart);
  return `${parts.date} ${parts.month}`;
}
