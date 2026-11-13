import { IFCT_ACKNOWLEDGEMENT, INDB_ACKNOWLEDGEMENT, OFF_ATTRIBUTION, type Food, type PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getEntry, replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { itemFromOwn, itemFromServings, parseOwnQuantity, withOwnQuantity, withServings } from '../mealItems';
import { formatAmount } from '../meals';
import { NOW, renderInApp } from '../testing/appHarness';
import { pickAmount, wheel } from '../testing/foodPage';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// More foods (docs/plans/more-foods.md, D-39; the redesign's 3.6 and 3.8, locked by the owner on
// 2026-11-04): USDA's foods with their servings, your own food in any unit, and My foods. Today is
// Wednesday 28 October 2026. The USDA rows are FNDDS 2021–2023's values; the rest are synthetic.

const TODAY = '2026-10-28';
const MY_BREAD_ID = '00000000-0000-4000-d000-000000000001';
const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [], portions: [] },
  // INDB recipes (D-46): synthetic values, every one estimated, each with its serving.
  {
    source: 'indb',
    code: 'BFP901',
    name: 'Test bread toast',
    foodGroup: 'Indian recipes (INDB)',
    aliases: [],
    proteinG: 9.43,
    fibreG: 2.3,
    fatG: 3.59,
    carbsG: 49.2,
    kcal: 267,
    kcalEstimated: true,
    measures: [],
    portions: [{ label: 'Slice', grams: 28 }],
  },
  { source: 'ifct2017', code: 'B021', name: 'Red gram, dal', foodGroup: 'Grain Legumes', aliases: [], proteinG: 21.7, fibreG: 9.06, fatG: 1.56, carbsG: 55.23, kcal: 335, kcalEstimated: false, measures: [], portions: [] },
  {
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
  },
];
const MY_BREAD = { id: MY_BREAD_ID, name: 'Peanut butter bread', unit: 'slice' as const, kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: 1.5 };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  await replaceFoods(db, server.state.foodsVersion, FOODS);
}

// A synthetic packaged food with a 50 g serving (D-48): made-up values, not a real product's.
const PACKAGED_BREAD: PackagedFood = {
  barcode: '8901234567890',
  name: 'Test sandwich bread',
  brand: 'Test Bakers',
  kcal: 250,
  proteinG: 8,
  carbsG: 50,
  fatG: 2,
  fibreG: null,
  servingGrams: 50,
};

// A synthetic brand label with no fibre given (D-49): made-up values, not a real product's.
const LABEL_BREAD: Food = {
  source: 'brand_label',
  code: 'test-bakers-white-bread',
  name: 'Test Bakers White Bread',
  foodGroup: 'Test Bakers',
  aliases: ['Test Bakers'],
  proteinG: 8,
  fibreG: null,
  fatG: 2,
  carbsG: 50,
  kcal: 250,
  kcalEstimated: false,
  measures: [],
  portions: [{ label: 'Slice', grams: 25 }],
};

async function withLabels(db: SqlDb, server: FakeServer) {
  server.state.foods = [...FOODS, LABEL_BREAD];
  server.state.packaged = [PACKAGED_BREAD];
  await replaceFoods(db, server.state.foodsVersion, [...FOODS, LABEL_BREAD], [], [PACKAGED_BREAD]);
}

async function withPackaged(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  server.state.packaged = [PACKAGED_BREAD];
  await replaceFoods(db, server.state.foodsVersion, FOODS, [], [PACKAGED_BREAD]);
}

async function withMyBread(db: SqlDb, server: FakeServer) {
  await withFoods(db, server);
  await saveEntry(db, 'myFood', { changeId: 'c-my-bread', data: { ...MY_BREAD, savedAt: NOW.toISOString() } });
}

function render(before: (db: SqlDb, server: FakeServer) => Promise<void> = withFoods) {
  mockParams = { day: TODAY, slot: 'breakfast' };
  return renderInApp(<LogMealScreen now={() => NOW} />, undefined, before);
}

async function search(text: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
}

