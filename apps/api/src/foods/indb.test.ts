import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import { convertIndb, INDB_GROUP, readIndbCsv } from './indb.ts';

// The Indian Nutrient Databank's recipes for the food list (D-46). Synthetic rows in INDB.xlsx's
// columns; the real file is converted by `npm run indb:convert`.

const HEADER = ['food_code', 'food_name', 'primarysource', 'energy_kcal', 'carb_g', 'protein_g', 'fat_g', 'fibre_g', 'servings_unit', 'unit_serving_energy_kcal'];

function recipe(code: string, name: string, kcal: string, carbs: string, protein: string, fat: string, fibre: string, unit: string, servingKcal: string) {
  return [code, name, 'bfp_manual', kcal, carbs, protein, fat, fibre, unit, servingKcal];
}

describe('D-46 converting INDB', () => {
  it('keeps the five values per 100 g, rounded to two decimals, and one serving weighing what its energy says', () => {
    const { foods, portions, skipped } = convertIndb([
      HEADER,
      recipe('BFP148', '  Plain   dosa ', '380.9123', '64.081', '10.344', '8.43', '5.2299', 'dosa', '137.62'),
      recipe('ASC001', 'Hot tea (Garam Chai)', '16.144', '2.58', '0.388', '0.532', '0', ' tea  cup ', '33.98'),
    ]);

    expect(skipped).toEqual([]);
    expect(foods).toEqual([
      ['food_code', 'name', 'category', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'],
      ['BFP148', 'Plain dosa', INDB_GROUP, '380.91', '10.34', '64.08', '8.43', '5.23'],
      ['ASC001', 'Hot tea (Garam Chai)', INDB_GROUP, '16.14', '0.39', '2.58', '0.53', '0'],
    ]);
    // 100 g × 137.62 / 380.9123 = 36.13 g; 100 g × 33.98 / 16.144 = 210.48 g.
    expect(portions).toEqual([
      ['food_code', 'seq', 'description', 'grams'],
      ['BFP148', '1', '1 dosa', '36.13'],
      ['ASC001', '1', '1 tea cup', '210.48'],
    ]);
  });

  it('keeps a recipe without a usable serving in grams only, and leaves out one with a value missing or out of range', () => {
    const { foods, portions, skipped } = convertIndb([
      HEADER,
      recipe('BFP001', 'No serving', '100', '10', '5', '2', '1', '', ''),
      recipe('BFP002', 'Serving over 2,000 g', '10', '1', '1', '0', '0', 'jar', '210'),
      recipe('BFP003', 'Serving under 1 g', '400', '50', '5', '20', '1', 'pinch', '2'),
      recipe('BFP004', 'Missing fibre', '100', '10', '5', '2', '', 'bowl', '200'),
      recipe('BFP005', 'Too much fat', '950', '0', '0', '101', '0', 'spoon', '50'),
      recipe('XYZ006', 'Wrong code', '100', '10', '5', '2', '1', 'bowl', '200'),
      recipe('BFP001', 'Same code again', '100', '10', '5', '2', '1', 'bowl', '200'),
    ]);

    expect(foods.slice(1).map((row) => row[0])).toEqual(['BFP001', 'BFP002', 'BFP003']);
    expect(portions).toHaveLength(1);
    expect(skipped).toEqual(['Missing fibre', 'Too much fat', 'Wrong code', 'Same code again']);
  });

  it('refuses a sheet without INDB’s columns', () => {
    expect(() => convertIndb([['food_code', 'food_name']])).toThrow(FoodListError);
  });
});

describe('D-46 reading the INDB files for foods:import', () => {
  it('reads what the converter writes, every value estimated, the serving by its label', () => {
    const { foods, portions } = convertIndb([HEADER, recipe('BFP148', 'Plain dosa', '380.91', '64.08', '10.34', '8.43', '5.23', 'dosa', '137.62')]);

    const read = readIndbCsv(toCsv(foods), toCsv(portions));

    expect(read.foods).toEqual([expect.objectContaining({ code: 'BFP148', name: 'Plain dosa', kcal: '380.91', estimated: true, foodGroup: INDB_GROUP })]);
    expect(read.portions).toEqual([{ code: 'BFP148', seq: 1, label: 'Dosa', grams: 36.13 }]);
  });

  it('refuses a code that is not INDB’s, naming the file and line', () => {
    const foods = [['food_code', 'name', 'category', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'], ['12345678', 'Bread', 'x', '1', '1', '1', '1', '1']];
    expect(() => readIndbCsv(toCsv(foods), 'food_code,seq,description,grams\n')).toThrow('INDB foods, line 2: the food code is not ASC, BFP or OSR and 3 digits');
  });
});

describe('D-46 the committed INDB files', () => {
  it('read whole: 1,014 recipes with 917 servings, each recipe once', () => {
    const read = (name: string) => readFileSync(new URL(`../../../../data/foods/${name}`, import.meta.url), 'utf8');
    const { foods, portions } = readIndbCsv(read('indb-foods.csv'), read('indb-portions.csv'));

    expect(foods).toHaveLength(1_014);
    expect(portions).toHaveLength(917);
    expect(new Set(portions.map((portion) => portion.code)).size).toBe(917);
    expect(parseCsv(read('indb-foods.csv'))[0]).toEqual(['food_code', 'name', 'category', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g']);
  });
});
