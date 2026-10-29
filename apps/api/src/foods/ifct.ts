// Reads data/foods/ifct2017-foods.csv into the rows of app.foods (ADR-0006 rule 1; D-25, D-26).
// How the file was made and checked, and why each rule below exists: docs/data/food-list-sources.md.
import { parseCsv } from './csv.ts';

export class FoodListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FoodListError';
  }
}

export const IFCT_SOURCE = 'ifct2017';

export const IFCT_HEADER = [
  'code',
  'name',
  'food_group',
  'protein_g',
  'fibre_g',
  'fat_g',
  'carbs_g',
  'kcal',
  'kcal_source',
  'needs_review',
  'note',
] as const;

/**
 * Energy for the oils and fats, for which IFCT publishes no energy value: the Atwater general
 * factor for fat, 37 kJ/g (9.0 kcal/g), FAO Food and Nutrition Paper 77 (2003), section 3.5.1.
 * Marked "estimated" (D-26).
 */
export const FAT_KCAL_PER_G = 9;

/**
 * Rows whose published energy disagrees with their own macronutrients (the source PDF's appendix).
 * They stay in the table but are left out of search until checked against the IFCT 2017 book
 * (MVP default, D-26 plan). The oils and fats in the same appendix get estimated energy instead.
 */
export const HIDDEN_UNTIL_CHECKED: ReadonlySet<string> = new Set(['N001', 'Q001', 'S007']);

/** Correct spellings for names kept as printed (food-list-sources.md, "Notes on the data"). */
export const ALIASES: Readonly<Record<string, readonly string[]>> = {
  E021: ['Gooseberry'],
  H006: ['Coconut, kernel, dry'],
  M007: ['Egg, poultry, omelette'],
  M010: ['Egg, country hen, omelette'],
  M013: ['Egg, duck, whole, omelette'],
  M014: ['Egg, quail, whole, raw'],
  M015: ['Egg, quail, whole, boiled'],
};

export type KcalSource = 'published' | 'estimated_fat_factor';

export type ImportedFood = {
  code: string;
  name: string;
  foodGroup: string;
  /** Grams per 100 g edible portion, as printed (two decimals). */
  proteinG: string;
  fibreG: string;
  fatG: string;
  carbsG: string;
  /** kcal per 100 g: as printed, or estimated from fat for the oils and fats. */
  kcal: string;
  kcalSource: KcalSource;
  estimated: boolean;
  needsReview: boolean;
  hidden: boolean;
  note: string | null;
  aliases: string[];
};

const CODE = /^[A-T]\d{3}$/;
const GRAMS = /^\d{1,3}\.\d{2}$/;
const PUBLISHED_KCAL = /^\d{1,3}$/;

/** Parses and checks the whole file; any problem refuses all of it, naming the line. */
export function readIfctCsv(text: string): ImportedFood[] {
  const [header, ...rows] = parseCsv(text);
  if (!header || header.join(',') !== IFCT_HEADER.join(',')) {
    throw new FoodListError(`The header must be: ${IFCT_HEADER.join(',')}`);
  }
  if (rows.length === 0) throw new FoodListError('The file has no foods');

  const seen = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const fail = (problem: string): never => {
      throw new FoodListError(`Line ${line}: ${problem}`);
    };
    if (row.length !== IFCT_HEADER.length) fail(`expected ${IFCT_HEADER.length} fields, found ${row.length}`);
    const [code, name, foodGroup, proteinG, fibreG, fatG, carbsG, kcal, kcalSource, needsReview, note] = row as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    if (!CODE.test(code)) fail('the code is not a letter and three digits');
    if (seen.has(code)) fail(`the code ${code} appears twice`);
    seen.add(code);
    if (name.trim() === '' || foodGroup.trim() === '') fail('the name or food group is empty');
    for (const value of [proteinG, fibreG, fatG, carbsG]) {
      if (!GRAMS.test(value)) fail('a gram value is not a number with two decimals');
    }
    if (needsReview !== 'yes' && needsReview !== 'no') fail('needs_review is not yes or no');
    if ((needsReview === 'yes') !== (note !== '')) fail('a note is required exactly when needs_review is yes');

    let energy: { kcal: string; kcalSource: KcalSource; estimated: boolean };
    if (kcalSource === 'published') {
      if (!PUBLISHED_KCAL.test(kcal)) fail('a published kcal is not a whole number');
      energy = { kcal: `${kcal}.00`, kcalSource: 'published', estimated: false };
    } else if (kcalSource === 'not published') {
      if (kcal !== '') fail('kcal must be empty when it is not published');
      energy = { kcal: estimateFatKcal(fatG), kcalSource: 'estimated_fat_factor', estimated: true };
    } else {
      return fail('kcal_source is not "published" or "not published"');
    }

    return {
      code,
      name,
      foodGroup,
      proteinG,
      fibreG,
      fatG,
      carbsG,
      ...energy,
      needsReview: needsReview === 'yes',
      hidden: HIDDEN_UNTIL_CHECKED.has(code),
      note: note === '' ? null : note,
      aliases: [...(ALIASES[code] ?? [])],
    };
  });
}

/** 9 kcal per gram of fat, in exact hundredths, e.g. "100.01" → "900.09". */
function estimateFatKcal(fatG: string): string {
  const hundredths = Number(fatG.replace('.', '')) * FAT_KCAL_PER_G;
  return `${Math.trunc(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}
