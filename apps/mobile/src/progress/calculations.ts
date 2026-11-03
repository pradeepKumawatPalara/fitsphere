import { addDays, istWeekStart, syncWindowStart, type IstDay } from '@fitsphere/shared';

// Progress's numbers (REQ-PRG-001…005; Q-043 and Q-044 MVP defaults, D-30). Pure functions over
// what the phone holds, plus older weigh-ins read online for the longer chart ranges. Values stay
// in canonical units (grams, kcal, grams of protein, steps); the screen converts for display
// (invariant #6).

export type WeighInPoint = { day: IstDay; weightGrams: number };
export type DayNutrition = { kcal: number; proteinG: number };

/** The cards cover the last 28 IST days, today included (REQ-PRG-002's 4 weeks). */
export const PERIOD_DAYS = 28;
/** The week table's weeks: this one and the 11 before it, all within the 90 days the phone holds. */
export const TABLE_WEEKS = 12;
/** Less than this many days between the two weigh-ins is "not enough data" for a weekly rate (REQ-PRG-001). */
export const RATE_MIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IstDay, to: IstDay): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export type FourWeekWeight = {
  latest: WeighInPoint;
  /** The weigh-in the change is measured from; null with only one weigh-in. */
  earlier: WeighInPoint | null;
  /** Latest minus earlier, in grams; null without an earlier weigh-in. */
  changeGrams: number | null;
  /** Grams a week; null with less than a week between the two weigh-ins (not enough data). */
  weeklyRateGrams: number | null;
};

/**
 * The 4-week weight card (REQ-PRG-001). The change is the latest weigh-in minus the weigh-in
 * nearest 28 days before it, among those at least a week earlier (ties: the earlier one), and the
 * weekly rate is that change ÷ the weeks between them, which is Q-043's "÷ 4" at 28 days (D-30).
 * With no weigh-in a week earlier, the change is measured from the oldest one and there is no rate.
 */
export function fourWeekWeight(weighIns: readonly WeighInPoint[]): FourWeekWeight | null {
  if (weighIns.length === 0) return null;
  const sorted = [...weighIns].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const latest = sorted[sorted.length - 1]!;
  const before = sorted.slice(0, -1);
  if (before.length === 0) return { latest, earlier: null, changeGrams: null, weeklyRateGrams: null };

  const goal = addDays(latest.day, -PERIOD_DAYS);
  const weekOrMore = before.filter((entry) => daysBetween(entry.day, latest.day) >= RATE_MIN_DAYS);
  if (weekOrMore.length === 0) {
    const earlier = before[0]!;
    return { latest, earlier, changeGrams: latest.weightGrams - earlier.weightGrams, weeklyRateGrams: null };
  }
  // Oldest first, so on a tie the earlier weigh-in is kept.
  let earlier = weekOrMore[0]!;
  for (const entry of weekOrMore) {
    if (Math.abs(daysBetween(goal, entry.day)) < Math.abs(daysBetween(goal, earlier.day))) earlier = entry;
  }
  const changeGrams = latest.weightGrams - earlier.weightGrams;
  const weeks = daysBetween(earlier.day, latest.day) / 7;
  return { latest, earlier, changeGrams, weeklyRateGrams: changeGrams / weeks };
}

/** The first day of the cards' period. */
export function periodStart(today: IstDay): IstDay {
  return addDays(today, -(PERIOD_DAYS - 1));
}

/**
 * Average daily calories over the period (REQ-PRG-002): the mean over the days with at least one
 * meal (Q-043), in whole kcal; null when no meal was logged.
 */
export function averageCalories(nutrition: Readonly<Record<IstDay, DayNutrition>>, today: IstDay): number | null {
  const from = periodStart(today);
  const days = Object.keys(nutrition).filter((day) => day >= from && day <= today);
  if (days.length === 0) return null;
  const total = days.reduce((sum, day) => sum + nutrition[day]!.kcal, 0);
  return Math.round(total / days.length);
}

/**
 * "Meals logged: X of Y days" (REQ-PRG-003): X is the days in the period with at least one meal;
 * Y counts from the day the account was created, at most 28 (Q-044). An unknown creation day
 * counts the whole period.
 */
export function daysLogged(
  nutrition: Readonly<Record<IstDay, DayNutrition>>,
  today: IstDay,
  accountStart: IstDay | null,
): { logged: number; total: number } {
  let from = periodStart(today);
  if (accountStart !== null && accountStart > from) from = accountStart <= today ? accountStart : today;
  const logged = Object.keys(nutrition).filter((day) => day >= from && day <= today).length;
  return { logged, total: daysBetween(from, today) + 1 };
}

export type WeekRow = {
  /** The week's Monday. */
  weekStart: IstDay;
  weightGrams: number | null;
  kcal: number | null;
  proteinG: number | null;
  steps: number | null;
};

