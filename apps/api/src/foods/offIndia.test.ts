import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import { exportColumns, PACKAGED_HEADER, packagedFromRow, packagedRow, readPackagedCsv, validBarcode } from './offIndia.ts';

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
