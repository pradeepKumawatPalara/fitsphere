import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_FOODS_HEADER, readHomeFoodsSheet } from './homeFoods.ts';
import { FoodListError } from './ifct.ts';

// FitSphere's home-foods sheet (D-59; docs/data/home-foods-sheet.csv). The rows below are synthetic:
// made-up foods and values to check the rules.

const COMMITTED = readFileSync(new URL('../../../../docs/data/home-foods-sheet.csv', import.meta.url), 'utf8');
const HEADER = HOME_FOODS_HEADER.join(',');
// 4 × 8 + 4 × 45 + 9 × 17 = 365: agrees with 365 kcal.
const TOAST = 'home-test-toast,Test toast (Test makhan toast),test bread,approved,100 g,365,8,45,17,2,2 slices,56,test makhan toast; buttered test toast,2026-11-06,"ESTIMATE from general knowledge; recipe: 2 slices, butter 10 g",llm';

function sheet(...rows: string[]) {
  return readHomeFoodsSheet([HEADER, ...rows].join('\n'));
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

describe('D-59 the committed home-foods sheet', () => {
  it('passes every check: the owner approved 31 bread foods on 2026-11-06, each an AI estimate with its serving', () => {
    const { foods, portions, proposed } = readHomeFoodsSheet(COMMITTED);
    expect(foods).toHaveLength(31);
    expect(proposed).toBe(0);
    expect(portions).toHaveLength(31);
    expect(foods.every((food) => food.flag === 'llm' && food.code.startsWith('home-'))).toBe(true);
  });

  it('finds every bread form by "bread", even those whose name does not say it', () => {
    const { foods } = readHomeFoodsSheet(COMMITTED);
    expect(foods.every((food) => food.aliases[0] === 'bread')).toBe(true);
    const toast = foods.find((food) => food.code === 'home-bread-butter-toast');
    expect(toast?.name).toBe('Butter toast (Makhan toast)');
    expect(toast?.aliases).toEqual(['bread', 'makhan toast', 'buttered toast', 'butter toast', 'toast butter']);
  });
});

describe('D-59 the sheet’s rules', () => {
  it('imports an approved row as a home-style food, its item and search words as aliases, with its serving', () => {
    expect(sheet(TOAST, TOAST.replace('home-test-toast', 'home-test-toast-2').replace(',approved,', ',proposed,'))).toEqual({
      foods: [
        {
          code: 'home-test-toast',
          name: 'Test toast (Test makhan toast)',
          foodGroup: 'Test bread',
          proteinG: '8',
          fibreG: '2',
          fatG: '17',
          carbsG: '45',
          kcal: '365',
          kcalSource: 'published',
          estimated: false,
          needsReview: false,
          hidden: false,
          note: null,
          aliases: ['test bread', 'test makhan toast', 'buttered test toast'],
          flag: 'llm',
        },
      ],
      portions: [{ code: 'home-test-toast', seq: 1, label: '2 slices', grams: 56 }],
      proposed: 1,
    });
  });

  it('keeps an unknown fibre as unknown, and a "1 slice" serving as "Slice"', () => {
    const { foods, portions } = sheet(TOAST.replace(',17,2,2 slices,56,', ',17,,1 slice,28,'));
    expect(foods[0]?.fibreG).toBeNull();
    expect(portions[0]).toMatchObject({ label: 'Slice', grams: 28 });
  });

  it('refuses a row whose energy does not agree with its protein, carbs and fat', () => {
    expect(refused(TOAST.replace(',365,', ',150,'))).toMatch(/line 2: kcal 150 does not agree/);
  });

  it('checks the code, the status, the basis, the serving, the search words, the flag and the date on every row', () => {
    expect(refused(TOAST.replace('home-test-toast', 'test-toast'))).toMatch(/code must start with home-/);
    expect(refused(TOAST, TOAST)).toMatch(/appears twice/);
    expect(refused(TOAST.replace(',approved,', ',ok,'))).toMatch(/status/);
    expect(refused(TOAST.replace(',100 g,', ',1 cup,'))).toMatch(/basis/);
    expect(refused(TOAST.replace(',2 slices,56,', ',,,'))).toMatch(/serving must be given/);
    expect(refused(TOAST.replace(',2 slices,56,', ',2 slices,0,'))).toMatch(/serving must be given/);
    expect(refused(TOAST.replace('buttered test toast', 'test makhan toast'))).toMatch(/gives a word twice/);
    expect(refused(TOAST.replace(',llm', ',other'))).toMatch(/flag must be empty or scrap or llm/);
    expect(refused(TOAST.replace('2026-11-06', '2026-02-30'))).toMatch(/read_on/);
  });

  it('refuses a sheet with another header', () => {
    expect(() => readHomeFoodsSheet(['code,name', TOAST].join('\n'))).toThrow(/header must be/);
  });
});
