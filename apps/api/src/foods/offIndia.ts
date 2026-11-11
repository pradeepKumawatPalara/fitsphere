// Packaged foods sold in India, from Open Food Facts' data export (D-48; ADR-0009): its products
// whose countries include India, with their label values per 100 g, for search by name and brand.
// Kept apart from FitSphere's food list, as ADR-0006 rule 2 keeps Open Food Facts' data apart. Two
// steps, as USDA's and INDB's: `packagedFromRow` judges one row of the export (tab-separated, read
// by `npm run off:convert`), which writes data/foods/off-india-products.csv; `readPackagedCsv` reads
// that file back for `foods:import`.
import { MEAL_ITEM_GRAMS_MAX, type PackagedFood } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';

export const PACKAGED_HEADER: readonly string[] = ['barcode', 'name', 'brand', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'serving_grams'];

/** The export's columns FitSphere reads. */
const COLUMNS = [
  'code',
  'product_name',
  'brands',
  'countries_tags',
  'serving_size',
  'serving_quantity',
  'energy-kcal_100g',
  'energy_100g',
  'proteins_100g',
  'carbohydrates_100g',
  'fat_100g',
  'fiber_100g',
] as const;
export type ExportColumns = Record<(typeof COLUMNS)[number], number>;

/** Where each column FitSphere reads is in the export's header; refuses a header without one. */
export function exportColumns(header: readonly string[]): ExportColumns {
  const at = Object.fromEntries(COLUMNS.map((name) => [name, header.indexOf(name)])) as ExportColumns;
  const missing = COLUMNS.filter((name) => at[name] < 0);
  if (missing.length > 0) throw new FoodListError(`Not Open Food Facts' export: no ${missing.join(', ')} column`);
  return at;
}

/**
 * Whether a barcode names one product everywhere: its last digit is its GS1 check digit (EAN-8,
 * UPC-A, EAN-13, GTIN-14: from the right, the other digits weigh 3 and 1 in turn, and the check digit
 * brings the sum to a multiple of 10), and it is not one of GS1's in-store codes, an EAN-8 starting
 * 0 or 2 or an EAN-13 starting 2, which shops give their own items. Catches a mistyped barcode, and
 * the made-up short codes some products are entered with.
 */
export function validBarcode(barcode: string): boolean {
  if (!BARCODE.test(barcode) || /^0+$/.test(barcode)) return false;
  if ((barcode.length === 8 && /^[02]/.test(barcode)) || (barcode.length === 13 && barcode.startsWith('2'))) return false;
  const digits = [...barcode].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Why a product sold in India is left out. */
export type Skipped = 'barcode' | 'name' | 'values' | 'energy';

const BARCODE = /^\d{8,14}$/;
const NAME_MAX = 120;
const BRAND_MAX = 80;
const KCAL_PER_KJ = 1 / 4.184;

/**
 * One row of the export: null when the product is not sold in India; otherwise the packaged food, or
 * why it is left out (MVP defaults, D-48):
 * - its barcode must be 8 to 14 digits with a right check digit, and its name 1 to 120 characters,
 *   not only digits;
 * - kcal (or kJ ÷ 4.184), protein, carbohydrate and fat per 100 g must be given; fibre may be not;
 *   each nutrient 0 to 100 g, together at most 105 g; kcal at most 1,000;
 * - the energy must agree with the nutrients: 4 kcal a gram of protein and carbohydrate, 9 of fat,
 *   within a quarter or 20 kcal, which catches values typed per serving or in the wrong place;
 * - the brand is the first one named, kept if 80 characters or fewer;
 * - a serving is kept when the label gives it in grams (not millilitres), over 0 and at most 2,000 g.
 * Values are rounded to two decimals.
 */
export function packagedFromRow(columns: ExportColumns, fields: readonly string[]): PackagedFood | Skipped | null {
  const cell = (name: keyof ExportColumns) => (fields[columns[name]] ?? '').trim();
  if (!cell('countries_tags').split(',').includes('en:india')) return null;

  const barcode = cell('code');
  if (!validBarcode(barcode)) return 'barcode';
  const name = cell('product_name').replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX || /^\d+$/.test(name)) return 'name';

  const kcalGiven = number(cell('energy-kcal_100g'));
  const kj = number(cell('energy_100g'));
  const kcal = kcalGiven ?? (kj === null ? null : kj * KCAL_PER_KJ);
  const protein = number(cell('proteins_100g'));
  const carbs = number(cell('carbohydrates_100g'));
  const fat = number(cell('fat_100g'));
  const fibre = number(cell('fiber_100g'));
  if (kcal === null || protein === null || carbs === null || fat === null) return 'values';
  const nutrients = [protein, carbs, fat, ...(fibre === null ? [] : [fibre])];
  if (kcal < 0 || kcal > 1_000 || nutrients.some((value) => value < 0 || value > 100) || protein + carbs + fat > 105) return 'values';
  const computed = 4 * protein + 4 * carbs + 9 * fat;
  if (Math.abs(kcal - computed) > Math.max(20, 0.25 * Math.max(kcal, computed))) return 'energy';

  const brand = cell('brands').split(',')[0]?.trim() ?? '';
  const servingQuantity = number(cell('serving_quantity'));
  const servingGrams =
    servingQuantity !== null && servingQuantity > 0 && servingQuantity <= MEAL_ITEM_GRAMS_MAX && !/\bml\b|millilit/i.test(cell('serving_size'))
      ? round(servingQuantity)
      : null;
  return {
    barcode,
    name,
    brand: brand && brand.length <= BRAND_MAX ? brand : null,
    kcal: round(kcal),
    proteinG: round(protein),
    carbsG: round(carbs),
    fatG: round(fat),
    fibreG: fibre === null ? null : round(fibre),
    servingGrams,
  };
}

