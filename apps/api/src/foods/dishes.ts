// Reads docs/data/standard-recipe-sheet.csv, FitSphere's standard-recipe sheet (D-26 answer 3,
// amended 2026-10-30; D-28), and works out each approved dish's values for one portion: IFCT values
// per 100 g × the measured grams. The whole sheet is checked first; any problem refuses all of it,
// naming the line. Why each rule exists: docs/data/food-list-sources.md, "Dishes".
import {
  MEAL_ITEM_KCAL_MAX,
  MEAL_ITEM_NUTRIENT_MAX,
  MEAL_ITEM_PORTIONS_MAX,
  type DishPortionUnit,
} from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { FoodListError, type ImportedFood } from './ifct.ts';

const SLOTS = [1, 2, 3, 4, 5, 6] as const;

export const RECIPE_SHEET_HEADER: readonly string[] = [
  'code',
  'dish',
  'portion_unit',
  'status',
  ...SLOTS.flatMap((slot) => [`ingredient_${slot}`, `ifct_code_${slot}`, `raw_g_per_portion_${slot}`]),
  'oil_or_ghee',
  'oil_or_ghee_ifct_code',
  'oil_or_ghee_g_per_portion',
  'cooked_g_per_piece',
  'pieces_per_batch',
  'katoris_per_batch',
  'measured_by',
  'date',
  'notes',
];

/**
 * `approved`: the owner's OK, so the dish is imported; it must then be complete. `pending`: not yet
 * measured or approved, so it stays hidden. `blocked`: must stay empty (D-28: the chicken curry,
 * until IFCT's poultry values are confirmed raw).
 */
export const RECIPE_STATUSES = ['pending', 'approved', 'blocked'] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

const PORTION_UNITS: Readonly<Record<string, DishPortionUnit>> = { piece: 'piece', 'katori (200 ml)': 'katori' };

/**
 * IFCT entries whose values are for the whole cooked item, used per gram of the cooked item (D-26
 * answer 3: "Exception, cooked IFCT entries"). The omelette, M007, is not one (D-26: its oil is
 * unknown).
 */
export const COOKED_IFCT_ENTRIES: ReadonlySet<string> = new Set(['M004']);

/** IFCT's poultry rows (group N) are not confirmed raw, so no approved recipe may use them (D-28). */
const UNCONFIRMED_GROUP = 'N';

/** One portion holds at most this much, so 10 portions still fit one meal item. */
const PORTION_KCAL_MAX = MEAL_ITEM_KCAL_MAX / MEAL_ITEM_PORTIONS_MAX;
const PORTION_NUTRIENT_MAX = MEAL_ITEM_NUTRIENT_MAX / MEAL_ITEM_PORTIONS_MAX;

const CODE = /^[a-z][a-z0-9_]{1,40}$/;
/** Grams and katoris: up to four digits and two decimals. */
const AMOUNT = /^\d{1,4}(\.\d{1,2})?$/;
const GRAMS_MAX = 1_000;
const PIECES = /^\d{1,3}$/;
const PIECES_MAX = 500;
const KATORIS_MAX = 100;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FAT_CODE = /^T\d{3}$/;

/** A dish's values for one portion, rounded to hundredths; always estimated. */
export type ImportedDish = {
  code: string;
  name: string;
  portionUnit: DishPortionUnit;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
};

export type RecipeSheet = {
  /** The approved rows, which are imported. */
  dishes: ImportedDish[];
  /** The codes of the rows left out: not yet approved, or blocked. */
  pending: string[];
  blocked: string[];
};

type Cells = Record<string, string>;
type Part = { food: ImportedFood; hundredthsOfGram: number };

