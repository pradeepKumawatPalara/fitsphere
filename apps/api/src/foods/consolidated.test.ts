import { describe, expect, it } from 'vitest';
import { convertConsolidated, otherNames, tidyName, WEAK_MATCH_ISSUE, type ConsolidatedInput } from './consolidated.ts';
import { toCsv } from './csv.ts';
import { DISH_ESTIMATES_HEADER, readDishEstimatesSheet } from './dishEstimates.ts';
import { readFoodAliases } from './foodAliases.ts';
import { HOME_FOODS_HEADER, readHomeFoodsSheet } from './homeFoods.ts';

// D-94: the owner's consolidated food database turned into FitSphere's sheets. The workbook's rows below
// are synthetic: made-up foods and values in its columns, to check the rules.

const DISH_HEADER = ['Base Food Item', 'Dish Name', 'Aliases', 'Search Text', 'Archetype', 'Data Source', 'Confidence', 'Serving Unit', 'Serving (g/ml)', 'Energy (kcal/100g)', 'Protein (g/100g)', 'Fat (g/100g)', 'Carbs (g/100g)', 'Fibre (g/100g)'];
const PACKAGED_HEADER = ['Brand', 'Product Name', 'Aliases', 'Search Text', 'Barcode'];
const GENERIC_HEADER = ['Item ID', 'Food Item', 'Group', 'Aliases', 'Regional Names', 'Search Text', 'Source', 'Confidence', 'Serving Unit', 'Serving (g/ml)', 'Energy (kcal/100g)', 'Protein (g/100g)', 'Fat (g/100g)', 'Carbs (g/100g)', 'Fibre (g/100g)'];

// A dish's row: values per 100 g as protein, fat, carbs, fibre, with kcal that agrees with them.
const dish = (base: string, name: string, aliases: string, confidence: string, values: [string, string, string, string, string], archetype = 'veg_gravy_sabzi', unit = 'katori', grams = '150') => [
  base,
  name,
  aliases,
  '',
  archetype,
  'Estimated (test)',
  confidence,
  unit,
  grams,
  ...values,
];
const SABZI_VALUES: [string, string, string, string, string] = ['100', '2.5', '6.5', '9', '2.5'];
const KOFTA_VALUES: [string, string, string, string, string] = ['180', '6', '10', '16', '2'];
const LASSI_VALUES: [string, string, string, string, string] = ['95', '2.8', '3', '14', '0.2'];

const estimate = (code: string, name: string, status: string, issue: string, kcal: string, protein: string, carbs: string, fat: string, confidence = 'C') =>
  [code, name, 'Test Base', status, issue, '100 g', kcal, protein, carbs, fat, '2', '1 katori', '150', 'test base', 'veg_gravy_sabzi', confidence, 'Estimated (test)', '2026-11-10', 'llm'];

