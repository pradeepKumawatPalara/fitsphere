import { IFCT_ACKNOWLEDGEMENT, INDB_ACKNOWLEDGEMENT, OFF_ATTRIBUTION, type Food, type PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getEntry, replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { itemFromOwn, itemFromServings, parseOwnQuantity, withOwnQuantity, withServings } from '../mealItems';
import { formatAmount } from '../meals';
import { NOW, renderInApp } from '../testing/appHarness';
import { pickAmount } from '../testing/foodPage';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

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
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Test dal fry, INDB, 100 kcal per 100 g, estimated', 'Red gram, dal, 335 kcal per 100 g']);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    expect(screen.getByText(`Foods marked INDB: ${INDB_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    expect(screen.queryByText(/USDA/)).toBeNull();
  });

  it('puts My foods after the Indian foods, marked "My food"', async () => {
    await render(withMyBread);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Test bread toast, INDB, 267 kcal per 100 g, estimated',
      'Peanut butter bread, my food, 180 kcal per slice',
    ]);
  });

  it('adds a recipe by its slice, counted in halves, with the grams the slices come to', async () => {
    await render();
    await search('toast');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test bread toast, INDB, 267 kcal per 100 g, estimated' }));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, my food, 180 kcal per slice' }));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, my food, 180 kcal per slice' }));

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
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, my food, 180 kcal per slice' }));
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
      'Bread, Other Bakers, packaged, 250 kcal per 100 g',
      'Test bread toast, INDB, 267 kcal per 100 g, estimated',
      'Test Bakers White Bread, Brand label, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, packaged, 250 kcal per 100 g',
    ]);
  });
});

describe('D-49 brands’ own labels', () => {
  it('are listed after the Indian foods and before Open Food Facts’ products, marked "Brand label", and credited', async () => {
    await render(withLabels);
    await search('test bakers');

    const rows = await screen.findAllByRole('button', { name: /Test Bakers/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Test Bakers White Bread, Brand label, 250 kcal per 100 g',
      'Test sandwich bread, Test Bakers, packaged, 250 kcal per 100 g',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    // D-52: the values may also come from a shop's listing or Open Food Facts.
    expect(screen.getByText(/^Foods marked Brand label: values as printed on each product’s label, read from the brand’s website, a shop’s listing/)).toBeOnTheScreen();
  });

  it('a label with no fibre shows it as unknown, and is added by its serving', async () => {
    await render(withLabels);
    await search('white bread');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test Bakers White Bread, Brand label, 250 kcal per 100 g' }));

    expect(screen.getByLabelText('Fibre: –')).toBeOnTheScreen();
    await pickAmount({ measure: 'Slice (25 g)', quantity: '2' });
    expect(screen.getByLabelText('Adds 125 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test Bakers White Bread: 2 × slice (50 g), 125 kcal, 4.0 g protein')).toBeOnTheScreen();
  });
});

describe('D-48 packaged foods sold in India', () => {
  it('are found by brand, after the Indian foods, marked "Packaged" with their brand, and credited to Open Food Facts', async () => {
    await render(withPackaged);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /bread/i });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Test bread toast, INDB, 267 kcal per 100 g, estimated',
      'Test sandwich bread, Test Bakers, packaged, 250 kcal per 100 g',
    ]);
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'test bakers');
    expect(await screen.findByRole('button', { name: 'Test sandwich bread, Test Bakers, packaged, 250 kcal per 100 g' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(`Foods marked Packaged: ${OFF_ATTRIBUTION}.`)).toBeOnTheScreen();
  });

  it('are added in grams or by their label’s serving, logged as the barcode product they are', async () => {
    const { db } = await render(withPackaged);
    await search('test bakers');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test sandwich bread, Test Bakers, packaged, 250 kcal per 100 g' }));

    expect(screen.getByText('Test Bakers · Per 100 g: 250 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 250 kcal')).toBeOnTheScreen();
    await pickAmount({ measure: 'Serving (50 g)', quantity: '1.5' });
    expect(screen.getByText('Net wt: 75 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 188 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 6.0 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test sandwich bread (Test Bakers): 1.5 × serving (75 g), 188 kcal, 6.0 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    expect((await getEntry(db, 'meal', row!.id))?.items).toEqual([
      expect.objectContaining({ source: 'barcode', ref: '8901234567890', amount: { unit: 'serving', label: 'Serving', value: 1.5, grams: 75 } }),
    ]);
  });
});

describe('D-46 INDB’s Indian recipes', () => {
  it('a recipe opens on its serving, counted in halves, its values estimated', async () => {
    await render();
    await search('dal fry');
    await fireEvent.press(await screen.findByRole('button', { name: 'Test dal fry, INDB, 100 kcal per 100 g, estimated' }));
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
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(() => expect(server.entries('meals').size).toBe(1));
    expect(server.entries('myFoods').size).toBe(0);
  });

  it('changes an item’s slices in the meal', async () => {
    await render(withMyBread);
    await search('peanut');
    await fireEvent.press(await screen.findByRole('button', { name: 'Peanut butter bread, my food, 180 kcal per slice' }));
    await fireEvent.changeText(screen.getByLabelText('Slices eaten'), '2');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Change Peanut butter bread' }));
    await fireEvent.changeText(screen.getByLabelText('New slices eaten'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 3 slices' }));

    expect(screen.getByLabelText('Peanut butter bread: 3 slices, 540 kcal, 18.0 g protein')).toBeOnTheScreen();
  });
});