/** Parses and checks the whole sheet against the IFCT list; any problem refuses all of it. */
export function readRecipeSheet(text: string, foods: readonly ImportedFood[]): RecipeSheet {
  const [header, ...rows] = parseCsv(text);
  if (!header || header.join(',') !== RECIPE_SHEET_HEADER.join(',')) {
    throw new FoodListError(`The recipe sheet's header must be: ${RECIPE_SHEET_HEADER.join(',')}`);
  }
  const byCode = new Map(foods.map((food) => [food.code, food]));
  const codes = new Set<string>();
  const names = new Set<string>();
  const sheet: RecipeSheet = { dishes: [], pending: [], blocked: [] };

  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Recipe sheet line ${index + 2}: ${problem}`);
    };
    // A spreadsheet may leave rows with no values at all; they hold no recipe.
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== RECIPE_SHEET_HEADER.length) fail(`expected ${RECIPE_SHEET_HEADER.length} fields, found ${row.length}`);
    const cells: Cells = Object.fromEntries(RECIPE_SHEET_HEADER.map((name, column) => [name, row[column]!.trim()]));

    const code = cells.code!;
    if (!CODE.test(code)) fail('the code must be 2 to 41 lowercase letters, digits or _, starting with a letter');
    if (codes.has(code)) fail(`the code ${code} appears twice`);
    codes.add(code);
    const name = cells.dish!;
    if (name === '' || name.length > 120) fail('the dish name must be 1 to 120 characters');
    if (names.has(name.toLowerCase())) fail(`the dish "${name}" appears twice`);
    names.add(name.toLowerCase());
    const portionUnit = PORTION_UNITS[cells.portion_unit!] ?? fail('portion_unit must be "piece" or "katori (200 ml)"');
    const status = (RECIPE_STATUSES as readonly string[]).includes(cells.status!)
      ? (cells.status as RecipeStatus)
      : fail('status must be pending, approved or blocked');

    checkCells(cells, byCode, fail);

    if (status === 'blocked') {
      if (measurementCells(cells).some((value) => value !== '')) {
        fail(`${code} is blocked (DO NOT FILL): its grams, counts, measured_by and date must stay empty`);
      }
      sheet.blocked.push(code);
    } else if (status === 'pending') {
      sheet.pending.push(code);
    } else {
      sheet.dishes.push(approvedDish(code, name, portionUnit, cells, byCode, fail));
    }
  });
  return sheet;
}

/** Checks every row, whatever its status: well-formed numbers, and IFCT codes under their names. */
function checkCells(cells: Cells, byCode: ReadonlyMap<string, ImportedFood>, fail: (problem: string) => never) {
  for (const slot of SLOTS) {
    const code = cells[`ifct_code_${slot}`]!;
    const name = cells[`ingredient_${slot}`]!;
    if (code !== '') {
      const food = byCode.get(code) ?? fail(`ifct_code_${slot}: ${code} is not in the IFCT list`);
      if (food.name !== name) fail(`ifct_code_${slot}: ${code} is "${food.name}" in the IFCT list, not "${name}"`);
    }
    gramsOf(cells[`raw_g_per_portion_${slot}`]!, `raw_g_per_portion_${slot}`, fail);
  }
  const fatCode = cells.oil_or_ghee_ifct_code!;
  if (fatCode !== '' && (!FAT_CODE.test(fatCode) || !byCode.has(fatCode))) {
    fail(`oil_or_ghee_ifct_code: ${fatCode} is not an oil or fat in the IFCT list (T001 to T014)`);
  }
  gramsOf(cells.oil_or_ghee_g_per_portion!, 'oil_or_ghee_g_per_portion', fail);
  gramsOf(cells.cooked_g_per_piece!, 'cooked_g_per_piece', fail);
  const pieces = cells.pieces_per_batch!;
  if (pieces !== '' && (!PIECES.test(pieces) || Number(pieces) < 1 || Number(pieces) > PIECES_MAX)) {
    fail(`pieces_per_batch must be a whole number from 1 to ${PIECES_MAX}`);
  }
  const katoris = cells.katoris_per_batch!;
  if (katoris !== '' && (!AMOUNT.test(katoris) || Number(katoris) <= 0 || Number(katoris) > KATORIS_MAX)) {
    fail(`katoris_per_batch must be more than 0 and at most ${KATORIS_MAX}, with at most two decimals`);
  }
  if (cells.date !== '' && !isCalendarDate(cells.date!)) fail('date must be a real date, as YYYY-MM-DD');
}

/** The cells a measurement fills; a blocked row must keep them empty. */
function measurementCells(cells: Cells): string[] {
  return [
    ...SLOTS.map((slot) => cells[`raw_g_per_portion_${slot}`]!),
    cells.oil_or_ghee_g_per_portion!,
    cells.cooked_g_per_piece!,
    cells.pieces_per_batch!,
    cells.katoris_per_batch!,
    cells.measured_by!,
    cells.date!,
  ];
}

/** An approved row must be complete; its values are worked out for one portion. */
function approvedDish(
  code: string,
  name: string,
  portionUnit: DishPortionUnit,
  cells: Cells,
  byCode: ReadonlyMap<string, ImportedFood>,
  fail: (problem: string) => never,
): ImportedDish {
  if (cells.measured_by === '') fail('an approved row needs measured_by');
  if (cells.date === '') fail('an approved row needs the date it was measured');
  if (portionUnit === 'piece') {
    if (cells.pieces_per_batch === '') fail('an approved piece dish needs pieces_per_batch');
    if (cells.katoris_per_batch !== '') fail('a piece dish leaves katoris_per_batch empty');
  } else {
    if (cells.katoris_per_batch === '') fail('an approved katori dish needs katoris_per_batch');
    if (cells.pieces_per_batch !== '') fail('a katori dish leaves pieces_per_batch empty');
  }

  const listed = SLOTS.map((slot) => ({
    slot,
    name: cells[`ingredient_${slot}`]!,
    code: cells[`ifct_code_${slot}`]!,
    grams: cells[`raw_g_per_portion_${slot}`]!,
  })).filter((ingredient) => ingredient.name !== '' || ingredient.code !== '' || ingredient.grams !== '');
  const fat = { name: cells.oil_or_ghee!, code: cells.oil_or_ghee_ifct_code!, grams: cells.oil_or_ghee_g_per_portion! };
  const usesFat = fat.name !== '' || fat.code !== '' || fat.grams !== '';
  const parts: Part[] = [];

  if (cells.cooked_g_per_piece !== '') {
    // The exception for an IFCT cooked entry: its value per gram of the cooked item.
    const [only] = listed;
    if (portionUnit !== 'piece') fail('cooked_g_per_piece is only for a piece dish');
    if (listed.length !== 1 || !only || !COOKED_IFCT_ENTRIES.has(only.code)) {
      fail(`cooked_g_per_piece needs exactly one ingredient, an IFCT cooked entry (${[...COOKED_IFCT_ENTRIES].join(', ')})`);
    }
    if (only!.grams !== '') fail(`with cooked_g_per_piece, leave raw_g_per_portion_${only!.slot} empty`);
    if (usesFat) fail('a dish from an IFCT cooked entry takes no oil or ghee');
    parts.push({ food: byCode.get(only!.code)!, hundredthsOfGram: gramsOf(cells.cooked_g_per_piece!, 'cooked_g_per_piece', fail)! });
  } else {
    if (listed.length === 0) fail('an approved row needs at least one ingredient');
    for (const ingredient of listed) {
      if (ingredient.name === '' || ingredient.code === '' || ingredient.grams === '') {
        fail(`ingredient ${ingredient.slot} needs its name, IFCT code and raw grams; remove an ingredient that is not used`);
      }
      if (COOKED_IFCT_ENTRIES.has(ingredient.code)) {
        fail(`${ingredient.code} is a cooked IFCT entry: give its cooked grams in cooked_g_per_piece`);
      }
      parts.push({
        food: byCode.get(ingredient.code)!,
        hundredthsOfGram: gramsOf(ingredient.grams, `raw_g_per_portion_${ingredient.slot}`, fail)!,
      });
    }
    if (usesFat) {
      if (fat.code === '' || fat.grams === '') {
        fail('give the oil or ghee its IFCT code and grams, or leave all three oil/ghee cells empty');
      }
      parts.push({ food: byCode.get(fat.code)!, hundredthsOfGram: gramsOf(fat.grams, 'oil_or_ghee_g_per_portion', fail)! });
    }
  }

  for (const { food } of parts) {
    if (food.hidden) fail(`${food.code} is hidden until it is checked against the IFCT book`);
    if (food.code.startsWith(UNCONFIRMED_GROUP)) fail(`${food.code}: IFCT's poultry values are not confirmed raw (D-28)`);
  }
  const dish: ImportedDish = {
    code,
    name,
    portionUnit,
    kcal: forPortion(parts, (food) => food.kcal),
    proteinG: forPortion(parts, (food) => food.proteinG),
    carbsG: forPortion(parts, (food) => food.carbsG),
    fatG: forPortion(parts, (food) => food.fatG),
    fibreG: forPortion(parts, (food) => food.fibreG),
  };
  if (dish.kcal > PORTION_KCAL_MAX) fail(`one portion would have ${dish.kcal} kcal, more than ${PORTION_KCAL_MAX}: check the grams`);
  for (const value of [dish.proteinG, dish.carbsG, dish.fatG, dish.fibreG]) {
    if (value > PORTION_NUTRIENT_MAX) fail(`one portion would have ${value} g of a nutrient, more than ${PORTION_NUTRIENT_MAX}: check the grams`);
  }
  return dish;
}

/** Grams with at most two decimals, more than 0, in hundredths of a gram; null when empty. */
function gramsOf(text: string, column: string, fail: (problem: string) => never): number | null {
  if (text === '') return null;
  if (!AMOUNT.test(text) || Number(text) <= 0 || Number(text) > GRAMS_MAX) {
    fail(`${column} must be more than 0 and at most ${GRAMS_MAX} g, with at most two decimals`);
  }
  return Math.round(Number(text) * 100);
}

/**
 * The sum of value per 100 g × grams over the parts, rounded once to hundredths. Values (two
 * decimals) and grams are taken in hundredths, so the sum is an exact whole number.
 */
function forPortion(parts: readonly Part[], valueOf: (food: ImportedFood) => string): number {
  const sum = parts.reduce((total, part) => total + Number(valueOf(part.food).replace('.', '')) * part.hundredthsOfGram, 0);
  return Math.round(sum / 10_000) / 100;
}

/** A real date written YYYY-MM-DD; also used by the household-measures sheet. */
export function isCalendarDate(text: string): boolean {
  const match = DATE.exec(text);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
