// Turns the owner's consolidated food database (Indian_Food_Database_CONSOLIDATED.xlsx, built on
// 12 November 2026, kept outside the repository, in D:\fitsphere-data) into FitSphere's sheets (D-94):
//
// - docs/data/food-aliases-sheet.csv: the other names its sheets "Dishes", "Branded packaged" and
//   "Generic unbranded" give their foods, for the FitSphere food each one is: a dish by its name (or its
//   name without the part in brackets) among INDB's recipes, the estimated dishes and the home-style
//   foods; a packaged food by its barcode; an IFCT food by its code. A name two foods share is left
//   out, and so is a row with no other names. A dish listed under several base foods gets the other
//   names of each.
// - docs/data/dish-estimates-sheet.csv: the dishes FitSphere lacks. A row held back in D-62 that the
//   file now rates C (most of them "re-checked") is approved with the file's values for it; a dish not
//   in the sheet at all is added, approved when rated C, held when only rated D (a weak match). A held
//   row that was another food already listed (D-62) stays held, and so does one held because its values
//   do not fit the dish when the file gives it the same values again. Every approved row passes the
//   sheet's own checks, or is held with the problem.
// - docs/data/home-foods-sheet.csv: the file's generic foods that are not in IFCT 2017 ("GEN-001" and
//   on), as home-style foods (D-59), flagged `llm`, except those FitSphere already has as the same food
//   in the same form (GENERIC_SAME_AS): their other names go to that food instead.
//
// Running it again on the same files changes nothing more.
import { MEAL_ITEM_GRAMS_MAX } from '@fitsphere/shared';
import { SEARCH_WORD } from './brandLabels.ts';
import { toCsv } from './csv.ts';
import { DISH_ESTIMATES_HEADER, readDishEstimatesSheet } from './dishEstimates.ts';
import { ALIAS, ALIASES_MAX, aliasKey, FOOD_ALIASES_HEADER, PACKAGED_ALIAS_SOURCE, type FoodAliasSource } from './foodAliases.ts';
import { HOME_FOODS_HEADER, readHomeFoodsSheet } from './homeFoods.ts';
import { FoodListError } from './ifct.ts';

/** The workbook's sheets read here. */
export const CONSOLIDATED_SHEETS = { dishes: 'Dishes', packaged: 'Branded packaged', generic: 'Generic unbranded' } as const;

/**
 * The generic foods FitSphere already has as the same food in the same form, with energy within 20 kcal
 * or 15% (checked when the sheets are made): each one's other names go to that food, and it is not added.
 */
export const GENERIC_SAME_AS: Readonly<Record<string, { source: FoodAliasSource; code: string }>> = {
  'GEN-001': { source: 'dish_estimate', code: 'est-curd-plain' },
  'GEN-005': { source: 'dish_estimate', code: 'est-plain-buttermilk' },
  'GEN-006': { source: 'dish_estimate', code: 'est-butter-plain' },
  'GEN-007': { source: 'dish_estimate', code: 'est-white-butter-makhan' },
  'GEN-015': { source: 'dish_estimate', code: 'est-milk-toned' },
  'GEN-016': { source: 'dish_estimate', code: 'est-milk-double-toned' },
  'GEN-019': { source: 'dish_estimate', code: 'est-steamed-rice' },
  'GEN-020': { source: 'dish_estimate', code: 'est-brown-rice' },
  'GEN-026': { source: 'ifct2017', code: 'M004' },
  'GEN-032': { source: 'ifct2017', code: 'A019' },
  'GEN-033': { source: 'ifct2017', code: 'A018' },
  'GEN-034': { source: 'ifct2017', code: 'A022' },
  'GEN-041': { source: 'ifct2017', code: 'A011' },
  'GEN-043': { source: 'ifct2017', code: 'A023' },
  'GEN-045': { source: 'ifct2017', code: 'A009' },
  'GEN-050': { source: 'home', code: 'home-white-bread-slice' },
  'GEN-051': { source: 'home', code: 'home-brown-bread-slice' },
  'GEN-052': { source: 'home', code: 'home-multigrain-bread-slice' },
  'GEN-053': { source: 'dish_estimate', code: 'est-pav' },
  'GEN-061': { source: 'dish_estimate', code: 'est-honey-1-tsp' },
  'GEN-062': { source: 'ifct2017', code: 'I001' },
  'GEN-064': { source: 'ifct2017', code: 'T014' },
  'GEN-065': { source: 'dish_estimate', code: 'est-refined-oil' },
  'GEN-070': { source: 'ifct2017', code: 'K002' },
  'GEN-071': { source: 'dish_estimate', code: 'est-peanut-butter' },
  'GEN-073': { source: 'indb', code: 'ASC266' },
  'GEN-077': { source: 'indb', code: 'ASC507' },
  'GEN-080': { source: 'indb', code: 'BFP005' },
};

