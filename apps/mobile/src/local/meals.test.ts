import type { Dish, Food, MealItem } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
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

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 5 });
      expect((await searchFoods(old, 'atta')).map((found) => found.code)).toEqual(['A019']);
      expect(await searchDishes(old, 'atta')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      expect(await getMeta(old, 'cursor')).toBe('42');
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

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 5 });
      expect(await old.getFirstAsync('SELECT steps FROM steps', [])).toEqual({ steps: 5000 });
      expect(await getMeta(old, 'cursor')).toBeNull();
      expect(await listSavedMeals(old)).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});
