import type { Dish, Food, MealItem } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  dailyNutrition,
  dayNutrition,
  deleteEntry,
  discardRejected,
  getEntry,
  getMeta,
  listMealsOfDay,
  listSavedMeals,
  markAccepted,
  markRejected,
  mealCounts,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  replaceFoods,
  saveEntry,
  searchDishes,
  searchFoods,
  searchMyFoods,
  searchPackaged,
  setMeta,
} from './store';

// Meals, saved meals and the cached food list on the phone (Meal logging slice, step 3; ADR-0006
// rule 1; ADR-0007 rules 1, 2 and 7; REQ-NFR-004). Synthetic values only.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;

let db: SqlDb;
let next = 0;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

function id(): string {
  next += 1;
  return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
}

const ATTA: MealItem = {
  source: 'ifct2017',
  ref: 'A019',
  name: 'Wheat flour, atta',
  amount: { unit: 'g', value: 60 },
  kcal: 192,
  proteinG: 6.34,
  carbsG: 38.5,
  fatG: 0.92,
  fibreG: 6.82,
  estimated: false,
};
const OWN: MealItem = { ...ATTA, source: 'own', ref: null, name: 'Synthetic bar', kcal: 180, proteinG: 4, fibreG: null };

async function saveMeal(mealId: string, extra: Partial<Parameters<typeof saveEntry<'meal'>>[2]['data']> = {}) {
  const changeId = id();
  await saveEntry(db, 'meal', {
    changeId,
    data: { id: mealId, day: DAY, mealType: 'lunch', tags: [], items: [ATTA], recordedAt: AT, ...extra },
  });
  return changeId;
}

describe('REQ-LOG-001 meals on the phone', () => {
  it('D-26 a saved meal gets the same totals the server computes', async () => {
    const mealId = id();

    await saveMeal(mealId, { items: [ATTA, OWN] });

    expect(await getEntry(db, 'meal', mealId)).toMatchObject({
      items: [ATTA, OWN],
      kcal: 372,
      proteinG: 10.34,
      fibreG: 6.82,
      syncState: 'pending',
    });
  });

  it('REQ-NUT-004 Delete removes the meal at once and queues its deletion', async () => {
    const mealId = id();
    await markAccepted(db, await saveMeal(mealId));

    await deleteEntry(db, 'meal', { changeId: id(), data: { id: mealId, deletedAt: AT } });

    expect(await getEntry(db, 'meal', mealId)).toBeNull();
    expect((await pendingChanges(db, 10)).map((change) => [change.type, change.data])).toEqual([
      ['meal.delete', { id: mealId, deletedAt: AT }],
    ]);
  });

  it('ADR-0007 a deletion waiting to sync is never undone by the pull', async () => {
    const mealId = id();
    await markAccepted(db, await saveMeal(mealId));
    await deleteEntry(db, 'meal', { changeId: id(), data: { id: mealId, deletedAt: AT } });

    await applyServerEntries(db, 'meal', [
      { deleted: false, id: mealId, day: DAY, mealType: 'lunch', tags: [], items: [ATTA], recordedAt: AT },
    ]);

    expect(await getEntry(db, 'meal', mealId)).toBeNull();
  });

  it('ADR-0007 a meal deleted on another phone leaves this one; a live one arrives as synced', async () => {
    const gone = id();
    const arriving = id();
    await markAccepted(db, await saveMeal(gone));

    await applyServerEntries(db, 'meal', [
      { deleted: true, id: gone },
      { deleted: false, id: arriving, day: DAY, mealType: 'dinner', tags: ['dessert'], items: [OWN], recordedAt: AT },
    ]);

    expect(await getEntry(db, 'meal', gone)).toBeNull();
    expect(await getEntry(db, 'meal', arriving)).toMatchObject({ tags: ['dessert'], kcal: 180, fibreG: null, syncState: 'synced' });
  });

  it('ADR-0007 rule 2 a rejected deletion can be discarded, and the next sync brings the meal back', async () => {
    const mealId = id();
    await markAccepted(db, await saveMeal(mealId));
    const deletion = id();
    await deleteEntry(db, 'meal', { changeId: deletion, data: { id: mealId, deletedAt: AT } });
    await markRejected(db, deletion, 'ROLE_NOT_ENABLED');
    await setMeta(db, 'cursor', '9');

    await discardRejected(db, deletion);

    expect(await pendingChanges(db, 10)).toEqual([]);
    expect(await getMeta(db, 'cursor')).toBeNull();
  });

  it('REQ-NUT-004 editing a meal replaces it, and a rejected edit is replaced by the next save', async () => {
    const mealId = id();
    const first = await saveMeal(mealId);
    await markRejected(db, first, 'VALIDATION_FAILED');

    await saveMeal(mealId, { mealType: 'dinner' });

    expect(await getEntry(db, 'meal', mealId)).toMatchObject({ mealType: 'dinner', syncState: 'pending' });
    expect(await pendingChanges(db, 10)).toHaveLength(1);
  });
});

