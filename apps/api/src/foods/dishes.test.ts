import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECIPE_SHEET_HEADER, readRecipeSheet } from './dishes.ts';
import { FoodListError, readIfctCsv } from './ifct.ts';

// FitSphere's standard-recipe sheet and the dish values worked out from it (D-26 answer 3, amended
// 2026-10-30; D-28; docs/data/food-list-sources.md, "Dishes"). The test recipes below are synthetic:
// made-up grams to check the rules and the arithmetic, not recipe data. Their ingredients are real
// IFCT rows, so the values come from the food list as printed.

const FOODS = readIfctCsv(readFileSync(new URL('../../../../data/foods/ifct2017-foods.csv', import.meta.url), 'utf8'));
const COMMITTED_SHEET = readFileSync(new URL('../../../../docs/data/standard-recipe-sheet.csv', import.meta.url), 'utf8');

type Row = Partial<Record<string, string>>;

function sheetOf(...rows: Row[]): string {
  const field = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return [RECIPE_SHEET_HEADER.join(','), ...rows.map((row) => RECIPE_SHEET_HEADER.map((column) => field(row[column] ?? '')).join(','))]
    .join('\n')
    .concat('\n');
}

const MEASURED = { measured_by: 'Synthetic tester', date: '2026-10-30' };
const FLATBREAD: Row = {
  code: 'test_flatbread',
  dish: 'Test flatbread',
  portion_unit: 'piece',
  status: 'approved',
  ingredient_1: 'Wheat flour, atta',
  ifct_code_1: 'A019',
  raw_g_per_portion_1: '40',
  oil_or_ghee: 'Ghee',
  oil_or_ghee_ifct_code: 'T013',
  oil_or_ghee_g_per_portion: '5',
  pieces_per_batch: '10',
  ...MEASURED,
};
const DAL: Row = {
  code: 'test_dal',
  dish: 'Test dal',
  portion_unit: 'katori (200 ml)',
  status: 'approved',
  ingredient_1: 'Red gram, dal',
  ifct_code_1: 'B021',
  raw_g_per_portion_1: '33.33',
  ingredient_2: 'Onion, big',
  ifct_code_2: 'G017',
  raw_g_per_portion_2: '12.5',
  oil_or_ghee: 'Oil',
  oil_or_ghee_ifct_code: 'T005',
  oil_or_ghee_g_per_portion: '2.5',
  katoris_per_batch: '4.5',
  ...MEASURED,
};
const EGG: Row = {
  code: 'test_egg',
  dish: 'Test boiled egg',
  portion_unit: 'piece',
  status: 'approved',
  ingredient_1: 'Egg, poultry, whole, boiled',
  ifct_code_1: 'M004',
  cooked_g_per_piece: '45.5',
  pieces_per_batch: '6',
  ...MEASURED,
};

function read(...rows: Row[]) {
  return readRecipeSheet(sheetOf(...rows), FOODS);
}

function refusal(...rows: Row[]): string {
  try {
    read(...rows);
  } catch (error) {
    expect(error).toBeInstanceOf(FoodListError);
    return (error as Error).message;
  }
  throw new Error('expected the sheet to be refused');
}

describe('D-28 the committed recipe sheet', () => {
  const sheet = readRecipeSheet(COMMITTED_SHEET, FOODS);

  it('passes every check, with all 25 rows accounted for', () => {
    expect(sheet.dishes.length + sheet.pending.length + sheet.blocked.length).toBe(25);
  });

  it('holds the owner’s starter set of nine dishes', () => {
    const codes = [...sheet.dishes.map((dish) => dish.code), ...sheet.pending];
    expect(codes).toEqual(
      expect.arrayContaining(['boiled_egg', 'roti', 'phulka', 'plain_rice', 'toor_dal', 'moong_dal', 'aloo_gobi', 'idli', 'plain_dosa']),
    );
  });

  it('keeps the chicken curry blocked, so it is never imported', () => {
    expect(sheet.blocked).toEqual(['chicken_curry']);
    expect(sheet.dishes.map((dish) => dish.code)).not.toContain('chicken_curry');
  });
});