function input(more: Partial<ConsolidatedInput> = {}): ConsolidatedInput {
  return {
    dishes: [
      DISH_HEADER,
      dish('Rice', 'Test pulao', 'test chawal test arisi', 'C - estimated', SABZI_VALUES),
      dish('Test Dal', 'Test pulao', 'test dal test chana', 'C - estimated', SABZI_VALUES),
      dish('Test Roll', 'Test roll', 'test wrap', 'C - estimated', SABZI_VALUES),
      dish('Test Base', 'Test Kofta', 'test kofte', 'C - estimated (re-checked)', KOFTA_VALUES, 'kofta_curry'),
      dish('Test Base', 'Test Idli', '', 'C - estimated (re-checked)', LASSI_VALUES, 'lassi_sweet'),
      dish('Test Base', 'Test Plain', '', 'C - estimated', SABZI_VALUES),
      dish('Test Veg / Tarkari', 'Test New Curry (', 'test tarkari test sabji', 'C - estimated', SABZI_VALUES),
      dish('Test Veg', 'Test Weak Dish', '', 'D - estimated (weak match)', SABZI_VALUES),
      dish('Test Base', 'Test Sabzi', 'test bhaji', 'C - estimated', SABZI_VALUES),
    ],
    packaged: [
      PACKAGED_HEADER,
      ['Test Dairy', 'Test toned milk', 'test doodh dudh', '', '8901234567890'],
      ['Test Dairy', 'Test curd', '', '', '8901234567891'],
      ['Test Dairy', 'Test butter', 'test makhan', '', '8901234567899'],
    ],
    generic: [
      GENERIC_HEADER,
      ['IFCT-Z001', 'Test millet', 'Test Cereal', 'test bajri Test baajra  Test pearl millet', 'Test baajra; Test pearl millet', '', 'IFCT', 'A - measured', 'portion (30 g)', '30', '360', '11', '5', '67', '11'],
      ['IFCT-Z002', 'Test barley, other', 'Test Cereal', 'test jau', '', '', 'IFCT', 'A - measured', 'portion (30 g)', '30', '330', '11', '1', '70', '15'],
      ['GEN-900', 'Test Greek Yogurt (plain)', 'Dairy', 'test dahi test curd', '', '', 'Estimated', 'C - estimated', 'cup (100 g)', '100', '97', '9', '5', '3.6', '0'],
      ['GEN-901', 'Test toast', 'Bakery', 'test pav', '', '', 'Estimated', 'C - estimated', 'slice (25 g)', '25', '300', '8', '10', '45', '2'],
      ['GEN-001', 'Test Curd / Dahi (cow milk)', 'Dairy', 'test mosaru', '', '', 'Estimated', 'C - estimated', 'katori (150 g)', '150', '60', '3.1', '3.3', '4.7', '0'],
    ],
    ifct: [
      { source: 'ifct2017', code: 'Z001', name: 'Test millet', kcal: 360 },
      { source: 'ifct2017', code: 'Z002', name: 'Test barley', kcal: 330 },
    ],
    indb: [
      { source: 'indb', code: 'Z001', name: 'Test pulao (Test chawal ka pulao)', kcal: 150 },
      { source: 'indb', code: 'Z002', name: 'Test roll (dry)', kcal: 200 },
      { source: 'indb', code: 'Z003', name: 'Test roll (curry)', kcal: 150 },
    ],
    estimatesSheet: [
      [...DISH_ESTIMATES_HEADER],
      estimate('est-test-sabzi', 'Test Sabzi', 'approved', '', '100', '2.5', '9', '6.5'),
      estimate('est-curd-plain', 'Test Curd (plain)', 'approved', '', '62', '3', '4.5', '3.5'),
      estimate('est-test-kofta', 'Test Kofta', 'held', WEAK_MATCH_ISSUE, '100', '2.5', '9', '6.5', 'D'),
      estimate('est-test-idli', 'Test Idli', 'held', '"idli" given the values of lassi sweet', '95', '2.8', '14', '3'),
      estimate('est-test-plain', 'Test Plain', 'held', 'just the plain food (IFCT or INDB has measured values)', '100', '2.5', '9', '6.5'),
    ],
    homeSheet: [
      [...HOME_FOODS_HEADER],
      ['home-test-toast', 'Test toast', 'test bread', 'approved', '100 g', '300', '8', '45', '10', '2', '1 slice', '25', '', '2026-11-06', 'ESTIMATE', 'llm'],
    ],
    barcodes: new Set(['8901234567890', '8901234567891']),
    readOn: '2026-11-12',
    ...more,
  };
}

const byCode = (rows: string[][]) => new Map(rows.slice(1).map((row) => [row[0]!, row]));

describe('D-94 reading the workbook’s other names', () => {
  it('keeps each regional name, and the Aliases cell’s other words once each as one name', () => {
    expect(otherNames('test bajri test pearl Test baajra  Test pearl millet', 'Test baajra; Test pearl millet')).toEqual({ names: ['Test baajra', 'Test pearl millet'], words: ['bajri'] });
    expect(otherNames('chana chana dal besan')).toEqual({ names: [], words: ['chana', 'dal', 'besan'] });
    expect(otherNames('')).toEqual({ names: [], words: [] });
  });

  it('tidies a name the file cut off', () => {
    expect(tidyName('Ghee Rice (')).toBe('Ghee Rice');
    expect(tidyName('Akki Rotti (Rice  Bread')).toBe('Akki Rotti (Rice Bread)');
  });
});

