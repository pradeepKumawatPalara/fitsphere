import { describe, expect, it } from 'vitest';
import { servingGramsAgree } from '../sync.ts';
import { ANOTHER_BASE_NOTE, WEAK_MATCH_ISSUE } from './consolidated.ts';
import { toCsv } from './csv.ts';
import { DISH_ESTIMATES_HEADER, readDishEstimatesSheet } from './dishEstimates.ts';
import {
  convertFoodUnits,
  drinkGramsPerMl,
  FOOD_UNITS_HEADER,
  opensOnOf,
  readAllowedUnits,
  readFoodUnitsSheet,
  withPackagedUnits,
  withSheetUnits,
  type FoodUnitsInput,
} from './foodUnits.ts';
import { FoodListError } from './ifct.ts';
import { HOME_FOODS_HEADER } from './homeFoods.ts';

// D-102: the owner's consolidated food database's Default Unit and Allowed Units. The workbook's rows
// below are synthetic: made-up foods and values in its columns, to check the rules.

const DISH_HEADER = [
  'Base Food Item',
  'Dish Name',
  'Portion Type',
  'Default Unit',
  'Allowed Units',
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
];
const GENERIC_HEADER = ['Item ID', 'Food Item', 'Group', 'Portion Type', 'Default Unit', 'Allowed Units'];
const PACKAGED_HEADER = ['Brand', 'Product Name', 'Barcode', 'Portion Type', 'Default Unit', 'Allowed Units'];

const VESSELS = 'katori:129.0g | bowl:215.0g | cup:172.0g | plate:301.0g | tablespoon:12.9g | gram:1g';
// A dish's row; values per 100 g as kcal, protein, fat, carbs, fibre.
const dish = (base: string, name: string, def: string, units: string, confidence: string, values = ['130', '4', '0.5', '27', '1'], serving = 'idli', grams = '45') =>
  [base, name, 'piece', def, units, 'idli', 'Generated (test)', confidence, serving, grams, ...values];

const estimate = (code: string, name: string, base: string, serving: string, grams: string) =>
  [code, name, base, 'approved', '', '100 g', '120', '6', '14', '4.5', '3', serving, grams, 'test dal', 'dal_tadka', 'C', 'Estimated (test)', '2026-11-10', 'llm'];