/** A held row's problem that is about being another food already listed, not about its values (D-62). */
const ANOTHER_FOOD = /^(just the plain food|a brand’s product)/;

/** The note of a home-style food made from the file's generic foods. */
const GENERIC_NOTE = /^GEN-\d+ of the owner's consolidated food database/;

/** The issue of a dish the file only rates D, as D-62 wrote it. */
export const WEAK_MATCH_ISSUE = 'weak match (D): its values are a default for the base food, not checked';

/** A food of FitSphere's list a row of the file may be. */
export type ListedFood = { source: FoodAliasSource; code: string; name: string; kcal: number };

export type ConsolidatedInput = {
  /** Each sheet's rows, its header first, as `readXlsxRows` reads them. */
  dishes: readonly (readonly string[])[];
  packaged: readonly (readonly string[])[];
  generic: readonly (readonly string[])[];
  /** IFCT's foods and INDB's recipes, as the food list has them. */
  ifct: readonly ListedFood[];
  indb: readonly ListedFood[];
  /** The sheets as they are, read again here. */
  estimatesSheet: readonly (readonly string[])[];
  homeSheet: readonly (readonly string[])[];
  /** The packaged foods' barcodes, as `foods:import` loads them. */
  barcodes: ReadonlySet<string>;
  /** The day the sheets are made, YYYY-MM-DD. */
  readOn: string;
};

export type ConsolidatedResult = {
  aliases: string[][];
  estimatesSheet: string[][];
  homeSheet: string[][];
  report: {
    aliasRows: Record<FoodAliasSource, number>;
    /** Dish names that are two of FitSphere's foods, with them. */
    ambiguous: string[];
    /** Rows of Generic unbranded whose IFCT code has another name in FitSphere's list. */
    ifctNotMatched: string[];
    heldApproved: number;
    heldKept: number;
    /** Held rows whose values did not fit the dish, given the same values by the file: still held. */
    heldSameValues: string[];
    dishesAdded: number;
    dishesAddedHeld: number;
    /** Rows that failed the sheet's checks, with the problem. */
    failed: string[];
    genericAdded: string[];
    genericSameAs: string[];
    /** Generic foods named exactly as a food already listed: not added, whatever their values. */
    genericSameName: string[];
    /** Generic foods added beside a food of the same name, but for its brackets. */
    genericBeside: string[];
  };
};

/** One sheet's rows by their header's names; a column the file lacks refuses it. */
function columns(rows: readonly (readonly string[])[], sheet: string, names: readonly string[]) {
  const header = rows[0] ?? [];
  const at = Object.fromEntries(
    names.map((name) => {
      const index = header.indexOf(name);
      if (index < 0) throw new FoodListError(`The workbook's sheet "${sheet}" has no column "${name}"`);
      return [name, index];
    }),
  );
  return rows.slice(1).map((row) => (name: string) => (row[at[name]!] ?? '').trim());
}

/** A number of the file with at most two decimals, as the sheets write it; empty when it is not one. */
export function twoDecimals(cell: string): string {
  const value = Number(cell);
  return cell === '' || !Number.isFinite(value) ? '' : String(Math.round(value * 100) / 100);
}

