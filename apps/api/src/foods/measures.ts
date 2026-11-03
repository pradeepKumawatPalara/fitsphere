// Reads docs/data/household-measures-sheet.csv, FitSphere's household-measures sheet (D-36): the
// grams one household unit of a listed food holds, as the owner weighed it. The whole sheet is
// checked first; any problem refuses all of it, naming the line. Only approved rows are imported.
import type { FoodMeasure } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { isCalendarDate } from './dishes.ts';
import { FoodListError, type ImportedFood } from './ifct.ts';

export const MEASURES_SHEET_HEADER: readonly string[] = [
  'ifct_code',
  'food',
  'measure',
  'status',
  'grams_per_measure',
  'measured_by',
  'date',
  'notes',
];

/** `approved`: the owner's OK, so the row is imported and must be complete. `pending`: not yet. */
export const MEASURE_STATUSES = ['pending', 'approved'] as const;

/** The sheet's names for the units, with their sizes (D-36). */
export const MEASURE_NAMES: Readonly<Record<string, FoodMeasure>> = {
  'teaspoon (5 ml)': 'teaspoon',
  'tablespoon (15 ml)': 'tablespoon',
  'katori (200 ml)': 'katori',
  'glass (250 ml)': 'glass',
  piece: 'piece',
};

/** Grams per unit: more than 0, at most 1,000, with at most two decimals (D-36). */
const GRAMS = /^\d{1,4}(\.\d{1,2})?$/;
const GRAMS_MAX = 1_000;

/** The grams one unit of a listed food holds. */
export type ImportedMeasure = { code: string; measure: FoodMeasure; grams: number };

export type MeasuresSheet = {
  /** The approved rows, which are imported. */
  measures: ImportedMeasure[];
  /** How many rows are not yet approved. */
  pending: number;
};

/** Parses and checks the whole sheet against the IFCT list; any problem refuses all of it. */
export function readMeasuresSheet(text: string, foods: readonly ImportedFood[]): MeasuresSheet {
  const [header, ...rows] = parseCsv(text);
  if (!header || header.join(',') !== MEASURES_SHEET_HEADER.join(',')) {
    throw new FoodListError(`The household-measures sheet's header must be: ${MEASURES_SHEET_HEADER.join(',')}`);
  }
  const byCode = new Map(foods.map((food) => [food.code, food]));
  const seen = new Set<string>();
  const sheet: MeasuresSheet = { measures: [], pending: 0 };

  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Household-measures sheet line ${index + 2}: ${problem}`);
    };
    // A spreadsheet may leave rows with no values at all; they hold no measure.
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== MEASURES_SHEET_HEADER.length) fail(`expected ${MEASURES_SHEET_HEADER.length} fields, found ${row.length}`);
    const cells = Object.fromEntries(MEASURES_SHEET_HEADER.map((name, column) => [name, row[column]!.trim()]));

    const code = cells.ifct_code!;
    const food = byCode.get(code) ?? fail(`ifct_code: ${code || '(empty)'} is not in the IFCT list`);
    if (food.name !== cells.food) fail(`ifct_code: ${code} is "${food.name}" in the IFCT list, not "${cells.food}"`);
    const measure = MEASURE_NAMES[cells.measure!] ?? fail(`measure must be one of: ${Object.keys(MEASURE_NAMES).join(', ')}`);
    if (seen.has(`${code} ${measure}`)) fail(`${code} has the ${measure} twice`);
    seen.add(`${code} ${measure}`);
    if (!(MEASURE_STATUSES as readonly string[]).includes(cells.status!)) fail('status must be pending or approved');

    const gramsText = cells.grams_per_measure!;
    if (gramsText !== '' && (!GRAMS.test(gramsText) || Number(gramsText) <= 0 || Number(gramsText) > GRAMS_MAX)) {
      fail(`grams_per_measure must be more than 0 and at most ${GRAMS_MAX.toLocaleString('en-US')} g, with at most two decimals`);
    }
    if (cells.date !== '' && !isCalendarDate(cells.date!)) fail('date must be a real date, as YYYY-MM-DD');

    if (cells.status === 'pending') {
      sheet.pending += 1;
      return;
    }
    if (gramsText === '') fail('an approved row needs grams_per_measure');
    if (cells.measured_by === '') fail('an approved row needs measured_by');
    if (cells.date === '') fail('an approved row needs the date it was measured');
    if (food.hidden) fail(`${code} is hidden until checked, so it cannot have an approved unit`);
    sheet.measures.push({ code, measure, grams: Number(gramsText) });
  });
  return sheet;
}