describe('D-39 the amounts', () => {
  const bread = FOODS[1]!;

  it('a serving: its grams × the count, the values for those grams, estimated', () => {
    const item = itemFromServings(bread, bread.portions[0]!, 2);

    expect(item).toMatchObject({ source: 'indb', ref: 'BFP901', estimated: true, amount: { unit: 'serving', label: 'Slice', value: 2, grams: 56 } });
    expect(item.kcal).toBeCloseTo(149.52);
    expect(formatAmount(item.amount)).toBe('2 × slice (56 g)');
    expect(withServings(item, 1).amount).toEqual({ unit: 'serving', label: 'Slice', value: 1, grams: 28 });
  });

  it('your own food per one slice, per 100 ml or per 100 g', () => {
    const values = { kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: null };
    expect(itemFromOwn({ name: ' Peanut butter bread ', unit: 'slice', ...values }, 2, MY_BREAD_ID)).toMatchObject({
      source: 'own',
      ref: MY_BREAD_ID,
      name: 'Peanut butter bread',
      amount: { unit: 'own', name: 'slice', value: 2 },
      kcal: 360,
      proteinG: 12,
      fibreG: null,
    });
    expect(itemFromOwn({ name: 'Lassi', unit: 'ml', ...values }, 250, null)).toMatchObject({ amount: { unit: 'own', name: 'ml', value: 250 }, kcal: 450 });
    expect(itemFromOwn({ name: 'Biscuits', unit: 'g', ...values }, 50, null)).toMatchObject({ amount: { unit: 'g', value: 50 }, kcal: 90 });
    expect(formatAmount({ unit: 'own', name: 'slice', value: 1.5 })).toBe('1.5 slices');
    expect(formatAmount({ unit: 'own', name: 'bowl', value: 1 })).toBe('1 bowl');
    expect(withOwnQuantity(itemFromOwn({ name: 'Bread', unit: 'slice', ...values }, 2, null), 3)).toMatchObject({ kcal: 540 });
  });

  it('a quantity: whole g or ml from 1 to 2,000; another unit from 0.1 to 100 with one decimal', () => {
    expect(parseOwnQuantity('250', 'ml')).toBe(250);
    expect(parseOwnQuantity('2.5', 'ml')).toBeNull();
    expect(parseOwnQuantity('1.5', 'slice')).toBe(1.5);
    expect(parseOwnQuantity('0.1', 'cup')).toBe(0.1);
    expect(parseOwnQuantity('1.25', 'slice')).toBeNull();
    expect(parseOwnQuantity('101', 'slice')).toBeNull();
    expect(parseOwnQuantity('0', 'slice')).toBeNull();
  });
});

describe('D-47 Search foods with Indian foods and My foods', () => {
  it('lists INDB’s recipes, then IFCT’s foods, and credits IFCT and INDB behind the i, no USDA', async () => {
    await render();
    await search('dal');

    const rows = await screen.findAllByRole('button', { name: /per 100 g/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Test dal fry, 100 kcal per 100 g, estimated', 'Red gram, dal, 335 kcal per 100 g']);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    expect(screen.getByText(`Foods marked INDB: ${INDB_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    expect(screen.queryByText(/USDA/)).toBeNull();
  });

  it('puts My foods before the Indian foods (D-54), marked "My food"', async () => {
    await render(withMyBread);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Peanut butter bread, your food, 180 kcal per slice',
      'Test bread toast, 267 kcal per 100 g, estimated',
    ]);
  });

  it('adds a recipe by its slice, counted in halves, with the grams the slices come to', async () => {
    await render();
    await search('toast');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test bread toast, 267 kcal per 100 g, estimated' }));
    expect(screen.getByText('Per 100 g: 267 kcal (estimated)')).toBeOnTheScreen();

    await pickAmount({ quantity: '2' });
    expect(screen.getByLabelText('Measure: Slice (28 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 2')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 56 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 150 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 5.3 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Test bread toast: 2 × slice (56 g), 150 kcal, 5.3 g protein')).toBeOnTheScreen();
  });

  it('adds a My food in its own unit, and its quantity’s rule shows under the box', async () => {
    await render(withMyBread);
    await search('peanut');
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, your food, 180 kcal per slice' }));
    expect(screen.getByText('One slice: 180 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Slices')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '1.25');
    expect(screen.getByText('Enter 0.1 to 100, with at most one decimal.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Peanut butter bread: 2 slices, 360 kcal, 12.0 g protein')).toBeOnTheScreen();
  });

  it('edits a My food from its sheet: the change is saved and synced; meals keep their own values', async () => {
    const { db, server } = await render(withMyBread);
    await search('peanut');
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, your food, 180 kcal per slice' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Edit My food' }));
    expect(await screen.findByRole('header', { name: 'Edit My food' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('kcal per slice'), '200');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await getEntry(db, 'myFood', MY_BREAD_ID)).toMatchObject({ kcal: 200 }));
    await waitFor(() => expect(server.entries('myFoods').get(MY_BREAD_ID)).toMatchObject({ kcal: 200 }));
  });

  it('deletes a My food only once confirmed', async () => {
    const { db } = await render(withMyBread);
    await search('peanut');
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, your food, 180 kcal per slice' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit My food' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete from My foods' }));

    expect(screen.getByText("Delete Peanut butter bread from My foods? Meals you've already logged keep it.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep it' }));
    expect(await getEntry(db, 'myFood', MY_BREAD_ID)).not.toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete from My foods' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await getEntry(db, 'myFood', MY_BREAD_ID)).toBeNull());
  });
});