function input(more: Partial<FoodUnitsInput> = {}): FoodUnitsInput {
  return {
    dishes: [
      DISH_HEADER,
      dish('Rice', 'Test Idli', 'idli', 'idli:25.1g | plate (4 pc):100.4g | gram:1g', 'A - measured', ['137.5', '4', '0.5', '30', '1']),
      dish('Urad Dal', 'Test Idli', 'idli', 'idli:45.0g | plate (4 pc):180.0g | gram:1g', 'C - estimated'),
      dish('Rice Flour', 'Test Idli', 'katori', 'katori:150.0g | gram:1g', 'D - estimated (weak match)'),
      dish('Rice', 'Test boiled rice', 'plate', VESSELS, 'A - measured', ['117', '2.6', '0.2', '25.7', '1.3'], 'plate', '300'),
      dish('Test Dal', 'Test Dal Tadka', 'katori', 'katori:150.0g | bowl:250.0g | tablespoon:15.0g | gram:1g', 'C - estimated'),
      dish('Milk', 'Test Hot Milk', 'glass', 'glass:200.0g | cup:160.0g | katori:120.0g | tablespoon:12.0g | millilitre:0.8g', 'C - estimated'),
      dish('Milk', 'Test Milk Fudge', 'glass', 'glass:200.0g | cup:160.0g | millilitre:0.8g', 'C - estimated'),
      dish('Test Base', 'Test Unknown Dish', 'katori', 'katori:150.0g | gram:1g', 'C - estimated'),
    ],
    generic: [
      GENERIC_HEADER,
      ['IFCT-Z001', 'Test banana', 'Fruit', 'piece', 'medium', 'medium:120.0g | gram:1g'],
      ['IFCT-Z002', 'Test oats, other', 'Cereal', 'weight', 'gram', 'gram:1g | cup:80.0g'],
      ['GEN-900', 'Test black coffee', 'Beverage', 'liquid', 'cup', 'cup:150.0g | millilitre:0.75g'],
    ],
    packaged: [
      PACKAGED_HEADER,
      ['Test', 'Test chips', '8900000000001', 'weight', 'serving', 'serving:30.0g | gram:1g | katori:150.0g'],
      ['Test', 'Test bar', '8900000000002', 'piece', 'bar', 'bar:20.0g | pack:20.0g | gram:1g'],
      ['Test', 'Test drink', '8900000000003', 'liquid', 'serving', 'serving:200.0g | glass:250.0g | millilitre:1g'],
      ['Test', 'Not ours', '8900000000999', 'weight', 'gram', 'gram:1g'],
    ],
    ifct: [
      { code: 'Z001', name: 'Test banana' },
      { code: 'Z002', name: 'Test oats' },
    ],
    indb: [
      { code: 'Z101', name: 'Test Idli' },
      { code: 'Z102', name: 'Test boiled rice (Test chawal)' },
      { code: 'Z103', name: 'Test Milk Fudge' },
    ],
    servings: new Map([
      ['indb Z101', [{ label: 'Idli', grams: 25.06 }]],
      ['indb Z102', [{ label: 'Plate', grams: 300 }]],
      ['dish_estimate est-test-dal-tadka', [{ label: 'Katori', grams: 150 }]],
    ]),
    estimatesSheet: [[...DISH_ESTIMATES_HEADER], estimate('est-test-dal-tadka', 'Test Dal Tadka', 'Test Dal', '1 katori', '150'), estimate('est-test-hot-milk', 'Test Hot Milk', 'Milk', '1 glass', '200')],
    homeSheet: [
      [...HOME_FOODS_HEADER],
      ['home-test-black-coffee', 'Test black coffee', 'beverage', 'approved', '100 g', '2', '0.1', '0', '0', '0', '1 cup', '150', '', '2026-11-12', "GEN-900 of the owner's consolidated food database (Generic unbranded); C - estimated", 'llm'],
    ],
    packagedServings: new Map([
      ['8900000000001', 25],
      ['8900000000002', null],
      ['8900000000003', null],
    ]),
    readOn: '2026-11-13',
    ...more,
  };
}

const unitsRow = (sheet: string[][], source: string, code: string) => sheet.find((row) => row[0] === source && row[1] === code);