/**
 * The week-by-week table (REQ-PRG-005): this Mon–Sun week and the 11 before it, newest first, none
 * before the week the account was created. Each value is the average over the week's days that
 * have an entry (Q-043), rounded to whole grams, kcal, grams of protein and steps; null with none.
 */
export function weekRows(input: {
  today: IstDay;
  accountStart: IstDay | null;
  weighIns: readonly WeighInPoint[];
  nutrition: Readonly<Record<IstDay, DayNutrition>>;
  steps: readonly { day: IstDay; steps: number }[];
}): WeekRow[] {
  const thisWeek = istWeekStart(input.today);
  const firstWeek = input.accountStart === null ? null : istWeekStart(input.accountStart);
  const rows: WeekRow[] = [];
  for (let index = 0; index < TABLE_WEEKS; index += 1) {
    const weekStart = addDays(thisWeek, -7 * index);
    if (firstWeek !== null && weekStart < firstWeek) break;
    const weekEnd = addDays(weekStart, 6);
    const inWeek = (day: IstDay) => day >= weekStart && day <= weekEnd;
    const nutritionDays = Object.keys(input.nutrition).filter(inWeek);
    rows.push({
      weekStart,
      weightGrams: average(input.weighIns.filter((entry) => inWeek(entry.day)).map((entry) => entry.weightGrams)),
      kcal: average(nutritionDays.map((day) => input.nutrition[day]!.kcal)),
      proteinG: average(nutritionDays.map((day) => input.nutrition[day]!.proteinG)),
      steps: average(input.steps.filter((entry) => inWeek(entry.day)).map((entry) => entry.steps)),
    });
  }
  return rows;
}

export const CHART_RANGES = ['1W', '1M', '3M', '6M', 'All'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

/** The same date `months` calendar months earlier, or that month's last day when it has no such date (31 Mar → 28 or 29 Feb). */
export function monthsBefore(day: IstDay, months: number): IstDay {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const lastDate = new Date(Date.UTC(year, month - months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 - months, Math.min(date, lastDate))).toISOString().slice(0, 10);
}

/**
 * The first day a range covers, today included; All has none (D-34). 1M and 6M go back calendar
 * months. 3M is cut to the 90 days the phone holds, so it works offline: three months back can be
 * up to 3 days more than 90.
 */
export function rangeStart(range: ChartRange, today: IstDay): IstDay | null {
  switch (range) {
    case '1W':
      return addDays(today, -6);
    case '1M':
      return monthsBefore(today, 1);
    case '3M': {
      const start = monthsBefore(today, 3);
      return start < syncWindowStart(today) ? syncWindowStart(today) : start;
    }
    case '6M':
      return monthsBefore(today, 6);
    case 'All':
      return null;
  }
}

/** Whether a range reaches back past the 90 days the phone holds, so needs older weigh-ins read online (ADR-0007 rule 6). */
export function rangeNeedsServer(range: ChartRange, today: IstDay, accountStart: IstDay | null): boolean {
  const start = rangeStart(range, today);
  const reachesBack = start === null || start < syncWindowStart(today);
  return reachesBack && (accountStart === null || accountStart < syncWindowStart(today));
}

/** Whether a range is plotted as weekly averages, to keep the chart light on low-end phones. */
export function rangeIsWeekly(range: ChartRange): boolean {
  return range === '6M' || range === 'All';
}

/**
 * The weight trend chart's points, oldest first (REQ-PRG-004): every weigh-in in the range for
 * 1W, 1M and 3M; one point per Mon–Sun week (its Monday, the week's average) for 6M and All.
 */
export function chartPoints(range: ChartRange, weighIns: readonly WeighInPoint[], today: IstDay): WeighInPoint[] {
  const from = rangeStart(range, today);
  const inRange = weighIns
    .filter((entry) => (from === null || entry.day >= from) && entry.day <= today)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return rangeIsWeekly(range) ? weeklyAverages(inRange) : inRange;
}

/** One point per Mon–Sun week, on its Monday, with the week's average weight in whole grams; oldest first. */
export function weeklyAverages(weighIns: readonly WeighInPoint[]): WeighInPoint[] {
  const weeks = new Map<IstDay, number[]>();
  for (const entry of weighIns) {
    const monday = istWeekStart(entry.day);
    weeks.set(monday, [...(weeks.get(monday) ?? []), entry.weightGrams]);
  }
  return [...weeks.keys()].sort().map((day) => ({ day, weightGrams: average(weeks.get(day)!)! }));
}

/** The phone's weigh-ins with older ones read from the server; the phone's entry wins for a day. */
export function mergeWeighIns(phone: readonly WeighInPoint[], server: readonly WeighInPoint[]): WeighInPoint[] {
  const byDay = new Map<IstDay, WeighInPoint>();
  for (const entry of server) byDay.set(entry.day, entry);
  for (const entry of phone) byDay.set(entry.day, entry);
  return [...byDay.values()];
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