describe('D-51 an exact match first (the owner’s phone test, 2026-11-05)', () => {
  it('a packaged food named just "Bread" comes first; the rest keep their order', async () => {
    const plain: PackagedFood = { ...PACKAGED_BREAD, barcode: '96385074', name: 'Bread', brand: 'Other Bakers' };
    await render(async (db, server) => {
      server.state.foods = [...FOODS, LABEL_BREAD];
      server.state.packaged = [PACKAGED_BREAD, plain];
      await replaceFoods(db, server.state.foodsVersion, [...FOODS, LABEL_BREAD], [], [PACKAGED_BREAD, plain]);
    });
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Bread, Other Bakers, 250 kcal per 100 g',
      'White Bread, Test Bakers, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
      'Test bread toast, 267 kcal per 100 g, estimated',
    ]);
  });
});

describe('D-54 the order of the results (the owner, 2026-11-06)', () => {
  // A synthetic IFCT food named like the others, so one search finds every source.
  const IFCT_BREAD: Food = { ...FOODS[0]!, code: 'A099', name: 'Bread, white (test)' };

  it('lists My foods, then brand labels, packaged foods, INDB, and IFCT last (an exact match would still come first, D-51; the plain food before all, D-91)', async () => {
    await render(async (db, server) => {
      const foods = [...FOODS, IFCT_BREAD, LABEL_BREAD];
      server.state.foods = foods;
      server.state.packaged = [PACKAGED_BREAD];
      await replaceFoods(db, server.state.foodsVersion, foods, [], [PACKAGED_BREAD]);
      await saveEntry(db, 'myFood', { changeId: 'c-my-bread', data: { ...MY_BREAD, savedAt: NOW.toISOString() } });
    });
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      // IFCT's "Bread, white" is the plain food "bread" names: first (D-91).
      'Bread, white (test), 320 kcal per 100 g',
      'Peanut butter bread, your food, 180 kcal per slice',
      'White Bread, Test Bakers, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
      'Test bread toast, 267 kcal per 100 g, estimated',
    ]);
  });
});

describe('D-57 erasing and clearing the search (the owner, 2026-11-06)', () => {
  const rowNames = async () => (await screen.findAllByRole('button', { name: /bread/i })).map((row) => row.props.accessibilityLabel);

  it('follows each letter erased, then the cross clears the search and its results', async () => {
    await render(async (db, server) => {
      server.state.foods = [...FOODS, LABEL_BREAD];
      server.state.packaged = [PACKAGED_BREAD];
      await replaceFoods(db, server.state.foodsVersion, [...FOODS, LABEL_BREAD], [], [PACKAGED_BREAD]);
    });
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await search('bread toast');
    expect(await rowNames()).toEqual(['Test bread toast, 267 kcal per 100 g, estimated']);

    // Erased a letter at a time: "bread toas", "bread toa", ... "bread".
    for (let end = 'bread toast'.length - 1; end >= 'bread'.length; end -= 1) {
      await fireEvent.changeText(screen.getByLabelText('Search foods'), 'bread toast'.slice(0, end));
    }
    await waitFor(async () =>
      expect(await rowNames()).toEqual([
        'White Bread, Test Bakers, 250 kcal per 100 g',
        'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
        'Test bread toast, 267 kcal per 100 g, estimated',
      ]),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search foods').props.value).toBe('');
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /bread/i })).toEqual([]));
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    expect(screen.queryByText(/No foods found/)).toBeNull();
  });
});

