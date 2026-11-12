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
  getFood,
  getMeta,
  isShortSearch,
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
  searchFoodSummaries,
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
      data: { id: id(), name: 'Old favourite', tags: [], items: [ATTA], savedAt: '2026-01-01T00:00:00.000Z' },
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
    await replaceFoods(db, 'v2', [...LIST, food('Z001', 'Dal tadka')]);
    expect((await searchFoods(db, 'dal')).map((found) => found.code)).toEqual(['Z001', 'B021']);
  });

  it('D-72 finds with one or two characters only a name, or another name, that is all of them', async () => {
    await replaceFoods(db, 'v2', [
      ...LIST,
      food('S001', 'Q'),
      food('S002', 'Test Zq cheese slices', ['Zq', 'cheese']),
      food('S003', 'Test quinoa'),
    ]);

    expect((await searchFoods(db, 'q')).map((found) => found.code)).toEqual(['S001']);
    expect((await searchFoods(db, ' ZQ ')).map((found) => found.code)).toEqual(['S002']);
    // Part of a word, or of a name, is not enough: "r" is in four names, "gh" starts Ghee.
    expect(await searchFoods(db, 'r')).toEqual([]);
    expect(await searchFoods(db, 'gh')).toEqual([]);
    // Marks alone find nothing.
    expect(await searchFoods(db, '-')).toEqual([]);
    // Three characters search as before.
    expect((await searchFoods(db, 'ghe')).map((found) => found.code)).toEqual(['T013']);
  });

  it('D-36 keeps each food’s household units with it', async () => {
    const ghee = { ...food('T013', 'Ghee'), measures: [{ measure: 'teaspoon' as const, grams: 4.6 }, { measure: 'tablespoon' as const, grams: 13.5 }] };
    await replaceFoods(db, 'v2', [ghee]);

    expect(await searchFoods(db, 'ghee')).toEqual([ghee]);
  });

  it('D-73 finds for the list the same foods, in the same order, as summaries, and reads one whole when it opens', async () => {
    const ghee = { ...food('T013', 'Ghee'), measures: [{ measure: 'teaspoon' as const, grams: 4.6 }], portions: [{ label: 'Spoon', grams: 5 }] };
    await replaceFoods(db, 'v2', [...LIST.filter((listed) => listed.code !== 'T013'), ghee, food('Z001', 'Dal tadka')]);

    for (const query of ['dal', 'gooseberry', 'ghee', 'raw rice', 'r']) {
      const summaries = (await searchFoods(db, query)).map(({ source, code, name, foodGroup, kcal, kcalEstimated }) => ({ source, code, name, foodGroup, kcal, kcalEstimated }));
      expect(await searchFoodSummaries(db, query)).toEqual(summaries);
    }
    expect(await searchFoodSummaries(db, 'ghee')).toEqual([{ source: 'ifct2017', code: 'T013', name: 'Ghee', foodGroup: 'Synthetic group', kcal: 10, kcalEstimated: false }]);
    expect(await getFood(db, 'ifct2017', 'T013')).toEqual(ghee);
    expect(await getFood(db, 'ifct2017', 'T999')).toBeNull();
  });

  it('D-26 finds a food by its alias', async () => {
    expect((await searchFoods(db, 'gooseberry')).map((found) => found.name)).toEqual(['Goosberry']);
  });

  it('treats % as a plain character and _ as a mark (D-86), and an empty search finds nothing', async () => {
    expect((await searchFoods(db, '50%')).map((found) => found.code)).toEqual(['X001']);
    expect((await searchFoods(db, 'fat_50%')).map((found) => found.code)).toEqual(['X001']);
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

  it('D-62 lists the estimated dishes after the other sources, found by their base food words too', async () => {
    const estimated = { ...food('est-test-sabzi', 'Test okra sabzi', ['okra', 'bhindi']), source: 'dish_estimate' as const, kcalEstimated: true };
    await replaceFoods(db, 'v2', [estimated, food('V001', 'Okra, raw'), { ...food('BFP301', 'Okra fry'), source: 'indb' as const }]);

    expect((await searchFoods(db, 'okra')).map((found) => found.code)).toEqual(['BFP301', 'V001', 'est-test-sabzi']);
    expect((await searchFoods(db, 'bhindi')).map((found) => found.code)).toEqual(['est-test-sabzi']);
  });

  it('D-62 ignores marks, and finds words typed together, without its apostrophe, or with a mark between them', async () => {
    await replaceFoods(db, 'v2', [
      food('T001', "Test Maker's Dal-Makhani (Synthetic)"),
      food('T002', 'Test bread, white'),
      food('T003', 'Test aloo naan', ['stuffed aloo naan']),
      food('T004', 'Soaked almonds'),
      food('T005', 'Test dal (tadka)'),
    ]);

    expect((await searchFoods(db, 'makers')).map((found) => found.code)).toEqual(['T001']);
    expect((await searchFoods(db, 'dalmakhani')).map((found) => found.code)).toEqual(['T001']);
    expect((await searchFoods(db, "maker's dal-makhani")).map((found) => found.code)).toEqual(['T001']);
    expect((await searchFoods(db, 'testbread')).map((found) => found.code)).toEqual(['T002']);
    // A word of marks alone is left out (D-86; D-62 looked for it as typed); one character alone is a
    // short search (D-72).
    expect((await searchFoods(db, "' dal")).map((found) => found.code)).toEqual(['T005', 'T001']);
    expect(await searchFoods(db, "'")).toEqual([]);
    // Never one word's end and the next one's start: "stuffed aloo" and "soaked almonds" have no "dal".
    expect((await searchFoods(db, 'dal')).map((found) => found.code)).toEqual(['T005', 'T001']);
    expect((await searchFoods(db, 'daltadka')).map((found) => found.code)).toEqual(['T005']);
    expect((await searchFoods(db, 'dal-tadka')).map((found) => found.code)).toEqual(['T005']);
    expect((await searchFoods(db, 'stuffedaloo')).map((found) => found.code)).toEqual(['T003']);
  });

  it('D-86 ignores any mark typed, before, after or inside a word, or as a word of its own', async () => {
    await replaceFoods(db, 'v2', [
      food('P001', 'Test paneer tikka'),
      food('P002', 'Test egg white, boiled'),
      food('P003', 'Test aloo gobi'),
      food('P004', 'Test oats + almonds!'),
      food('P005', 'Test 55% dark chocolate'),
      food('P006', 'Qz'),
      food('P007', 'Test chicken: masala'),
    ]);
    const codes = async (query: string) => (await searchFoods(db, query)).map((found) => found.code);

    // QA-09's searches (2026-11-12) find what the words alone find.
    for (const [typed, plain] of [
      ['paneer!', 'paneer'],
      ['paneer?', 'paneer'],
      ['[paneer]', 'paneer'],
      ['paneer*', 'paneer'],
      ['#paneer', 'paneer'],
      ['“paneer”', 'paneer'],
      ['paneer…', 'paneer'],
      ['chicken:', 'chicken'],
      ['chicken;', 'chicken'],
      ['egg+white', 'egg-white'],
      ['egg_white', 'egg-white'],
      ['egg–white', 'egg-white'],
      ['aloo+gobi', 'aloo-gobi'],
      ['aloo & gobi', 'aloo gobi'],
      ['aloo – gobi !', 'aloo gobi'],
    ]) {
      expect([typed, await codes(typed!)]).toEqual([typed, await codes(plain!)]);
    }
    expect(await codes('paneer')).toEqual(['P001']);
    expect(await codes('chicken')).toEqual(['P007']);
    expect(await codes('egg-white')).toEqual(['P002']);
    expect(await codes('aloo gobi')).toEqual(['P003']);
    // A name's own marks read as spaces too: its words find it, typed apart or together.
    expect(await codes('oats almonds')).toEqual(['P004']);
    expect(await codes('oatsalmonds')).toEqual(['P004']);
    expect(await codes('chicken masala')).toEqual(['P007']);
    // % stays: names use it.
    expect(await codes('55%')).toEqual(['P005']);
    expect(await codes('55% dark')).toEqual(['P005']);
    // Marks alone find nothing, and do not make a short search long (D-72).
    expect(await codes('!?!')).toEqual([]);
    expect(await codes('& -')).toEqual([]);
    expect(await codes('qz')).toEqual(['P006']);
    expect(await codes('qz!')).toEqual(['P006']);
  });

  it('D-92 finds an everyday food by its word and marks it, wherever the word is in its other names', async () => {
    await replaceFoods(db, 'v2', [
      { ...food('E001', 'Test boiled rice (Uble chawal)', ['@rice']), source: 'indb' },
      food('E002', 'Test masala chai', ['chai', '@tea', '@chai']),
      food('E003', 'Test rice, raw, milled'),
      food('E004', 'Test tea leaves'),
    ]);
    const marked = async (query: string) => (await searchFoodSummaries(db, query)).map((found) => `${found.code}${found.everyday ? '*' : ''}`);

    expect(await marked('rice')).toEqual(['E001*', 'E003']);
    expect(await marked('RICE!')).toEqual(['E001*', 'E003']);
    // Found by its word alone ("tea" is not in the name), the word the last of its other names or not.
    expect(await marked('tea')).toEqual(['E002*', 'E004']);
    expect(await marked('chai')).toEqual(['E002*']);
    // Another word, or the word inside another, is no everyday food's.
    expect(await marked('masala')).toEqual(['E002']);
    expect(await marked('boiled rice')).toEqual(['E001']);
    // The full food keeps its other names as the list gives them.
    expect((await searchFoods(db, 'tea')).map((found) => found.aliases)).toEqual([['chai', '@tea', '@chai'], []]);
  });

  it('D-72 finds with one or two characters a food whose last other name is the search (D-86 put no space after it)', async () => {
    await replaceFoods(db, 'v2', [food('S010', 'Test protein shake', ['protein', 'On']), food('S011', 'Test onion soup')]);

    expect((await searchFoods(db, 'on')).map((found) => found.code)).toEqual(['S010']);
  });

  it('D-88 ignores accents, typed or in the name; Devanagari stays as it is', async () => {
    await replaceFoods(db, 'v2', [
      food('I001', 'Test Nescafé latte'),
      food('I002', 'Test crème brûlée'),
      food('I003', 'Test jalapeño chips', ['Jalapeño']),
      food('I004', 'Test cafe frappe'),
      food('I005', 'दाल मखनी (test)'),
      food('I006', 'Test smørrebrød'),
    ]);
    const codes = async (query: string) => (await searchFoods(db, query)).map((found) => found.code);

    expect(await codes('nescafe')).toEqual(['I001']);
    expect(await codes('NESCAFÉ')).toEqual(['I001']);
    expect(await codes('creme brulee')).toEqual(['I002']);
    expect(await codes('crème')).toEqual(['I002']);
    expect(await codes('jalapeno')).toEqual(['I003']);
    expect(await codes('cafe')).toEqual(['I004', 'I001']);
    expect(await codes('café')).toEqual(['I004', 'I001']);
    expect(await codes('smorrebrod')).toEqual(['I006']);
    expect(await codes('दाल')).toEqual(['I005']);
    expect(await codes('मखनी')).toEqual(['I005']);
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

  it('D-62 finds a brand typed without its apostrophe or its spaces, brands starting with it first', async () => {
    // Synthetic brands, written as some labels write them.
    const BHUJIA = { ...BUTTER, barcode: '8901234500011', name: 'Bhujia sev', brand: "Testiram'S" };
    const BAR = { ...BUTTER, barcode: '8901234500012', name: 'Protein bar', brand: 'The Test Factory' };
    const OTHER = { ...BUTTER, barcode: '8901234500013', name: 'Bhujia like testirams', brand: 'Other Foods' };
    await replaceFoods(db, 'v1', [], [], [BHUJIA, BAR, OTHER]);

    expect((await searchPackaged(db, 'testirams')).map((found) => found.barcode)).toEqual([BHUJIA.barcode, OTHER.barcode]);
    expect((await searchPackaged(db, 'testfactory')).map((found) => found.barcode)).toEqual([BAR.barcode]);
    expect((await searchPackaged(db, 'test factory bar')).map((found) => found.barcode)).toEqual([BAR.barcode]);
  });

  it('returns every barcode of a product, each with its own serving; Search foods shows it once (D-78)', async () => {
    // Synthetic: one paneer under three barcodes (one names it with the brand), only one with a serving.
    const PANEER = { barcode: '8901234500001', name: 'Paneer', brand: 'Test Dairy', kcal: 283, proteinG: 16.1, carbsG: 5.1, fatG: 22, fibreG: null, servingGrams: null };
    const PANEER_1KG = { ...PANEER, barcode: '8901234500002', name: 'Test Dairy Paneer', servingGrams: 50 };
    const PANEER_COPY = { ...PANEER, barcode: '8901234500003', name: 'paneer', brand: 'TEST DAIRY' };
    await replaceFoods(db, 'v1', [], [], [PANEER, PANEER_1KG, PANEER_COPY]);

    const found = await searchPackaged(db, 'paneer');
    expect(found.map((food) => food.barcode).sort()).toEqual(['8901234500001', '8901234500002', '8901234500003']);
    // D-56 once gave the first copy another barcode's serving, which the server refused when a meal used it.
    expect(found.find((food) => food.barcode === PANEER.barcode)?.servingGrams).toBeNull();
    expect(found.find((food) => food.barcode === PANEER_1KG.barcode)?.servingGrams).toBe(50);
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
        CREATE TABLE saved_meals (id TEXT PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL, tags TEXT NOT NULL,
          items TEXT NOT NULL, saved_at TEXT NOT NULL, kcal REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL,
          fat_g REAL, fibre_g REAL, sync_state TEXT NOT NULL);
        CREATE TABLE workouts (id TEXT PRIMARY KEY, day TEXT NOT NULL, exercises TEXT NOT NULL, recorded_at TEXT NOT NULL,
          sync_state TEXT NOT NULL);
        CREATE TABLE targets (kind TEXT PRIMARY KEY, value INTEGER NOT NULL, set_at TEXT NOT NULL, set_by_user_id TEXT,
          sync_state TEXT NOT NULL);
        CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
          data TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_code TEXT);
        PRAGMA user_version = 7;`);
      await old.runAsync(`INSERT INTO foods VALUES ('ifct2017', 'L002', 'Milk, whole, Cow', 'Synthetic group', '[]', 1, 0, 1, 1, 10, 0)`, []);
      await setMeta(old, 'food_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
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
        CREATE TABLE saved_meals (id TEXT PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL, tags TEXT NOT NULL,
          items TEXT NOT NULL, saved_at TEXT NOT NULL, kcal REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL,
          fat_g REAL, fibre_g REAL, sync_state TEXT NOT NULL);
        CREATE TABLE targets (kind TEXT PRIMARY KEY, value INTEGER NOT NULL, set_at TEXT NOT NULL, set_by_user_id TEXT,
          sync_state TEXT NOT NULL);
        CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
          data TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_code TEXT);
        PRAGMA user_version = 4;`);
      await old.runAsync(`INSERT INTO foods VALUES ('ifct2017', 'A019', 'Wheat flour, atta', 'Synthetic group', '[]', 1, 1, 1, 1, 10, 0)`, []);
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '42');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
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
        CREATE TABLE targets (kind TEXT PRIMARY KEY, value INTEGER NOT NULL, set_at TEXT NOT NULL, set_by_user_id TEXT,
          sync_state TEXT NOT NULL);
        CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
          data TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_code TEXT);
        PRAGMA user_version = 2;`);
      await old.runAsync(`INSERT INTO steps VALUES ('2026-10-20', 5000, ?, 'synced')`, [AT]);
      await setMeta(old, 'cursor', '42');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
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
      await old.execAsync('ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; DROP TABLE exercises; ALTER TABLE packaged_foods DROP COLUMN search_name; ALTER TABLE packaged_foods DROP COLUMN search_brand; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 11;');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
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
      await old.execAsync('DROP TABLE exercises; DROP TABLE packaged_foods; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 10;');
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await searchPackaged(old, 'butter')).toEqual([]);
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      // Version 11 keeps the cursor; version 19 (targets by date, D-77) then clears it.
      expect(await getMeta(old, 'cursor')).toBeNull();
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
      await old.execAsync('DROP TABLE exercises; DROP TABLE packaged_foods; DROP TABLE my_foods; ALTER TABLE foods DROP COLUMN portions; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 9;');
      await old.runAsync(
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated, measures)
         VALUES ('ifct2017', 'A019', 'Wheat flour, atta', 'Synthetic group', '[]', 10, 11, 1.5, 64, 320, 0, '[]')`,
        [],
      );
      await setMeta(old, 'food_list_version', 'v1');
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
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

describe('D-66 Search foods without a cap', () => {
  it('finds every match of each kind: more than 30 foods of one source, packaged foods, dishes and My foods', async () => {
    // Synthetic foods, dishes and products: made-up names and values.
    const foods: Food[] = Array.from({ length: 45 }, (_, i) => ({
      source: 'brand_label',
      code: `test-bread-${i}`,
      name: `Test bread ${i}`,
      foodGroup: 'Test Bakers',
      aliases: [],
      proteinG: 8,
      fibreG: 2,
      fatG: 3,
      carbsG: 48,
      kcal: 250,
      kcalEstimated: false,
      measures: [],
      portions: [],
    }));
    const dishes: Dish[] = Array.from({ length: 15 }, (_, i) => ({ code: `test_bread_dish_${i}`, name: `Test bread dish ${i}`, portionUnit: 'piece', kcal: 100, proteinG: 3, carbsG: 15, fatG: 3, fibreG: 1 }));
    const packaged = Array.from({ length: 40 }, (_, i) => ({ ...BUTTER, barcode: `89012345${String(i).padStart(5, '0')}`, name: `Test bread pack ${i}` }));
    await replaceFoods(db, 'v1', foods, dishes, packaged);
    for (let i = 0; i < 12; i += 1) {
      const id = `00000000-0000-4000-d000-${String(i).padStart(12, '0')}`;
      await saveEntry(db, 'myFood', {
        changeId: `c-my-bread-${i}`,
        data: { id, name: `Test bread mine ${i}`, unit: 'slice', kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: 1.5, savedAt: AT },
      });
    }

    expect(await searchFoods(db, 'bread')).toHaveLength(45);
    expect(await searchPackaged(db, 'bread')).toHaveLength(40);
    expect(await searchDishes(db, 'bread')).toHaveLength(15);
    expect(await searchMyFoods(db, 'bread')).toHaveLength(12);
    // A limit, where one is given, still keeps that many.
    expect(await searchFoods(db, 'bread', 30)).toHaveLength(30);
    expect(await searchPackaged(db, 'bread', 30)).toHaveLength(30);
  });
});

describe('D-72 a search of one or two characters', () => {
  it('is short below three characters, spaces and marks (but %) not counted (D-86)', () => {
    expect(['a', 'ab', ' ab ', 'a b', '-', '米菓', 'on!', '!?', '“ab”', 'a.b'].filter((query) => !isShortSearch(query))).toEqual([]);
    expect(['abc', 'a bc', '50%', 'दाल', 'on!x'].filter(isShortSearch)).toEqual([]);
  });

  it('finds the packaged foods named by it, or of a brand named by it, the dishes and My foods named by it', async () => {
    // Synthetic products, dishes and My foods: made-up names and values.
    const named = { ...BUTTER, barcode: '8901234500001', name: 'Q', brand: null };
    const branded = { ...BUTTER, barcode: '8901234500002', name: 'Test whey', brand: 'Z.Y.' };
    const other = { ...BUTTER, barcode: '8901234500003', name: 'Test quark', brand: 'Zyx Foods' };
    const dish: Dish = { code: 'test_qa', name: 'Qa', portionUnit: 'piece', kcal: 100, proteinG: 3, carbsG: 15, fatG: 3, fibreG: 1 };
    const longer: Dish = { code: 'test_qa_curry', name: 'Qa curry', portionUnit: 'katori', kcal: 150, proteinG: 4, carbsG: 15, fatG: 6, fibreG: 2 };
    await replaceFoods(db, 'v1', [], [dish, longer], [named, branded, other]);
    for (const [i, name] of ['Qa', 'Qa shake'].entries()) {
      await saveEntry(db, 'myFood', {
        changeId: `c-short-${i}`,
        data: { id: `00000000-0000-4000-d100-${String(i).padStart(12, '0')}`, name, unit: 'g', kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fibreG: null, savedAt: AT },
      });
    }

    expect(await searchPackaged(db, 'q')).toEqual([named]);
    expect(await searchPackaged(db, 'zy')).toEqual([branded]);
    expect((await searchDishes(db, 'QA')).map((found) => found.code)).toEqual(['test_qa']);
    expect((await searchMyFoods(db, 'qa')).map((found) => found.name)).toEqual(['Qa']);
    // A product with no brand is not found by a search of marks alone.
    expect(await searchPackaged(db, '.')).toEqual([]);
    // Three characters find by part of a word again.
    expect((await searchMyFoods(db, 'qa s')).map((found) => found.name)).toEqual(['Qa shake']);
  });
});

describe('D-86 marks in a search', () => {
  it('finds packaged foods, dishes and My foods as the words alone do, the marks typed or in the name', async () => {
    // Synthetic products, dishes and My foods: made-up names and values.
    const marked = { ...BUTTER, barcode: '8901234500011', name: 'Test paneer + peas!', brand: 'Test “Dairy”' };
    const dish: Dish = { code: 'test_dal_tadka', name: 'Test dal: tadka!', portionUnit: 'katori', kcal: 150, proteinG: 4, carbsG: 15, fatG: 6, fibreG: 2 };
    const short: Dish = { code: 'test_qa', name: 'Qa!', portionUnit: 'piece', kcal: 100, proteinG: 3, carbsG: 15, fatG: 3, fibreG: 1 };
    await replaceFoods(db, 'v1', [], [dish, short], [marked, BISCUIT]);
    for (const [i, name] of ['Test paneer + peas!', 'Qz?'].entries()) {
      await saveEntry(db, 'myFood', {
        changeId: `c-marks-${i}`,
        data: { id: `00000000-0000-4000-d200-${String(i).padStart(12, '0')}`, name, unit: 'g', kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fibreG: null, savedAt: AT },
      });
    }
    const barcodes = async (query: string) => (await searchPackaged(db, query)).map((found) => found.barcode);
    const dishCodes = async (query: string) => (await searchDishes(db, query)).map((found) => found.code);
    const mine = async (query: string) => (await searchMyFoods(db, query)).map((found) => found.name);

    for (const query of ['paneer!', '#paneer', 'paneer + peas', 'paneerpeas', '“test dairy”', 'dairy?']) {
      expect([query, await barcodes(query)]).toEqual([query, ['8901234500011']]);
    }
    // Dishes and My foods are read by SQL (D-66), which reads the same marks as spaces.
    for (const query of ['dal!', 'tadka;', '[dal tadka]', 'daltadka', 'dal: tadka']) {
      expect([query, await dishCodes(query)]).toEqual([query, ['test_dal_tadka']]);
    }
    for (const query of ['paneer!', 'paneer & peas', 'paneerpeas']) {
      expect([query, await mine(query)]).toEqual([query, ['Test paneer + peas!']]);
    }
    // A short search: a name with a mark at its end is still named by it, typed with a mark or not.
    expect(await dishCodes('qa')).toEqual(['test_qa']);
    expect(await dishCodes('qa!')).toEqual(['test_qa']);
    expect(await mine('qz')).toEqual(['Qz?']);
    // Marks alone find nothing.
    expect(await barcodes('!!!')).toEqual([]);
    expect(await dishCodes('?!')).toEqual([]);
    expect(await mine('& ?')).toEqual([]);
  });
});

describe('D-88 accents in a search', () => {
  it('finds packaged foods by a brand with accents, and dishes and My foods, capitals too, without them', async () => {
    // Synthetic products, dishes and My foods: made-up names and values.
    const krunch = { ...BUTTER, barcode: '8901234500031', name: 'Test Koko Krunch', brand: 'Testlé' };
    const dish: Dish = { code: 'test_creme', name: 'Test crème caramel', portionUnit: 'piece', kcal: 200, proteinG: 4, carbsG: 30, fatG: 6, fibreG: 0 };
    await replaceFoods(db, 'v1', [], [dish], [krunch, BISCUIT]);
    for (const [i, name] of ['Test CAFÉ MOCHA', 'Test café latté'].entries()) {
      await saveEntry(db, 'myFood', {
        changeId: `c-accents-${i}`,
        data: { id: `00000000-0000-4000-d300-${String(i).padStart(12, '0')}`, name, unit: 'g', kcal: 100, proteinG: 5, carbsG: 10, fatG: 2, fibreG: null, savedAt: AT },
      });
    }

    expect((await searchPackaged(db, 'testle koko')).map((found) => found.barcode)).toEqual(['8901234500031']);
    expect((await searchPackaged(db, 'TESTLÉ')).map((found) => found.barcode)).toEqual(['8901234500031']);
    // Dishes and My foods are read by SQL (D-66), which takes the accents off capitals too.
    expect((await searchDishes(db, 'creme')).map((found) => found.code)).toEqual(['test_creme']);
    expect((await searchMyFoods(db, 'cafe')).map((found) => found.name)).toEqual(['Test CAFÉ MOCHA', 'Test café latté']);
    expect((await searchMyFoods(db, 'café mocha')).map((found) => found.name)).toEqual(['Test CAFÉ MOCHA']);
    expect((await searchMyFoods(db, 'cafelatte')).map((found) => found.name)).toEqual(['Test café latté']);
  });
});

describe('Local schema version 21', () => {
  it('D-88 the update from version 20 asks for the food list again, the foods searched as before till it comes', async () => {
    const old = memoryDb();
    try {
      // Version 20 as phones have it: version 21 only clears the list's version.
      await migrateLocal(old);
      await replaceFoods(old, 'v9', [
        { source: 'ifct2017', code: 'T501', name: 'Test Nescafé', foodGroup: 'Test', aliases: [], proteinG: 1, fibreG: null, fatG: 1, carbsG: 1, kcal: 2, kcalEstimated: false, measures: [], portions: [] },
      ]);
      await old.execAsync('ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; PRAGMA user_version = 20;');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await getMeta(old, 'food_list_version')).toBeNull();
      expect((await searchFoods(old, 'nescafe')).map((found) => found.code)).toEqual(['T501']);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 15', () => {
  it('D-66 the update from version 14 makes the search text from the foods on the phone, without downloading them again', async () => {
    const old = memoryDb();
    try {
      // Version 14 as phones have it: build it with the current migrations, then drop what 15 adds.
      await migrateLocal(old);
      await old.execAsync(
        'ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; ALTER TABLE exercises DROP COLUMN details; ALTER TABLE exercises DROP COLUMN places; ALTER TABLE exercises DROP COLUMN place_keys; ALTER TABLE foods DROP COLUMN search_name; ALTER TABLE foods DROP COLUMN search_aliases; ALTER TABLE packaged_foods DROP COLUMN search_name; ALTER TABLE packaged_foods DROP COLUMN search_brand; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 14;',
      );
      // Synthetic: a home-style food found by its item, and a packaged food by its brand.
      await old.runAsync(
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated)
         VALUES ('home', 'home-test-toast', 'Test toast', 'Bread', '["bread"]', 8, 2, 3, 45, 250, 0)`,
        [],
      );
      await old.runAsync(
        `INSERT INTO packaged_foods (barcode, name, brand, kcal, protein_g, carbs_g, fat_g) VALUES ('8901234500021', 'Bhujia sev', 'Testiram''S', 592, 10, 40, 40)`,
        [],
      );
      await setMeta(old, 'food_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect((await searchFoods(old, 'bread')).map((found) => found.code)).toEqual(['home-test-toast']);
      expect((await searchPackaged(old, 'testirams')).map((found) => found.barcode)).toEqual(['8901234500021']);
      // Version 15 kept the list's version; version 21 (D-88) then asks for the list again.
      expect(await getMeta(old, 'food_list_version')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 17', () => {
  it('D-69 the update from version 16 keeps every saved meal, waiting ones too, without its meal', async () => {
    const old = memoryDb();
    try {
      // Version 16 (the exercise library's, D-67) as phones have it: build it with the current
      // migrations, then put meal_type back.
      await migrateLocal(old);
      await old.execAsync(`ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases;
        DROP TABLE saved_meals;
        CREATE TABLE saved_meals (id TEXT PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL, tags TEXT NOT NULL,
          items TEXT NOT NULL, saved_at TEXT NOT NULL, kcal REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL,
          fat_g REAL, fibre_g REAL, sync_state TEXT NOT NULL);
        ALTER TABLE exercises DROP COLUMN details; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 16;`);
      const synced = id();
      const waiting = id();
      for (const row of [
        { savedId: synced, name: 'Synthetic breakfast', state: 'synced' },
        { savedId: waiting, name: 'Synthetic dinner', state: 'pending' },
      ]) {
        await old.runAsync(`INSERT INTO saved_meals VALUES (?, ?, 'lunch', '[]', ?, ?, 192, 6.34, 38.5, 0.92, 6.82, ?)`, [
          row.savedId,
          row.name,
          JSON.stringify([ATTA]),
          AT,
          row.state,
        ]);
      }

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      const saved = await listSavedMeals(old);
      expect(saved).toEqual([
        { id: synced, name: 'Synthetic breakfast', tags: [], items: [ATTA], savedAt: AT, kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82, syncState: 'synced' },
        { id: waiting, name: 'Synthetic dinner', tags: [], items: [ATTA], savedAt: AT, kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82, syncState: 'pending' },
      ]);
    } finally {
      await old.closeAsync();
    }
  });
});
