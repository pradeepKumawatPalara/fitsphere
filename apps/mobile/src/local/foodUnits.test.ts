import type { Food, PackagedFood } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import { FOOD_ROWS_PER_INSERT, getFood, getMeta, migrateLocal, PACKAGED_ROWS_PER_INSERT, replaceFoods, searchPackaged, setMeta, SQL_VALUES_MAX } from './store';

// D-102: the units of the owner's food database on the phone: a packaged food's units, and the measure
// each food's page opens on. Synthetic foods and made-up values.

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

const RICE: Food = {
  source: 'indb',
  code: 'T901',
  name: 'Test boiled rice',
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 2.5,
  fibreG: 1.2,
  fatG: 0.2,
  carbsG: 26,
  kcal: 120,
  kcalEstimated: true,
  measures: [],
  portions: [
    { label: 'Plate', grams: 300 },
    { label: 'Katori', grams: 129 },
  ],
  opensOn: 'Plate',
};
const BAR: PackagedFood = {
  barcode: '8901234500501',
  name: 'Test dark bar',
  brand: 'Test Sweets',
  kcal: 520,
  proteinG: 6,
  carbsG: 50,
  fatG: 33,
  fibreG: null,
  servingGrams: null,
  portions: [
    { label: 'Bar', grams: 20 },
    { label: 'Pack', grams: 20 },
  ],
  opensOn: 'Bar',
};
const PLAIN: PackagedFood = { ...BAR, barcode: '8901234500502', name: 'Test plain biscuit' };
delete PLAIN.portions;
delete PLAIN.opensOn;

describe('D-102 the units of the owner’s food database, kept on the phone', () => {
  it('keeps a food’s page’s opening measure, and a packaged food’s units and opening measure', async () => {
    await replaceFoods(db, 'v1', [RICE, { ...RICE, code: 'T902', name: 'Test plain rice', opensOn: undefined }], [], [BAR, PLAIN]);
    expect(await getFood(db, 'indb', 'T901')).toEqual(RICE);
    // A food without one has none, as before.
    expect(await getFood(db, 'indb', 'T902')).not.toHaveProperty('opensOn');
    expect(await searchPackaged(db, 'dark bar')).toEqual([BAR]);
    expect(await searchPackaged(db, 'plain biscuit')).toEqual([PLAIN]);
  });

  it('writes the list in statements within SQLite’s 999 values: 16 a food, 15 a packaged food', async () => {
    expect(FOOD_ROWS_PER_INSERT * 16).toBeLessThanOrEqual(SQL_VALUES_MAX);
    expect(PACKAGED_ROWS_PER_INSERT * 15).toBeLessThanOrEqual(SQL_VALUES_MAX);
    // A list longer than one statement is written whole.
    const many = Array.from({ length: PACKAGED_ROWS_PER_INSERT * 2 + 1 }, (_, index) => ({ ...BAR, barcode: `89012345${String(index).padStart(5, '0')}` }));
    await replaceFoods(db, 'v2', [], [], many);
    expect(await db.getFirstAsync('SELECT count(*) AS n FROM packaged_foods', [])).toEqual({ n: many.length });
  });
});

describe('Local schema version 23', () => {
  it('D-102 the update from version 22 gives foods and packaged foods room for the units, and asks for the food list again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      const riceBefore: Food = { ...RICE };
      delete riceBefore.opensOn;
      const barBefore: PackagedFood = { ...BAR };
      delete barBefore.portions;
      delete barBefore.opensOn;
      await replaceFoods(old, 'v9', [riceBefore], [], [barBefore]);
      // Version 22 as phones have it.
      await old.execAsync('DROP TABLE notifications; ALTER TABLE weigh_ins DROP COLUMN source; ALTER TABLE steps DROP COLUMN source; ALTER TABLE foods DROP COLUMN opens_on; ALTER TABLE packaged_foods DROP COLUMN portions; ALTER TABLE packaged_foods DROP COLUMN opens_on; PRAGMA user_version = 22;');
      await setMeta(old, 'food_list_version', 'v9');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 25 });
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      // The foods stay, as before, till the list comes.
      expect(await getFood(old, 'indb', 'T901')).toEqual(riceBefore);
      expect(await searchPackaged(old, 'dark bar')).toEqual([barBefore]);
    } finally {
      await old.closeAsync();
    }
  });
});
