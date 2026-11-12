import { addDays, IFCT_ACKNOWLEDGEMENT, INDB_ACKNOWLEDGEMENT, OFF_ATTRIBUTION, type Food, type IstDay, type MealItem, type PackagedFood } from '@fitsphere/shared';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { formatInteger } from '../format';
import { latestOnly } from '../latestOnly';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  getFood,
  getMeta,
  isShortSearch,
  listedFoodOf,
  nameMatcher,
  recentFoodKey,
  recentFoods,
  SEARCH_MIN_CHARACTERS,
  searchDishes,
  searchFoodSummaries,
  searchMyFoods,
  searchPackaged,
  searchesInOtherNumber,
  type FoodSummary,
  type LocalMyFood,
  withoutAccents,
} from '../local/store';
import { formatAmount, formatKcal, OWN_UNIT_NAMES, PORTION_UNIT_LABELS } from '../meals';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { FoodDetail, type FoodResult } from './FoodDetail';
import { BRAND_LABEL_CREDIT, DISH_ESTIMATES_CREDIT, HOME_FOODS_CREDIT } from './foodSources';
import { FullScreen } from './FullScreen';
import { OwnFoodSheet } from './OwnFoodSheet';
import { Sheet } from './Sheet';
import { IconButton, Message, Text, TextButton, TextInput } from './ui';

// Search the food list (REQ-LOG-007, REQ-ACC-005): offline, on the copy cached on the phone
// (ADR-0006 rule 1). Since D-54 the user's My foods (D-39) come first, then brands' own labels
// (D-49), then packaged foods sold in India from Open Food Facts, by name or brand (D-48), then INDB's
// Indian recipes (D-46), then the rest: dishes (D-28) and IFCT's Indian foods. Since D-61 no result
// carries a source tag (each food's page still does): a branded food shows its brand under its name,
// a My food "Your food", and the branded foods of one name are one row ("Bread · 3 brands"), which
// opens to list them, a brand each. USDA's foods are no longer listed (D-47). IFCT's acknowledgement
// is one tap away, behind the i at the top (D-25, changed by D-44): the dishes' values come from IFCT too; INDB's and Open Food Facts'
// credits are shown with it.
//
// Since D-78 each branded product is one row: a brand label and Open Food Facts' barcodes of the same
// brand and name (ignoring a pack size), with those saved with no brand that are its copies (by the
// barcode's company, or the brand at the front of the name), show one copy, the brand label when there
// is one.
//
// A food whose name is exactly what was typed comes first, wherever its source would list it; the
// rest keep that order (D-51). Since D-59 the home-style forms of daily foods (a bread slice, butter
// toast, bread omelette) come next, before My foods, untagged.
//
// The search fills the screen, so the most results show above the keyboard (D-44). A result opens the
// food's page over them (D-45, FoodDetail), and its back arrow returns to the same results. A My food
// can be edited or deleted from its page.
//
// The results follow the search as it is typed or erased; the cross at the end of the box clears it,
// and its results, and is shown only while something is typed (D-57). Since D-72 the phone searches
// less often: it waits for a short pause in typing (SEARCH_PAUSE_MS) before searching, so a word typed
// quickly is searched once, not at every letter; an emptied box clears at once. One search runs at a
// time, and only the latest text waits for it. One or two characters find only the foods named by
// them, whole (a product named "H", the brand "ON"), under a line asking for three or more.
//
// Since D-73 the list reads of each food found only what its row shows (FoodSummary); the food is read
// whole when it is opened. It shows the first RESULT_PAGE_ROWS rows and adds as many again from the
// results already found as the end comes near, so scrolling never waits for a search; every match is
// ordered and grouped before the first row shows, so a name's brands are all in its row from the start.
//
// Before anything is typed, Recent foods lists what was logged on the last five days, today's first,
// each food once by its name with the amount it was last logged in (D-60, the redesign's 3.6 with
// recent foods, locked by the owner on 2026-11-06). The tick box on the right picks a food as it was
// last time, and the bar at the foot adds every ticked food; the name opens the food's page on that
// amount, to change it. Once foods are ticked, a food added from its page, a recent one or one found
// by the search, goes into the meal with them. The keyboard opens by itself only when there are no
// recent foods, so it does not hide them.

/** A food found: as its page opens it, but a food of the list as its summary only (D-73). */
type Result = Exclude<FoodResult, { kind: 'food' }> | { kind: 'food'; food: FoodSummary };

/** How many days Recent foods looks back, today included (D-60). */
export const RECENT_FOOD_DAYS = 5;

/** How long typing must pause before the phone searches, in milliseconds (D-72). */
export const SEARCH_PAUSE_MS = 250;

/** How many rows of results the list shows at first, and adds each time its end comes near (D-73). */
export const RESULT_PAGE_ROWS = 200;

function nameOf(result: Result): string {
  return result.kind === 'dish' ? result.dish.name : result.food.name;
}

/**
 * A name or a search as compared for an exact match, and a brand or a product as told apart (D-61,
 * D-78): lowercase, without accents (D-88: "Nestlé" is "nestle"), its letters and digits only, one
 * space between words.
 */
