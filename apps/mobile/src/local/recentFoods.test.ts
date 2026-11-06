import type { Dish, Food, MealItem, PackagedFood } from '@fitsphere/shared';
import { itemFromDish, itemFromFood, itemFromPackaged, itemFromServings } from '../mealItems';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import { listedFoodOf, markRejected, migrateLocal, recentFoodKey, recentFoods, replaceFoods, saveEntry } from './store';

// Recent foods on the phone (D-60, REQ-LOG-007): the foods logged on the last five days, each once by
// its name with the amount it was last logged in, and the food each came from. Synthetic values only.

const ATTA: Food = {
  source: 'ifct2017',
  code: 'A019',
  name: 'Wheat flour, atta',
  foodGroup: 'Cereals and Millets',
  aliases: [],
  proteinG: 10.57,
  fibreG: 11.36,
  fatG: 1.53,
  carbsG: 64.17,
  kcal: 320,
  kcalEstimated: false,
  measures: [],
  portions: [],
};
const DAL: Food = {
  source: 'indb',
  code: 'BFP999',
  name: 'Test dal fry',
  foodGroup: 'Indian recipes (INDB)',
  aliases: [],
  proteinG: 5,
  fibreG: 2,
  fatG: 4,
  carbsG: 12,
  kcal: 100,
  kcalEstimated: true,
  measures: [],
  portions: [{ label: 'Bowl', grams: 180 }],
};
const RICE: Dish = { code: 'plain-rice', name: 'Test plain rice', portionUnit: 'katori', kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5, fibreG: 0.6 };
const BREAD: PackagedFood = { barcode: '8901234567890', name: 'Test sandwich bread', brand: 'Test Bakers', kcal: 250, proteinG: 8, carbsG: 50, fatG: 2, fibreG: null, servingGrams: 50 };
const BAR: MealItem = { source: 'own', ref: null, name: 'Synthetic bar', amount: { unit: 'g', value: 40 }, kcal: 180, proteinG: 4, carbsG: null, fatG: null, fibreG: null, estimated: false };

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

async function saveMeal(day: string, recordedAt: string, items: MealItem[]): Promise<string> {
  const changeId = id();
  await saveEntry(db, 'meal', { changeId, data: { id: id(), day, mealType: 'lunch', tags: [], items, recordedAt } });
  return changeId;
}

describe('D-60 recentFoods', () => {
  it('lists the last five days’ foods, latest first, each name once with the amount last logged', async () => {
    await saveMeal('2026-10-28', '2026-10-28T02:00:00.000Z', [itemFromFood(ATTA, 60), BAR]);
    await saveMeal('2026-10-28', '2026-10-28T07:00:00.000Z', [itemFromServings(DAL, DAL.portions[0]!, 1)]);
    // Yesterday's atta, in another amount and with its name in capitals: the same food, already listed.
    await saveMeal('2026-10-27', '2026-10-27T07:00:00.000Z', [{ ...itemFromFood(ATTA, 120), name: ' WHEAT FLOUR,  atta ' }, itemFromDish(RICE, 1)]);
    await saveMeal('2026-10-24', '2026-10-24T07:00:00.000Z', [itemFromPackaged(BREAD, 50)]);
    // Six days ago: too old.
    await saveMeal('2026-10-23', '2026-10-23T07:00:00.000Z', [{ ...BAR, name: 'Old food' }]);

    const foods = await recentFoods(db, '2026-10-24', '2026-10-28');

    expect(foods.map((item) => item.name)).toEqual(['Test dal fry', 'Synthetic bar', 'Wheat flour, atta', 'Test plain rice', 'Test sandwich bread (Test Bakers)']);
    expect(foods[2]!.amount).toEqual({ unit: 'g', value: 60 });
  });

  it('leaves out a meal the server refused', async () => {
    const refused = await saveMeal('2026-10-28', '2026-10-28T02:00:00.000Z', [BAR]);
    await markRejected(db, refused, 'VALIDATION_FAILED');

    expect(await recentFoods(db, '2026-10-24', '2026-10-28')).toEqual([]);
  });

  it('tells foods apart by name only, ignoring case and spaces', () => {
    expect(recentFoodKey({ name: ' Wheat  flour, ATTA ' })).toBe(recentFoodKey({ name: 'wheat flour, atta' }));
    expect(recentFoodKey({ name: 'Atta' })).not.toBe(recentFoodKey({ name: 'Wheat flour, atta' }));
  });
});

describe('D-60 listedFoodOf', () => {
  it('finds a recent food in the food list, the dishes, the packaged foods and My foods', async () => {
    await replaceFoods(db, 'v1', [ATTA, DAL], [RICE], [BREAD]);
    const myId = id();
    await saveEntry(db, 'myFood', {
      changeId: id(),
      data: { id: myId, name: 'Peanut butter bread', unit: 'slice', kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: 1.5, savedAt: '2026-10-28T02:00:00.000Z' },
    });

    expect(await listedFoodOf(db, itemFromServings(DAL, DAL.portions[0]!, 2))).toEqual({ kind: 'food', food: DAL });
    expect(await listedFoodOf(db, itemFromDish(RICE, 1))).toEqual({ kind: 'dish', dish: RICE });
    expect(await listedFoodOf(db, itemFromPackaged(BREAD, 50))).toEqual({ kind: 'packaged', food: BREAD });
    expect(await listedFoodOf(db, { ...BAR, ref: myId, name: 'Peanut butter bread' })).toMatchObject({ kind: 'mine', food: { id: myId, unit: 'slice' } });
  });

  it('finds nothing for your own food not in My foods, or a food no longer listed', async () => {
    await replaceFoods(db, 'v1', [DAL]);

    expect(await listedFoodOf(db, BAR)).toBeNull();
    expect(await listedFoodOf(db, itemFromFood(ATTA, 60))).toBeNull();
  });
});