/** A dish's name as written in the sheets: one space between words, a bracket the file cut off closed. */
export function tidyName(name: string): string {
  let text = name.replace(/\s+/g, ' ').replace(/\s*\(\s*$/, '').trim();
  const open = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length;
  if (open > 0) text = `${text}${')'.repeat(open)}`;
  return text;
}

const withoutBrackets = (name: string) => name.replace(/\([^)]*\)?/g, ' ');

/** A code's words: lowercase letters and digits joined by hyphens. */
function slug(name: string): string {
  return aliasKey(name)
    .normalize('NFD')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/ +/g, '-')
    .slice(0, 56)
    .replace(/-+$/, '');
}

/** An other name of the file as a sheet keeps it: only letters, digits, spaces and ' & -. */
function cleanAlias(text: string): string {
  const clean = text
    .replace(/[^\p{L}\p{M}\p{N} '&-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
  return clean.length <= 200 ? clean : clean.slice(0, 200).replace(/\s+\S*$/, '');
}

/**
 * The other names of a row: each regional name (separated by semicolons), and the words of the
 * Aliases cell those leave, as one name. The cell runs a food's other names together, one space between
 * them ("chana chana dal besan chickpea"), so its words are kept once each, in their order.
 */
export function otherNames(aliases: string, regional = ''): { names: string[]; words: string[] } {
  const names = regional
    .split(';')
    .map(cleanAlias)
    .filter((name) => name !== '');
  let run = aliases;
  const joined = names.join('  ');
  if (joined !== '' && aliases.endsWith(joined)) run = aliases.slice(0, aliases.length - joined.length);
  else if (names.length > 0) run = '';
  const known = new Set(names.flatMap((name) => aliasKey(name).split(' ')));
  const words: string[] = [];
  for (const word of cleanAlias(run).split(' ')) {
    const key = aliasKey(word);
    if (key === '' || known.has(key)) continue;
    known.add(key);
    words.push(word);
  }
  return { names, words };
}

/** Other names gathered for each food of FitSphere's, by source and code. */
class AliasRows {
  private readonly rows = new Map<string, { food: ListedFood | { source: FoodAliasSource; code: string; name: string }; names: string[]; words: string[] }>();

  add(food: { source: FoodAliasSource; code: string; name: string }, more: { names: string[]; words: string[] }) {
    if (more.names.length === 0 && more.words.length === 0) return;
    const key = `${food.source} ${food.code}`;
    const row = this.rows.get(key) ?? { food, names: [], words: [] };
    row.names.push(...more.names);
    for (const word of more.words) if (!row.words.some((known) => aliasKey(known) === aliasKey(word))) row.words.push(word);
    this.rows.set(key, row);
  }

  csv(): string[][] {
    const order = (source: string) => ['ifct2017', 'indb', 'home', 'dish_estimate', PACKAGED_ALIAS_SOURCE].indexOf(source);
    const rows = [...this.rows.values()].sort((a, b) => order(a.food.source) - order(b.food.source) || a.food.code.localeCompare(b.food.code));
    const lines: string[][] = [[...FOOD_ALIASES_HEADER]];
    for (const { food, names, words } of rows) {
      const list: string[] = [];
      const seen = new Set<string>();
      // The run of words, then each regional name; a name past the sheet's limits is left out.
      for (const name of [cleanAlias(words.join(' ')), ...names]) {
        const key = aliasKey(name);
        if (key === '' || seen.has(key) || !ALIAS.test(name) || list.length >= ALIASES_MAX) continue;
        seen.add(key);
        list.push(name);
      }
      if (list.length > 0) lines.push([food.source, food.code, food.name, list.join('; ')]);
    }
    return lines;
  }
}

const DISH_COLUMNS = [
  'Base Food Item',
  'Dish Name',
  'Aliases',
  'Archetype',
  'Data Source',
  'Confidence',
  'Serving Unit',
  'Serving (g/ml)',
  'Energy (kcal/100g)',
  'Protein (g/100g)',
  'Fat (g/100g)',
  'Carbs (g/100g)',
  'Fibre (g/100g)',
] as const;
type Cell = (name: string) => string;

/** The file's column of each value per 100 g. */
const VALUE_COLUMNS = { kcal: 'Energy (kcal/100g)', protein_g: 'Protein (g/100g)', carbs_g: 'Carbs (g/100g)', fat_g: 'Fat (g/100g)', fibre_g: 'Fibre (g/100g)' } as const;

/** Of a dish's rows in the file, the one to load: rated C, re-checked first, of the base given or named in the dish. */
function chosen(rows: readonly Cell[], base?: string): Cell | null {
  const rated = rows.filter((row) => row('Confidence').startsWith('C'));
  if (rated.length === 0) return null;
  const rechecked = rated.filter((row) => row('Confidence').includes('re-checked'));
  const pool = rechecked.length > 0 ? rechecked : rated;
  const named = (row: Cell) => {
    const name = ` ${aliasKey(row('Dish Name'))} `;
    return baseWords(row('Base Food Item')).some((word) => name.includes(` ${aliasKey(word)} `));
  };
  return pool.find((row) => base !== undefined && row('Base Food Item') === base) ?? pool.find(named) ?? pool[0]!;
}

/** A base food's own words ("Okra / Bhindi": okra, bhindi); none for a region ("Regional - Goan"). */
function baseWords(base: string): string[] {
  if (/^regional\b/i.test(base)) return [];
  const words = base
    .split('/')
    .map((word) => word.replace(/\([^)]*\)/g, '').trim().toLowerCase())
    .filter((word) => SEARCH_WORD.test(word));
  return [...new Set(words)];
}

/** A serving as the sheets write it: "katori" is "1 katori", "2 biscuits (15 g)" stays as it is. */
function servingOf(unit: string, withoutGrams = false): string {
  const text = withoutGrams ? unit.replace(/\s*\([^)]*\b(g|ml)\b[^)]*\)\s*$/i, '').trim() : unit.trim();
  return /^\d/.test(text) ? text : `1 ${text}`;
}