function matchKey(text: string): string {
  return withoutAccents(text.toLowerCase())
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The names a result answers to: a packaged food also by its brand and name together. */
function namesOf(result: Result): string[] {
  if (result.kind === 'dish') return [result.dish.name];
  if (result.kind === 'packaged') return [result.food.name, `${result.food.brand ?? ''} ${result.food.name}`];
  return [result.food.name];
}

/**
 * Whether a result is the plain food the search names (D-91; the owner, 2026-11-12, after "potato"
 * listed the raw potato 191st, under the chips): not a brand's or a packaged product, and named exactly
 * as typed, or as typed and then a part in brackets ("Apple (1 medium)", "Curd (plain)"), or, for IFCT's
 * foods, named as typed and then a comma ("Banana, ripe, robusta", "Chicken, poultry, breast"). Other
 * sources' commas list a dish's foods ("Carrot, Radish & Peanut Salad"): not plain. A word typed in its
 * other number counts as typed (D-94: "bananas" names "Banana, ripe, robusta" too).
 */
function plainFor(query: string): (result: Result) => boolean {
  const typed = new Set([query, ...searchesInOtherNumber(query)].map((search) => matchKey(search).replace(/ /g, '')).filter(Boolean));
  const named = (part: string) => typed.has(matchKey(part).replace(/ /g, ''));
  return (result) => {
    if (typed.size === 0 || result.kind === 'packaged' || (result.kind === 'food' && result.food.source === 'brand_label')) return false;
    const name = nameOf(result).trim();
    if (named(name)) return true;
    const bracket = name.indexOf(' (');
    if (bracket > 0 && name.endsWith(')') && named(name.slice(0, bracket))) return true;
    const comma = name.indexOf(',');
    return result.kind === 'food' && result.food.source === 'ifct2017' && comma > 0 && named(name.slice(0, comma));
  };
}

/**
 * The words that name a food's dry or ready-to-cook form rather than the food eaten (D-92): "Dosa Idli
 * Batter", "Rava Upma Mix", "Chai Premix", "Sambar Powder", "Curry leaves". Flour and atta are left
 * out: they are what a search for besan or ragi wants.
 */
const DRY_FORM = /(^| )(batter|mix|premix|pre mix|powder|podi|ready to cook|rtc|leaves|leaf)( |$)/;

/**
 * Whether a result is a pack of a dry or ready-to-cook form the search did not ask for (D-92; the
 * owner, 2026-11-12, after "dosa" listed batters, flours and mixes before any dosa): a packaged
 * food's or a brand label's name with one of DRY_FORM's words, unless the search has that word too
 * ("dosa batter") or is a search for its brand ("mtr", whose packs are mixes).
 */
function dryFor(query: string): (result: Result) => boolean {
  const key = matchKey(query);
  const typed = key.replace(/ /g, '');
  const asked = DRY_FORM.test(key);
  return (result) => {
    if (asked || !typed || !(result.kind === 'packaged' || (result.kind === 'food' && result.food.source === 'brand_label'))) return false;
    const branded = brandOf(result);
    if (branded && matchKey(branded.brand).replace(/ /g, '').includes(typed)) return false;
    return DRY_FORM.test(matchKey(nameOf(result)));
  };
}

/**
 * The results in the order Search foods lists them, given in the order by source (D-54, D-59, D-62):
 * - the everyday food the search names first (D-92: the owner's choice for an everyday word, "rice"
 *   finding "Boiled rice (Uble chawal)" first; `searchFoodSummaries` marks it);
 * - then the plain foods the search names (D-91): your own first, then IFCT's measured foods, then
 *   the rest ("banana" finds "Banana, ripe, robusta" above a protein powder named "Banana" and "Banana
 *   chips");
 * - then those named exactly as the search ("bread" finds "Bread" above "Bread, white" and "Brown
 *   bread"), ignoring case, spaces and punctuation (D-51), or a word of it in its other number (D-94:
 *   "samosas" finds "Samosa");
 * - before and after them alike, the best matches first (D-66; the owner, 2026-11-10, after "dal"
 *   listed Baati and Dalda oil near the top): foods whose name has every word whole, then those where
 *   a word only starts a word of the name, then those where it is inside a word, then those found
 *   only by their hidden search words.
 * - the packs of a dry or ready-to-cook form the search did not ask for last (D-92: "dosa" lists the
 *   dosas before the batters and mixes).
 * Each group keeps the order by source. A packaged food's brand counts as part of its name. Worked out
 * in one pass, each name read once for each test (D-75), where the exact match and the best match
 * used to be two passes reading every name three times.
 */
export function inSearchOrder(query: string, results: readonly Result[]): Result[] {
  const keys = new Set([query, ...searchesInOtherNumber(query)].map(matchKey).filter(Boolean));
  const match = nameMatcher(query);
  const plain = plainFor(query);
  const dry = dryFor(query);
  // The everyday foods the search names in group 0 (D-92); the plain foods in groups 1 to 3 (your own,
  // IFCT's, the rest); then the exact matches in groups 4 to 7 and the rest in 8 to 11, each by how well
  // the name matches; the dry forms last, in 12.
  const groups: Result[][] = Array.from({ length: 13 }, () => []);
  for (const result of results) {
    if (result.kind === 'food' && result.food.everyday) {
      groups[0]!.push(result);
      continue;
    }
    if (dry(result)) {
      groups[12]!.push(result);
      continue;
    }
    if (plain(result)) {
      groups[result.kind === 'mine' ? 1 : result.kind === 'food' && result.food.source === 'ifct2017' ? 2 : 3]!.push(result);
      continue;
    }
    let best = 3;
    let exact = false;
    for (const name of namesOf(result)) {
      best = Math.min(best, match(name));
      if (!exact && keys.has(matchKey(name))) exact = true;
    }
    groups[(exact ? 4 : 8) + best]!.push(result);
  }
  return groups.flat();
}

/** A My food's values are per 100 g or ml, or per one of its unit: "100 g", "slice". */
function perOne(food: LocalMyFood): string {
  return food.unit === 'g' || food.unit === 'ml' ? `100 ${food.unit}` : OWN_UNIT_NAMES[food.unit].one;
}

/**
 * A branded food's brand and its name without the brand (D-61): a packaged food's brand, or a brand
 * label's, which is its food group; null for every other food, and for a packaged food with no brand.
 */
export function brandOf(result: Result): { brand: string; product: string } | null {
  const product = (brand: string, name: string) => (name.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? name.slice(brand.length + 1) : name);
  if (result.kind === 'packaged') return result.food.brand ? { brand: result.food.brand, product: product(result.food.brand, result.food.name) } : null;
  if (result.kind === 'food' && result.food.source === 'brand_label') return { brand: result.food.foodGroup, product: product(result.food.foodGroup, result.food.name) };
  return null;
}

/** A row of the results: one food, or the branded foods of one name, listed under it (D-61). */
export type ResultRow = { kind: 'one'; result: Result } | { kind: 'brands'; key: string; name: string; members: Result[] };

/**
 * Whether two foods' energies are alike enough to be one product under several brands (D-89): the
 * higher at most twice the lower, or 20 kcal apart at most (drinks, sauces: 0 and 1 kcal are alike).
 */
const ENERGY_RATIO_MAX = 2;
const ENERGY_GAP_ALIKE = 20;
const alikeEnergy = (low: number, high: number) => high <= ENERGY_RATIO_MAX * low || high - low <= ENERGY_GAP_ALIKE;

/**
 * A name's branded foods split by energy (D-89; the owner, 2026-11-12, after "Gold · 6 brands" held
 * Bru's coffee, Tata Tea, a milk and an oil): in order of energy, a food whose energy jumps from the
 * one before it (not alike) starts another set, so foods spread evenly stay together ("Paneer", 150 to
 * 330 kcal). Each set keeps the order the foods came in; the sets come in the order of their first food.
 */
function byEnergy(members: readonly Result[]): Result[][] {
  const sorted = [...members].sort((a, b) => energyOf(a) - energyOf(b));
  const sets: Result[][] = [];
  for (const member of sorted) {
    const last = sets[sets.length - 1];
    if (last && alikeEnergy(energyOf(last[last.length - 1]!), energyOf(member))) last.push(member);
    else sets.push([member]);
  }
  const at = new Map(members.map((member, index) => [member, index]));
  return sets.map((set) => set.sort((a, b) => at.get(a)! - at.get(b)!)).sort((a, b) => at.get(a[0]!)! - at.get(b[0]!)!);
}

const energyOf = (result: Result) => (result.kind === 'dish' ? result.dish.kcal : result.food.kcal);

/**
 * The results as rows (D-61): branded foods (brand labels and packaged foods) with the same name,
 * their brands left out and ignoring case and punctuation, are one row where the first of them was;
 * a name only one brand has stays a row of its own. Since D-89 only foods of alike energy share a row
 * ("Gold" is a coffee, a tea, a milk and an oil: four rows), and a brand counts once however it is
 * written. Every other food, and the order, are unchanged.
 */
export function groupBrands(results: readonly Result[]): ResultRow[] {
  const rows: ResultRow[] = [];
  const groups = new Map<string, Extract<ResultRow, { kind: 'brands' }>>();
  for (const result of results) {
    const branded = brandOf(result);
    if (!branded) {
      rows.push({ kind: 'one', result });
      continue;
    }
    const key = matchKey(branded.product);
    const group = groups.get(key);
    if (group) {
      group.members.push(result);
      continue;
    }
    const created = { kind: 'brands' as const, key, name: branded.product, members: [result] };
    groups.set(key, created);
    rows.push(created);
  }
  return rows.flatMap((row): ResultRow[] => {
    if (row.kind === 'one') return [row];
    // Foods of far apart energy are other products (D-89); each set keeps the row's place, and a key of its own.
    return byEnergy(row.members).flatMap((members, index): ResultRow[] =>
      // A name only one brand has, even under two sources, stays a row for each.
      brandCount(members) < 2 ? members.map((result) => ({ kind: 'one', result })) : [{ ...row, key: index === 0 ? row.key : `${row.key} ${index + 1}`, members }],
    );
  });
}

/** How many different brands a name's foods have, however each is written (D-88, D-89: "Nestlé" and "Nestle India" are one). */
export function brandCount(members: readonly Result[]): number {
  return new Set(members.map((member) => brandKey(brandOf(member)?.brand ?? ''))).size;
}

/**
 * Words a company's name adds to its brand at its end ("Britannia Industries Ltd"), as `brandKey`
 * leaves them out (D-89), with "The" at its start.
 */
const COMPANY_WORDS = new Set(['company', 'co', 'ltd', 'limited', 'pvt', 'private', 'inc', 'llp', 'llc', 'corp', 'corporation', 'industries', 'india']);

/**
 * A brand as told apart from others (D-78, D-89): its letters and digits only, without accents, and
 * without the company's words: "The Coca-Cola Company", "Coca Cola" and "Coca-Cola" are "cocacola",
 * "Britannia Industries Ltd" is "britannia", "Nestlé" and "Nestle India" "nestle".
 */
export function brandKey(brand: string): string {
  const words = matchKey(brand).split(' ').filter(Boolean);
  while (words.length > 1 && COMPANY_WORDS.has(words[words.length - 1]!)) words.pop();
  if (words.length > 1 && words[0] === 'the') words.shift();
  return words.join('');
}

/**
 * A pack size in a name, as Open Food Facts' names give it: "500ml", "1 ltr", "(200 g)", "70.5g"
 * (D-78). What comes before it is kept by the first group, so no lookbehind is needed.
 */
const PACK_SIZE = /(^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:g|gm|gms|gram|grams|kg|kgs|ml|l|lt|ltr|ltrs|litre|litres|liter|liters)(?![\p{L}\p{N}])/giu;

/** A product (D-78): its brand, letters and digits only, and its name's words without the brand. */
type Product = { brand: string; words: string[] };

const keyOfProduct = (product: Product) => `${product.brand}|${product.words.join('')}`;

/** A name's words, lowercase, letters and digits only, without a pack size. */
function nameWords(name: string): string[] {
  return matchKey(name.replace(PACK_SIZE, '$1 '))
    .split(' ')
    .filter(Boolean);
}

/**
 * The product a branded food is (D-78): its brand, as `brandKey` tells it apart (D-89), and its name
 * without a pack size or the brand at its front, written with or without spaces, in full ("The Whole
 * Truth Protein Bar") or as told apart ("Britannia Marie" under "Britannia Industries Ltd").
 */
function productOf(result: Result): Product | null {
  const branded = brandOf(result);
  if (!branded) return null;
  const brand = brandKey(branded.brand);
  if (!brand) return null;
  const full = matchKey(branded.brand).replace(/ /g, '');
  const words = nameWords(nameOf(result));
  // The longest of the two at the front goes: "(TEST CO) Rich Tomato Sauce" under "Test Co" is "rich tomato sauce".
  let joined = '';
  let cut = 0;
  for (let at = 0; at < words.length && joined.length < Math.max(brand.length, full.length); at++) {
    joined += words[at];
    if (joined === brand || joined === full) cut = at + 1;
  }
  return { brand, words: words.slice(cut) };
}

/**
 * Which product a branded food is (D-78): its brand and its name, the brand left out of the name,
 * ignoring case, spaces, marks and a pack size. "AMUL PURE GHEE" (brand AMUL), "Amul pure ghee 500ml"
 * and the brand label "Pure Ghee" (Amul) are one product; "Haldiram's" and "Haldirams" one brand.
 * Null for a food with no brand: onePerProduct places it from the foods found with it.
 */
export function productKey(result: Result): string | null {
  const product = productOf(result);
  return product && keyOfProduct(product);
}

/**
 * The company a 13-digit barcode belongs to, as far as one company's products share it: its first 7
 * digits (Britannia's are 8901063…, Amul's 8901262…). Null for a shorter barcode.
 */
const companyOf = (barcode: string) => (/^\d{13}$/.test(barcode) ? barcode.slice(0, 7) : null);

/**
 * How far a food with no brand's energy may be from a copy of the brand's product it is placed with by
 * its barcode's company alone: a tenth. Seven digits can be shared by more than one company, and a
 * general name ("Chocolate", "Mango Pickle") by more than one of a company's products.
 */
const SAME_COMPANY_KCAL_GAP = 0.1;

/**
 * Whose product a packaged food with no brand is (D-78; the owner, 2026-11-11, after three "Milk Bikis"
 * with no brand listed under Britannia's), told from the branded foods found with it:
 * - the one brand whose product of the same name has a barcode of the same company and an energy within
 *   a tenth of it ("Milk Bikis", 8901063…, 459 kcal, as Britannia's Milk Bikis);
 * - else the brand written at the front of its name, when that brand has the rest as a product
 *   ("BRITANNIA Milk Bikis");
 * - else its company, so one company's products with no brand and the same name are one product.
 * Never by its name alone: a "Mayonnaise" with no brand may be any maker's. Null when none can be told.
 */
function placed(food: PackagedFood, products: ReadonlySet<string>, owners: ReadonlyMap<string, ReadonlyMap<string, number[]>>): Product | null {
  const words = nameWords(food.name);
  if (words.length === 0) return null;
  const company = companyOf(food.barcode);
  const brands = company === null ? undefined : owners.get(`${company}|${words.join('')}`);
  if (brands?.size === 1) {
    const [[brand, energies]] = [...brands] as [[string, number[]]];
    if (energies.some((kcal) => Math.abs(kcal - food.kcal) <= SAME_COMPANY_KCAL_GAP * Math.max(kcal, food.kcal))) return { brand, words };
  }
  let joined = '';
  for (let at = 0; at < words.length - 1; at++) {
    joined += words[at];
    const rest = { brand: joined, words: words.slice(at + 1) };
    if (products.has(keyOfProduct(rest))) return rest;
  }
  return company === null ? null : { brand: `#${company}`, words };
}

/**
 * The copy of a product that its row shows (D-78; the owner, 2026-11-11): a brand label, read from the
 * brand's page or approved by the owner; otherwise a copy that names its brand, then the energy most
 * copies give (in whole kcal, as shown), then the copy with the most values (its fibre, its serving),
 * then one whose name has no pack size, then the first in the order. Each copy keeps its own values and
 * serving.
 */
function shownCopy(copies: readonly Result[]): Result {
  const label = copies.find((copy) => copy.kind === 'food');
  if (label) return label;
  const packaged = copies.filter((copy) => copy.kind === 'packaged');
  const votes = new Map<number, number>();
  for (const copy of packaged) votes.set(Math.round(copy.food.kcal), (votes.get(Math.round(copy.food.kcal)) ?? 0) + 1);
  const score = ({ food }: (typeof packaged)[number]) => [
    food.brand?.trim() ? 1 : 0,
    votes.get(Math.round(food.kcal)) ?? 0,
    (food.fibreG === null ? 0 : 1) + (food.servingGrams === null ? 0 : 1),
    food.name.search(PACK_SIZE) < 0 ? 1 : 0,
  ];
  let shown = packaged[0];
  for (const copy of packaged.slice(1)) {
    const [mine, best] = [score(copy), score(shown!)];
    const at = mine.findIndex((value, index) => value !== best[index]);
    if (at >= 0 && mine[at]! > best[at]!) shown = copy;
  }
  return shown ?? copies[0]!;
}

/**
 * The results with each branded product once (D-78), where its first copy was: the brand labels and
 * Open Food Facts' packaged foods of one product (productKey), and the packaged foods with no brand
 * that are its copies (placed), whatever their values, as one row showing one copy (shownCopy). Every
 * other food, and the order, are unchanged. Every barcode stays on the phone and the server, so any
 * pack still scans; a meal keeps the values it was logged with.
 */
export function onePerProduct(results: readonly Result[]): Result[] {
  const products = results.map(productOf);
  // The products found, and by each company and product name its brands with their copies' energies,
  // to place the foods with no brand.
  const found = new Set<string>();
  const owners = new Map<string, Map<string, number[]>>();
  results.forEach((result, at) => {
    const product = products[at];
    if (!product) return;
    found.add(keyOfProduct(product));
    const company = result.kind === 'packaged' ? companyOf(result.food.barcode) : null;
    if (company === null || result.kind !== 'packaged') return;
    const name = `${company}|${product.words.join('')}`;
    const brands = owners.get(name) ?? owners.set(name, new Map()).get(name)!;
    const energies = brands.get(product.brand);
    if (energies) energies.push(result.food.kcal);
    else brands.set(product.brand, [result.food.kcal]);
  });
  const keys = results.map((result, at) => {
    const product = products[at] ?? (result.kind === 'packaged' && !result.food.brand?.trim() ? placed(result.food, found, owners) : null);
    return product ? keyOfProduct(product) : null;
  });
  const copies = new Map<string, Result[]>();
  results.forEach((result, at) => {
    const key = keys[at] ?? null;
    if (key === null) return;
    const list = copies.get(key);
    if (list) list.push(result);
    else copies.set(key, [result]);
  });
  const shown = new Set<string>();
  return results.flatMap((result, at) => {
    const key = keys[at] ?? null;
    if (key === null) return [result];
    if (shown.has(key)) return [];
    shown.add(key);
    return [shownCopy(copies.get(key)!)];
  });
}

function keyOf(result: Result): string {
  return result.kind === 'dish'
    ? `dish:${result.dish.code}`
    : result.kind === 'mine'
      ? `mine:${result.food.id}`
      : result.kind === 'packaged'
        ? `packaged:${result.food.barcode}`
        : `${result.food.source}:${result.food.code}`;
}

/**
 * What a result's row says (D-61), with no source tag: its name; under it, a branded food's brand or
 * "Your food" for a My food, then its energy; and all of it as read out.
 */
function describe(result: Result): { name: string; lead: string | null; mine: boolean; detail: string; said: string } {
  const say = (parts: (string | null)[]) => parts.filter((part) => part !== null).join(', ');
  if (result.kind === 'dish') {
    const detail = `${formatKcal(result.dish.kcal)} per ${PORTION_UNIT_LABELS[result.dish.portionUnit]}`;
    return { name: result.dish.name, lead: null, mine: false, detail: `${detail} · estimated`, said: say([result.dish.name, detail, 'estimated']) };
  }
  if (result.kind === 'mine') {
    const detail = `${formatKcal(result.food.kcal)} per ${perOne(result.food)}`;
    return { name: result.food.name, lead: 'Your food', mine: true, detail, said: say([result.food.name, 'your food', detail]) };
  }
  const detail = `${formatKcal(result.food.kcal)} per 100 g`;
  const branded = brandOf(result);
  if (branded) return { name: branded.product, lead: branded.brand, mine: false, detail, said: say([branded.product, branded.brand, detail]) };
  const estimated = result.kind === 'food' && result.food.kcalEstimated;
  return { name: result.food.name, lead: null, mine: false, detail: `${detail}${estimated ? ' · estimated' : ''}`, said: say([result.food.name, detail, estimated ? 'estimated' : null]) };
}

/** The energy of a name's brands: "250 kcal" or "220–274 kcal", and as read out. */
function kcalRange(members: readonly Result[]): { shown: string; said: string } {
  const kcals = members.map((member) => Math.round(member.kind === 'dish' ? member.dish.kcal : member.food.kcal));
  const [low, high] = [Math.min(...kcals), Math.max(...kcals)];
  return low === high ? { shown: formatKcal(low), said: formatKcal(low) } : { shown: `${formatInteger(low)}–${formatKcal(high)}`, said: `${formatInteger(low)} to ${formatKcal(high)}` };
}

/** One line of the results list: a food, a name's brands, or one of those brands while they are open. */
type Line = { kind: 'one'; result: Result } | { kind: 'brands'; row: Extract<ResultRow, { kind: 'brands' }>; open: boolean } | { kind: 'member'; result: Result; group: string };

export function FoodSearchSheet({ today, onAdd, onClose }: { today: IstDay; onAdd(items: MealItem[]): void; onClose(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const local = useLocalDatabase();
  const { version } = useSync();
  const [query, setQuery] = useState('');
  // D-72: the text searched for, once typing pauses; and the results, with the text they are for.
  const [searched, setSearched] = useState('');
  const [found, setFound] = useState<{ query: string; results: Result[] }>({ query: '', results: [] });
  const results = found.results;
  const [runLatest] = useState(latestOnly);
  const [listCached, setListCached] = useState(true);
  // The food whose page is open, and the amount it was last logged in when opened from Recent foods.
  const [chosen, setChosen] = useState<{ result: FoodResult; from?: MealItem['amount'] } | null>(null);
  const [editing, setEditing] = useState<LocalMyFood | null>(null);
  // The food sources' sheet, behind the i (D-44).
  const [sources, setSources] = useState(false);
  // Recent foods (D-60): null until read; the ticked ones by their keys, in the order ticked.
  const [recent, setRecent] = useState<MealItem[] | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  // The names whose brands are open (D-61).
  const [openNames, setOpenNames] = useState<string[]>([]);
  // D-73: how many rows the list shows, for the results they were counted for.
  const [paged, setPaged] = useState<{ results: Result[]; rows: number }>({ results, rows: RESULT_PAGE_ROWS });
  const shownRows = paged.results === results ? paged.rows : RESULT_PAGE_ROWS;
  // The results as rows, worked out once for each search, not at every change of the screen.
  const rows = useMemo(() => groupBrands(results), [results]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void recentFoods(local.state.db, addDays(today, -(RECENT_FOOD_DAYS - 1)), today).then((foods) => {
      if (active) setRecent(foods);
    });
    return () => {
      active = false;
    };
  }, [local.state, today, version]);

  const byKey = new Map((recent ?? []).map((item) => [recentFoodKey(item), item]));
  const tickedItems = ticked.flatMap((key) => byKey.get(key) ?? []);
  // From a food's page the ticked foods go in with it, but not its own tick: the page's amount counts.
  const withPage = chosen ? tickedItems.filter((item) => recentFoodKey(item) !== recentFoodKey({ name: nameOf(chosen.result) })) : [];
  const showRecent = query.trim() === '' && recent !== null && recent.length > 0;

  function toggle(item: MealItem) {
    const key = recentFoodKey(item);
    setTicked((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  /** A food's page from the results: a food of the list is read whole first (D-73); one no longer listed does not open. */
  async function choose(result: Result) {
    if (result.kind !== 'food') {
      setChosen({ result });
      return;
    }
    if (local.state.status !== 'ready') return;
    const food = await getFood(local.state.db, result.food.source, result.food.code);
    if (food) setChosen({ result: { kind: 'food', food } });
  }

  /** A recent food's page, on its last amount; a food no longer listed has no page, and its name ticks it (MVP default, D-60). */
  async function open(item: MealItem) {
    if (local.state.status !== 'ready') return;
    const result = await listedFoodOf(local.state.db, item);
    if (result) setChosen({ result, from: item.amount });
    else toggle(item);
  }

  function addAll(items: MealItem[]) {
    onAdd(items);
    onClose();
  }

  /** The text typed or cleared (D-72): an emptied box clears the search and its results at once. */
  function changeQuery(text: string) {
    setQuery(text);
    if (text.trim() === '') {
      setSearched('');
      setFound({ query: '', results: [] });
    }
  }

  // D-72: any other text is searched once typing pauses.
  useEffect(() => {
    if (query.trim() === '') return;
    const timer = setTimeout(() => setSearched(query), SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    // D-72: one search at a time; a newer text replaces one still waiting to start.
    runLatest(async () => {
      if (!active) return;
      const [dishes, foods, mine, packaged, listVersion] = await Promise.all([
        searchDishes(db, searched),
        searchFoodSummaries(db, searched),
        searchMyFoods(db, searched),
        searchPackaged(db, searched),
        getMeta(db, 'food_list_version'),
      ]);
      if (!active) return;
      const listed = (source: Food['source']) => foods.filter((food) => food.source === source).map((food): Result => ({ kind: 'food', food }));
      setFound({
        query: searched,
        // D-59: home-style foods; D-54: My foods, brand labels, packaged foods, INDB, then dishes and IFCT;
        // D-62: the estimated dishes after the measured ones, before IFCT's raw foods.
        // D-51: those named exactly as the search first; D-66: in four groups, the best matches first,
        // each group in that order. D-78: each branded product once, where its first copy was.
        results: onePerProduct(inSearchOrder(searched, [
          ...listed('home'),
          ...mine.map((food): Result => ({ kind: 'mine', food })),
          ...listed('brand_label'),
          ...packaged.map((food): Result => ({ kind: 'packaged', food })),
          ...listed('indb'),
          ...dishes.map((dish): Result => ({ kind: 'dish', dish })),
          ...listed('dish_estimate'),
          ...listed('ifct2017'),
        ])),
      });
      setListCached(listVersion !== null);
    });
    return () => {
      active = false;
    };
  }, [local.state, searched, version, runLatest]);

  if (editing) {
    return (
      <OwnFoodSheet
        editing={editing}
        onClose={() => {
          setEditing(null);
          setChosen(null);
        }}
      />
    );
  }

  const lines = rows.flatMap((row): Line[] => {
    if (row.kind === 'one') return [row];
    const open = openNames.includes(row.key);
    return [{ kind: 'brands', row, open }, ...(open ? row.members.map((result): Line => ({ kind: 'member', result, group: row.name })) : [])];
  });

  function toggleName(key: string) {
    setOpenNames((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  const tickedKcal = tickedItems.reduce((sum, item) => sum + item.kcal, 0);
  const bar =
    tickedItems.length > 0 ? (
      <View style={styles.bar}>
        <View style={styles.barLine}>
          <Text accessibilityLiveRegion="polite" style={styles.barText}>
            {tickedItems.length} selected · {formatKcal(tickedKcal)}
          </Text>
          <TextButton title="Deselect all" onPress={() => setTicked([])} />
        </View>
        <TextButton title={`Add ${tickedItems.length} ${tickedItems.length === 1 ? 'food' : 'foods'}`} filled onPress={() => addAll(tickedItems)} />
      </View>
    ) : undefined;

  return (
    <FullScreen onClose={onClose} footer={bar}>
          <View style={styles.header}>
            <IconButton label="Close search" onPress={onClose}>
              <ChevronLeft size={24} strokeWidth={2.25} color={colors.accent} />
            </IconButton>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
              Search foods
            </Text>
            <IconButton label="Food sources" onPress={() => setSources(true)}>
              <Info size={22} color={colors.accent} />
            </IconButton>
          </View>
          <View style={styles.searchArea}>
            <View style={[styles.searchBox, query !== '' && styles.searchBoxClearable]}>
              <Search size={20} color={colors.inkMuted} />
              <TextInput
                // Made again once Recent foods is read, so the keyboard opens by itself only when there are none (D-60).
                key={recent === null ? 'reading' : 'read'}
                accessibilityLabel="Search foods"
                value={query}
                onChangeText={changeQuery}
                placeholder="e.g. atta, dal, paneer"
                autoFocus={recent !== null && recent.length === 0}
                style={styles.searchInput}
              />
              {query !== '' ? (
                <IconButton label="Clear search" onPress={() => changeQuery('')}>
                  <X size={20} strokeWidth={2.25} color={colors.inkMuted} />
                </IconButton>
              ) : null}
            </View>
            {!listCached ? (
              <Message text={TEXTS.needsInternet('Downloading the food list')} offline />
            ) : query.trim() !== '' && isShortSearch(query) ? (
              // D-72: one or two characters list only the foods named by them, under this line.
              <Text style={styles.empty}>Type {SEARCH_MIN_CHARACTERS} letters or more to search all foods.</Text>
            ) : query.trim() !== '' && found.query === query && results.length === 0 ? (
              // Only once the search for this text is done, not while it waits for the pause (D-72).
              <Text style={styles.empty}>No foods found. Try another word, or enter your own food.</Text>
            ) : query.trim() === '' && recent !== null && recent.length === 0 ? (
              <Text style={styles.empty}>Foods you log show here for {RECENT_FOOD_DAYS} days, so you can add them again with a tap.</Text>
            ) : showRecent ? (
              <View style={styles.recentHead}>
                <View style={styles.recentTitleLine}>
                  <Text accessibilityRole="header" style={styles.recentTitle}>
                    Recent foods
                  </Text>
                  <Text style={styles.detail}>Last {RECENT_FOOD_DAYS} days</Text>
                </View>
                <Text style={styles.detail}>Tick a food to add it as last time. Tap a food to change its amount.</Text>
              </View>
            ) : null}
          </View>
          {showRecent ? (
            <FlatList
              data={recent}
              keyExtractor={recentFoodKey}
              style={[styles.list, styles.listCard]}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = ticked.includes(recentFoodKey(item));
                const said = `${item.name}, ${formatAmount(item.amount)}, ${formatKcal(item.kcal)}`;
                return (
                  <View style={[styles.recentRow, on && styles.recentRowOn]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${said}, change the amount`}
                      onPress={() => void open(item)}
                      style={({ pressed }) => [styles.recentText, pressed && styles.pressed]}
                    >
                      <Text style={[styles.name, on && styles.nameOn]}>{item.name}</Text>
                      <Text style={styles.detail}>
                        {formatAmount(item.amount)} · {formatKcal(item.kcal)}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={said}
                      accessibilityState={{ checked: on }}
                      onPress={() => toggle(item)}
                      style={styles.tickArea}
                    >
                      <View style={[styles.tick, on && styles.tickOn]}>{on ? <Check size={18} strokeWidth={3} color={colors.onPrimary} /> : null}</View>
                    </Pressable>
                  </View>
                );
              }}
            />
          ) : (
          <FlatList
            // D-73: the first rows, and more from the results found as the end comes near (two screens
            // ahead), so they are there before the user reaches them.
            data={lines.slice(0, shownRows)}
            onEndReached={() => {
              if (shownRows < lines.length) setPaged({ results, rows: shownRows + RESULT_PAGE_ROWS });
            }}
            onEndReachedThreshold={2}
            initialNumToRender={15}
            testID="food-results"
            keyExtractor={(line) => (line.kind === 'brands' ? `brands:${line.row.key}` : line.kind === 'member' ? `member:${keyOf(line.result)}` : keyOf(line.result))}
            style={[styles.list, lines.length > 0 && styles.listCard]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: line }) => {
              if (line.kind === 'brands') {
                const range = kcalRange(line.row.members);
                const Chevron = line.open ? ChevronUp : ChevronDown;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${line.row.name}, ${brandCount(line.row.members)} brands, ${range.said} per 100 g`}
                    accessibilityState={{ expanded: line.open }}
                    onPress={() => toggleName(line.row.key)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.name}>{line.row.name}</Text>
                      <Text numberOfLines={1} style={styles.detail}>
                        <Text style={styles.lead}>{brandCount(line.row.members)} brands</Text> · {range.shown} per 100 g
                      </Text>
                    </View>
                    <Chevron size={20} strokeWidth={2.25} color={colors.accent} />
                  </Pressable>
                );
              }
              const said = describe(line.result);
              if (line.kind === 'member') {
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${line.group}, ${said.lead ?? said.name}, ${said.detail}`}
                    onPress={() => void choose(line.result)}
                    style={({ pressed }) => [styles.row, styles.member, pressed && styles.pressed]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.memberName}>{said.lead ?? said.name}</Text>
                      <Text style={styles.detail}>{said.detail}</Text>
                    </View>
                    <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={said.said}
                  onPress={() => void choose(line.result)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{said.name}</Text>
                    <Text numberOfLines={1} style={styles.detail}>
                      {said.lead ? (
                        <>
                          <Text style={[styles.lead, said.mine && styles.leadMine]}>{said.lead}</Text>
                          {' · '}
                        </>
                      ) : null}
                      {said.detail}
                    </Text>
                  </View>
                  <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
                </Pressable>
              );
            }}
          />
          )}
      {sources ? (
        <Sheet title="Food sources" onClose={() => setSources(false)} actions={<TextButton title="Close" wide onPress={() => setSources(false)} />}>
          <Text style={styles.source}>Food values: {IFCT_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked INDB: {INDB_ACKNOWLEDGEMENT}</Text>
          <Text style={styles.source}>Foods marked Brand label: {BRAND_LABEL_CREDIT}</Text>
          <Text style={styles.source}>Home-style foods (a bread slice, butter toast and the like): {HOME_FOODS_CREDIT}</Text>
          <Text style={styles.source}>Estimated dishes: {DISH_ESTIMATES_CREDIT}</Text>
          <Text style={styles.source}>Foods marked Packaged: {OFF_ATTRIBUTION}.</Text>
        </Sheet>
      ) : null}
      {chosen ? (
        <FoodDetail
          result={chosen.result}
          from={chosen.from}
          addTitle={withPage.length > 0 ? `Add ${withPage.length + 1} foods` : 'Add'}
          addNote={withPage.length > 0 ? `Your ${withPage.length === 1 ? '1 ticked food goes' : `${withPage.length} ticked foods go`} in with it.` : undefined}
          onBack={() => setChosen(null)}
          onAdd={(item: MealItem) => addAll([...withPage, item])}
          onEdit={setEditing}
        />
      ) : null}
    </FullScreen>
  );
}

// The redesign's 3.6 (locked by the owner, 2026-11-03; the full screen locked 2026-11-04, D-44): the
// search fills the screen under a header with the back arrow, its title and the i; the search in a
// sunken box with its icon; the results ruled on a raised card down to the keyboard, each opening
// with a chevron; the food sources in a sheet.
const useStyles = themedStyles((c) => ({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 8 },
  title: { ...TYPE.screenHeader, flex: 1 },
  searchArea: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 12 },
  searchBox: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.accent,
    backgroundColor: c.surfaceSunken,
  },
  // With the cross (D-57), whose own space fills the rest of the edge.
  searchBoxClearable: { paddingRight: 4 },
  // flex: 1 only in the box's row: in the sheet's column a field with flex: 1 has no height for its
  // text (Yoga's flex basis is 0), which hid the search text.
  searchInput: { ...TYPE.input, flex: 1, paddingVertical: 12 },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center' },
  // As tall as its results, and no taller than the room above the keyboard.
  list: { flexGrow: 0, marginHorizontal: 16 },
  listCard: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  detail: { flexShrink: 1, color: c.inkMuted, fontSize: 14, lineHeight: 20 },
  // D-61, in place of the source tags: the brand (or "N brands") in the ink, a little heavier; "Your
  // food" in caramel. A name's brands, while open, sit on the sunken colour, set in under it.
  lead: { fontWeight: '600', color: c.ink },
  leadMine: { color: c.accent },
  member: { minHeight: 52, paddingLeft: 30, backgroundColor: c.surfaceSunken },
  memberName: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  source: { fontSize: 15, lineHeight: 22 },
  // Recent foods (D-60): the title in condensed capitals with "Last 5 days" across from it; each food
  // ruled on the raised card, its name opening its page, its tick box on the right; a ticked food's
  // row tinted, its name heavier, its box filled with the check.
  recentHead: { gap: 4 },
  recentTitleLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  recentTitle: { ...TYPE.screenHeader, fontSize: 20, lineHeight: 24 },
  recentRow: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: c.border },
  recentRowOn: { backgroundColor: c.accentTint },
  recentText: { flex: 1, justifyContent: 'center', gap: 2, paddingVertical: 10, paddingLeft: 14, paddingRight: 4 },
  nameOn: { fontWeight: '600' },
  tickArea: { width: 56, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 2, borderColor: c.inkSubtle },
  tickOn: { borderColor: c.primary, backgroundColor: c.primary },
  // The bar at the foot while foods are ticked.
  bar: { gap: 8 },
  barLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  barText: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
}));
