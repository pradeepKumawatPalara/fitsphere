import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import {
  exportColumns,
  PACKAGED_HEADER,
  PACKAGED_NAME_FIXES_HEADER,
  packagedFromRow,
  packagedRow,
  readPackagedCsv,
  readPackagedNameFixes,
  validBarcode,
  withExtraPackaged,
  withNameFixes,
} from './offIndia.ts';
import type { PackagedFood } from '@fitsphere/shared';

// Packaged foods sold in India, from Open Food Facts' data export (D-48; ADR-0009). Synthetic rows in
// the export's columns, not real products; the real export is converted by `npm run off:convert`.

const HEADER = [
  'code',
  'url',
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
];
const COLUMNS = exportColumns(HEADER);

type Row = Partial<Record<(typeof HEADER)[number], string>>;

/** A synthetic bread sold in India: 4 × 8 + 4 × 50 + 9 × 2 = 250 kcal, as given. Its barcode's check digit is right. */
const BREAD: Row = {
  code: '8901234567890',
  url: 'https://world.openfoodfacts.org/product/8901234567890',
  product_name: '  Test   sandwich bread ',
  brands: 'Test Foods,Test Group',
  countries_tags: 'en:india,en:nepal',
  serving_size: '2 slices (50 g)',
  serving_quantity: '50',
  'energy-kcal_100g': '250',
  energy_100g: '1046',
  proteins_100g: '8',
  carbohydrates_100g: '50',
  fat_100g: '2',
  fiber_100g: '3.456',
};

function row(values: Row): string[] {
  return HEADER.map((name) => values[name] ?? '');
}

function judge(changes: Row) {
  return packagedFromRow(COLUMNS, row({ ...BREAD, ...changes }));
}

describe('D-48 reading Open Food Facts’ export', () => {
  it('keeps a product sold in India with its name, first brand, values per 100 g and serving in grams', () => {
    expect(judge({})).toEqual({
      barcode: '8901234567890',
      name: 'Test sandwich bread',
      brand: 'Test Foods',
      kcal: 250,
      proteinG: 8,
      carbsG: 50,
      fatG: 2,
      fibreG: 3.46,
      servingGrams: 50,
    });
  });

  it('passes over a product not sold in India', () => {
    expect(judge({ countries_tags: 'en:france,en:indonesia' })).toBeNull();
  });

  it('takes kcal from kJ when kcal is not given, and leaves fibre and the serving out when not given in grams', () => {
    expect(judge({ 'energy-kcal_100g': '', energy_100g: '1046', fiber_100g: '', serving_size: '200 ml', serving_quantity: '200' })).toMatchObject({
      kcal: 250,
      fibreG: null,
      servingGrams: null,
    });
    expect(judge({ serving_quantity: '2500' })).toMatchObject({ servingGrams: null });
    expect(judge({ brands: '' })).toMatchObject({ brand: null });
  });

  it('leaves out a product without a usable barcode, name or values, or whose energy does not match them', () => {
    expect(judge({ code: '12345' })).toBe('barcode');
    expect(judge({ code: '8901234567892' })).toBe('barcode');
    expect(judge({ code: '00000604' })).toBe('barcode');
    expect(judge({ product_name: '8901234567890' })).toBe('name');
    expect(judge({ product_name: '' })).toBe('name');
    expect(judge({ proteins_100g: '' })).toBe('values');
    expect(judge({ fat_100g: '101' })).toBe('values');
    expect(judge({ 'energy-kcal_100g': '1200', energy_100g: '' })).toBe('values');
    // Per serving, not per 100 g: 125 kcal given, 250 by the nutrients.
    expect(judge({ 'energy-kcal_100g': '125' })).toBe('energy');
    // Within a quarter, or 20 kcal: a label's rounding is kept.
    expect(judge({ 'energy-kcal_100g': '230' })).toMatchObject({ kcal: 230 });
  });

  it('checks a barcode’s check digit, for EAN-13, EAN-8 and UPC-A, and leaves out GS1’s in-store codes', () => {
    // Right check digits, but codes shops give their own items.
    expect(['00000604', '20123451', '2001234567893'].map(validBarcode)).toEqual([false, false, false]);
    expect(['8901234567890', '96385074', '036000291452'].map(validBarcode)).toEqual([true, true, true]);
    expect(['8901234567893', '96385075', '036000291453', '00000000'].map(validBarcode)).toEqual([false, false, false, false]);
  });

  it('refuses an export without the columns it reads', () => {
    expect(() => exportColumns(['code', 'product_name'])).toThrow(FoodListError);
  });
});