describe('D-28 values for one portion', () => {
  it('a piece dish: IFCT values per 100 g × the raw grams of each ingredient and the fat', () => {
    // A019 atta 40 g, and T013 ghee 5 g at 900 kcal per 100 g (estimated, D-26).
    expect(read(FLATBREAD).dishes).toEqual([
      { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 173, proteinG: 4.23, carbsG: 25.67, fatG: 5.61, fibreG: 4.54 },
    ]);
  });

  it('a katori dish, summed exactly and rounded once to hundredths', () => {
    // 331 × 33.33 + 48 × 12.5 + 900 × 2.5, all ÷ 100 = 138.8223 kcal.
    expect(read(DAL).dishes).toEqual([
      { code: 'test_dal', name: 'Test dal', portionUnit: 'katori', kcal: 138.82, proteinG: 7.42, carbsG: 19.6, fatG: 3.05, fibreG: 3.33 },
    ]);
  });

  it('the exception: an IFCT cooked entry, per gram of the cooked item', () => {
    // M004 boiled egg, 45.5 g cooked per piece.
    expect(read(EGG).dishes).toEqual([
      { code: 'test_egg', name: 'Test boiled egg', portionUnit: 'piece', kcal: 67.34, proteinG: 6.11, carbsG: 0, fatG: 4.8, fibreG: 0 },
    ]);
  });

  it('only approved rows are imported; pending and blocked rows are left out, even when filled in', () => {
    const sheet = read(FLATBREAD, { ...DAL, status: 'pending' }, { code: 'test_blocked', dish: 'Test blocked', portion_unit: 'piece', status: 'blocked' });

    expect(sheet.dishes.map((dish) => dish.code)).toEqual(['test_flatbread']);
    expect(sheet.pending).toEqual(['test_dal']);
    expect(sheet.blocked).toEqual(['test_blocked']);
  });

  it('a pending row may be part-filled while it is being measured', () => {
    expect(read({ code: 'test_dal', dish: 'Test dal', portion_unit: 'katori (200 ml)', status: 'pending', raw_g_per_portion_1: '30' }).pending).toEqual([
      'test_dal',
    ]);
  });
});

describe('D-28 an approved row must be complete', () => {
  it.each<[string, Row, RegExp]>([
    ['no measured_by', { ...FLATBREAD, measured_by: '' }, /needs measured_by/],
    ['no date', { ...FLATBREAD, date: '' }, /needs the date it was measured/],
    ['no pieces per batch', { ...FLATBREAD, pieces_per_batch: '' }, /needs pieces_per_batch/],
    ['katoris on a piece dish', { ...FLATBREAD, katoris_per_batch: '2' }, /leaves katoris_per_batch empty/],
    ['no katoris per batch', { ...DAL, katoris_per_batch: '' }, /needs katoris_per_batch/],
    ['pieces on a katori dish', { ...DAL, pieces_per_batch: '3' }, /leaves pieces_per_batch empty/],
    ['an ingredient without grams', { ...DAL, raw_g_per_portion_2: '' }, /ingredient 2 needs its name, IFCT code and raw grams/],
    ['an ingredient without its code', { ...DAL, ifct_code_2: '' }, /ingredient 2 needs its name, IFCT code and raw grams/],
    ['the fat without grams', { ...FLATBREAD, oil_or_ghee_g_per_portion: '' }, /give the oil or ghee its IFCT code and grams/],
    ['the fat without its code', { ...DAL, oil_or_ghee_ifct_code: '' }, /give the oil or ghee its IFCT code and grams/],
    ['no ingredient', { ...FLATBREAD, ingredient_1: '', ifct_code_1: '', raw_g_per_portion_1: '' }, /needs at least one ingredient/],
  ])('refuses %s', (_case, row, problem) => {
    expect(refusal(row)).toMatch(problem);
  });

  it('names the line of the row', () => {
    expect(refusal(FLATBREAD, { ...DAL, measured_by: '' })).toMatch(/^Recipe sheet line 3: /);
  });
});

