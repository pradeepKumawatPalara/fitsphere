// The Indian Nutrient Databank (INDB) for FitSphere's food list (D-46): 1,014 Indian recipes as
// cooked and eaten, with values per 100 g computed by INDB from their ingredients, mostly IFCT's,
// and one serving each ("bowl", "roti"). Published with Vijayakumar et al. (2024), Current
// Developments in Nutrition 8(7) 103790; no licence is stated for the data, a risk the owner accepted
// (R-008). Two steps, as USDA's: `convertIndb` turns INDB.xlsx's rows into the two CSV files kept in
// the repository (`npm run indb:convert`), and `readIndbCsv` reads them back for `foods:import`. Every
// value is estimated.
import { MEAL_ITEM_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import type { ImportedFood } from './ifct.ts';
import { FoodListError } from './ifct.ts';
import { portionLabel, readServingListCsv, USDA_FOODS_HEADER, USDA_PORTIONS_HEADER, type ImportedPortion, type ServingList } from './usda.ts';

export const INDB_SOURCE = 'indb';
const INDB_LIST: ServingList = { name: 'INDB', code: /^(ASC|BFP|OSR)\d{3}$/, codeRule: 'ASC, BFP or OSR and 3 digits', estimated: true };
/** The group every INDB food is listed under. */
export const INDB_GROUP = 'Indian recipes (INDB)';

/** INDB.xlsx's columns that FitSphere reads. */
const COLUMNS = [
  'food_code',
  'food_name',
  'energy_kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fibre_g',
  'servings_unit',
  'unit_serving_energy_kcal',
] as const;

/**
 * The CSV rows, headers first, for INDB.xlsx's rows (headers first). A recipe is left out when a value
 * is missing or not a number, more than 100 g or 1,000 kcal per 100 g, or its code or name is not as
 * expected. Its one serving is kept as "1 <unit>", with the grams it weighs: INDB gives each value per
 * 100 g and per serving, so one serving weighs 100 g times its energy over the energy per 100 g (its
 * protein, carbs and fat give the same weight). A serving under 1 g or over 2,000 g, with no unit, or
 * of a recipe with under 1 kcal per 100 g is left out; the recipe stays, in grams. Values are rounded
 * to two decimals.
 */
export function convertIndb(rows: string[][]): { foods: string[][]; portions: string[][]; skipped: string[] } {
  const [header = [], ...recipes] = rows;
  const at = Object.fromEntries(COLUMNS.map((name) => [name, header.indexOf(name)])) as Record<(typeof COLUMNS)[number], number>;
  const missing = COLUMNS.filter((name) => at[name] < 0);
  if (missing.length > 0) throw new FoodListError(`Not INDB.xlsx: no ${missing.join(', ')} column`);
  const foods: string[][] = [[...USDA_FOODS_HEADER]];
  const portions: string[][] = [[...USDA_PORTIONS_HEADER]];
  const skipped: string[] = [];
  const codes = new Set<string>();
  for (const recipe of recipes) {
    const cell = (name: (typeof COLUMNS)[number]) => (recipe[at[name]] ?? '').trim();
    const code = cell('food_code');
    const name = cell('food_name').replace(/\s+/g, ' ');
    if (!code && !name) continue;
    const values = (['energy_kcal', 'protein_g', 'carb_g', 'fat_g', 'fibre_g'] as const).map((column) => number(cell(column)));
    const [kcal, protein, carbs, fat, fibre] = values;
    if (
      !INDB_LIST.code.test(code) ||
      codes.has(code) ||
      !name ||
      name.length > 120 ||
      values.some((value) => value === null || value < 0) ||
      kcal! > 1_000 ||
      [protein, carbs, fat, fibre].some((value) => value! > 100)
    ) {
      skipped.push(name || code);
      continue;
    }
    codes.add(code);
    foods.push([code, name, INDB_GROUP, ...values.map((value) => decimal(value!))]);
    const unit = cell('servings_unit').replace(/\s+/g, ' ');
    const servingKcal = number(cell('unit_serving_energy_kcal'));
    if (!unit || servingKcal === null || kcal! < 1) continue;
    const grams = Math.round((100 * servingKcal) / kcal! * 100) / 100;
    const description = `1 ${unit}`;
    if (grams < 1 || grams > MEAL_ITEM_GRAMS_MAX || portionLabel(description).length > SERVING_LABEL_MAX) continue;
    portions.push([code, '1', description, decimal(grams)]);
  }
  return { foods, portions, skipped };
}

/** A cell's number, or null when it is not one. */
function number(text: string): number | null {
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return null;
  return Number(text);
}

/** A number with at most two decimals, without trailing zeros. */
function decimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Parses and checks both files whole, as USDA's; every INDB value is estimated. */
export function readIndbCsv(foodsText: string, portionsText: string): { foods: ImportedFood[]; portions: ImportedPortion[] } {
  return readServingListCsv(INDB_LIST, foodsText, portionsText);
}
