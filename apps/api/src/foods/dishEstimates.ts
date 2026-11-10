// Reads docs/data/dish-estimates-sheet.csv, FitSphere's estimated-dishes sheet (D-62): Indian dishes the
// food list did not have, from the owner's dish database (Indian_Food_Database_MASTER.xlsx, kept
// outside the repository). Each dish has the typical values per 100 g of its type of dish (its
// "archetype": a dry sabzi, a dal, a pulao), not values measured for that dish, and one serving. The
// rows are flagged `llm` (app.foods.flag, server only, D-53). A row is `approved` or `held`: held rows
// had a problem when the sheet was made (the type's values do not fit the dish, not a dish at all, a
// weak match) and say which in `issue`; only approved rows reach the food list, as source
// `dish_estimate`, with their serving. The whole sheet is checked first; any problem refuses all of
// it, naming the line.
//
// A row's base food words ("okra; bhindi") are kept as the food's aliases, so a search for the base
// food finds its dishes ("okra" finds Bhindi Masala). They are never shown.
import { MEAL_ITEM_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import { BRAND_LABEL_BASES, CODE, SEARCH_WORD, SEARCH_WORDS_MAX, VALUE } from './brandLabels.ts';
import { parseCsv } from './csv.ts';
import { isCalendarDate } from './dishes.ts';
import { FOOD_FLAGS, FoodListError, type FoodFlag, type ImportedFood } from './ifct.ts';
import { portionLabel, type ImportedPortion } from './usda.ts';

export const DISH_ESTIMATE_SOURCE = 'dish_estimate';

export const DISH_ESTIMATES_HEADER: readonly string[] = [
  'code',
  'name',
  'base',
  'status',
  'issue',
  'basis',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fibre_g',
  'serving',
  'serving_grams',
  'search_words',
  'archetype',
  'confidence',
  'data_source',
  'read_on',
  'flag',
];

/** A row is approved, and loaded, or held back with the problem found in it. */
export const DISH_ESTIMATE_STATUSES = ['approved', 'held'] as const;

/** How sure the owner's database is of a row: C estimated, D a weak match (only ever held). */
export const DISH_ESTIMATE_CONFIDENCES = ['C', 'D'] as const;

export type DishEstimatesSheet = {
  /** The approved rows, as food-list items. */
  foods: ImportedFood[];
  /** Their servings, one each. */
  portions: ImportedPortion[];
  /** How many rows are held back, with a problem. */
  held: number;
};

/** Parses and checks the whole sheet; any problem refuses all of it. */
export function readDishEstimatesSheet(text: string): DishEstimatesSheet {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== DISH_ESTIMATES_HEADER.join(',')) {
    throw new FoodListError(`The estimated-dishes sheet's header must be: ${DISH_ESTIMATES_HEADER.join(',')}`);
  }
  const sheet: DishEstimatesSheet = { foods: [], portions: [], held: 0 };
  const codes = new Set<string>();
  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Estimated-dishes sheet line ${index + 2}: ${problem}`);
    };
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== DISH_ESTIMATES_HEADER.length) fail(`expected ${DISH_ESTIMATES_HEADER.length} fields, found ${row.length}`);
    const cell = Object.fromEntries(DISH_ESTIMATES_HEADER.map((name, column) => [name, row[column]!.trim()])) as Record<string, string>;

    const code = cell.code!;
    if (!CODE.test(code) || code.length > 64 || !code.startsWith('est-')) {
      fail('code must start with est- and be lowercase letters and digits joined by hyphens, at most 64');
    }
    if (codes.has(code)) fail(`${code} appears twice`);
    codes.add(code);
    const name = cell.name!;
    if (!name || name.length > 120) fail('name must be given, at most 120 characters');
    const base = cell.base!;
    if (!base || base.length > 80) fail('base must be given, at most 80 characters');
    const status = cell.status!;
    if (!(DISH_ESTIMATE_STATUSES as readonly string[]).includes(status)) fail('status must be approved or held');
    const issue = cell.issue!;
    if ((status === 'held') !== (issue !== '')) fail('a held row says its issue, and an approved row has none');
    const confidence = cell.confidence!;
    if (!(DISH_ESTIMATE_CONFIDENCES as readonly string[]).includes(confidence)) fail('confidence must be C or D');
    if (!/^[a-z0-9_]{1,40}$/.test(cell.archetype!)) fail('archetype must be given, lowercase letters, digits or _');
    if (!cell.data_source) fail('data_source must be given');
    if (!isCalendarDate(cell.read_on!)) fail('read_on must be a real date, as YYYY-MM-DD');
    const flag = cell.flag!;
    if (flag !== '' && !(FOOD_FLAGS as readonly string[]).includes(flag)) fail(`flag must be empty or ${FOOD_FLAGS.join(' or ')}`);
    if (status === 'held') {
      sheet.held += 1;
      return;
    }

    // An approved row is checked as a food of the list is.
    if (confidence !== 'C') fail('a weak match (D) is never approved');
    if (!(BRAND_LABEL_BASES as readonly string[]).includes(cell.basis!)) fail('basis must be 100 g or 100 ml');
    const values = [cell.kcal!, cell.protein_g!, cell.carbs_g!, cell.fat_g!, cell.fibre_g!];
    if (!values.every((value) => VALUE.test(value))) fail('kcal, protein_g, carbs_g, fat_g and fibre_g must be numbers with at most two decimals');
    const [kcal, protein, carbs, fat, fibre] = values.map(Number) as [number, number, number, number, number];
    if (kcal > 1_000 || [protein, carbs, fat, fibre].some((value) => value > 100) || protein + carbs + fat > 105) {
      fail('a value is more than 100 g, or 1,000 kcal, per 100');
    }
    // As for brand labels (D-49): 4 kcal a gram of protein and carbohydrate, 9 of fat, within a
    // quarter or 20 kcal.
    const computed = 4 * protein + 4 * carbs + 9 * fat;
    if (Math.abs(kcal - computed) > Math.max(20, 0.25 * Math.max(kcal, computed))) {
      fail(`kcal ${kcal} does not agree with protein, carbs and fat (${Math.round(computed)} kcal)`);
    }
    const servingGrams = cell.serving_grams!;
    if (cell.serving === '' || !VALUE.test(servingGrams) || Number(servingGrams) <= 0 || Number(servingGrams) > MEAL_ITEM_GRAMS_MAX) {
      fail('serving must be given, with serving_grams more than 0 and at most 2,000');
    }
    const label = portionLabel(cell.serving!);
    if (label.length > SERVING_LABEL_MAX) fail(`serving must be at most ${SERVING_LABEL_MAX} characters`);
    const searchWords = cell.search_words === '' ? [] : cell.search_words!.split(';').map((word) => word.trim());
    if (searchWords.length > SEARCH_WORDS_MAX || !searchWords.every((word) => SEARCH_WORD.test(word))) {
      fail(`search_words must be at most ${SEARCH_WORDS_MAX} words or names, separated by semicolons, each at most 60 letters, digits, spaces or ' & -`);
    }
    if (new Set(searchWords.map((word) => word.toLowerCase())).size !== searchWords.length) fail('search_words gives a word twice');

    sheet.foods.push({
      code,
      name,
      foodGroup: base,
      proteinG: cell.protein_g!,
      fibreG: cell.fibre_g!,
      fatG: cell.fat_g!,
      carbsG: cell.carbs_g!,
      kcal: cell.kcal!,
      kcalSource: 'published',
      // The values are a type of dish's, not this dish's: shown as estimated (D-62).
      estimated: true,
      needsReview: false,
      hidden: false,
      note: null,
      aliases: searchWords,
      ...(flag === '' ? {} : { flag: flag as FoodFlag }),
    });
    sheet.portions.push({ code, seq: 1, label, grams: Number(servingGrams) });
  });
  return sheet;
}
