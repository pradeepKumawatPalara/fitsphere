import { USDA_ACKNOWLEDGEMENT, type Food } from '@fitsphere/shared';
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
  {
    source: 'usda_fndds',
    code: '51101000',
    name: 'Bread, white',
    foodGroup: 'Yeast breads',
    aliases: [],
    proteinG: 9.43,
    fibreG: 2.3,
    fatG: 3.59,
    carbsG: 49.2,
    kcal: 267,
    kcalEstimated: false,
    measures: [],
    portions: [
      { label: 'Small or thin/very thin slice', grams: 24 },
      { label: 'Medium or regular slice', grams: 28 },
    ],
  },
  { source: 'usda_fndds', code: '51300100', name: 'Bread, whole wheat', foodGroup: 'Yeast breads', aliases: [], proteinG: 12.3, fibreG: 6, fatG: 3.5, carbsG: 43, kcal: 254, kcalEstimated: false, measures: [], portions: [] },
  { source: 'usda_fndds', code: '41205010', name: 'Dal', foodGroup: 'Bean, pea, legume dishes', aliases: [], proteinG: 8.6, fibreG: 7.5, fatG: 4.31, carbsG: 19.2, kcal: 145, kcalEstimated: false, measures: [], portions: [] },
  { source: 'ifct2017', code: 'B021', name: 'Red gram, dal', foodGroup: 'Grain Legumes', aliases: [], proteinG: 21.7, fibreG: 9.06, fatG: 1.56, carbsG: 55.23, kcal: 335, kcalEstimated: false, measures: [], portions: [] },
];
const MY_BREAD = { id: MY_BREAD_ID, name: 'Peanut butter bread', unit: 'slice' as const, kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: 1.5 };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  await replaceFoods(db, server.state.foodsVersion, FOODS);
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

  it('a USDA serving: its grams × the count, the values for those grams', () => {
    const item = itemFromServings(bread, bread.portions[1]!, 2);

    expect(item).toMatchObject({ source: 'usda_fndds', ref: '51101000', amount: { unit: 'serving', label: 'Medium or regular slice', value: 2, grams: 56 } });
    expect(item.kcal).toBeCloseTo(149.52);
    expect(formatAmount(item.amount)).toBe('2 × medium or regular slice (56 g)');
    expect(withServings(item, 1).amount).toEqual({ unit: 'serving', label: 'Medium or regular slice', value: 1, grams: 28 });
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

describe('D-39 Search foods with USDA foods and My foods', () => {
  it('lists the Indian foods first, then USDA’s marked "USDA", and credits USDA with IFCT behind the i', async () => {
    await render();
    await search('dal');

    const rows = await screen.findAllByRole('button', { name: /per 100 g/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Red gram, dal, 335 kcal per 100 g', 'Dal, USDA, 145 kcal per 100 g']);
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByText(`Foods marked USDA: ${USDA_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
  });

  it('puts My foods before USDA’s, marked "My food"', async () => {
    await render(withMyBread);
    await search('bread');

    const rows = await screen.findAllByRole('button', { name: /^(Peanut butter bread|Bread)/ });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Peanut butter bread, my food, 180 kcal per slice',
      'Bread, white, USDA, 267 kcal per 100 g',
      'Bread, whole wheat, USDA, 254 kcal per 100 g',
    ]);
  });

  it('adds a USDA food by its slice, counted in halves, with the grams the slices come to', async () => {
    await render();
    await search('bread');
    await fireEvent.press(await screen.findByRole('button', { name: 'Bread, white, USDA, 267 kcal per 100 g' }));
    expect(screen.getByText('Per 100 g: 267 kcal')).toBeOnTheScreen();

    await pickAmount({ measure: 'Medium or regular slice (28 g)', quantity: '2' });
    expect(screen.getByLabelText('Measure: Medium or regular slice (28 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 2')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 56 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 150 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 5.3 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Bread, white: 2 × medium or regular slice (56 g), 150 kcal, 5.3 g protein')).toBeOnTheScreen();
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