describe('REQ-NUT-002 a day’s meals and totals', () => {
  it('REQ-NUT-002 nothing logged gives no totals, so the screen shows a dash', async () => {
    expect(await dayNutrition(db, DAY)).toBeNull();
  });

  it('REQ-HOME-003 sums the day’s meals; a value no meal has stays unknown', async () => {
    await saveMeal(id(), { items: [ATTA] });
    await saveMeal(id(), { items: [OWN] });
    await saveMeal(id(), { day: '2026-10-26', items: [ATTA] });

    expect(await dayNutrition(db, DAY)).toEqual({ meals: 2, kcal: 372, proteinG: 10.34, carbsG: 77, fatG: 1.84, fibreG: 6.82 });
    expect((await listMealsOfDay(db, DAY)).map((meal) => meal.items[0]?.name)).toEqual(['Wheat flour, atta', 'Synthetic bar']);
  });

  it('REQ-NUT-002 fibre stays unknown when no meal of the day has it', async () => {
    await saveMeal(id(), { items: [OWN] });

    expect((await dayNutrition(db, DAY))?.fibreG).toBeNull();
  });

  it('Q-019 counts each day’s meals, for the week strip and the day sheet', async () => {
    await saveMeal(id());
    await saveMeal(id());
    await saveMeal(id(), { day: '2026-10-25' });

    expect(await mealCounts(db, '2026-10-21', '2026-10-27')).toEqual({ '2026-10-25': 1, '2026-10-27': 2 });
  });

  it('REQ-PRG-002 sums kcal and protein for each day with meals between two days', async () => {
    await saveMeal(id(), { items: [ATTA] });
    await saveMeal(id(), { items: [OWN] });
    await saveMeal(id(), { day: '2026-10-25', items: [ATTA] });
    await saveMeal(id(), { day: '2026-10-20', items: [ATTA] });

    expect(await dailyNutrition(db, '2026-10-21', '2026-10-27')).toEqual({
      '2026-10-25': { kcal: 192, proteinG: 6.34 },
      '2026-10-27': { kcal: 372, proteinG: 10.34 },
    });
  });

  it('ADR-0007 rule 1 old synced meals leave the phone; saved meals never do', async () => {
    const old = id();
    await markAccepted(db, await saveMeal(old, { day: '2026-07-01' }));
    await saveEntry(db, 'savedMeal', {
      changeId: id(),
      data: { id: id(), name: 'Old favourite', mealType: 'lunch', tags: [], items: [ATTA], savedAt: '2026-01-01T00:00:00.000Z' },
    });

    await pruneSynced(db, '2026-10-28');

    expect(await getEntry(db, 'meal', old)).toBeNull();
    expect((await listSavedMeals(db)).map((saved) => saved.name)).toEqual(['Old favourite']);
  });
});