describe('D-48 reading the packaged foods file for foods:import', () => {
  it('reads back what the converter writes', () => {
    const bread = judge({});
    if (bread === null || typeof bread === 'string') throw new Error('The bread was left out');
    const plain = { ...bread, barcode: '96385074', brand: null, fibreG: null, servingGrams: null };

    expect(readPackagedCsv(toCsv([[...PACKAGED_HEADER], packagedRow(bread), packagedRow(plain)]))).toEqual([bread, plain]);
  });

  it('refuses a barcode twice, or a value out of range, naming the line', () => {
    const line = '8901234567890,Bread,,250,8,50,2,,';
    expect(() => readPackagedCsv([PACKAGED_HEADER.join(','), line, line].join('\n'))).toThrow('Packaged foods, line 3');
    expect(() => readPackagedCsv([PACKAGED_HEADER.join(','), '8901234567890,Bread,,250,8,150,2,,'].join('\n'))).toThrow(
      'Packaged foods, line 2: a value is more than 100 g',
    );
  });
});

describe('D-48 the committed packaged foods file', () => {
  it('reads whole, each barcode once', () => {
    const foods = readPackagedCsv(readFileSync(new URL('../../../../data/foods/off-india-products.csv', import.meta.url), 'utf8'));

    expect(foods.length).toBeGreaterThan(1_000);
    expect(new Set(foods.map((food) => food.barcode)).size).toBe(foods.length);
  });
});

describe('D-62 the extra packaged products from the owner’s dish database', () => {
  const read = (file: string) => readPackagedCsv(readFileSync(new URL(`../../../../data/foods/${file}`, import.meta.url), 'utf8'));

  it('adds 11 products FitSphere lacked, none already listed', () => {
    const extra = read('off-india-extra.csv');
    const all = withExtraPackaged(read('off-india-products.csv'), extra);

    expect(extra).toHaveLength(11);
    expect(all).toHaveLength(read('off-india-products.csv').length + 11);
    expect(extra.find((food) => food.name === 'Bhujia sev 200g')).toMatchObject({ brand: "Haldiram'S", kcal: 592 });
  });

  it('refuses a barcode already listed, even with other leading zeros', () => {
    const [food] = read('off-india-extra.csv');
    if (!food) throw new Error('No extra product');

    expect(() => withExtraPackaged([food], [{ ...food, barcode: `0${food.barcode}` }])).toThrow(`barcode 0${food.barcode} is in both files`);
  });
});