/** The sheet's check of one row, as `foods:import` reads it: the problem, or null. */
function problemOf(header: readonly string[], row: readonly string[], read: (text: string) => unknown): string | null {
  try {
    read(toCsv([header, row]));
    return null;
  } catch (error) {
    return (error as Error).message.replace(/^.*? line \d+: /, '');
  }
}

/** Makes the sheets from the workbook's rows. */
export function convertConsolidated(input: ConsolidatedInput): ConsolidatedResult {
  const report: ConsolidatedResult['report'] = {
    aliasRows: { ifct2017: 0, indb: 0, home: 0, dish_estimate: 0, packaged: 0 },
    ambiguous: [],
    ifctNotMatched: [],
    heldApproved: 0,
    heldKept: 0,
    heldSameValues: [],
    dishesAdded: 0,
    dishesAddedHeld: 0,
    failed: [],
    genericAdded: [],
    genericSameAs: [],
    genericSameName: [],
    genericBeside: [],
  };
  const aliases = new AliasRows();
  const estimates = input.estimatesSheet.map((row) => [...row]);
  const home = input.homeSheet.map((row) => [...row]);
  if (estimates[0]?.join(',') !== DISH_ESTIMATES_HEADER.join(',')) throw new FoodListError('The estimated-dishes sheet has another header');
  if (home[0]?.join(',') !== HOME_FOODS_HEADER.join(',')) throw new FoodListError('The home-foods sheet has another header');
  const est = (row: readonly string[], name: string) => row[DISH_ESTIMATES_HEADER.indexOf(name)]!;
  const hm = (row: readonly string[], name: string) => row[HOME_FOODS_HEADER.indexOf(name)]!;

  // FitSphere's dishes: INDB's recipes, the approved estimated dishes and home-style foods, not the
  // generic foods this file gave (made again from it below).
  const listed: ListedFood[] = [
    ...input.indb,
    ...estimates.slice(1).filter((row) => est(row, 'status') === 'approved').map((row) => ({ source: 'dish_estimate' as const, code: est(row, 'code'), name: est(row, 'name'), kcal: Number(est(row, 'kcal')) })),
    ...home
      .slice(1)
      .filter((row) => hm(row, 'status') === 'approved' && !GENERIC_NOTE.test(hm(row, 'notes')))
      .map((row) => ({ source: 'home' as const, code: hm(row, 'code'), name: hm(row, 'name'), kcal: Number(hm(row, 'kcal')) })),
  ];
  const byName = new Map<string, ListedFood[]>();
  const byShortName = new Map<string, ListedFood[]>();
  const put = (map: Map<string, ListedFood[]>, key: string, food: ListedFood) => {
    if (key === '') return;
    const foods = map.get(key) ?? [];
    if (!foods.includes(food)) foods.push(food);
    map.set(key, foods);
  };
  for (const food of listed) {
    put(byName, aliasKey(food.name), food);
    put(byShortName, aliasKey(withoutBrackets(food.name)), food);
  }

  // --- Dishes: grouped by name.
  const groups = new Map<string, Cell[]>();
  for (const row of columns(input.dishes, CONSOLIDATED_SHEETS.dishes, DISH_COLUMNS)) {
    const key = aliasKey(tidyName(row('Dish Name')));
    if (key === '') continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const namesOf = (rows: readonly Cell[]) => {
    const words: string[] = [];
    for (const row of rows) words.push(...otherNames(row('Aliases')).words);
    return { names: [], words };
  };
  const unlisted = new Map<string, Cell[]>();
  for (const [key, rows] of groups) {
    const found = byName.get(key) ?? byShortName.get(key) ?? byShortName.get(aliasKey(withoutBrackets(tidyName(rows[0]!('Dish Name')))));
    if (!found) {
      unlisted.set(key, rows);
      continue;
    }
    if (found.length > 1) {
      report.ambiguous.push(`${tidyName(rows[0]!('Dish Name'))}: ${found.map((food) => food.name).join(' | ')}`);
      continue;
    }
    aliases.add(found[0]!, namesOf(rows));
  }

  // Held rows the file now rates C: approved with its values.
  const dishRow = (code: string, name: string, base: string, searchWords: string, row: Cell, status: 'approved' | 'held', issue = '') => {
    const cells: Record<string, string> = {
      code,
      name,
      base,
      status,
      issue,
      basis: '100 g',
      kcal: twoDecimals(row('Energy (kcal/100g)')),
      protein_g: twoDecimals(row('Protein (g/100g)')),
      carbs_g: twoDecimals(row('Carbs (g/100g)')),
      fat_g: twoDecimals(row('Fat (g/100g)')),
      fibre_g: twoDecimals(row('Fibre (g/100g)')),
      serving: servingOf(row('Serving Unit')),
      serving_grams: twoDecimals(row('Serving (g/ml)')),
      search_words: searchWords,
      archetype: row('Archetype'),
      confidence: row('Confidence').charAt(0),
      data_source: row('Data Source'),
      read_on: input.readOn,
      flag: 'llm',
    };
    return DISH_ESTIMATES_HEADER.map((column) => cells[column]!);
  };
  const codes = new Set(estimates.slice(1).map((row) => est(row, 'code')));
  for (let index = 1; index < estimates.length; index += 1) {
    const held = estimates[index]!;
    if (est(held, 'status') !== 'held') continue;
    const rows = unlisted.get(aliasKey(est(held, 'name')));
    if (!rows) continue;
    unlisted.delete(aliasKey(est(held, 'name')));
    const pick = ANOTHER_FOOD.test(est(held, 'issue')) ? null : chosen(rows, est(held, 'base'));
    if (!pick) {
      report.heldKept += 1;
      continue;
    }
    // A row held because its values do not fit the dish stays held when the file gives it the same values.
    const unchanged = (['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const).every(
      (column) => Number(est(held, column)) === Number(twoDecimals(pick(VALUE_COLUMNS[column]))),
    );
    if (unchanged && !est(held, 'issue').startsWith('weak match')) {
      report.heldKept += 1;
      report.heldSameValues.push(`${est(held, 'name')}: ${est(held, 'issue')}`);
      continue;
    }
    const row = dishRow(est(held, 'code'), est(held, 'name'), est(held, 'base'), est(held, 'search_words'), pick, 'approved');
    const problem = problemOf(DISH_ESTIMATES_HEADER, row, readDishEstimatesSheet);
    if (problem) {
      report.heldKept += 1;
      report.failed.push(`${est(held, 'name')} (estimated dish): ${problem}`);
      continue;
    }
    estimates[index] = row;
    report.heldApproved += 1;
    aliases.add({ source: 'dish_estimate', code: est(held, 'code'), name: est(held, 'name') }, namesOf(rows));
  }

  // Dishes not in the sheet at all: added.
  for (const rows of unlisted.values()) {
    const pick = chosen(rows);
    const first = pick ?? rows[0]!;
    const name = tidyName(first('Dish Name')).slice(0, 120).trim();
    let code = `est-${slug(name)}`;
    for (let n = 2; codes.has(code); n += 1) code = `est-${slug(name).slice(0, 52)}-${n}`;
    const base = first('Base Food Item').slice(0, 80);
    const searchWords = baseWords(base).slice(0, 12).join('; ');
    let row = pick ? dishRow(code, name, base, searchWords, pick, 'approved') : dishRow(code, name, base, searchWords, first, 'held', WEAK_MATCH_ISSUE);
    const problem = problemOf(DISH_ESTIMATES_HEADER, row, readDishEstimatesSheet);
    if (problem && pick) {
      report.failed.push(`${name} (new dish): ${problem}`);
      row = dishRow(code, name, base, searchWords, pick, 'held', problem);
      if (problemOf(DISH_ESTIMATES_HEADER, row, readDishEstimatesSheet)) continue;
    } else if (problem) {
      report.failed.push(`${name} (new dish): ${problem}`);
      continue;
    }
    codes.add(code);
    estimates.push(row);
    if (est(row, 'status') === 'approved') {
      report.dishesAdded += 1;
      aliases.add({ source: 'dish_estimate', code, name }, namesOf(rows));
    } else {
      report.dishesAddedHeld += 1;
    }
  }

  // --- Branded packaged: by barcode.
  for (const row of columns(input.packaged, CONSOLIDATED_SHEETS.packaged, ['Brand', 'Product Name', 'Barcode', 'Aliases'])) {
    const barcode = row('Barcode');
    if (!input.barcodes.has(barcode)) continue;
    const name = (row('Product Name') || row('Brand')).slice(0, 120) || barcode;
    aliases.add({ source: PACKAGED_ALIAS_SOURCE, code: barcode, name }, otherNames(row('Aliases')));
  }

  // --- Generic unbranded: IFCT's foods by code; the file's own generic foods as home-style foods.
  const ifct = new Map(input.ifct.map((food) => [food.code, food]));
  const everyListed = new Map([...input.ifct, ...listed].map((food) => [`${food.source} ${food.code}`, food]));
  const sameName = new Map([...input.ifct, ...listed].map((food) => [aliasKey(food.name), food]));
  const homeByName = new Map(home.slice(1).map((row) => [aliasKey(hm(row, 'name')), row]));
  const homeCodes = new Set(home.slice(1).map((row) => hm(row, 'code')));
  const GENERIC_COLUMNS = ['Item ID', 'Food Item', 'Group', 'Aliases', 'Regional Names', 'Confidence', 'Serving Unit', 'Serving (g/ml)', 'Energy (kcal/100g)', 'Protein (g/100g)', 'Fat (g/100g)', 'Carbs (g/100g)', 'Fibre (g/100g)'];
  for (const row of columns(input.generic, CONSOLIDATED_SHEETS.generic, GENERIC_COLUMNS)) {
    const id = row('Item ID');
    const names = otherNames(row('Aliases'), row('Regional Names'));
    if (id.startsWith('IFCT-')) {
      const food = ifct.get(id.slice('IFCT-'.length));
      if (!food || aliasKey(food.name) !== aliasKey(row('Food Item'))) {
        report.ifctNotMatched.push(`${id} ${row('Food Item')}`);
        continue;
      }
      aliases.add(food, names);
      continue;
    }
    if (!id.startsWith('GEN-')) continue;
    const kcal = Number(row('Energy (kcal/100g)'));
    const same = GENERIC_SAME_AS[id];
    const name = row('Food Item').slice(0, 120);
    if (same) {
      const food = everyListed.get(`${same.source} ${same.code}`);
      if (!food) throw new FoodListError(`${id}: ${same.source} ${same.code} is not listed`);
      if (Math.abs(food.kcal - kcal) > Math.max(20, 0.15 * Math.max(food.kcal, kcal))) {
        throw new FoodListError(`${id} ${name} (${kcal} kcal) is not the same as ${food.name} (${food.kcal} kcal)`);
      }
      report.genericSameAs.push(`${id} ${name} → ${food.name}`);
      aliases.add(food, names);
      continue;
    }
    // A food already listed under this very name is that food: not added again, whatever its values.
    const named = sameName.get(aliasKey(name));
    if (named) {
      report.genericSameName.push(`${id} ${name} (${kcal} kcal) → ${named.name} (${named.kcal} kcal)`);
      aliases.add(named, names);
      continue;
    }
    const beside = byShortName.get(aliasKey(withoutBrackets(name)));
    if (beside) report.genericBeside.push(`${id} ${name} (${kcal} kcal), beside ${beside.map((food) => `${food.name} (${food.kcal} kcal)`).join(', ')}`);
    const known = homeByName.get(aliasKey(name));
    let code = known ? hm(known, 'code') : `home-${slug(name)}`;
    if (!known) {
      for (let n = 2; homeCodes.has(code); n += 1) code = `home-${slug(name).slice(0, 52)}-${n}`;
      const cells: Record<string, string> = {
        code,
        name,
        item: row('Group').toLowerCase().replace(/\s*\/\s*/g, ' & '),
        status: 'approved',
        basis: '100 g',
        kcal: twoDecimals(row('Energy (kcal/100g)')),
        protein_g: twoDecimals(row('Protein (g/100g)')),
        carbs_g: twoDecimals(row('Carbs (g/100g)')),
        fat_g: twoDecimals(row('Fat (g/100g)')),
        fibre_g: twoDecimals(row('Fibre (g/100g)')),
        serving: servingOf(row('Serving Unit'), true),
        serving_grams: twoDecimals(row('Serving (g/ml)')),
        search_words: '',
        read_on: input.readOn,
        notes: `${id} of the owner's consolidated food database (Generic unbranded); ${row('Confidence')}`,
        flag: 'llm',
      };
      const line = HOME_FOODS_HEADER.map((column) => cells[column]!);
      const problem = Number(cells.serving_grams) > MEAL_ITEM_GRAMS_MAX ? 'serving over 2,000 g' : problemOf(HOME_FOODS_HEADER, line, readHomeFoodsSheet);
      if (problem) {
        report.failed.push(`${id} ${name} (generic food): ${problem}`);
        continue;
      }
      homeCodes.add(code);
      home.push(line);
      report.genericAdded.push(`${id} ${name}`);
    }
    aliases.add({ source: 'home', code, name }, names);
  }

  const aliasCsv = aliases.csv();
  for (const row of aliasCsv.slice(1)) report.aliasRows[row[0] as FoodAliasSource] += 1;
  return { aliases: aliasCsv, estimatesSheet: estimates, homeSheet: home, report };
}