describe('D-102 the units of the owner’s consolidated food database', () => {
  it('reads Allowed Units as the file writes them, and refuses anything else', () => {
    expect(readAllowedUnits(VESSELS)).toEqual([
      { name: 'katori', grams: 129 },
      { name: 'bowl', grams: 215 },
      { name: 'cup', grams: 172 },
      { name: 'plate', grams: 301 },
      { name: 'tablespoon', grams: 12.9 },
      { name: 'gram', grams: 1 },
    ]);
    expect(readAllowedUnits('plate (4 pc):100.4g')).toEqual([{ name: 'plate (4 pc)', grams: 100.4 }]);
    expect(() => readAllowedUnits('katori 129 g')).toThrow(FoodListError);
  });

  it('gives each food its units and the unit its page opens on: Grams for gram, ml for millilitre', () => {
    const { unitsSheet, report } = convertFoodUnits(input());
    expect(unitsSheet[0]).toEqual([...FOOD_UNITS_HEADER]);
    expect(unitsRow(unitsSheet, 'indb', 'Z102')).toEqual(['indb', 'Z102', 'Test boiled rice (Test chawal)', 'Plate', 'Katori:129 | Bowl:215 | Cup:172 | Plate:301 | Tablespoon:12.9']);
    expect(unitsRow(unitsSheet, 'ifct2017', 'Z001')).toEqual(['ifct2017', 'Z001', 'Test banana', 'Medium', 'Medium:120']);
    // An IFCT row is IFCT's food only when the names agree, as in D-94.
    expect(unitsRow(unitsSheet, 'ifct2017', 'Z002')).toBeUndefined();
    expect(report.unmatched).toEqual({ dishes: 1, packaged: 1, generic: 1 });
    // A generic food D-94 made a home-style food gets its units there.
    expect(unitsRow(unitsSheet, 'home', 'home-test-black-coffee')).toEqual(['home', 'home-test-black-coffee', 'Test black coffee', 'Cup', 'Cup:200 | ml:1']);
  });

  it('R2: a dish under several base foods keeps the row whose unit weighs its serving; another base’s is a dish of its own', () => {
    const { unitsSheet, estimatesSheet, report } = convertFoodUnits(input());
    expect(unitsRow(unitsSheet, 'indb', 'Z101')).toEqual(['indb', 'Z101', 'Test Idli', 'Idli', 'Idli:25.1 | Plate (4 pc):100.4']);
    const added = estimatesSheet.find((row) => row[1] === 'Test Idli (Urad Dal)')!;
    expect(added).toEqual([
      'est-test-idli-urad-dal',
      'Test Idli (Urad Dal)',
      'Urad Dal',
      'approved',
      '',
      '100 g',
      '130',
      '4',
      '27',
      '0.5',
      '1',
      '1 idli',
      '45',
      'urad dal',
      'idli',
      'C',
      `Generated (test)${ANOTHER_BASE_NOTE}`,
      '2026-11-13',
      'llm',
    ]);
    expect(unitsRow(unitsSheet, 'dish_estimate', 'est-test-idli-urad-dal')).toEqual(['dish_estimate', 'est-test-idli-urad-dal', 'Test Idli (Urad Dal)', 'Idli', 'Idli:45 | Plate (4 pc):180']);
    // A row the file rates D (a weak match) is held, as D-62 and D-94 hold them, and gets no units.
    expect(estimatesSheet.find((row) => row[1] === 'Test Idli (Rice Flour)')).toMatchObject({ 3: 'held', 4: WEAK_MATCH_ISSUE, 15: 'D' });
    expect(unitsSheet.some((row) => row[2] === 'Test Idli (Rice Flour)')).toBe(false);
    expect(report.anotherBaseAdded).toEqual(['Test Idli (Urad Dal)']);
    // Every row passes the sheet's own checks.
    expect(readDishEstimatesSheet(toCsv(estimatesSheet)).foods.map((food) => food.code)).toEqual(['est-test-dal-tadka', 'est-test-hot-milk', 'est-test-idli-urad-dal']);
  });

  it('R2: an estimated dish keeps the row of its own base food', () => {
    const { unitsSheet } = convertFoodUnits(
      input({
        dishes: [
          DISH_HEADER,
          dish('Test Lentil', 'Test Dal Tadka', 'bowl', 'bowl:200.0g | gram:1g', 'C - estimated'),
          dish('Test Dal', 'Test Dal Tadka', 'katori', 'katori:150.0g | bowl:250.0g | gram:1g', 'C - estimated'),
        ],
      }),
    );
    expect(unitsRow(unitsSheet, 'dish_estimate', 'est-test-dal-tadka')).toEqual(['dish_estimate', 'est-test-dal-tadka', 'Test Dal Tadka', 'Katori', 'Katori:150 | Bowl:250']);
  });

  it('R3: a packaged food keeps its label’s serving; the file’s is used only when the label gives none', () => {
    const { unitsSheet, report } = convertFoodUnits(input());
    expect(unitsRow(unitsSheet, 'packaged', '8900000000001')).toEqual(['packaged', '8900000000001', '', 'Serving', 'Katori:150']);
    expect(unitsRow(unitsSheet, 'packaged', '8900000000002')).toEqual(['packaged', '8900000000002', '', 'Bar', 'Bar:20 | Pack:20']);
    expect(unitsRow(unitsSheet, 'packaged', '8900000000003')).toEqual(['packaged', '8900000000003', '', 'Serving', 'Serving:200 | Glass:250 | ml:1']);
    expect(report.labelServingKept).toBe(1);
  });

  it('R5: a drink counted below 1 g per ml is fixed (milk 1.03, others 1.00); a food the file calls liquid is only reported', () => {
    const { unitsSheet, mlFixes } = convertFoodUnits(input());
    expect(unitsRow(unitsSheet, 'dish_estimate', 'est-test-hot-milk')).toEqual([
      'dish_estimate',
      'est-test-hot-milk',
      'Test Hot Milk',
      'Glass',
      'Glass:257.5 | Cup:206 | Katori:154.5 | Tablespoon:15.5 | ml:1.03',
    ]);
    expect(mlFixes.slice(1).map((row) => [row[1], row[4], row[5], row[8]])).toEqual([
      ['Test Hot Milk', '0.8', '1.03', 'fixed: milk or a milk drink, 1.03 g per ml'],
      ['Test Milk Fudge', '0.8', '0.8', 'not a drink: check, not changed'],
      ['Test black coffee', '0.75', '1', 'fixed: a drink, 1.00 g per ml'],
    ]);
    expect(drinkGramsPerMl('Milk, whole, Cow')).toBe(1.03);
    expect(drinkGramsPerMl('Mango Lassi')).toBe(1.03);
    expect(drinkGramsPerMl('Homemade Coconut Milk')).toBe(1);
    expect(drinkGramsPerMl('Jaggery Coffee Without Milk')).toBe(1);
    expect(drinkGramsPerMl('Masala Soda Shikanji')).toBe(1);
    expect(drinkGramsPerMl('Milk Sooji Fudge')).toBeNull();
    expect(drinkGramsPerMl('Thandai Mousse')).toBeNull();
  });

  it('changes nothing more when run again on its own output', () => {
    const first = convertFoodUnits(input());
    const second = convertFoodUnits(input({ estimatesSheet: first.estimatesSheet }));
    expect(second.estimatesSheet).toEqual(first.estimatesSheet);
    expect(second.unitsSheet).toEqual(first.unitsSheet);
    expect(second.mlFixes).toEqual(first.mlFixes);
  });

  it('reads the units sheet whole, and refuses a bad row naming its line', () => {
    const sheet = (...rows: string[][]) => toCsv([[...FOOD_UNITS_HEADER], ...rows]);
    const read = readFoodUnitsSheet(sheet(['indb', 'Z102', 'Test rice', 'Plate', 'Katori:129 | Plate:301'], ['packaged', '890', '', 'Grams', '']));
    expect(read.get('indb Z102')).toEqual({ opensOn: 'Plate', units: [{ label: 'Katori', grams: 129 }, { label: 'Plate', grams: 301 }] });
    expect(read.get('packaged 890')).toEqual({ opensOn: 'Grams', units: [] });
    for (const [row, problem] of [
      [['usda', 'Z1', '', '', 'Cup:1'], 'source'],
      [['indb', 'Z1', '', '', 'oz:28.35'], 'oz'],
      [['indb', 'Z1', '', '', 'Cup:2001'], 'at most 2,000'],
      [['indb', 'Z1', '', '', 'Cup:0'], 'more than 0'],
      [['indb', 'Z1', '', '', 'Cup:1.234'], 'two decimals'],
      [['indb', 'Z1', '', '', 'Cup:1 | cup:2'], 'twice'],
      [['indb', 'Z1', '', '', ''], 'units or the unit'],
    ] as const) {
      expect(() => readFoodUnitsSheet(sheet([...row]))).toThrow(new RegExp(`line 2: .*${problem.replace('.', '\\.')}`));
    }
    expect(() => readFoodUnitsSheet(sheet(['indb', 'Z1', '', '', 'Cup:1'], ['indb', 'Z1', '', '', 'Cup:1']))).toThrow(/line 3: indb Z1 appears twice/);
  });

  it('R1: a unit the food has by that name takes the sheet’s grams; the others come after its own', () => {
    const portions = [
      { code: 'Z101', seq: 1, label: '1 plate', grams: 300 },
      { code: 'Z101', seq: 2, label: 'Plate', grams: 668.13 },
      { code: 'Z200', seq: 1, label: 'Bowl', grams: 200 },
    ];
    const units = new Map([['Z101', { opensOn: 'Plate', units: [{ label: 'plate', grams: 150.5 }, { label: 'Katori', grams: 64.5 }] }], ['Z300', { opensOn: null, units: [{ label: 'Cup', grams: 80 }] }]]);
    expect(withSheetUnits(portions, units)).toEqual({
      portions: [
        { code: 'Z101', seq: 1, label: '1 plate', grams: 300 },
        { code: 'Z101', seq: 2, label: 'Plate', grams: 150.5 },
        { code: 'Z101', seq: 3, label: 'Katori', grams: 64.5 },
        { code: 'Z200', seq: 1, label: 'Bowl', grams: 200 },
        { code: 'Z300', seq: 1, label: 'Cup', grams: 80 },
      ],
      replaced: 1,
      added: 2,
    });
    // The input is not changed.
    expect(portions[1]!.grams).toBe(668.13);
    // The page opens on a measure the food has, named as the food names it.
    expect(opensOnOf([{ code: 'Z101', seq: 2, label: 'Plate', grams: 150.5 }], new Map([['Z101', { opensOn: 'plate', units: [] }], ['Z102', { opensOn: 'Grams', units: [] }], ['Z103', { opensOn: 'Cup', units: [] }]]))).toEqual(
      new Map([
        ['Z101', 'Plate'],
        ['Z102', 'Grams'],
      ]),
    );
  });

  it('R3 at import: a packaged food’s units leave out a second Serving, and its page opens only on what it has', () => {
    const food = { barcode: '890', servingGrams: 25 };
    expect(withPackagedUnits(food, { opensOn: 'Serving', units: [{ label: 'Serving', grams: 30 }, { label: 'Katori', grams: 150 }] })).toEqual({ ...food, portions: [{ label: 'Katori', grams: 150 }], opensOn: 'Serving' });
    expect(withPackagedUnits({ ...food, servingGrams: null }, { opensOn: 'Serving', units: [{ label: 'Katori', grams: 150 }] })).toEqual({ ...food, servingGrams: null, portions: [{ label: 'Katori', grams: 150 }] });
    expect(withPackagedUnits(food, undefined)).toBe(food);
  });
});

describe('D-102 the sync’s grams check of a serving', () => {
  it('accepts what it accepted before, and a count typed with two decimals', () => {
    // Before: the grams per serving within 0.02.
    expect(servingGramsAgree(28, 2, 56)).toBe(true);
    expect(servingGramsAgree(28.35, 0.5, 14.18)).toBe(true);
    expect(servingGramsAgree(25.06, 10, 250.7)).toBe(true);
    // A typed count: 1.25 katori of 129 g, 0.01 of a 4.8 g teaspoon (0.05 g, rounded).
    expect(servingGramsAgree(129, 1.25, 161.25)).toBe(true);
    expect(servingGramsAgree(4.8, 0.01, 0.05)).toBe(true);
    expect(servingGramsAgree(1.03, 250, 257.5)).toBe(true);
    // Other grams are refused.
    expect(servingGramsAgree(129, 1.25, 170)).toBe(false);
    expect(servingGramsAgree(150.5, 1, 668.13)).toBe(false);
  });
});