describe('D-28 the rules for every row', () => {
  it.each<[string, Row, RegExp]>([
    ['an IFCT code not in the list', { ...FLATBREAD, ifct_code_1: 'A999' }, /A999 is not in the IFCT list/],
    ['an ingredient named differently from the list', { ...FLATBREAD, ingredient_1: 'Atta' }, /A019 is "Wheat flour, atta" in the IFCT list, not "Atta"/],
    ['a fat that is not an oil or fat', { ...FLATBREAD, oil_or_ghee_ifct_code: 'A019' }, /not an oil or fat in the IFCT list/],
    ['more than two decimals', { ...FLATBREAD, raw_g_per_portion_1: '40.555' }, /at most two decimals/],
    ['zero grams', { ...FLATBREAD, raw_g_per_portion_1: '0' }, /more than 0/],
    ['text for grams', { ...FLATBREAD, oil_or_ghee_g_per_portion: 'five' }, /oil_or_ghee_g_per_portion must be/],
    ['half a piece per batch', { ...FLATBREAD, pieces_per_batch: '2.5' }, /pieces_per_batch must be a whole number/],
    ['a date that does not exist', { ...FLATBREAD, date: '2026-02-30' }, /date must be a real date/],
    ['an unknown status', { ...FLATBREAD, status: 'done' }, /status must be pending, approved or blocked/],
    ['an unknown portion unit', { ...FLATBREAD, portion_unit: 'katori' }, /portion_unit must be "piece" or "katori \(200 ml\)"/],
    ['a code with capitals', { ...FLATBREAD, code: 'Test_flatbread' }, /the code must be/],
    ['a bad number in a pending row', { ...DAL, status: 'pending', katoris_per_batch: 'four' }, /katoris_per_batch must be/],
  ])('refuses %s', (_case, row, problem) => {
    expect(refusal(row)).toMatch(problem);
  });

  it('refuses a code or a dish name that appears twice', () => {
    expect(refusal(FLATBREAD, { ...DAL, code: 'test_flatbread' })).toMatch(/the code test_flatbread appears twice/);
    expect(refusal(FLATBREAD, { ...DAL, dish: 'test FLATBREAD' })).toMatch(/the dish "test FLATBREAD" appears twice/);
  });

  it('refuses a wrong header', () => {
    expect(() => readRecipeSheet('dish,portion_unit\nRoti,piece\n', FOODS)).toThrow(/header must be/);
  });

  it('skips rows a spreadsheet leaves with no values', () => {
    const text = `${sheetOf(FLATBREAD)}\n${','.repeat(RECIPE_SHEET_HEADER.length - 1)}\n`;
    expect(readRecipeSheet(text, FOODS).dishes).toHaveLength(1);
  });
});

describe('D-28 what an approved recipe may not use', () => {
  it('poultry, whose IFCT values are not confirmed raw', () => {
    const chicken: Row = { ...DAL, ingredient_1: 'Chicken, poultry, breast, skinless', ifct_code_1: 'N003' };
    expect(refusal(chicken)).toMatch(/N003: IFCT's poultry values are not confirmed raw \(D-28\)/);
  });

  it('a food hidden until it is checked against the IFCT book', () => {
    expect(refusal({ ...DAL, ingredient_1: 'Crab', ifct_code_1: 'Q001' })).toMatch(/Q001 is hidden until it is checked/);
  });

  it('a cooked IFCT entry given as raw grams, or the omelette M007 as a cooked entry', () => {
    expect(refusal({ ...EGG, cooked_g_per_piece: '', raw_g_per_portion_1: '45' })).toMatch(/M004 is a cooked IFCT entry/);
    expect(refusal({ ...EGG, ingredient_1: 'Egg, poultry, omlet', ifct_code_1: 'M007' })).toMatch(/an IFCT cooked entry \(M004\)/);
  });

  it('cooked grams beside raw grams or fat, or for a katori dish', () => {
    expect(refusal({ ...EGG, raw_g_per_portion_1: '45' })).toMatch(/leave raw_g_per_portion_1 empty/);
    expect(refusal({ ...EGG, oil_or_ghee: 'Oil', oil_or_ghee_ifct_code: 'T005', oil_or_ghee_g_per_portion: '2' })).toMatch(/takes no oil or ghee/);
    expect(refusal({ ...EGG, portion_unit: 'katori (200 ml)', pieces_per_batch: '', katoris_per_batch: '2' })).toMatch(/only for a piece dish/);
  });

  it('a portion too large to log 10 of', () => {
    // 320 × 40 + 900 × 300, ÷ 100 = 2,828 kcal; ten portions would pass one item's 20,000.
    expect(refusal({ ...FLATBREAD, oil_or_ghee_g_per_portion: '300' })).toMatch(/one portion would have 2828 kcal, more than 2000/);
  });
});

describe('D-28 a blocked row stays empty (DO NOT FILL)', () => {
  const BLOCKED: Row = { code: 'test_blocked', dish: 'Test blocked', portion_unit: 'katori (200 ml)', status: 'blocked' };

  it.each<[string, Row]>([
    ['grams', { raw_g_per_portion_1: '30' }],
    ['a count', { katoris_per_batch: '3' }],
    ['measured_by', { measured_by: 'Synthetic tester' }],
  ])('refuses %s in a blocked row', (_case, filled) => {
    expect(refusal({ ...BLOCKED, ...filled })).toMatch(/test_blocked is blocked \(DO NOT FILL\)/);
  });
});
