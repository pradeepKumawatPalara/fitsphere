import type { Dish, Food, PackagedFood } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import { getFood, getMeta, migrateLocal, nameMatcher, otherNumber, replaceFoods, searchDishes, searchFoods, searchPackaged, setMeta } from './store';

// D-94: packaged foods found by their other names, from the owner's food database, and a word found in
// its other number ("bananas" finds Banana, "curry" finds Curries). Synthetic foods and made-up values.

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

const food = (code: string, name: string, aliases: string[] = []): Food => ({
  source: 'ifct2017',
  code,
  name,
  foodGroup: 'Synthetic group',
  aliases,
  proteinG: 1,
  fibreG: 1,
  fatG: 1,
  carbsG: 20,
  kcal: 90,
  kcalEstimated: false,
  measures: [],
  portions: [],
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
const dish = (code: string, name: string): Dish => ({ code, name, portionUnit: 'katori', kcal: 120, proteinG: 4, carbsG: 15, fatG: 4, fibreG: 2 });
const codes = (foods: readonly { code: string }[]) => foods.map((one) => one.code);

describe('D-94 a packaged food’s other names', () => {
  const MILK = product('8901234500101', 'Test toned milk', 'Test Dairy', ['test doodh dudh paal']);
  const CURD = product('8901234500102', 'Test doodh curd', 'Test Dairy');

  it('finds a product by them, never by them alone with a short search, and keeps them with it', async () => {
    await replaceFoods(db, 'v1', [], [], [MILK, CURD]);

    expect(await searchPackaged(db, 'paal')).toEqual([MILK]);
    expect(await searchPackaged(db, 'doodh')).toEqual([CURD, MILK]);
    expect(await searchPackaged(db, 'test dudh')).toEqual([MILK]);
    // One or two characters find a name or a brand that is all of it, not another name (D-72).
    await replaceFoods(db, 'v2', [], [], [{ ...MILK, aliases: ['tm'] }]);
    expect(await searchPackaged(db, 'tm')).toEqual([]);
  });

  it('a product with none comes back with none, as before', async () => {
    await replaceFoods(db, 'v1', [], [], [CURD]);
    expect((await searchPackaged(db, 'curd'))[0]).not.toHaveProperty('aliases');
  });
});

describe('Local schema version 22', () => {
  it('D-94 the update from version 21 gives the packaged foods room for other names and asks for the food list again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await replaceFoods(old, 'v9', [], [], [product('8901234500101', 'Test toned milk', 'Test Dairy')]);
      // Version 21 as phones have it.
      await old.execAsync('ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; PRAGMA user_version = 21;');
      await setMeta(old, 'food_list_version', 'v9');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      // The products stay, searched by name as before, with no other names till the list comes.
      expect(await searchPackaged(old, 'toned milk')).toEqual([product('8901234500101', 'Test toned milk', 'Test Dairy')]);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('D-94 a word in its other number', () => {
  it('gives the singular of a plural and the plurals not made by adding s or es', () => {
    expect(otherNumber('bananas')).toEqual(['banana']);
    expect(otherNumber('rotis')).toEqual(['roti']);
    expect(otherNumber('potatoes')).toEqual(['potato', 'potatoe']);
    expect(otherNumber('sandwiches')).toEqual(['sandwich', 'sandwiche']);
    expect(otherNumber('curries')).toEqual(['curry', 'currie', 'curri']);
    expect(otherNumber('leaves')).toEqual(['leaf', 'leafe', 'leav', 'leave']);
    expect(otherNumber('curry')).toEqual(['curries']);
    expect(otherNumber('leaf')).toEqual(['leaves']);
    expect(otherNumber('knife')).toEqual(['knives']);
    expect(otherNumber('idlis')).toEqual(['idli']);
    expect(otherNumber('geese')).toEqual(['goose']);
    expect(otherNumber('goose')).toEqual(['geese']);
  });

  it('leaves alone a word that is not a plural, and short words, numbers and marks', () => {
    expect(otherNumber('glass')).toEqual([]);
    expect(otherNumber('hummus')).toEqual([]);
    expect(otherNumber('dal')).toEqual([]);
    expect(otherNumber('banana')).toEqual([]);
    expect(otherNumber('soy')).toEqual([]);
    expect(otherNumber('7up')).toEqual([]);
    expect(otherNumber('as')).toEqual([]);
  });

  it('finds a food named in the singular by its plural, and in the plural by its singular, in names and other names', async () => {
    await replaceFoods(
      db,
      'v1',
      [
        food('T601', 'Test banana, ripe'),
        food('T602', 'Test vegetable curries'),
        food('T603', 'Test curry leaves'),
        food('T604', 'Test roti', ['test phulka']),
        food('T605', 'Test goat meat'),
        food('T606', 'Test flatbread', ['test chapatis']),
      ],
      [dish('test_potato', 'Test potato sabzi')],
      [product('8901234500201', 'Test plain sandwich', 'Test Bakers')],
    );

    expect(codes(await searchFoods(db, 'test bananas'))).toEqual(['T601']);
    expect(codes(await searchFoods(db, 'curry'))).toEqual(['T603', 'T602']);
    expect(codes(await searchFoods(db, 'leaf'))).toEqual(['T603']);
    expect(codes(await searchFoods(db, 'rotis'))).toEqual(['T604']);
    expect(codes(await searchFoods(db, 'test phulkas'))).toEqual(['T604']);
    expect(codes(await searchFoods(db, 'chapati'))).toEqual(['T606']);
    expect(codes(await searchDishes(db, 'potatoes'))).toEqual(['test_potato']);
    expect(codes((await searchPackaged(db, 'sandwiches')).map((one) => ({ code: one.barcode })))).toEqual(['8901234500201']);
    // Only as a whole word: "oats" does not find goat.
    expect(codes(await searchFoods(db, 'oats'))).toEqual([]);
    expect(await getFood(db, 'ifct2017', 'T601')).not.toBeNull();
  });

  it('ranks a name with the word in its other number as one with the word itself', () => {
    const rank = nameMatcher('bananas');
    expect(rank('Banana, ripe')).toBe(0);
    expect(rank('Bananas, dried')).toBe(0);
    expect(rank('Plantain')).toBe(3);
    expect(nameMatcher('curry')('Vegetable curries')).toBe(0);
  });
});
