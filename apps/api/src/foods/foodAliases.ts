// Reads docs/data/food-aliases-sheet.csv, FitSphere's sheet of other names (D-94): the other names the
// owner's food database (Indian_Food_Database_CONSOLIDATED.xlsx, kept outside the repository) gives its
// foods, each row a food of FitSphere's list or a packaged food it matched, made by
// `npm run consolidated:convert`. `foods:import` adds them to the food's other names (app.foods.aliases,
// app.packaged_foods.aliases): a name the food already has, as its name or another name, is not added
// again (ignoring case, accents and marks), and a food the sheet does not name keeps its other names as
// they are. Search foods finds a food by them; they are never shown. The whole sheet is checked first;
// any problem refuses all of it, naming the line.
import type { PackagedFood } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';

export const FOOD_ALIASES_HEADER: readonly string[] = ['source', 'code', 'name', 'aliases'];

/** The packaged foods' rows give their barcode as the code. */
export const PACKAGED_ALIAS_SOURCE = 'packaged';

/** The kinds of food a row may give other names to. */
export const FOOD_ALIAS_SOURCES = ['ifct2017', 'indb', 'home', 'dish_estimate', PACKAGED_ALIAS_SOURCE] as const;
export type FoodAliasSource = (typeof FOOD_ALIAS_SOURCES)[number];

/** An other name: letters, marks, digits, spaces and ' & -, starting with a letter or digit. */
export const ALIAS = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '&-]{0,199}$/u;
/** At most this many other names in a row. */
export const ALIASES_MAX = 40;

export type FoodAliasRow = {
  source: FoodAliasSource;
  code: string;
  /** The food's name when the sheet was made: checked again for the food list's foods. */
  name: string;
  aliases: string[];
};

/** Parses and checks the whole sheet; any problem refuses all of it. */
export function readFoodAliases(text: string): FoodAliasRow[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== FOOD_ALIASES_HEADER.join(',')) {
    throw new FoodListError(`The other-names sheet's header must be: ${FOOD_ALIASES_HEADER.join(',')}`);
  }
  const seen = new Set<string>();
  const read: FoodAliasRow[] = [];
  rows.forEach((row, index) => {
    const fail = (problem: string): never => {
      throw new FoodListError(`Other-names sheet line ${index + 2}: ${problem}`);
    };
    if (row.every((value) => value.trim() === '')) return;
    if (row.length !== FOOD_ALIASES_HEADER.length) fail(`expected ${FOOD_ALIASES_HEADER.length} fields, found ${row.length}`);
    const [source, code, name, aliases] = row.map((value) => value.trim()) as [string, string, string, string];
    if (!(FOOD_ALIAS_SOURCES as readonly string[]).includes(source)) fail(`source must be ${FOOD_ALIAS_SOURCES.join(', ')}`);
    if (source === PACKAGED_ALIAS_SOURCE ? !/^[0-9]{8,14}$/.test(code) : !/^[A-Za-z0-9-]{1,64}$/.test(code)) {
      fail(source === PACKAGED_ALIAS_SOURCE ? 'code must be the barcode, 8 to 14 digits' : 'code must be the food’s code');
    }
    if (seen.has(`${source} ${code}`)) fail(`${source} ${code} appears twice`);
    seen.add(`${source} ${code}`);
    if (!name || name.length > 120) fail('name must be given, at most 120 characters');
    const list = aliases.split(';').map((alias) => alias.trim());
    if (aliases === '' || list.length > ALIASES_MAX || !list.every((alias) => ALIAS.test(alias))) {
      fail(`aliases must be 1 to ${ALIASES_MAX} names separated by semicolons, each at most 200 letters, digits, spaces or ' & -`);
    }
    if (new Set(list.map(aliasKey)).size !== list.length) fail('aliases gives a name twice');
    read.push({ source: source as FoodAliasSource, code, name, aliases: list });
  });
  return read;
}

/** A name as compared for being the same: lowercase, without accents or marks, one space between words. */
export function aliasKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘`´.]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}%]+/gu, ' ')
    .trim();
}

/**
 * The other names a food has, with the new ones it lacks after them: none of them already one of its
 * `names` (its name, a product's brand) or other names.
 */
function joined(names: readonly string[], aliases: readonly string[], more: readonly string[]): { aliases: string[]; added: number } {
  const known = new Set([...names, ...aliases].map(aliasKey));
  const added = more.filter((alias) => {
    const key = aliasKey(alias);
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return { aliases: [...aliases, ...added], added: added.length };
}

export type WithAliases<T> = {
  foods: T[];
  /** How many foods were given at least one new other name. */
  named: number;
  /** How many other names were added in all. */
  added: number;
  /** The sheet's rows for this kind of food whose food is not listed. */
  missing: number;
};

/**
 * The foods of one source of the food list with the sheet's other names added (D-94). A row whose food
 * is listed under another name is refused: the sheet is made again (`consolidated:convert`).
 */
export function withAliases<T extends { code: string; name: string; aliases: string[] }>(
  foods: readonly T[],
  source: FoodAliasSource,
  rows: readonly FoodAliasRow[],
): WithAliases<T> {
  const bySource = new Map(rows.filter((row) => row.source === source).map((row) => [row.code, row]));
  let named = 0;
  let added = 0;
  const found = new Set<string>();
  const result = foods.map((food) => {
    const row = bySource.get(food.code);
    if (!row) return food;
    found.add(food.code);
    if (row.name !== food.name) {
      throw new FoodListError(`Other-names sheet: ${source} ${food.code} is now named "${food.name}", not "${row.name}"; make the sheet again`);
    }
    const next = joined([food.name], food.aliases, row.aliases);
    if (next.added === 0) return food;
    named += 1;
    added += next.added;
    return { ...food, aliases: next.aliases };
  });
  return { foods: result, named, added, missing: bySource.size - found.size };
}

/**
 * The packaged foods with the sheet's other names added (D-94), by barcode: a product's name may change
 * after the sheet is made (D-80, D-89), so it is not compared.
 */
export function withPackagedAliases(foods: readonly PackagedFood[], rows: readonly FoodAliasRow[]): WithAliases<PackagedFood> {
  const byBarcode = new Map(rows.filter((row) => row.source === PACKAGED_ALIAS_SOURCE).map((row) => [row.code, row]));
  let named = 0;
  let added = 0;
  const found = new Set<string>();
  const result = foods.map((food) => {
    const row = byBarcode.get(food.barcode);
    if (!row) return food;
    found.add(food.barcode);
    const next = joined([food.name, food.brand ?? ''], food.aliases ?? [], row.aliases);
    if (next.added === 0) return food;
    named += 1;
    added += next.added;
    return { ...food, aliases: next.aliases };
  });
  return { foods: result, named, added, missing: byBarcode.size - found.size };
}
