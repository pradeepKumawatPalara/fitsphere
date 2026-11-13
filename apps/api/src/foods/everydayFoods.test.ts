import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.ts';
import { readDishEstimatesSheet } from './dishEstimates.ts';
import { EVERYDAY_FOODS_HEADER, readEverydayFoods, withEverydayWords } from './everydayFoods.ts';
import { readHomeFoodsSheet } from './homeFoods.ts';
import { FoodListError, type ImportedFood, readIfctCsv } from './ifct.ts';
import { readIndbCsv } from './indb.ts';

// D-92: for an everyday word, the food Search foods lists first, as the owner approves the rows of
// docs/data/everyday-foods-sheet.csv. Synthetic foods and made-up values, not real ones.

const sheet = (rows: string[][]) => toCsv([[...EVERYDAY_FOODS_HEADER], ...rows]);
const food = (code: string, name: string, more: Partial<ImportedFood> = {}): ImportedFood => ({
  code,
  name,
  foodGroup: 'Test',
  proteinG: '3.00',
  fibreG: '1.00',
  fatG: '1.00',
  carbsG: '25.00',
  kcal: '120',
  kcalSource: 'published',
  estimated: true,
  needsReview: false,
  hidden: false,
  note: null,
  aliases: [],
  ...more,
});

describe('D-92 everyday foods', () => {
  const ROWS = [
    ['rice', 'indb', 'T101', 'Test boiled rice', '117', 'approved', 'cooked rice as eaten'],
    ['tea', 'indb', 'T102', 'Test masala chai', '55', 'approved', 'a cup of milk tea'],
    ['chai', 'indb', 'T102', 'Test masala chai', '55', 'approved', 'a cup of milk tea'],
    ['dal', 'indb', 'T103', 'Test dal tadka', '120', 'proposed', 'waiting for the owner'],
    ['soup', 'dish_estimate', 'T104', 'Test soup', '40', 'approved', 'another source'],
  ];

  it('reads the sheet', () => {
    expect(readEverydayFoods(sheet(ROWS)).map((row) => [row.word, row.source, row.code, row.approved])).toEqual([
      ['rice', 'indb', 'T101', true],
      ['tea', 'indb', 'T102', true],
      ['chai', 'indb', 'T102', true],
      ['dal', 'indb', 'T103', false],
      ['soup', 'dish_estimate', 'T104', true],
    ]);
  });

  it('refuses a sheet with any wrong row, naming its line', () => {
    const refused = (row: string[]) => () => readEverydayFoods(sheet([row]));
    expect(() => readEverydayFoods('word,code\nrice,T101\n')).toThrow(FoodListError);
    expect(refused(['Rice', 'indb', 'T101', 'Test boiled rice', '117', 'approved', 'capital'])).toThrow('line 2: the word must be lowercase letters and digits');
    expect(refused(['rice!', 'indb', 'T101', 'Test boiled rice', '117', 'approved', 'mark'])).toThrow('line 2: the word must be lowercase letters and digits');
    expect(refused(['rice', 'brand_label', 'T101', 'Test boiled rice', '117', 'approved', 'a brand'])).toThrow('line 2: the source must be one of');
    expect(refused(['rice', 'indb', '', 'Test boiled rice', '117', 'approved', 'no code'])).toThrow('line 2: the code and the name must be given');
    expect(refused(['rice', 'indb', 'T101', 'Test boiled rice', 'many', 'approved', 'kcal'])).toThrow('line 2: the kcal must be a number');
    expect(refused(['rice', 'indb', 'T101', 'Test boiled rice', '117', 'yes', 'status'])).toThrow('line 2: the status must be proposed or approved');
    expect(refused(['rice', 'indb', 'T101', 'Test boiled rice', '117', 'approved', ' '])).toThrow('line 2: the reason must be given');
    expect(() => readEverydayFoods(sheet([ROWS[0]!, ROWS[0]!]))).toThrow('line 3: the word and the food appear twice');
  });

  it('marks the approved words among one source’s foods, “@” first, counting the foods not listed', () => {
    const foods = [food('T101', 'Test boiled rice'), food('T102', 'Test masala chai', { aliases: ['chai'] }), food('T103', 'Test dal tadka'), food('T105', 'Test hidden', { hidden: true })];
    const everyday = readEverydayFoods(sheet([...ROWS, ['khichdi', 'indb', 'T105', 'Test hidden', '90', 'approved', 'hidden'], ['poha', 'indb', 'T199', 'Gone', '90', 'approved', 'gone']]));

    const marked = withEverydayWords(foods, 'indb', everyday);

    expect(marked.foods.map((one) => one.aliases)).toEqual([['@rice'], ['chai', '@tea', '@chai'], [], []]);
    expect([marked.marked, marked.missing]).toEqual([3, 2]);
    // Every other value is kept; another source's rows are not read.
    expect(marked.foods[0]).toEqual({ ...foods[0], aliases: ['@rice'] });
    expect(withEverydayWords(foods, 'dish_estimate', everyday)).toEqual({ foods, marked: 0, missing: 1 });
    // Run again, nothing is marked twice.
    expect(withEverydayWords(marked.foods, 'indb', everyday).foods).toEqual(marked.foods);
  });

  it('refuses a row whose food is now named otherwise, so the sheet is checked again', () => {
    const everyday = readEverydayFoods(sheet([ROWS[0]!]));
    expect(() => withEverydayWords([food('T101', 'Test rice, boiled')], 'indb', everyday)).toThrow('Everyday foods: indb T101 is now named "Test rice, boiled", not "Test boiled rice"');
  });

  it('the committed sheet reads, and names foods the list has, each by its name', () => {
    const read = (file: string) => readFileSync(new URL(`../../../../${file}`, import.meta.url), 'utf8');
    const everyday = readEverydayFoods(read('docs/data/everyday-foods-sheet.csv')).map((row) => ({ ...row, approved: true }));
    const sources: [string, ImportedFood[]][] = [
      ['ifct2017', readIfctCsv(read('data/foods/ifct2017-foods.csv'))],
      ['indb', readIndbCsv(read('data/foods/indb-foods.csv'), read('data/foods/indb-portions.csv')).foods],
      ['home', readHomeFoodsSheet(read('docs/data/home-foods-sheet.csv')).foods],
      ['dish_estimate', readDishEstimatesSheet(read('docs/data/dish-estimates-sheet.csv')).foods],
    ];

    expect(everyday.length).toBeGreaterThan(0);
    // As if every row were approved, every food is listed under its name.
    const marked = sources.map(([source, foods]) => withEverydayWords(foods, source, everyday));
    expect(marked.reduce((sum, one) => sum + one.missing, 0)).toBe(0);
    expect(marked.reduce((sum, one) => sum + one.marked, 0)).toBe(everyday.length);
  });
});