describe('D-55 search words on brand labels', () => {
  // A synthetic chakki atta whose name says nothing of "whole wheat": made-up values.
  const CHAKKI: Food = { ...LABEL_BREAD, code: 'test-mills-chakki-atta', name: 'Test Mills Chakki Atta', foodGroup: 'Test Mills', aliases: ['Test Mills', 'whole wheat atta', 'gehu atta'], portions: [] };

  it('finds a product by its hidden search words, never showing them', async () => {
    await render(async (db, server) => {
      server.state.foods = [...FOODS, CHAKKI];
      await replaceFoods(db, server.state.foodsVersion, [...FOODS, CHAKKI]);
    });
    await search('whole wheat atta');

    expect(await screen.findByRole('button', { name: 'Chakki Atta, Test Mills, 250 kcal per 100 g' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'gehu');
    expect(await screen.findByRole('button', { name: 'Chakki Atta, Test Mills, 250 kcal per 100 g' })).toBeOnTheScreen();
    expect(screen.queryByText(/gehu atta/)).toBeNull();
  });
});

describe('D-49 brands’ own labels', () => {
  it('are listed before Open Food Facts’ products (D-54), marked "Brand label", and credited', async () => {
    await render(withLabels);
    await search('test bakers');

    const rows = await screen.findAllByRole('button', { name: /Test Bakers/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'White Bread, Test Bakers, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    // D-52: the values may also come from a shop's listing or Open Food Facts.
    expect(screen.getByText(/^Foods marked Brand label: values as printed on each product’s label, read from the brand’s website, a shop’s listing/)).toBeOnTheScreen();
  });

  it('a label with no fibre shows it as unknown, and is added by its serving', async () => {
    await render(withLabels);
    await search('white bread');
    await fireEvent.press(await screen.findByRole('button', { name: 'White Bread, Test Bakers, 250 kcal per 100 g' }));

    expect(screen.getByLabelText('Fibre: –')).toBeOnTheScreen();
    await pickAmount({ measure: 'Slice (25 g)', quantity: '2' });
    expect(screen.getByLabelText('Adds 125 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test Bakers White Bread: 2 × slice (50 g), 125 kcal, 4.0 g protein')).toBeOnTheScreen();
  });
});

describe('D-48 packaged foods sold in India', () => {
  it('are found by brand, before the Indian foods (D-54), marked "Packaged" with their brand, and credited to Open Food Facts', async () => {
    await render(withPackaged);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
      'Test bread toast, 267 kcal per 100 g, estimated',
    ]);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'test bakers');
    expect(await screen.findByRole('button', { name: 'Test sandwich bread, Test Bakers, 250 kcal per 100 g' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(`Foods marked Packaged: ${OFF_ATTRIBUTION}.`)).toBeOnTheScreen();
  });

  it('are added in grams or by their label’s serving, logged as the barcode product they are', async () => {
    const { db } = await render(withPackaged);
    await search('test bakers');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test sandwich bread, Test Bakers, 250 kcal per 100 g' }));

    expect(screen.getByText('Test Bakers · Per 100 g: 250 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 250 kcal')).toBeOnTheScreen();
    await pickAmount({ measure: 'Serving (50 g)', quantity: '1.5' });
    expect(screen.getByText('Net wt: 75 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 188 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 6.0 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test sandwich bread (Test Bakers): 1.5 × serving (75 g), 188 kcal, 6.0 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));
    expect(await screen.findByText(/^Breakfast saved · /)).toBeOnTheScreen();
    const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    expect((await getEntry(db, 'meal', row!.id))?.items).toEqual([
      expect.objectContaining({ source: 'barcode', ref: '8901234567890', amount: { unit: 'serving', label: 'Serving', value: 1.5, grams: 75 } }),
    ]);
  });

  it('D-76 are also added in oz, 28.35 g each, after their serving and Grams', async () => {
    const { db } = await render(withPackaged);
    await search('test bakers');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test sandwich bread, Test Bakers, 250 kcal per 100 g' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Grams' }));
    expect(wheel('Measure')).toEqual(['Serving (50 g)', 'Grams', 'oz (28.35 g)']);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await pickAmount({ measure: 'oz (28.35 g)', quantity: '2' });
    expect(screen.getByText('Net wt: 56.7 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 142 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test sandwich bread (Test Bakers): 2 oz (56.7 g), 142 kcal, 4.5 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));
    expect(await screen.findByText(/^Breakfast saved · /)).toBeOnTheScreen();
    const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    expect((await getEntry(db, 'meal', row!.id))?.items).toEqual([
      expect.objectContaining({ source: 'barcode', ref: '8901234567890', amount: { unit: 'serving', label: 'oz', value: 2, grams: 56.7 } }),
    ]);
  });
});

describe('D-59 home-style foods (the owner, 2026-11-06)', () => {
  // A synthetic home-style food, made-up values: its name does not say "bread"; its item does.
  const HOME_TOAST: Food = {
    source: 'home',
    code: 'home-test-butter-toast',
    name: 'Test butter toast',
    foodGroup: 'Bread',
    aliases: ['bread', 'test makhan toast'],
    proteinG: 8,
    fibreG: 2,
    fatG: 17,
    carbsG: 45,
    kcal: 365,
    kcalEstimated: false,
    measures: [],
    portions: [{ label: '2 slices', grams: 56 }],
  };
  const IFCT_BREAD: Food = { ...FOODS[0]!, code: 'A099', name: 'Bread, white (test)' };
  const PLAIN_BREAD: PackagedFood = { ...PACKAGED_BREAD, barcode: '96385074', name: 'Bread', brand: 'Other Bakers' };

  async function withHomeToast(db: SqlDb, server: FakeServer) {
    const foods = [...FOODS, IFCT_BREAD, LABEL_BREAD, HOME_TOAST];
    server.state.foods = foods;
    server.state.packaged = [PACKAGED_BREAD, PLAIN_BREAD];
    await replaceFoods(db, server.state.foodsVersion, foods, [], [PACKAGED_BREAD, PLAIN_BREAD]);
    await saveEntry(db, 'myFood', { changeId: 'c-my-bread', data: { ...MY_BREAD, savedAt: NOW.toISOString() } });
  }

  it('lists them right after an exact match, before My foods, untagged; one found only by its item comes last (D-66)', async () => {
    await render(withHomeToast);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /kcal per/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      // The plain food first (D-91), then the exact match (D-51).
      'Bread, white (test), 320 kcal per 100 g',
      'Bread, Other Bakers, 250 kcal per 100 g',
      'Peanut butter bread, your food, 180 kcal per slice',
      'White Bread, Test Bakers, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
      'Test bread toast, 267 kcal per 100 g, estimated',
      // Its name has no "bread": found by its item, a hidden search word, so listed last (D-66).
      'Test butter toast, 365 kcal per 100 g',
    ]);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'toast');
    // Found by its name, it keeps its place right after an exact match (D-59). The rows for "bread"
    // stay until typing pauses (D-72).
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel)).toEqual([
        'Test butter toast, 365 kcal per 100 g',
        'Test bread toast, 267 kcal per 100 g, estimated',
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(/^Home-style foods \(a bread slice, butter toast and the like\): typical values for a home recipe/)).toBeOnTheScreen();
  });

  it('opens on its serving, and is added by it', async () => {
    await render(withHomeToast);
    await search('makhan toast');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test butter toast, 365 kcal per 100 g' }));
    expect(screen.getByLabelText('Measure: 2 slices (56 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 204 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Test butter toast: 1 × 2 slices (56 g), 204 kcal, 4.5 g protein')).toBeOnTheScreen();
  });

  it('D-76 offers the one slice its serving of two gives, smallest first, then Grams and oz; still opens on its serving', async () => {
    // The food list brings the single unit as one more serving, after the food's own (foods:import).
    const sliced: Food = { ...HOME_TOAST, portions: [{ label: '2 slices', grams: 56 }, { label: 'Slice', grams: 28 }] };
    await render(async (db, server) => {
      const foods = [...FOODS, sliced];
      server.state.foods = foods;
      await replaceFoods(db, server.state.foodsVersion, foods, [], []);
    });
    await search('makhan toast');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test butter toast, 365 kcal per 100 g' }));
    expect(screen.getByLabelText('Measure: 2 slices (56 g)')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Quantity: 1' }));
    expect(wheel('Measure')).toEqual(['Slice (28 g)', '2 slices (56 g)', 'Grams', 'oz (28.35 g)']);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await pickAmount({ measure: 'Slice (28 g)', quantity: '3' });
    expect(screen.getByLabelText('Measure: Slice (28 g)')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 84 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 307 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Test butter toast: 3 × slice (84 g), 307 kcal, 6.7 g protein')).toBeOnTheScreen();
  });
});

describe('D-62 estimated dishes (the owner, 2026-11-10)', () => {
  // A synthetic estimated dish, made-up values: 4 × 6 + 4 × 30 + 9 × 14 = 270 kcal.
  const ESTIMATED_PAKORA: Food = {
    source: 'dish_estimate',
    code: 'est-test-bread-pakora',
    name: 'Test bread pakora',
    foodGroup: 'Bread',
    aliases: ['bread'],
    proteinG: 6,
    fibreG: 2,
    fatG: 14,
    carbsG: 30,
    kcal: 270,
    kcalEstimated: true,
    measures: [],
    portions: [{ label: 'Piece', grams: 60 }],
  };
  const IFCT_BREAD: Food = { ...FOODS[0]!, code: 'A099', name: 'Bread, white (test)' };

  async function withPakora(db: SqlDb, server: FakeServer) {
    const foods = [...FOODS, IFCT_BREAD, LABEL_BREAD, ESTIMATED_PAKORA];
    server.state.foods = foods;
    server.state.packaged = [PACKAGED_BREAD];
    await replaceFoods(db, server.state.foodsVersion, foods, [], [PACKAGED_BREAD]);
  }

  it('lists them after INDB and the dishes, before IFCT, marked estimated, and credits them behind the i', async () => {
    await render(withPakora);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /kcal per/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      // IFCT's plain bread first (D-91); the others in the order by source.
      'Bread, white (test), 320 kcal per 100 g',
      'White Bread, Test Bakers, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, 250 kcal per 100 g',
      'Test bread toast, 267 kcal per 100 g, estimated',
      'Test bread pakora, 270 kcal per 100 g, estimated',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(/^Estimated dishes: typical values for each type of dish/)).toBeOnTheScreen();
  });

  it('opens on its serving, its page saying it is an estimated dish', async () => {
    await render(withPakora);
    await search('pakora');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test bread pakora, 270 kcal per 100 g, estimated' }));

    expect(screen.getByText('Estimated dish')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Piece (60 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 162 kcal')).toBeOnTheScreen();
  });
});

describe('D-46 INDB’s Indian recipes', () => {
  it('a recipe opens on its serving, counted in halves, its values estimated', async () => {
    await render();
    await search('dal fry');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test dal fry, 100 kcal per 100 g, estimated' }));
    expect(screen.getByText('Per 100 g: 100 kcal (estimated)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Bowl (180 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 180 kcal')).toBeOnTheScreen();

    await pickAmount({ quantity: '1.5' });
    expect(screen.getByText('Net wt: 270 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 270 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 13.5 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Test dal fry: 1.5 × bowl (270 g), 270 kcal, 13.5 g protein')).toBeOnTheScreen();
  });
});

describe('D-39 Enter your own food in any unit', () => {
  async function openOwnFood() {
    await fireEvent.press(await screen.findByRole('button', { name: 'Enter your own food' }));
  }

  it('D-100 a food name of one character says it needs 2 to 120, and Add waits', async () => {
    await render();
    await openOwnFood();

    await fireEvent.changeText(screen.getByLabelText('Food name'), 'X');

    expect(screen.getByText("Enter the food's name in 2 to 120 characters.")).toBeOnTheScreen();
    expect(screen.getByText("Check the food's name.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('by the slice: the values for one slice and the slices eaten; saved to My foods and synced', async () => {
    const { db, server } = await render();
    await openOwnFood();

    await fireEvent.changeText(screen.getByLabelText('Food name'), 'Peanut butter bread');
    await fireEvent.press(screen.getByRole('radio', { name: 'Unit: Slice' }));
    expect(screen.getByText('Type the values for one slice.')).toBeOnTheScreen();
    for (const [label, value] of [
      ['kcal per slice', '180'],
      ['Protein per slice (g)', '6'],
      ['Carbs per slice (g)', '20'],
      ['Fat per slice (g)', '9'],
    ] as const) {
      await fireEvent.changeText(screen.getByLabelText(label), value);
    }
    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '2');
    expect(screen.getByRole('checkbox', { name: 'Save to My foods', checked: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 360 kcal and 12.0 g protein')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText('Peanut butter bread: 2 slices, 360 kcal, 12.0 g protein')).toBeOnTheScreen();
    await waitFor(() =>
      expect([...server.entries('myFoods').values()]).toEqual([
        expect.objectContaining({ deleted: false, name: 'Peanut butter bread', unit: 'slice', kcal: 180, proteinG: 6, fibreG: null }),
      ]),
    );
    const saved = [...server.entries('myFoods').values()][0] as { id: string };
    expect(await getEntry(db, 'myFood', saved.id)).toMatchObject({ name: 'Peanut butter bread' });
  });

  it('per one unit, values may go to 2,000 kcal and 200 g; per 100 g, to 900 kcal and 100 g', async () => {
    await render();
    await openOwnFood();
    await fireEvent.press(screen.getByRole('radio', { name: 'Unit: Bowl' }));
    await fireEvent.changeText(screen.getByLabelText('kcal per bowl'), '2001');
    expect(screen.getByText('Enter 0 to 2,000, with at most one decimal.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Unit: Grams' }));
    expect(screen.getByText('Enter 0 to 900, with at most one decimal.')).toBeOnTheScreen();
  });

  it('unticked, the food is added to the meal only, not to My foods', async () => {
    const { server } = await render();
    await openOwnFood();
    await fireEvent.changeText(screen.getByLabelText('Food name'), 'Synthetic biscuits');
    for (const [label, value] of [
      ['kcal per 100 g', '452'],
      ['Protein per 100 g (g)', '8'],
      ['Carbs per 100 g (g)', '68.5'],
      ['Fat per 100 g (g)', '16'],
    ] as const) {
      await fireEvent.changeText(screen.getByLabelText(label), value);
    }
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '50');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Save to My foods' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText('Synthetic biscuits: 50 g, 226 kcal, 4.0 g protein')).toBeOnTheScreen();

    // D-64: a food with no page of its own keeps the sheet for its amount, its buttons centred.
    await fireEvent.press(screen.getByRole('button', { name: 'Change Synthetic biscuits' }));
    await fireEvent.changeText(await screen.findByLabelText('New grams'), '80');
    expect(screen.getByText('Remove')).toHaveStyle({ textAlign: 'center' });
    expect(screen.getByText('Change to 80 g')).toHaveStyle({ textAlign: 'center' });
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 80 g' }));
    expect(screen.getByLabelText(/^Synthetic biscuits: 80 g, /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));
    await waitFor(() => expect(server.entries('meals').size).toBe(1));
    expect(server.entries('myFoods').size).toBe(0);
  });

  it('changes an item’s slices in the meal, on the My food’s page', async () => {
    await render(withMyBread);
    await search('peanut');
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, your food, 180 kcal per slice' }));
    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Change Peanut butter bread' }));
    expect(await screen.findByText('In this meal now: 2 slices')).toBeOnTheScreen();
    // From the meal, the page changes the amount only: no Edit My food.
    expect(screen.queryByRole('button', { name: 'Edit My food' })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));

    expect(screen.getByLabelText('Peanut butter bread: 3 slices, 540 kcal, 18.0 g protein')).toBeOnTheScreen();
  });
});