describe('ADR-0006 rule 1 the cached food list', () => {
  const food = (code: string, name: string, aliases: string[] = []): Food => ({
    source: 'ifct2017',
    code,
    name,
    foodGroup: 'Synthetic group',
    aliases,
    proteinG: 1,
    fibreG: 1,
    fatG: 1,
    carbsG: 1,
    kcal: 10,
    kcalEstimated: false,
    measures: [],
    portions: [],
  });
  const LIST = [
    food('A015', 'Rice, raw, milled'),
    food('A019', 'Wheat flour, atta'),
    food('B021', 'Red gram, dal'),
    food('E021', 'Goosberry', ['Gooseberry']),
    food('T013', 'Ghee'),
    food('X001', 'Fat, 50% (synthetic)'),
  ];

  beforeEach(async () => {
    await replaceFoods(db, 'v1', LIST);
  });

  it('keeps the list and its version on the phone', async () => {
    expect(await getMeta(db, 'food_list_version')).toBe('v1');

    await replaceFoods(db, 'v2', LIST.slice(0, 2));

    expect(await getMeta(db, 'food_list_version')).toBe('v2');
    expect(await searchFoods(db, 'ghee')).toEqual([]);
  });

  it('REQ-LOG-007 finds foods offline by any word, ignoring case, names starting with it first', async () => {
    expect((await searchFoods(db, 'ATTA')).map((found) => found.code)).toEqual(['A019']);
    expect((await searchFoods(db, 'dal gram')).map((found) => found.code)).toEqual(['B021']);
    expect((await searchFoods(db, 'r')).map((found) => found.code).slice(0, 2)).toEqual(['B021', 'A015']);
  });

  it('D-36 keeps each food’s household units with it', async () => {
    const ghee = { ...food('T013', 'Ghee'), measures: [{ measure: 'teaspoon' as const, grams: 4.6 }, { measure: 'tablespoon' as const, grams: 13.5 }] };
    await replaceFoods(db, 'v2', [ghee]);

    expect(await searchFoods(db, 'ghee')).toEqual([ghee]);
  });

  it('D-26 finds a food by its alias', async () => {
    expect((await searchFoods(db, 'gooseberry')).map((found) => found.name)).toEqual(['Goosberry']);
  });

  it('treats % and _ as plain characters, and an empty search finds nothing', async () => {
    expect((await searchFoods(db, '50%')).map((found) => found.code)).toEqual(['X001']);
    expect(await searchFoods(db, '_')).toEqual([]);
    expect(await searchFoods(db, '   ')).toEqual([]);
  });

  it('returns each food’s values as numbers', async () => {
    expect(await searchFoods(db, 'ghee')).toEqual([food('T013', 'Ghee')]);
  });

  it('D-46 lists INDB’s recipes, then IFCT’s foods, each source up to the limit, so neither hides the other', async () => {
    const recipe = (code: string, name: string) => ({ ...food(code, name), source: 'indb' as const });
    await replaceFoods(db, 'v2', [
      food('M001', 'Egg, poultry, whole, raw'),
      recipe('BFP201', 'Egg curry (Ande ki curry)'),
      recipe('BFP202', 'Boiled egg (Ubla anda)'),
      recipe('BFP203', 'Egg bhurji'),
    ]);

    expect((await searchFoods(db, 'egg', 2)).map((found) => found.code)).toEqual(['BFP203', 'BFP201', 'M001']);
  });

  it('D-47 never lists a USDA food a phone still holds from before', async () => {
    await db.runAsync(
      `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated, measures, portions)
       VALUES ('usda_fndds', '31103010', 'Egg, whole, boiled or poached', 'Eggs', '[]', 12.4, 0, 9.96, 0.96, 143, 0, '[]', '[]')`,
      [],
    );

    expect(await searchFoods(db, 'boiled')).toEqual([]);
  });
});

// Synthetic packaged foods (D-48): made-up values, not real products.
const BUTTER = { barcode: '8901234567890', name: 'Test salted butter', brand: 'Test Dairy', kcal: 720, proteinG: 0.5, carbsG: 0.5, fatG: 80, fibreG: null, servingGrams: 10 };
const BISCUIT = { barcode: '96385074', name: 'Butter biscuits', brand: 'Other Foods', kcal: 480, proteinG: 7, carbsG: 70, fatG: 19, fibreG: 2, servingGrams: null };

