import { readFileSync } from 'node:fs';
import type { PackagedFood } from '@fitsphere/shared';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.ts';
import { FOOD_ALIASES_HEADER, readFoodAliases, withAliases, withPackagedAliases } from './foodAliases.ts';
import { FoodListError, type ImportedFood } from './ifct.ts';

// D-94: the other names of docs/data/food-aliases-sheet.csv, from the owner's consolidated food
// database, added to the foods' own by foods:import. Synthetic foods and made-up values, not real ones.

const sheet = (rows: string[][]) => toCsv([[...FOOD_ALIASES_HEADER], ...rows]);
const food = (code: string, name: string, aliases: string[] = []): ImportedFood => ({
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
  aliases,
});
const product = (barcode: string, name: string, brand: string | null, aliases?: string[]): PackagedFood => ({
  barcode,
  name,
  brand,
  kcal: 60,
  proteinG: 3,
  carbsG: 5,
  fatG: 3,
  fibreG: null,
  servingGrams: null,
  ...(aliases ? { aliases } : {}),
});

function refused(rows: string[][]): string {
  try {
    readFoodAliases(sheet(rows));
  } catch (error) {
    expect(error).toBeInstanceOf(FoodListError);
    return (error as Error).message;
  }
  throw new Error('The sheet was accepted');
}

describe('D-94 the other-names sheet', () => {
  it('reads each row’s other names, separated by semicolons', () => {
    expect(
      readFoodAliases(
        sheet([
          ['ifct2017', 'Z001', 'Test millet', 'Test baajra; Test pearl millet'],
          ['packaged', '8901234567890', 'Test toned milk', 'test doodh dudh'],
        ]),
      ),
    ).toEqual([
      { source: 'ifct2017', code: 'Z001', name: 'Test millet', aliases: ['Test baajra', 'Test pearl millet'] },
      { source: 'packaged', code: '8901234567890', name: 'Test toned milk', aliases: ['test doodh dudh'] },
    ]);
  });

  it('refuses the whole sheet for one wrong row, naming its line', () => {
    expect(() => readFoodAliases('source,code,aliases\n')).toThrow(/header must be/);
    expect(refused([['usda', 'Z001', 'Test', 'test']])).toMatch(/line 2: source must be/);
    expect(refused([['packaged', 'TEST', 'Test', 'test']])).toMatch(/line 2: code must be the barcode/);
    expect(refused([['indb', 'Z 1', 'Test', 'test']])).toMatch(/line 2: code must be the food’s code/);
    expect(refused([['home', 'home-test', 'Test', '']])).toMatch(/line 2: aliases must be/);
    expect(refused([['home', 'home-test', 'Test', 'test (one)']])).toMatch(/line 2: aliases must be/);
    expect(refused([['home', 'home-test', 'Test', 'Test dahi; test DAHI']])).toMatch(/line 2: aliases gives a name twice/);
    expect(refused([['home', 'home-test', 'Test', 'a'], ['home', 'home-test', 'Test', 'b']])).toMatch(/line 3: home home-test appears twice/);
  });
});

describe('D-94 adding the other names to the foods', () => {
  const rows = readFoodAliases(
    sheet([
      ['indb', 'Z001', 'Test pulao', 'test chana dal besan; Test pulao; test kabuli'],
      ['indb', 'Z002', 'Test kheer', 'Test Rice Pudding'],
      ['indb', 'Z009', 'Test gone', 'test gone'],
      ['home', 'Z001', 'Test pulao', 'test home'],
    ]),
  );

  it('adds the names a food lacks after its own, not its name or a name it has, ignoring case, accents and marks; the others stay as they are', () => {
    const result = withAliases([food('Z001', 'Test pulao', ['test kábuli']), food('Z002', 'Test kheer', ['test rice pudding']), food('Z003', 'Test idli')], 'indb', rows);
    expect(result.foods.map((one) => one.aliases)).toEqual([['test kábuli', 'test chana dal besan'], ['test rice pudding'], []]);
    expect(result).toMatchObject({ named: 1, added: 1, missing: 1 });
  });

  it('refuses a row whose food now has another name: the sheet is made again', () => {
    expect(() => withAliases([food('Z001', 'Test veg pulao')], 'indb', rows)).toThrow(/indb Z001 is now named "Test veg pulao", not "Test pulao"/);
  });

  it('adds a packaged food’s by its barcode, whatever its name now, not its brand', () => {
    const named = readFoodAliases(
      sheet([
        ['packaged', '8901234567890', 'Test milk', 'test doodh dudh; Test Dairy'],
        ['packaged', '8901234567891', 'Test curd', 'test dahi'],
      ]),
    );
    const result = withPackagedAliases([product('8901234567890', 'Test Dairy toned milk', 'Test Dairy'), product('8901234567892', 'Test paneer', null)], named);
    expect(result.foods).toEqual([product('8901234567890', 'Test Dairy toned milk', 'Test Dairy', ['test doodh dudh']), product('8901234567892', 'Test paneer', null)]);
    expect(result).toMatchObject({ named: 1, added: 1, missing: 1 });
  });
});

describe('D-94 the committed other-names sheet', () => {
  it('passes every check, with names for IFCT’s, INDB’s, home-style, estimated and packaged foods', () => {
    const rows = readFoodAliases(readFileSync(new URL('../../../../docs/data/food-aliases-sheet.csv', import.meta.url), 'utf8'));
    const bySource: Record<string, number> = {};
    for (const row of rows) bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    expect(bySource).toEqual({ ifct2017: 483, indb: 494, home: 52, dish_estimate: 3_043, packaged: 3_337 });
  });
});