describe('D-80 the packaged foods named only by their brand', () => {
  // Synthetic products named only by their brand, not real ones; their barcodes' check digits are right.
  const named = (barcode: string, name: string, brand: string): PackagedFood => ({
    barcode,
    name,
    brand,
    kcal: 450,
    proteinG: 7,
    carbsG: 70,
    fatG: 15,
    fibreG: null,
    servingGrams: null,
  });
  const ONE_PRODUCT = named('8901234500019', 'Testola', 'Testola');
  const MANY_PRODUCTS = named('8901234500026', 'Test Foods', 'Test Foods');
  const SOUP = named('8901234500033', 'test kitchen', 'Test Kitchen');
  // Its name and brand the wrong way round.
  const SWAPPED = named('8901234567890', 'TEST FOODS', 'CRUNCHY');
  const sheet = (...rows: string[]) => [PACKAGED_NAME_FIXES_HEADER.join(','), ...rows].join('\n');
  const SHEET = sheet(
    "8901234500019,Testola,Testola,keep,,,The brand is the product's own name",
    '8901234500026,Test Foods,Test Foods,remove,,,Test Foods makes many products',
    "8901234500033,Test Kitchen,test kitchen,rename,Tomato Soup,,Open Food Facts' generic name: Tomato Soup",
    '8901234567890,CRUNCHY,TEST FOODS,rename,Crunchy,Test Foods,Its name and brand the wrong way round',
    '96385074,Test Gone,Test Gone,remove,,,No longer listed',
  );

  it('reads the reviewed names', () => {
    expect(readPackagedNameFixes(SHEET)).toEqual([
      { barcode: '8901234500019', action: 'keep', newName: null, newBrand: null },
      { barcode: '8901234500026', action: 'remove', newName: null, newBrand: null },
      { barcode: '8901234500033', action: 'rename', newName: 'Tomato Soup', newBrand: null },
      { barcode: '8901234567890', action: 'rename', newName: 'Crunchy', newBrand: 'Test Foods' },
      { barcode: '96385074', action: 'remove', newName: null, newBrand: null },
    ]);
  });

  it('refuses a sheet with a mistake, naming the line', () => {
    expect(() => readPackagedNameFixes('barcode,name\n')).toThrow('header');
    expect(() => readPackagedNameFixes(sheet('8901234500019,Testola,Testola,hide,,,Why'))).toThrow('line 2: the action');
    expect(() => readPackagedNameFixes(sheet('8901234500019,Testola,Testola,rename,,,Why'))).toThrow('line 2: a new name');
    expect(() => readPackagedNameFixes(sheet('8901234500019,Testola,Testola,keep,Other,,Why'))).toThrow('line 2: a new name');
    expect(() => readPackagedNameFixes(sheet('8901234500019,Testola,Testola,remove,,Other,Why'))).toThrow('line 2: a new brand');
    expect(() => readPackagedNameFixes(sheet('8901234500019,Testola,Testola,keep,,,'))).toThrow('line 2: the reason');
    expect(() => readPackagedNameFixes(sheet('8901234500018,Testola,Testola,keep,,,Why'))).toThrow('line 2: the barcode');
    expect(() =>
      readPackagedNameFixes(sheet('8901234500019,Testola,Testola,keep,,,Why', '8901234500019,Testola,Testola,keep,,,Why')),
    ).toThrow('line 3: the barcode');
  });

  it('renames (and rebrands) and leaves out as reviewed, keeps every other food in its order, and counts a fix no longer listed', () => {
    const fixed = withNameFixes([ONE_PRODUCT, MANY_PRODUCTS, SWAPPED, SOUP], readPackagedNameFixes(SHEET));

    expect(fixed).toEqual({
      foods: [ONE_PRODUCT, { ...SWAPPED, name: 'Crunchy', brand: 'Test Foods' }, { ...SOUP, name: 'Tomato Soup' }],
      renamed: 2,
      removed: 1,
      notFound: 1,
    });
  });

  it('the committed sheet: 139 products reviewed, 86 kept, 7 renamed, 46 left out, and none left named only by its brand', () => {
    const read = (file: string) => readFileSync(new URL(`../../../../${file}`, import.meta.url), 'utf8');
    const fixes = readPackagedNameFixes(read('docs/data/packaged-name-fixes.csv'));
    const all = withExtraPackaged(readPackagedCsv(read('data/foods/off-india-products.csv')), readPackagedCsv(read('data/foods/off-india-extra.csv')));
    const listed = new Set(all.map((food) => food.barcode));
    const count = (action: string) => fixes.filter((fix) => fix.action === action).length;

    expect([fixes.length, count('keep'), count('rename'), count('remove')]).toEqual([139, 86, 7, 46]);
    for (const fix of fixes) expect(listed.has(fix.barcode), fix.barcode).toBe(true);
    const fixed = withNameFixes(all, fixes);
    expect([fixed.foods.length, fixed.renamed, fixed.removed, fixed.notFound]).toEqual([all.length - 46, 7, 46, 0]);
    const at = (barcode: string) => fixed.foods.find((food) => food.barcode === barcode);
    expect(at('8901030757501')).toMatchObject({ name: 'Tomato Soup', brand: 'Knorr' });
    expect(at('8901063092334')).toMatchObject({ name: 'Good Day', brand: 'Britannia' });
    for (const gone of ['8901262070430', '8906001387015', '8901058010572', '8901764061189']) expect(at(gone), gone).toBeUndefined();

    // Every product still named only by its brand (letters and digits, a pack size left out) was reviewed and kept.
    const bare = (text: string) => text.toLowerCase().replace(/\d+(\.\d+)?\s*(g|gm|ml|l|ltr|kg)\b/g, '').replace(/[^\p{L}\p{N}]/gu, '');
    const kept = new Set(fixes.filter((fix) => fix.action === 'keep').map((fix) => fix.barcode));
    const brandOnly = fixed.foods.filter((food) => food.brand && bare(food.name).replace(bare(food.brand), '') === '');
    expect(brandOnly.filter((food) => !kept.has(food.barcode)).map((food) => food.barcode)).toEqual([]);
  });
});