describe('D-48 the cached packaged foods', () => {
  it('keeps them apart from the food list, replaced with it, and finds them by name or brand, ignoring case', async () => {
    const atta: Food = {
      source: 'ifct2017',
      code: 'A019',
      name: 'Wheat flour, atta',
      foodGroup: 'Synthetic group',
      aliases: [],
      proteinG: 10,
      fibreG: 11,
      fatG: 1.5,
      carbsG: 64,
      kcal: 320,
      kcalEstimated: false,
      measures: [],
      portions: [],
    };
    await replaceFoods(db, 'v1', [atta], [], [BUTTER, BISCUIT]);

    expect(await searchPackaged(db, 'BUTTER')).toEqual([BISCUIT, BUTTER]);
    expect(await searchPackaged(db, 'test dairy')).toEqual([BUTTER]);
    expect(await searchPackaged(db, 'butter dairy')).toEqual([BUTTER]);
    expect(await searchPackaged(db, 'atta')).toEqual([]);
    expect((await searchFoods(db, 'butter')).length).toBe(0);

    await replaceFoods(db, 'v2', [], [], [BISCUIT]);
    expect(await searchPackaged(db, 'butter')).toEqual([BISCUIT]);
  });

  it('shows a product listed under several barcodes with the same values once, taking a copy’s serving (D-56)', async () => {
    // Synthetic: one paneer in three pack sizes (two name it with the brand), and a different one.
    const PANEER = { barcode: '8901234500001', name: 'Paneer', brand: 'Test Dairy', kcal: 283, proteinG: 16.1, carbsG: 5.1, fatG: 22, fibreG: null, servingGrams: null };
    const PANEER_1KG = { ...PANEER, barcode: '8901234500002', name: 'Test Dairy Paneer', servingGrams: 50 };
    const PANEER_COPY = { ...PANEER, barcode: '8901234500003', name: 'paneer', brand: 'TEST DAIRY' };
    const HIGH_PROTEIN = { ...PANEER, barcode: '8901234500004', kcal: 189.8, proteinG: 25, carbsG: 6.7, fatG: 7 };
    await replaceFoods(db, 'v1', [], [], [PANEER, PANEER_1KG, PANEER_COPY, HIGH_PROTEIN]);

    const found = await searchPackaged(db, 'paneer');
    expect(found.map((food) => food.barcode).sort()).toEqual(['8901234500001', '8901234500004']);
    expect(found.find((food) => food.barcode === PANEER.barcode)?.servingGrams).toBe(50);
    expect(await searchPackaged(db, 'paneer', 1)).toHaveLength(1);
  });
});

describe('D-28 the cached dishes', () => {
  // Synthetic dishes: made-up values for one portion.
  const FLATBREAD: Dish = { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 173, proteinG: 4.23, carbsG: 25.67, fatG: 5.61, fibreG: 4.54 };
  const DAL: Dish = { code: 'test_dal', name: 'Test dal', portionUnit: 'katori', kcal: 138.82, proteinG: 7.42, carbsG: 19.6, fatG: 3.05, fibreG: 3.33 };

  it('keeps the dishes with the food list, and replaces them whole with it', async () => {
    await replaceFoods(db, 'v1', [], [FLATBREAD, DAL]);
    expect(await searchDishes(db, 'test')).toEqual([DAL, FLATBREAD]);

    await replaceFoods(db, 'v2', []);

    expect(await searchDishes(db, 'test')).toEqual([]);
    expect(await getMeta(db, 'food_list_version')).toBe('v2');
  });

  it('REQ-LOG-007 finds dishes offline by every word of the search, ignoring case', async () => {
    await replaceFoods(db, 'v1', [], [FLATBREAD, DAL]);

    expect(await searchDishes(db, 'DAL')).toEqual([DAL]);
    expect(await searchDishes(db, 'flatbread test')).toEqual([FLATBREAD]);
    expect(await searchDishes(db, 'roti')).toEqual([]);
    expect(await searchDishes(db, '  ')).toEqual([]);
  });
});

