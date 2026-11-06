// Reads docs/data/home-foods-sheet.csv, FitSphere's home-foods sheet (D-59): everyday forms of daily
// foods as eaten at home (a bread slice, butter toast, bread omelette), not any brand's product, with
// typical values per 100 g (or 100 ml) and one serving. The values are an AI tool's estimates from its
// general knowledge, from the owner's files, flagged `llm` (app.foods.flag, server only, D-53). A row
// is `proposed` until the owner approves it; only approved rows reach the food list, as source
// `home`, with their serving. The whole sheet is checked first; any problem refuses all of it, naming
// the line.
//
// A row's item ("bread") and its search words (D-55) are kept as the food's aliases, so a search for
// the item finds all its forms ("bread" finds Butter toast). They are never shown.
import { MEAL_ITEM_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import { BRAND_LABEL_BASES, BRAND_LABEL_STATUSES, CODE, SEARCH_WORD, SEARCH_WORDS_MAX, VALUE } from './brandLabels.ts';
import { parseCsv } from './csv.ts';
import { isCalendarDate } from './dishes.ts';
import { FOOD_FLAGS, FoodListError, type FoodFlag, type ImportedFood } from './ifct.ts';
import { portionLabel, type ImportedPortion } from './usda.ts';

export const HOME_FOOD_SOURCE = 'home';

export const HOME_FOODS_HEADER: readonly string[] = [
  'code',
  'name',
  'item',
  'status',
  'basis',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fibre_g',
  'serving',
  'serving_grams',
  'search_words',
  'read_on',
  'notes',
  'flag',
];

export type HomeFoodsSheet = {
  /** The approved rows, as food-list items. */
  foods: ImportedFood[];
  /** Their servings, one each. */
  portions: ImportedPortion[];
  /** How many rows wait for the owner's OK. */
  proposed: number;
};

/** Parses and checks the whole sheet; any problem refuses all of it. */
export function readHomeFoodsSheet(text: string): HomeFoodsSheet {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== HOME_FOODS_HEADER.join(',')) {
    throw new FoodListError(`The home-foods sheet's header must be: ${HOME_FOODS_HEADER.join(',')}`);
  }
  const sheet: HomeFoodsSheet = { foods: [], portions: [], proposed: 0 };
  const codes = new Set<string>();
  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Home-foods sheet line ${index + 2}: ${problem}`);
    };
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== HOME_FOODS_HEADER.length) fail(`expected ${HOME_FOODS_HEADER.length} fields, found ${row.length}`);
    const cell = Object.fromEntries(HOME_FOODS_HEADER.map((name, column) => [name, row[column]!.trim()])) as Record<string, string>;

    const code = cell.code!;
    if (!CODE.test(code) || code.length > 64 || !code.startsWith('home-')) {
      fail('code must start with home- and be lowercase letters and digits joined by hyphens, at most 64');
    }
    if (codes.has(code)) fail(`${code} appears twice`);
    codes.add(code);
    const name = cell.name!;
    const item = cell.item!;
    if (!name || name.length > 120) fail('name must be given, at most 120 characters');
    if (!SEARCH_WORD.test(item)) fail('item must be given, at most 60 letters, digits, spaces or \' & -');
    if (!(BRAND_LABEL_STATUSES as readonly string[]).includes(cell.status!)) fail('status must be proposed or approved');
    if (!(BRAND_LABEL_BASES as readonly string[]).includes(cell.basis!)) fail('basis must be 100 g or 100 ml');

    const required = [cell.kcal!, cell.protein_g!, cell.carbs_g!, cell.fat_g!];
    if (!required.every((value) => VALUE.test(value)) || (cell.fibre_g !== '' && !VALUE.test(cell.fibre_g!))) {
      fail('kcal, protein_g, carbs_g and fat_g must be numbers with at most two decimals; fibre_g a number or empty');
    }
    const [kcal, protein, carbs, fat] = required.map(Number) as [number, number, number, number];
    const fibre = cell.fibre_g === '' ? null : Number(cell.fibre_g);
    if (kcal > 1_000 || [protein, carbs, fat, fibre ?? 0].some((value) => value > 100) || protein + carbs + fat > 105) {
      fail('a value is more than 100 g, or 1,000 kcal, per 100');
    }
    // As for brand labels (D-49): 4 kcal a gram of protein and carbohydrate, 9 of fat, within a
    // quarter or 20 kcal.
    const computed = 4 * protein + 4 * carbs + 9 * fat;
    if (Math.abs(kcal - computed) > Math.max(20, 0.25 * Math.max(kcal, computed))) {
      fail(`kcal ${kcal} does not agree with protein, carbs and fat (${Math.round(computed)} kcal)`);
    }

    // Every home-style food has its serving: a slice, a roti, a plate.
    const serving = cell.serving!;
    const servingGrams = cell.serving_grams!;
    if (serving === '' || !VALUE.test(servingGrams) || Number(servingGrams) <= 0 || Number(servingGrams) > MEAL_ITEM_GRAMS_MAX) {
      fail('serving must be given, with serving_grams more than 0 and at most 2,000');
    }
    const label = portionLabel(serving);
    if (label.length > SERVING_LABEL_MAX) fail(`serving must be at most ${SERVING_LABEL_MAX} characters`);
    const flag = cell.flag!;
    if (flag !== '' && !(FOOD_FLAGS as readonly string[]).includes(flag)) fail(`flag must be empty or ${FOOD_FLAGS.join(' or ')}`);
    if (!isCalendarDate(cell.read_on!)) fail('read_on must be a real date, as YYYY-MM-DD');
    const searchWords = cell.search_words === '' ? [] : cell.search_words!.split(';').map((word) => word.trim());
    if (searchWords.length > SEARCH_WORDS_MAX || !searchWords.every((word) => SEARCH_WORD.test(word))) {
      fail(`search_words must be at most ${SEARCH_WORDS_MAX} words or names, separated by semicolons, each at most 60 letters, digits, spaces or ' & -`);
    }
    if (new Set(searchWords.map((word) => word.toLowerCase())).size !== searchWords.length) fail('search_words gives a word twice');

    if (cell.status === 'proposed') {
      sheet.proposed += 1;
      return;
    }
    const aliases = [item, ...searchWords.filter((word) => word.toLowerCase() !== item.toLowerCase())];
    sheet.foods.push({
      code,
      name,
      foodGroup: item.charAt(0).toUpperCase() + item.slice(1),
      proteinG: cell.protein_g!,
      fibreG: cell.fibre_g === '' ? null : cell.fibre_g!,
      fatG: cell.fat_g!,
      carbsG: cell.carbs_g!,
      kcal: cell.kcal!,
      // Shown as the other foods are, with no "estimated" (the owner, D-59); the flag says what they are.
      kcalSource: 'published',
      estimated: false,
      needsReview: false,
      hidden: false,
      note: null,
      aliases,
      ...(flag === '' ? {} : { flag: flag as FoodFlag }),
    });
    sheet.portions.push({ code, seq: 1, label, grams: Number(servingGrams) });
  });
  return sheet;
}
