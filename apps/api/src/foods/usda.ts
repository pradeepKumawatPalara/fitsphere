// USDA FoodData Central's FNDDS 2021–2023 for FitSphere's food list (ADR-0006 rule 1: a source whose
// licence allows it, recorded per item; docs/plans/more-foods.md, D-39). FNDDS holds foods as people
// eat them, with the serving weights recorded in the US diet survey; it is public domain (CC0), and
// USDA asks to be credited. Two steps: `convertFndds` turns USDA's JSON download into the two CSV
// files kept in the repository (`npm run usda:convert`), and `readUsdaCsv` reads them back for
// `foods:import`. Values are per 100 g.
import { MEAL_ITEM_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { FoodListError, type ImportedFood } from './ifct.ts';

export const USDA_SOURCE = 'usda_fndds';
export const USDA_FOODS_HEADER: readonly string[] = ['food_code', 'name', 'category', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'];
export const USDA_PORTIONS_HEADER: readonly string[] = ['food_code', 'seq', 'description', 'grams'];

/** USDA's nutrient names for the five values FitSphere keeps, and their units. */
const NUTRIENTS = [
  ['kcal', 'Energy', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbohydrate, by difference', 'g'],
  ['fat', 'Total lipid (fat)', 'g'],
  ['fibre', 'Fiber, total dietary', 'g'],
] as const;

type FnddsFood = {
  foodCode?: string | number;
  description?: string;
  wweiaFoodCategory?: { wweiaFoodCategoryDescription?: string };
  foodNutrients?: { nutrient?: { name?: string; unitName?: string }; amount?: number }[];
  foodPortions?: { portionDescription?: string; gramWeight?: number; sequenceNumber?: number }[];
};

/**
 * Whether a USDA serving is left out (MVP default): one with no quantity, or counted in ounces or
 * cubic inches ("1 oz", "per fl oz of beverage"), as India uses metric measures. A cup or bottle
 * that only names its ounces ("1 cup (8 fl oz)") stays: its grams are shown.
 */
export function skippedPortion(description: string): boolean {
  return (
    /quantity not specified/i.test(description) ||
    /^\s*[\d./]+\s*(fl\s*)?oz\b/i.test(description) ||
    /\bper (fl\s*)?oz\b/i.test(description) ||
    /cubic inch/i.test(description)
  );
}

/** The name a serving is offered under: "1 medium or regular slice" becomes "Medium or regular slice". */
export function portionLabel(description: string): string {
  const text = description.trim().replace(/^1\s+/, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The CSV rows, headers first, for USDA's FNDDS JSON download (`{ SurveyFoods: [...] }`). A food
 * without all five values is left out, and so are the servings `skippedPortion` names, those over
 * 2,000 g, those whose name is over 80 characters, and a second serving with the same name. Values
 * are rounded to two decimals.
 */
export function convertFndds(json: unknown): { foods: string[][]; portions: string[][]; skipped: string[] } {
  const surveyFoods = (json as { SurveyFoods?: FnddsFood[] }).SurveyFoods;
  if (!Array.isArray(surveyFoods)) throw new FoodListError('Not an FNDDS download: no SurveyFoods list');
  const foods: string[][] = [[...USDA_FOODS_HEADER]];
  const portions: string[][] = [[...USDA_PORTIONS_HEADER]];
  const skipped: string[] = [];
  const codes = new Set<string>();
  for (const food of surveyFoods) {
    const code = String(food.foodCode ?? '');
    const name = (food.description ?? '').trim();
    const values = NUTRIENTS.map(([, nutrient, unit]) => {
      const found = food.foodNutrients?.find((entry) => entry.nutrient?.name === nutrient && entry.nutrient.unitName === unit);
      return typeof found?.amount === 'number' ? found.amount : null;
    });
    if (!/^\d{8}$/.test(code) || !name || codes.has(code) || values.some((value) => value === null)) {
      skipped.push(name || code);
      continue;
    }
    codes.add(code);
    foods.push([code, name, food.wweiaFoodCategory?.wweiaFoodCategoryDescription ?? '', ...values.map((value) => decimal(value!))]);
    const labels = new Set<string>();
    const sorted = [...(food.foodPortions ?? [])].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
    for (const portion of sorted) {
      const description = (portion.portionDescription ?? '').trim();
      const grams = portion.gramWeight ?? 0;
      const label = portionLabel(description);
      if (!description || skippedPortion(description) || grams <= 0 || grams > MEAL_ITEM_GRAMS_MAX) continue;
      if (label.length > SERVING_LABEL_MAX || labels.has(label)) continue;
      labels.add(label);
      portions.push([code, String(labels.size), description, decimal(grams)]);
    }
  }
  return { foods, portions, skipped };
}

/** A number with at most two decimals, without trailing zeros. */
function decimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export type ImportedPortion = { code: string; seq: number; label: string; grams: number };

/**
 * A food list kept as two CSV files in these columns, its foods per 100 g and their servings: USDA's,
 * and INDB's recipes (D-46), whose values are all estimated.
 */
export type ServingList = { name: string; code: RegExp; codeRule: string; estimated: boolean };

const USDA_LIST: ServingList = { name: 'USDA', code: /^\d{8}$/, codeRule: '8 digits', estimated: false };
const NUMBER = /^\d{1,4}(\.\d{1,2})?$/;

/** Parses and checks both files whole; any problem refuses all of it, naming the file and line. */
export function readUsdaCsv(foodsText: string, portionsText: string): { foods: ImportedFood[]; portions: ImportedPortion[] } {
  return readServingListCsv(USDA_LIST, foodsText, portionsText);
}

/** Reads one list's two files, as `readUsdaCsv` does USDA's. */
export function readServingListCsv(
  list: ServingList,
  foodsText: string,
  portionsText: string,
): { foods: ImportedFood[]; portions: ImportedPortion[] } {
  const [foodsHeader, ...foodRows] = parseCsv(foodsText);
  if (foodsHeader?.join(',') !== USDA_FOODS_HEADER.join(',')) throw new FoodListError(`${list.name} foods: the header is not as expected`);
  const foods = foodRows.map((row, index): ImportedFood => {
    const line = `${list.name} foods, line ${index + 2}`;
    const [code = '', name = '', category = '', kcal = '', protein = '', carbs = '', fat = '', fibre = ''] = row;
    if (row.length !== USDA_FOODS_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    if (!list.code.test(code)) throw new FoodListError(`${line}: the food code is not ${list.codeRule}`);
    if (!name.trim()) throw new FoodListError(`${line}: no name`);
    if (![kcal, protein, carbs, fat, fibre].every((value) => NUMBER.test(value))) throw new FoodListError(`${line}: a value is not a number`);
    // Pure fats pass 900 kcal by USDA's factors (lard: 902).
    if (Number(kcal) > 1_000 || [protein, carbs, fat, fibre].some((value) => Number(value) > 100)) {
      throw new FoodListError(`${line}: a value is more than 100 g, or 1,000 kcal, per 100 g`);
    }
    return {
      code,
      name: name.trim(),
      foodGroup: category,
      proteinG: protein,
      fibreG: fibre,
      fatG: fat,
      carbsG: carbs,
      kcal,
      kcalSource: 'published',
      estimated: list.estimated,
      needsReview: false,
      hidden: false,
      note: null,
      aliases: [],
    };
  });
  const codes = new Set(foods.map((food) => food.code));
  if (codes.size !== foods.length) throw new FoodListError(`${list.name} foods: a food code appears twice`);

  const [portionsHeader, ...portionRows] = parseCsv(portionsText);
  if (portionsHeader?.join(',') !== USDA_PORTIONS_HEADER.join(',')) throw new FoodListError(`${list.name} portions: the header is not as expected`);
  const seen = new Set<string>();
  const portions = portionRows.map((row, index): ImportedPortion => {
    const line = `${list.name} portions, line ${index + 2}`;
    const [code = '', seq = '', description = '', grams = ''] = row;
    if (row.length !== USDA_PORTIONS_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    if (!codes.has(code)) throw new FoodListError(`${line}: no food with this code`);
    if (!/^\d{1,2}$/.test(seq) || !NUMBER.test(grams) || Number(grams) <= 0 || Number(grams) > MEAL_ITEM_GRAMS_MAX) {
      throw new FoodListError(`${line}: the order or the grams are not as expected`);
    }
    const label = portionLabel(description);
    if (!label || label.length > SERVING_LABEL_MAX || skippedPortion(description)) throw new FoodListError(`${line}: the serving's name`);
    if (seen.has(`${code} ${label}`)) throw new FoodListError(`${line}: the same serving twice`);
    seen.add(`${code} ${label}`);
    return { code, seq: Number(seq), label, grams: Number(grams) };
  });
  return { foods, portions };
}