describe('Local schema version 8', () => {
  it('D-36 the update from version 7 gives every cached food no units yet, and asks for the food list again', async () => {
    const old = memoryDb();
    try {
      await old.execAsync(`
        CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE foods (source TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, food_group TEXT NOT NULL,
          aliases TEXT NOT NULL, protein_g REAL NOT NULL, fibre_g REAL NOT NULL, fat_g REAL NOT NULL, carbs_g REAL NOT NULL,
          kcal REAL NOT NULL, kcal_estimated INTEGER NOT NULL, PRIMARY KEY (source, code));
        PRAGMA user_version = 7;`);
      await old.runAsync(`INSERT INTO foods VALUES ('ifct2017', 'L002', 'Milk, whole, Cow', 'Synthetic group', '[]', 1, 0, 1, 1, 10, 0)`, []);
      await setMeta(old, 'food_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      // Since version 12 (D-49) the cached list is made again and downloaded anew.
      expect(await searchFoods(old, 'milk')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 5', () => {
  it('D-28 the update from version 4 adds the dishes, keeps the meals and foods, and asks for the food list again', async () => {
    const old = memoryDb();
    try {
      await old.execAsync(`
        CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE foods (source TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, food_group TEXT NOT NULL,
          aliases TEXT NOT NULL, protein_g REAL NOT NULL, fibre_g REAL NOT NULL, fat_g REAL NOT NULL, carbs_g REAL NOT NULL,
          kcal REAL NOT NULL, kcal_estimated INTEGER NOT NULL, PRIMARY KEY (source, code));
        PRAGMA user_version = 4;`);
      await old.runAsync(`INSERT INTO foods VALUES ('ifct2017', 'A019', 'Wheat flour, atta', 'Synthetic group', '[]', 1, 1, 1, 1, 10, 0)`, []);
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '42');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      // Since version 12 (D-49) the cached list is made again and downloaded anew.
      expect(await searchFoods(old, 'atta')).toEqual([]);
      expect(await searchDishes(old, 'atta')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      // Version 5 keeps the cursor; version 6 (workouts) then clears it.
      expect(await getMeta(old, 'cursor')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 3', () => {
  it('ADR-0007 the update from version 2 keeps what is on the phone and clears the cursor', async () => {
    const old = memoryDb();
    try {
      await old.execAsync(`
        CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE steps (day TEXT PRIMARY KEY, steps INTEGER NOT NULL, recorded_at TEXT NOT NULL, sync_state TEXT NOT NULL);
        PRAGMA user_version = 2;`);
      await old.runAsync(`INSERT INTO steps VALUES ('2026-10-20', 5000, ?, 'synced')`, [AT]);
      await setMeta(old, 'cursor', '42');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      expect(await old.getFirstAsync('SELECT steps FROM steps', [])).toEqual({ steps: 5000 });
      expect(await getMeta(old, 'cursor')).toBeNull();
      expect(await listSavedMeals(old)).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 12', () => {
  it('D-49 the update from version 11 makes the cached food list again, a food’s fibre allowed to be unknown, and asks for it again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await setMeta(old, 'food_list_version', 'v1');
      await old.execAsync('DROP TABLE exercises; PRAGMA user_version = 11;');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      // A brand label that gives no fibre (synthetic values).
      const label: Food = {
        source: 'brand_label',
        code: 'test-butter',
        name: 'Test Dairy Butter',
        foodGroup: 'Test Dairy',
        aliases: ['Test Dairy'],
        proteinG: 0.5,
        fibreG: null,
        fatG: 80,
        carbsG: 0.5,
        kcal: 720,
        kcalEstimated: false,
        measures: [],
        portions: [{ label: 'Serving', grams: 10 }],
      };
      await replaceFoods(old, 'v2', [label]);
      expect(await searchFoods(old, 'butter')).toEqual([label]);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 11', () => {
  it('D-48 the update from version 10 adds the packaged foods, and asks for the food list again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await old.execAsync('DROP TABLE exercises; DROP TABLE packaged_foods; PRAGMA user_version = 10;');
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      expect(await searchPackaged(old, 'butter')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      expect(await getMeta(old, 'cursor')).toBe('99');
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 10', () => {
  it('D-39 the update from version 9 adds the foods’ servings and My foods, and asks for the food list and the sync again', async () => {
    const old = memoryDb();
    try {
      // Version 9 as phones have it: build it with the current migrations, then drop what 10 adds.
      await migrateLocal(old);
      await old.execAsync('DROP TABLE exercises; DROP TABLE packaged_foods; DROP TABLE my_foods; ALTER TABLE foods DROP COLUMN portions; PRAGMA user_version = 9;');
      await old.runAsync(
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated, measures)
         VALUES ('ifct2017', 'A019', 'Wheat flour, atta', 'Synthetic group', '[]', 10, 11, 1.5, 64, 320, 0, '[]')`,
        [],
      );
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      // Since version 12 (D-49) the cached list is made again and downloaded anew.
      expect(await searchFoods(old, 'atta')).toEqual([]);
      expect(await searchMyFoods(old, 'bread')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      expect(await getMeta(old, 'cursor')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });
});
