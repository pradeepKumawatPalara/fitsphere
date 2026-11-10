import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DISH_ESTIMATES_HEADER, readDishEstimatesSheet } from './dishEstimates.ts';
import { FoodListError } from './ifct.ts';

// FitSphere's estimated-dishes sheet (D-62; docs/data/dish-estimates-sheet.csv). The rows below are
// synthetic: made-up dishes and values to check the rules.

const COMMITTED = readFileSync(new URL('../../../../docs/data/dish-estimates-sheet.csv', import.meta.url), 'utf8');
const HEADER = DISH_ESTIMATES_HEADER.join(',');
// 4 × 2.5 + 4 × 9 + 9 × 6.5 = 104.5: agrees with 100 kcal.
const SABZI = 'est-test-sabzi,Test Sabzi,Test Veg / Tarkari,approved,,100 g,100,2.5,9,6.5,2.5,1 katori,150,test veg; tarkari,veg_gravy_sabzi,C,Generated (test),2026-11-10,llm';
const HELD = 'est-test-idli,Test Idli,Test Rice,held,"""idli"" given the values of lassi sweet",100 g,95,2.8,14,3,0.2,1 glass,250,test rice,lassi_sweet,C,Estimated (test),2026-11-10,llm';

function sheet(...rows: string[]) {
  return readDishEstimatesSheet([HEADER, ...rows].join('\n'));
}

function refused(...rows: string[]): string {
  try {
    sheet(...rows);
  } catch (error) {
    expect(error).toBeInstanceOf(FoodListError);
    return (error as Error).message;
  }
  throw new Error('The sheet was accepted');
}

describe('D-62 the committed estimated-dishes sheet', () => {
  it('passes every check: 5,025 dishes approved, 1,778 held back with their problem', () => {
    const { foods, portions, held } = readDishEstimatesSheet(COMMITTED);
    expect(foods).toHaveLength(5_025);
    expect(portions).toHaveLength(5_025);
    expect(held).toBe(1_778);
    expect(foods.every((food) => food.flag === 'llm' && food.estimated && food.code.startsWith('est-'))).toBe(true);
  });

  it('loads Bhindi Masala with its base food words, and holds back Rava Idli given a lassi’s values', () => {
    const { foods, portions } = readDishEstimatesSheet(COMMITTED);
    expect(foods.find((food) => food.code === 'est-bhindi-masala')).toMatchObject({
      name: 'Bhindi Masala',
      foodGroup: 'Okra / Bhindi',
      kcal: '100',
      aliases: ['okra', 'bhindi'],
    });
    expect(portions.find((portion) => portion.code === 'est-bhindi-masala')).toEqual({ code: 'est-bhindi-masala', seq: 1, label: 'Katori', grams: 150 });
    expect(foods.find((food) => food.code === 'est-classic-south-indian-rava-idli')).toBeUndefined();
    expect(COMMITTED).toContain('est-classic-south-indian-rava-idli,Classic South Indian Rava Idli,Rice,held,"""idli"" given the values of lassi sweet"');
  });
});

describe('D-62 the sheet’s rules', () => {
  it('imports an approved row as an estimated dish, its base food words as aliases, with its serving; a held row is counted', () => {
    expect(sheet(SABZI, HELD)).toEqual({
      foods: [
        {
          code: 'est-test-sabzi',
          name: 'Test Sabzi',
          foodGroup: 'Test Veg / Tarkari',
          proteinG: '2.5',
          fibreG: '2.5',
          fatG: '6.5',
          carbsG: '9',
          kcal: '100',
          kcalSource: 'published',
          estimated: true,
          needsReview: false,
          hidden: false,
          note: null,
          aliases: ['test veg', 'tarkari'],
          flag: 'llm',
        },
      ],
      portions: [{ code: 'est-test-sabzi', seq: 1, label: 'Katori', grams: 150 }],
      held: 1,
    });
  });

  it('refuses a row whose energy does not agree with its protein, carbs and fat', () => {
    expect(refused(SABZI.replace(',100,2.5,', ',300,2.5,'))).toMatch(/line 2: kcal 300 does not agree/);
  });

  it('checks the code, the status and its issue, the confidence, the serving, the search words, the flag and the date', () => {
    expect(refused(SABZI.replace('est-test-sabzi', 'test-sabzi'))).toMatch(/code must start with est-/);
    expect(refused(SABZI, SABZI)).toMatch(/appears twice/);
    expect(refused(SABZI.replace(',approved,', ',ok,'))).toMatch(/status must be approved or held/);
    expect(refused(SABZI.replace(',approved,,', ',approved,looks odd,'))).toMatch(/a held row says its issue/);
    expect(refused(HELD.replace('"""idli"" given the values of lassi sweet"', ''))).toMatch(/a held row says its issue/);
    expect(refused(SABZI.replace(',C,', ',D,'))).toMatch(/a weak match \(D\) is never approved/);
    expect(refused(SABZI.replace(',1 katori,150,', ',,,'))).toMatch(/serving must be given/);
    expect(refused(SABZI.replace(',2.5,1 katori', ',,1 katori'))).toMatch(/fibre_g must be numbers/);
    expect(refused(SABZI.replace('test veg; tarkari', 'tarkari; Tarkari'))).toMatch(/gives a word twice/);
    expect(refused(SABZI.replace(',llm', ',other'))).toMatch(/flag must be empty or scrap or llm/);
    expect(refused(SABZI.replace('2026-11-10', '2026-02-30'))).toMatch(/read_on/);
  });

  it('refuses a sheet with another header', () => {
    expect(() => readDishEstimatesSheet(['code,name', SABZI].join('\n'))).toThrow(/header must be/);
  });
});