/** The CSV row `readPackagedCsv` reads back. */
export function packagedRow(food: PackagedFood): string[] {
  return [
    food.barcode,
    food.name,
    food.brand ?? '',
    String(food.kcal),
    String(food.proteinG),
    String(food.carbsG),
    String(food.fatG),
    food.fibreG === null ? '' : String(food.fibreG),
    food.servingGrams === null ? '' : String(food.servingGrams),
  ];
}

function number(text: string): number | null {
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return null;
  return Number(text);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const VALUE = /^\d{1,4}(\.\d{1,2})?$/;

/**
 * The packaged foods with those of data/foods/off-india-extra.csv added (D-62): products from the
 * owner's dish database (Open Food Facts India, export of 27 October 2026) that FitSphere's own export
 * lacked and that pass the same checks. A barcode in both, ignoring leading zeros, refuses the import.
 */
export function withExtraPackaged(foods: readonly PackagedFood[], extra: readonly PackagedFood[]): PackagedFood[] {
  const key = (barcode: string) => barcode.replace(/^0+/, '');
  const known = new Set(foods.map((food) => key(food.barcode)));
  const twice = extra.find((food) => known.has(key(food.barcode)));
  if (twice) throw new FoodListError(`Packaged foods: barcode ${twice.barcode} is in both files`);
  return [...foods, ...extra];
}

/**
 * docs/data/packaged-name-fixes.csv (D-80): packaged foods reviewed one by one against Open Food Facts'
 * own data, chiefly those whose name was only their brand ("Amul", "English oven"): `keep` (the brand
 * is the product's own name: "Nutella", "Sprite"), `rename` (to the name Open Food Facts gives it as
 * its generic name: Knorr's "Tomato Soup"; with `new_brand` when its name and brand were swapped), or
 * `remove` (a brand of many products, with nothing to tell which this is; or values its own data
 * contradicts, as a sugared cola at 0 kcal). `reason` says why.
 */
export const PACKAGED_NAME_FIXES_HEADER: readonly string[] = ['barcode', 'brand', 'name', 'action', 'new_name', 'new_brand', 'reason'];

export const PACKAGED_NAME_ACTIONS = ['keep', 'rename', 'remove'] as const;

export type PackagedNameFix = {
  barcode: string;
  action: (typeof PACKAGED_NAME_ACTIONS)[number];
  newName: string | null;
  newBrand: string | null;
};

/** Parses and checks the whole sheet; any problem refuses all of it, naming the line. */
export function readPackagedNameFixes(text: string): PackagedNameFix[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== PACKAGED_NAME_FIXES_HEADER.join(',')) {
    throw new FoodListError(`The packaged name fixes' header must be: ${PACKAGED_NAME_FIXES_HEADER.join(',')}`);
  }
  const seen = new Set<string>();
  return rows.map((row, index): PackagedNameFix => {
    const line = `Packaged name fixes, line ${index + 2}`;
    if (row.length !== PACKAGED_NAME_FIXES_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    const [barcode = '', , , action = '', newName = '', newBrand = '', reason = ''] = row.map((cell) => cell.trim());
    if (!validBarcode(barcode) || seen.has(barcode)) throw new FoodListError(`${line}: the barcode is not valid, or appears twice`);
    seen.add(barcode);
    if (!(PACKAGED_NAME_ACTIONS as readonly string[]).includes(action)) throw new FoodListError(`${line}: the action must be keep, rename or remove`);
    if ((action === 'rename') !== (newName !== '')) throw new FoodListError(`${line}: a new name is given with rename, and only then`);
    if (newBrand !== '' && action !== 'rename') throw new FoodListError(`${line}: a new brand is given only with rename`);
    if (newName.length > NAME_MAX || /^\d+$/.test(newName)) throw new FoodListError(`${line}: the new name`);
    if (newBrand.length > BRAND_MAX) throw new FoodListError(`${line}: the new brand`);
    if (!reason) throw new FoodListError(`${line}: the reason must be given`);
    return { barcode, action: action as PackagedNameFix['action'], newName: newName || null, newBrand: newBrand || null };
  });
}

/**
 * The packaged foods with the reviewed names applied (D-80): a renamed food takes its new name (and its
 * new brand when one is given), a removed one is left out of the list (its barcode still scans: a scan
 * asks Open Food Facts through the server, not this list). A fix for a barcode no longer in the list is
 * counted, not applied.
 */
export function withNameFixes(
  foods: readonly PackagedFood[],
  fixes: readonly PackagedNameFix[],
): { foods: PackagedFood[]; renamed: number; removed: number; notFound: number } {
  const byBarcode = new Map(fixes.map((fix) => [fix.barcode, fix]));
  const listed = new Set(foods.map((food) => food.barcode));
  let renamed = 0;
  let removed = 0;
  const fixed = foods.flatMap((food): PackagedFood[] => {
    const fix = byBarcode.get(food.barcode);
    if (fix?.action === 'remove') {
      removed += 1;
      return [];
    }
    if (fix?.action === 'rename' && fix.newName) {
      renamed += 1;
      return [{ ...food, name: fix.newName, brand: fix.newBrand ?? food.brand }];
    }
    return [food];
  });
  return { foods: fixed, renamed, removed, notFound: fixes.filter((fix) => !listed.has(fix.barcode)).length };
}

/** Parses and checks the whole file; any problem refuses all of it, naming the line. */
export function readPackagedCsv(text: string): PackagedFood[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== PACKAGED_HEADER.join(',')) throw new FoodListError('Packaged foods: the header is not as expected');
  const seen = new Set<string>();
  return rows.map((row, index): PackagedFood => {
    const line = `Packaged foods, line ${index + 2}`;
    const [barcode = '', name = '', brand = '', kcal = '', protein = '', carbs = '', fat = '', fibre = '', serving = ''] = row;
    if (row.length !== PACKAGED_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    if (!validBarcode(barcode) || seen.has(barcode)) {
      throw new FoodListError(`${line}: the barcode is not 8 to 14 digits with a right check digit, or appears twice`);
    }
    seen.add(barcode);
    if (!name.trim() || name.length > NAME_MAX || brand.length > BRAND_MAX) throw new FoodListError(`${line}: the name or the brand`);
    if (![kcal, protein, carbs, fat].every((value) => VALUE.test(value)) || [fibre, serving].some((value) => value !== '' && !VALUE.test(value))) {
      throw new FoodListError(`${line}: a value is not a number`);
    }
    if (Number(kcal) > 1_000 || [protein, carbs, fat, fibre].some((value) => Number(value) > 100)) {
      throw new FoodListError(`${line}: a value is more than 100 g, or 1,000 kcal, per 100 g`);
    }
    if (serving !== '' && (Number(serving) <= 0 || Number(serving) > MEAL_ITEM_GRAMS_MAX)) throw new FoodListError(`${line}: the serving's grams`);
    return {
      barcode,
      name: name.trim(),
      brand: brand.trim() || null,
      kcal: Number(kcal),
      proteinG: Number(protein),
      carbsG: Number(carbs),
      fatG: Number(fat),
      fibreG: fibre === '' ? null : Number(fibre),
      servingGrams: serving === '' ? null : Number(serving),
    };
  });
}
