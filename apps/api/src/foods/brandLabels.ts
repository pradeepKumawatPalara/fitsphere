// Reads docs/data/brand-labels-sheet.csv, FitSphere's brand-labels sheet (D-49): packaged Indian
// foods with the values their brands publish on their labels, each row with the official page it was
// read from. A row is `proposed` until the owner approves it; only approved rows reach the food list,
// as source `brand_label`, with their serving. The whole sheet is checked first; any problem refuses
// all of it, naming the line.
//
// Since D-52 a row may also come from a shop's listing of the product or from the owner's files made
// with another AI tool; its `flag` column is empty or `scrap`, a mark kept on the server only
// (app.foods.flag), never sent to the phone, that nothing reads yet. Since D-53 a row may hold an AI
// tool's estimate from its general knowledge, approved by the owner: flagged `llm`, with no page.
//
// Since D-55 a row may give search words, separated by semicolons ("whole wheat atta; gehu atta"):
// the everyday names of what the product is, kept as the food's aliases after its brand, so a search
// for the item finds every brand whatever its pack calls it. They are never shown.
import { MEAL_ITEM_GRAMS_MAX, SERVING_LABEL_MAX } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { isCalendarDate } from './dishes.ts';
import { FOOD_FLAGS, FoodListError, type FoodFlag, type ImportedFood } from './ifct.ts';
import { portionLabel, type ImportedPortion } from './usda.ts';

export const BRAND_LABEL_SOURCE = 'brand_label';

export const BRAND_LABELS_HEADER: readonly string[] = [
  'code',
  'brand',
  'product',
  'status',
  'basis',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fibre_g',
  'serving',
  'serving_grams',
  'source_url',
  'read_on',
  'notes',
  'flag',
  'search_words',
];

/** Search words (D-55): letters, digits, spaces and ' & -, at most 60 characters each, at most 12 a row. */
const SEARCH_WORD = /^[\p{L}\p{N}][\p{L}\p{N} '&-]{0,59}$/u;
const SEARCH_WORDS_MAX = 12;

/** `proposed`: read from the brand's page, waiting for the owner's OK, not imported. `approved`: imported. */
export const BRAND_LABEL_STATUSES = ['proposed', 'approved'] as const;

/** Per 100 g, or per 100 ml for a drink, taken as 100 g. */
export const BRAND_LABEL_BASES = ['100 g', '100 ml'] as const;

const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VALUE = /^\d{1,4}(\.\d{1,2})?$/;

export type BrandLabelsSheet = {
  /** The approved rows, as food-list items. */
  foods: ImportedFood[];
  /** Their servings, one each where the label gives it in grams or ml. */
  portions: ImportedPortion[];
  /** How many rows wait for the owner's OK. */
  proposed: number;
};

/** The name a product is listed under: its brand, then the product, unless the product already starts with the brand. */
export function brandLabelName(brand: string, product: string): string {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}

/** Parses and checks the whole sheet; any problem refuses all of it. */
export function readBrandLabelsSheet(text: string): BrandLabelsSheet {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== BRAND_LABELS_HEADER.join(',')) {
    throw new FoodListError(`The brand-labels sheet's header must be: ${BRAND_LABELS_HEADER.join(',')}`);
  }
  const sheet: BrandLabelsSheet = { foods: [], portions: [], proposed: 0 };
  const codes = new Set<string>();
  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Brand-labels sheet line ${index + 2}: ${problem}`);
    };
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== BRAND_LABELS_HEADER.length) fail(`expected ${BRAND_LABELS_HEADER.length} fields, found ${row.length}`);
    const cell = Object.fromEntries(BRAND_LABELS_HEADER.map((name, column) => [name, row[column]!.trim()])) as Record<string, string>;

    const code = cell.code!;
    if (!CODE.test(code) || code.length > 64) fail('code must be lowercase letters and digits joined by hyphens, at most 64');
    if (codes.has(code)) fail(`${code} appears twice`);
    codes.add(code);
    const brand = cell.brand!;
    const product = cell.product!;
    if (!brand || brand.length > 60 || !product || brand.length + product.length + 1 > 120) fail('brand and product must be given, the name at most 120');
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
    // As for packaged foods (D-48): 4 kcal a gram of protein and carbohydrate, 9 of fat, within a
    // quarter or 20 kcal; catches a value copied into the wrong column.
    const computed = 4 * protein + 4 * carbs + 9 * fat;
    if (Math.abs(kcal - computed) > Math.max(20, 0.25 * Math.max(kcal, computed))) {
      fail(`kcal ${kcal} does not agree with protein, carbs and fat (${Math.round(computed)} kcal)`);
    }

    const serving = cell.serving!;
    const servingGrams = cell.serving_grams!;
    if ((serving === '') !== (servingGrams === '')) fail('serving and serving_grams go together');
    if (servingGrams !== '' && (!VALUE.test(servingGrams) || Number(servingGrams) <= 0 || Number(servingGrams) > MEAL_ITEM_GRAMS_MAX)) {
      fail('serving_grams must be more than 0 and at most 2,000');
    }
    const label = serving === '' ? '' : portionLabel(serving);
    if (label.length > SERVING_LABEL_MAX) fail(`serving must be at most ${SERVING_LABEL_MAX} characters`);
    const flag = cell.flag!;
    if (flag !== '' && !(FOOD_FLAGS as readonly string[]).includes(flag)) fail(`flag must be empty or ${FOOD_FLAGS.join(' or ')}`);
    // An AI tool's estimate (D-53) was read from no page; every other row names its page.
    const noPage = flag === 'llm' && cell.source_url === '';
    if (!noPage && !/^https:\/\/\S+$/.test(cell.source_url!)) fail('source_url must be the https address of the brand’s page');
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
    sheet.foods.push({
      code,
      name: brandLabelName(brand, product),
      foodGroup: brand,
      proteinG: cell.protein_g!,
      fibreG: cell.fibre_g === '' ? null : cell.fibre_g!,
      fatG: cell.fat_g!,
      carbsG: cell.carbs_g!,
      kcal: cell.kcal!,
      kcalSource: 'published',
      estimated: false,
      needsReview: false,
      hidden: false,
      note: null,
      aliases: [brand, ...searchWords],
      ...(flag === '' ? {} : { flag: flag as FoodFlag }),
    });
    if (label) sheet.portions.push({ code, seq: 1, label, grams: Number(servingGrams) });
  });
  return sheet;
}