describe('D-94 the sheets made from the workbook', () => {
  const { aliases, estimatesSheet, homeSheet, report } = convertConsolidated(input());
  const named = new Map(aliases.slice(1).map((row) => [`${row[0]} ${row[1]}`, row[3]]));

  it('gives a dish’s other names to the food it is, by its name without brackets, those of each base food it is listed under', () => {
    expect(aliases[0]).toEqual(['source', 'code', 'name', 'aliases']);
    expect(named.get('indb Z001')).toBe('test chawal arisi dal chana');
    expect(named.get('dish_estimate est-test-sabzi')).toBe('test bhaji');
  });

  it('gives none to a name two foods share, and lists it', () => {
    expect([...named.keys()].some((key) => key.startsWith('indb Z00') && key !== 'indb Z001')).toBe(false);
    expect(report.ambiguous).toEqual(['Test roll: Test roll (dry) | Test roll (curry)']);
  });

  it('approves a held row the file now rates C with values that fit, with them', () => {
    expect(byCode(estimatesSheet).get('est-test-kofta')).toEqual([
      'est-test-kofta', 'Test Kofta', 'Test Base', 'approved', '', '100 g', '180', '6', '16', '10', '2', '1 katori', '150', 'test base', 'kofta_curry', 'C', 'Estimated (test)', '2026-11-12', 'llm',
    ]);
    expect(named.get('dish_estimate est-test-kofta')).toBe('test kofte');
    expect(report.heldApproved).toBe(1);
  });

  it('keeps held a row given the same values that did not fit it, and one that is another food', () => {
    expect(byCode(estimatesSheet).get('est-test-idli')![3]).toBe('held');
    expect(byCode(estimatesSheet).get('est-test-plain')![3]).toBe('held');
    expect(report.heldSameValues).toEqual(['Test Idli: "idli" given the values of lassi sweet']);
    expect(report.heldKept).toBe(2);
  });

  it('adds a dish FitSphere lacks: approved when rated C, its base food’s words to search by; held when only rated D', () => {
    expect(byCode(estimatesSheet).get('est-test-new-curry')).toEqual([
      'est-test-new-curry', 'Test New Curry', 'Test Veg / Tarkari', 'approved', '', '100 g', '100', '2.5', '9', '6.5', '2.5', '1 katori', '150', 'test veg; tarkari', 'veg_gravy_sabzi', 'C', 'Estimated (test)', '2026-11-12', 'llm',
    ]);
    expect(named.get('dish_estimate est-test-new-curry')).toBe('test tarkari sabji');
    expect(byCode(estimatesSheet).get('est-test-weak-dish')).toMatchObject({ 3: 'held', 4: WEAK_MATCH_ISSUE, 15: 'D' });
    expect(report).toMatchObject({ dishesAdded: 1, dishesAddedHeld: 1, failed: [] });
  });

  it('gives a packaged food’s other names by barcode, only for one FitSphere has', () => {
    expect(named.get('packaged 8901234567890')).toBe('test doodh dudh');
    expect(named.has('packaged 8901234567891')).toBe(false);
    expect(named.has('packaged 8901234567899')).toBe(false);
  });

  it('gives an IFCT food its regional names by code, when the names agree', () => {
    // "test" is a word of the regional names already.
    expect(named.get('ifct2017 Z001')).toBe('bajri; Test baajra; Test pearl millet');
    expect(named.has('ifct2017 Z002')).toBe(false);
    expect(report.ifctNotMatched).toEqual(['IFCT-Z002 Test barley, other']);
  });

  it('adds a generic food as a home-style food, flagged llm, with its serving and group', () => {
    expect(byCode(homeSheet).get('home-test-greek-yogurt-plain')).toEqual([
      'home-test-greek-yogurt-plain', 'Test Greek Yogurt (plain)', 'dairy', 'approved', '100 g', '97', '9', '3.6', '5', '0', '1 cup', '100', '', '2026-11-12',
      "GEN-900 of the owner's consolidated food database (Generic unbranded); C - estimated", 'llm',
    ]);
    expect(named.get('home home-test-greek-yogurt-plain')).toBe('test dahi curd');
  });

  it('gives a generic food FitSphere already has its other names, and does not add it', () => {
    expect(named.get('home home-test-toast')).toBe('test pav');
    expect(named.get('dish_estimate est-curd-plain')).toBe('test mosaru');
    expect(homeSheet).toHaveLength(3);
    expect(report.genericSameName).toEqual(['GEN-901 Test toast (300 kcal) → Test toast (300 kcal)']);
    expect(report.genericSameAs).toEqual(['GEN-001 Test Curd / Dahi (cow milk) → Test Curd (plain)']);
  });

  it('refuses a generic food listed as the same food when their energy is not alike', () => {
    const generic = input().generic.map((row) => (row[0] === 'GEN-001' ? row.map((cell, index) => (index === 10 ? '200' : cell)) : row));
    expect(() => convertConsolidated(input({ generic }))).toThrow(/GEN-001 .* is not the same as Test Curd \(plain\)/);
  });

  it('changes nothing more when run again on its own sheets', () => {
    const again = convertConsolidated(input({ estimatesSheet: estimatesSheet, homeSheet: homeSheet }));
    expect(again.estimatesSheet).toEqual(estimatesSheet);
    expect(again.homeSheet).toEqual(homeSheet);
    expect(again.aliases).toEqual(aliases);
  });

  it('writes sheets foods:import reads', () => {
    expect(readDishEstimatesSheet(toCsv(estimatesSheet))).toMatchObject({ held: 3 });
    expect(readHomeFoodsSheet(toCsv(homeSheet)).foods.map((food) => food.code)).toEqual(['home-test-toast', 'home-test-greek-yogurt-plain']);
    expect(readFoodAliases(toCsv(aliases))).toHaveLength(aliases.length - 1);
  });
});
