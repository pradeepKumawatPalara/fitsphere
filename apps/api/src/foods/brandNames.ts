// docs/data/brand-names-sheet.csv (D-89): the brands of Open Food Facts' packaged foods, each written one
// way, as the owner approves them row by row. A brand written several ways ("Haldirams", "Haldiram’s",
// "Haldiram s"; "Britania"; "The Coca-Cola Company") takes the one spelling (`spelling`). A brand that
// is a product line of a maker whose name the same product also carries ("KitKat", "Nestlé") takes the
// maker's name, the line kept at the front of the product's name: "Chunky Caramel" under "KitKat"
// becomes "KitKat Chunky Caramel" under "Nestlé" (`maker`). `proposed` rows wait for the owner and are
// not applied. So Search foods counts each brand once and shows each product once (D-61, D-78).
import type { PackagedFood } from '@fitsphere/shared';
import { parseCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import { BRAND_MAX, NAME_MAX } from './offIndia.ts';

export const BRAND_NAMES_HEADER: readonly string[] = ['brand', 'new_brand', 'kind', 'products', 'status', 'reason'];

export const BRAND_NAME_KINDS = ['spelling', 'maker'] as const;

export const BRAND_NAME_STATUSES = ['proposed', 'approved'] as const;

export type BrandName = { brand: string; newBrand: string; kind: (typeof BRAND_NAME_KINDS)[number]; approved: boolean };

/** Parses and checks the whole sheet; any problem refuses all of it, naming the line. */
export function readBrandNames(text: string): BrandName[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== BRAND_NAMES_HEADER.join(',')) throw new FoodListError(`The brand names' header must be: ${BRAND_NAMES_HEADER.join(',')}`);
  const seen = new Set<string>();
  const names = rows.map((row, index): BrandName => {
    const line = `Brand names, line ${index + 2}`;
    if (row.length !== BRAND_NAMES_HEADER.length) throw new FoodListError(`${line}: ${row.length} fields`);
    const [brand = '', newBrand = '', kind = '', products = '', status = '', reason = ''] = row;
    if (!brand.trim() || brand.length > BRAND_MAX || seen.has(brand)) throw new FoodListError(`${line}: the brand is empty, too long, or appears twice`);
    seen.add(brand);
    if (!newBrand.trim() || newBrand !== newBrand.trim() || newBrand.length > BRAND_MAX || newBrand === brand) throw new FoodListError(`${line}: the new brand`);
    if (!(BRAND_NAME_KINDS as readonly string[]).includes(kind)) throw new FoodListError(`${line}: the kind must be spelling or maker`);
    if (!/^\d+$/.test(products)) throw new FoodListError(`${line}: the products must be a whole number`);
    if (!(BRAND_NAME_STATUSES as readonly string[]).includes(status)) throw new FoodListError(`${line}: the status must be proposed or approved`);
    if (!reason.trim()) throw new FoodListError(`${line}: the reason must be given`);
    return { brand, newBrand, kind: kind as BrandName['kind'], approved: status === 'approved' };
  });
  // One step each: a new brand is never a brand the sheet changes again.
  const changed = new Set(names.map((name) => name.brand));
  const chained = names.findIndex((name) => changed.has(name.newBrand));
  if (chained >= 0) throw new FoodListError(`Brand names, line ${chained + 2}: the new brand is itself changed by another row`);
  return names;
}

/** A text's letters and digits, lowercase and without accents, to tell whether a name already has a brand. */
const letters = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * The packaged foods with the approved brand names applied (D-89): a brand's foods take its new brand;
 * under a maker's name, a food whose name lacks its line has the line put at its front, unless that
 * makes the name too long. Proposed rows are left out; an approved row whose brand no food has is
 * counted, not applied.
 */
export function withBrandNames(
  foods: readonly PackagedFood[],
  names: readonly BrandName[],
): { foods: PackagedFood[]; rebranded: number; named: number; notFound: number } {
  const approved = new Map(names.filter((name) => name.approved).map((name) => [name.brand, name]));
  let rebranded = 0;
  let named = 0;
  const used = new Set<string>();
  const result = foods.map((food): PackagedFood => {
    const change = food.brand === null ? undefined : approved.get(food.brand);
    if (!change || food.brand === null) return food;
    used.add(change.brand);
    rebranded += 1;
    const line = `${food.brand} ${food.name}`;
    if (change.kind === 'maker' && !letters(food.name).includes(letters(food.brand)) && line.length <= NAME_MAX) {
      named += 1;
      return { ...food, name: line, brand: change.newBrand };
    }
    return { ...food, brand: change.newBrand };
  });
  return { foods: result, rebranded, named, notFound: [...approved.keys()].filter((brand) => !used.has(brand)).length };
}
