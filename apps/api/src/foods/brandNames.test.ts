import { readFileSync } from 'node:fs';
import type { PackagedFood } from '@fitsphere/shared';
import { describe, expect, it } from 'vitest';
import { BRAND_NAMES_HEADER, readBrandNames, withBrandNames } from './brandNames.ts';
import { toCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import { readPackagedCsv, readPackagedNameFixes, withExtraPackaged, withNameFixes } from './offIndia.ts';

// D-89: each brand of Open Food Facts' packaged foods written one way, as the owner approves the rows of
// docs/data/brand-names-sheet.csv. Synthetic brands and products, made-up values, not real ones.

const sheet = (rows: string[][]) => toCsv([[...BRAND_NAMES_HEADER], ...rows]);
const food = (barcode: string, name: string, brand: string | null): PackagedFood => ({ barcode, name, brand, kcal: 500, proteinG: 7, carbsG: 60, fatG: 25, fibreG: null, servingGrams: null });

describe('D-89 brand names', () => {
  const ROWS = [
    ['Testannia Industries Ltd', 'Testannia', 'spelling', '2', 'approved', 'the same brand written another way'],
    ['Testania', 'Testannia', 'spelling', '1', 'approved', '"Testannia" misspelt'],
    ['TestKat', 'Testlé', 'maker', '2', 'approved', 'a product line of "Testlé"'],
    ['Testlo', 'Testannia', 'spelling', '1', 'proposed', 'waiting for the owner'],
  ];

  it('reads the sheet', () => {
    expect(readBrandNames(sheet(ROWS))).toEqual([
      { brand: 'Testannia Industries Ltd', newBrand: 'Testannia', kind: 'spelling', approved: true },
      { brand: 'Testania', newBrand: 'Testannia', kind: 'spelling', approved: true },
      { brand: 'TestKat', newBrand: 'Testlé', kind: 'maker', approved: true },
      { brand: 'Testlo', newBrand: 'Testannia', kind: 'spelling', approved: false },
    ]);
  });

  it('refuses a sheet with any wrong row, naming its line', () => {
    const refused = (rows: string[][]) => () => readBrandNames(sheet(rows));
    expect(() => readBrandNames('brand,new_brand\nA,B\n')).toThrow(FoodListError);
    expect(refused([...ROWS, ['Testania', 'Other', 'spelling', '1', 'proposed', 'twice']])).toThrow('line 6: the brand is empty, too long, or appears twice');
    expect(refused([['A brand', 'A brand', 'spelling', '1', 'proposed', 'same']])).toThrow('line 2: the new brand');
    expect(refused([['A brand', '', 'spelling', '1', 'proposed', 'none']])).toThrow('line 2: the new brand');
    expect(refused([['A brand', 'B brand', 'typo', '1', 'proposed', 'kind']])).toThrow('line 2: the kind must be spelling or maker');
    expect(refused([['A brand', 'B brand', 'spelling', 'many', 'proposed', 'count']])).toThrow('line 2: the products must be a whole number');
    expect(refused([['A brand', 'B brand', 'spelling', '1', 'yes', 'status']])).toThrow('line 2: the status must be proposed or approved');
    expect(refused([['A brand', 'B brand', 'spelling', '1', 'proposed', ' ']])).toThrow('line 2: the reason must be given');
    // One step each: a new brand the sheet changes again is refused.
    expect(refused([['A brand', 'B brand', 'spelling', '1', 'proposed', 'one'], ['B brand', 'C brand', 'spelling', '1', 'proposed', 'two']])).toThrow('line 2: the new brand is itself changed by another row');
  });

  it('applies the approved rows only: a spelling takes the one brand, a maker its name with the line kept in the product’s name', () => {
    const foods = [
      food('8900000000201', 'Marie Gold', 'Testannia Industries Ltd'),
      food('8900000000202', 'Good Day', 'Testania'),
      food('8900000000203', 'Chunky Caramel', 'TestKat'),
      food('8900000000204', 'TestKat 4 Finger', 'TestKat'),
      food('8900000000205', 'Rusk', 'Testlo'),
      food('8900000000206', 'Plain biscuits', null),
    ];

    const applied = withBrandNames(foods, readBrandNames(sheet([...ROWS, ['Gone Foods', 'Testannia', 'spelling', '1', 'approved', 'no longer listed']])));

    expect(applied.foods.map((fixed) => [fixed.name, fixed.brand])).toEqual([
      ['Marie Gold', 'Testannia'],
      ['Good Day', 'Testannia'],
      ['TestKat Chunky Caramel', 'Testlé'],
      ['TestKat 4 Finger', 'Testlé'],
      ['Rusk', 'Testlo'],
      ['Plain biscuits', null],
    ]);
    expect([applied.rebranded, applied.named, applied.notFound]).toEqual([4, 1, 1]);
    // Every other value is kept.
    expect(applied.foods[2]).toEqual({ ...foods[2], name: 'TestKat Chunky Caramel', brand: 'Testlé' });
  });

  it('the committed sheet reads, and names only brands the packaged foods have', () => {
    const read = (file: string) => readFileSync(new URL(`../../../../${file}`, import.meta.url), 'utf8');
    const names = readBrandNames(read('docs/data/brand-names-sheet.csv'));
    const packaged = withNameFixes(
      withExtraPackaged(readPackagedCsv(read('data/foods/off-india-products.csv')), readPackagedCsv(read('data/foods/off-india-extra.csv'))),
      readPackagedNameFixes(read('docs/data/packaged-name-fixes.csv')),
    ).foods;
    const brands = new Set(packaged.map((product) => product.brand));

    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !brands.has(name.brand)).map((name) => name.brand)).toEqual([]);
    // As if every row were approved, every brand is found and the list keeps its length.
    const all = withBrandNames(packaged, names.map((name) => ({ ...name, approved: true })));
    expect(all.notFound).toBe(0);
    expect(all.foods).toHaveLength(packaged.length);
  });
});
