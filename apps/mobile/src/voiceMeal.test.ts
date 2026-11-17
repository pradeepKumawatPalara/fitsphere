import type { Food, ParsedMealItem } from '@fitsphere/shared';
import { searchFoodList } from './components/FoodSearchSheet';
import { replaceFoods } from './local/store';
import { migrateLocal } from './local/store';
import type { SqlDb } from './local/sql';
import { itemFromFood, itemFromFoodUnits, itemFromServings } from './mealItems';
import { memoryDb } from './testing/memoryDb';
import { amountSaid, findSpokenFoods } from './voiceMeal';

// D-115 (REQ-LOG-009): the foods the AI named, found in the phone's food list as Search foods finds
// them, with their amounts built as a food's page builds them. Synthetic foods and made-up values.

const food = (source: Food['source'], code: string, name: string, extra: Partial<Food> = {}): Food => ({
  source,
  code,
  name,
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 6,
  fibreG: 2,
  fatG: 3,
  carbsG: 30,
  kcal: 180,
  kcalEstimated: source !== 'ifct2017',
  measures: [],
  portions: [],
  ...extra,
});

const ROTI = food('indb', 'V01', 'Test roti', { portions: [{ label: 'Roti', grams: 40 }] });
const DAL = food('ifct2017', 'V02', 'Test toor dal', { measures: [{ measure: 'katori', grams: 150 }] });
const BIRYANI = food('dish_estimate', 'est-v03', 'Test chicken biryani', { portions: [{ label: 'Plate', grams: 250 }] });
const CURD = food('ifct2017', 'V04', 'Test curd', { portions: [{ label: 'Bowl', grams: 200 }] });
const RICE = food('ifct2017', 'V05', 'Test rice');
const MILK = food('ifct2017', 'V06', 'Test milk');
const EGG_RAW = food('ifct2017', 'V07', 'Test egg, raw', { measures: [{ measure: 'piece', grams: 50 }] });
const EGG_BOILED = food('ifct2017', 'V08', 'Test egg, boiled', { measures: [{ measure: 'piece', grams: 45 }] });

const said = (name: string, quantity: number | null, unit: ParsedMealItem['unit'], extra: Partial<ParsedMealItem> = {}): ParsedMealItem => ({
  spokenWords: name,
  name,
  quantity,
  unit,
  preparation: null,
  ambiguity: [],
  ...extra,
});

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
  await replaceFoods(db, 'v-test', [ROTI, DAL, BIRYANI, CURD, RICE, MILK, EGG_RAW, EGG_BOILED]);
});

describe('D-115 the amount said', () => {
  it('weights and volumes become grams; a measure stays a measure; nothing said is no amount', () => {
    expect(amountSaid({ quantity: 150, unit: 'g' }).amount).toEqual({ count: 150, unit: 'g' });
    expect(amountSaid({ quantity: 0.5, unit: 'kg' }).amount).toEqual({ count: 500, unit: 'g' });
    expect(amountSaid({ quantity: 500, unit: 'ml' }).amount).toEqual({ count: 500, unit: 'g' });
    expect(amountSaid({ quantity: 1, unit: 'l' }).amount).toEqual({ count: 1000, unit: 'g' });
    expect(amountSaid({ quantity: 1, unit: 'katori' })).toEqual({ amount: { count: 1, unit: 'katori' }, otherUnits: ['bowl'] });
    expect(amountSaid({ quantity: 2, unit: null }).amount).toEqual({ count: 2, unit: null });
    expect(amountSaid({ quantity: null, unit: null }).amount).toBeNull();
  });
});

describe('REQ-LOG-009 the foods said, found in the food list', () => {
  it('finds each food and builds its amount exactly as its page would: katori, plate, piece (a roti’s own measure) and grams', async () => {
    const { found, missing } = await findSpokenFoods(
      db,
      [said('roti', 2, 'piece'), said('toor dal', 1, 'katori'), said('chicken biryani', 0.5, 'plate'), said('rice', 150, 'g')],
      searchFoodList,
    );

    expect(missing).toEqual([]);
    expect(found.map((food) => [food.item, food.assumed])).toEqual([
      [itemFromServings(ROTI, ROTI.portions[0]!, 2), false],
      [itemFromFoodUnits(DAL, DAL.measures[0]!, 1), false],
      [itemFromServings(BIRYANI, BIRYANI.portions[0]!, 0.5), false],
      [itemFromFood(RICE, 150), false],
    ]);
  });

  it('a katori said is the food’s Bowl when it has no katori', async () => {
    const { found } = await findSpokenFoods(db, [said('curd', 1, 'katori')], searchFoodList);
    expect(found[0]).toMatchObject({ item: itemFromServings(CURD, CURD.portions[0]!, 1), assumed: false });
  });

  it('no amount said, or a measure the food lacks: the amount its page opens on, marked assumed', async () => {
    const { found } = await findSpokenFoods(db, [said('milk', null, null), said('milk', 1, 'glass'), said('roti', null, null)], searchFoodList);
    expect(found.map((food) => [food.item, food.assumed])).toEqual([
      [itemFromFood(MILK, 100), true],
      [itemFromFood(MILK, 100), true],
      [itemFromServings(ROTI, ROTI.portions[0]!, 1), true],
    ]);
  });

  it('a way of cooking said finds that form first ("boiled egg")', async () => {
    const { found } = await findSpokenFoods(db, [said('egg', 2, 'piece', { preparation: 'boiled' })], searchFoodList);
    expect(found[0]?.item).toEqual(itemFromFoodUnits(EGG_BOILED, EGG_BOILED.measures[0]!, 2));
  });

  it('a food the list doesn’t have is "Not in our food list", the others still found', async () => {
    const lassi = said('mango lassi', 1, 'glass');
    const { found, missing } = await findSpokenFoods(db, [said('roti', 2, 'piece'), lassi], searchFoodList);
    expect(found.map((food) => food.item.name)).toEqual([itemFromServings(ROTI, ROTI.portions[0]!, 2).name]);
    expect(missing).toEqual([lassi]);
  });

  it('Devanagari words with an English name are found by the name', async () => {
    const { found } = await findSpokenFoods(db, [said('roti', 2, 'piece', { spokenWords: 'दो रोटी' })], searchFoodList);
    expect(found[0]).toMatchObject({ said: { spokenWords: 'दो रोटी' }, item: itemFromServings(ROTI, ROTI.portions[0]!, 2) });
  });
});
