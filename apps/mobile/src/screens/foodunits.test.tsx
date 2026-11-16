import type { Food, PackagedFood } from '@fitsphere/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FoodDetail } from '../components/FoodDetail';
import { setCheckPause } from '../fieldChecks';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { COUNT_RULE } from '../mealItems';
import { NOW, renderInApp } from '../testing/appHarness';
import { nutrients, pickAmount, wheel } from '../testing/foodPage';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// D-102 (the owner, 2026-11-13; the canvas's 3.6b "units from your food database", locked): a food the
// owner's food database lists opens on its Default Unit and has its units; Quantity is typed, with the
// list beside it; more than 0, two decimals at most, no more than 10,000 g. Synthetic foods and
// made-up values.

const food = (source: Food['source'], code: string, name: string, portions: Food['portions'], opensOn?: string): Food => ({
  source,
  code,
  name,
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 2.5,
  fibreG: 1.2,
  fatG: 0.2,
  carbsG: 26,
  kcal: 120,
  kcalEstimated: source !== 'ifct2017',
  measures: [],
  portions,
  ...(opensOn === undefined ? {} : { opensOn }),
});
const RICE = food(
  'indb',
  'T801',
  'Test boiled rice',
  [
    { label: 'Plate', grams: 300 },
    { label: 'Katori', grams: 129 },
    { label: 'Bowl', grams: 215 },
    { label: 'Cup', grams: 172 },
    { label: 'Tablespoon', grams: 12.9 },
  ],
  'Plate',
);
const BANANA = food('ifct2017', 'T802', 'Test banana', [{ label: 'Medium', grams: 120 }], 'Medium');
const ATTA = food('ifct2017', 'T803', 'Test atta', [{ label: 'Cup', grams: 170 }], 'Grams');
const OLD_DISH = food('indb', 'T804', 'Test old dish', [{ label: 'Plate', grams: 200 }]);
const MILK = food(
  'dish_estimate',
  'est-test-milk',
  'Test badam milk',
  [
    { label: 'Glass', grams: 257.5 },
    { label: 'ml', grams: 1.03 },
  ],
  'Glass',
);
const BAR: PackagedFood = {
  barcode: '8901234500401',
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
const CHIPS: PackagedFood = { ...BAR, barcode: '8901234500402', name: 'Test chips', servingGrams: 25, portions: [{ label: 'Katori', grams: 150 }], opensOn: 'Serving' };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];
const FOODS = [RICE, BANANA, ATTA, OLD_DISH, MILK];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  server.state.packaged = [BAR, CHIPS];
  await replaceFoods(db, server.state.foodsVersion, FOODS, [], [BAR, CHIPS]);
}

async function openSearch() {
  mockParams = { day: '2026-10-28', slot: 'lunch' };
  await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
}

const rows = () => screen.queryAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel as string);

async function open(text: string, name: RegExp) {
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
  await waitFor(() => expect(rows().some((row) => name.test(row))).toBe(true));
  await fireEvent.press(screen.getAllByRole('button', { name })[0]!);
  await screen.findByRole('header', { name: 'Macronutrients breakdown' });
}

async function back() {
  await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));
}

const typeCount = (text: string) => fireEvent.changeText(screen.getByLabelText('Type the quantity'), text);

describe('D-102 a food’s page opens on the default unit of the owner’s food database', () => {
  it('opens on it, quantity 1: Plate for the rice, Medium for an IFCT banana, Grams when it says gram', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    expect(screen.getByLabelText('Measure: Plate (300 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Type the quantity')).toHaveDisplayValue('1');
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 360 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 300 g')).toBeOnTheScreen();

    await back();
    await open('banana', /^Test banana/);
    // An IFCT food opened on Grams before (D-76).
    expect(screen.getByLabelText('Measure: Medium (120 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 144 kcal')).toBeOnTheScreen();

    await back();
    await open('atta', /^Test atta/);
    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grams eaten')).toHaveDisplayValue('100');
  });

  it('a food the database does not list opens as before: an INDB recipe on its serving', async () => {
    await openSearch();
    await open('old dish', /^Test old dish/);
    expect(screen.getByLabelText('Measure: Plate (200 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
  });

  it('lists the food’s measures smallest first, then Grams, then oz', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Plate (300 g)' }));
    expect(wheel('Measure')).toEqual(['Tablespoon (12.9 g)', 'Katori (129 g)', 'Cup (172 g)', 'Bowl (215 g)', 'Plate (300 g)', 'Grams', 'oz (28.35 g)']);
  });

  it('an amount the food is in the meal with comes first (D-64), as last time’s (D-60)', async () => {
    const onAdd = jest.fn();
    await renderInApp(
      <FoodDetail result={{ kind: 'food', food: RICE }} from={{ unit: 'serving', label: 'Katori', value: 2, grams: 258 }} onBack={jest.fn()} onAdd={onAdd} />,
    );
    expect(screen.getByLabelText('Measure: Katori (129 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Type the quantity')).toHaveDisplayValue('2');
  });
});

describe('D-102 Quantity is typed, with the list beside it', () => {
  it('a typed quantity gives its values at once, and is logged as typed', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    await pickAmount({ measure: 'Katori (129 g)' });
    await typeCount('1.5');
    // 1.5 × 129 g = 193.5 g of 120 kcal per 100 g.
    expect(screen.getByLabelText('Adds 232 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 193.5 g')).toBeOnTheScreen();
    expect(nutrients()).toEqual(['Protein: 4.8 g', 'Carbs: 50.3 g', 'Fat: 0.4 g', 'Fibre: 2.3 g']);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText(/^Test boiled rice: 1\.5 × katori \(193\.5 g\), 232 kcal/)).toBeOnTheScreen();
  });

  it('refuses 0, a negative, three decimals and nothing; says so, and greys Add', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    for (const text of ['0', '-1', '1.234', 'abc']) {
      await typeCount(text);
      expect(screen.getByText(COUNT_RULE)).toBeOnTheScreen();
      expect(screen.getByLabelText('Adds –')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    }
    // Empty: the message waits for the box to be left (D-99), Add is greyed meanwhile.
    await typeCount('');
    expect(screen.queryByText(COUNT_RULE)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await fireEvent(screen.getByLabelText('Type the quantity'), 'blur');
    expect(screen.getByText(COUNT_RULE)).toBeOnTheScreen();

    await typeCount('0.25');
    expect(screen.queryByText(COUNT_RULE)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('takes any quantity up to 10,000 g of the food, and says the most past it', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    await pickAmount({ measure: 'Katori (129 g)' });
    await typeCount('25');
    expect(screen.getByText('Net wt: 3,225 g')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    await typeCount('78');
    expect(screen.getByText('That is more than 10,000 g of this food, the most one food can have. Enter up to 77.51.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await typeCount('77.51');
    expect(screen.getByText('Net wt: 9998.8 g')).toBeOnTheScreen();
  });

  it('the message waits until typing stops (D-99)', async () => {
    jest.useFakeTimers();
    setCheckPause(3_000);
    try {
      await openSearch();
      await open('boiled rice', /^Test boiled rice/);
      await typeCount('0');
      expect(screen.queryByText(COUNT_RULE)).toBeNull();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
      await act(async () => {
        jest.advanceTimersByTime(3_000);
      });
      expect(screen.getByText(COUNT_RULE)).toBeOnTheScreen();
    } finally {
      setCheckPause(0);
      jest.useRealTimers();
    }
  });

  it('the list shows a typed quantity among its halves, and a choice there is typed into the box', async () => {
    await openSearch();
    await open('boiled rice', /^Test boiled rice/);
    await typeCount('1.25');
    await fireEvent.press(screen.getByRole('button', { name: 'Quantity: 1.25' }));
    expect(wheel('Quantity').slice(0, 5)).toEqual(['0.5', '1', '1.25', '1.5', '2']);
    expect(wheel('Quantity')).toHaveLength(21);
    await pickAmount({ quantity: '2' });
    expect(screen.getByLabelText('Type the quantity')).toHaveDisplayValue('2');
    expect(screen.getByLabelText('Adds 720 kcal')).toBeOnTheScreen();
  });
});

describe('D-102 ml, and packaged foods’ units', () => {
  it('a drink has ml, typed whole, after Grams; logged as ml with the grams they weigh', async () => {
    await openSearch();
    await open('badam milk', /^Test badam milk/);
    expect(screen.getByLabelText('Measure: Glass (257.5 g)')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Glass (257.5 g)' }));
    expect(wheel('Measure')).toEqual(['Glass (257.5 g)', 'Grams', 'ml (1.03 g)', 'oz (28.35 g)']);
    await pickAmount({ measure: 'ml (1.03 g)' });
    expect(screen.getByLabelText('ml drunk')).toHaveDisplayValue('100');
    await fireEvent.changeText(screen.getByLabelText('ml drunk'), '250');
    expect(screen.getByText('Net wt: 257.5 g')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('ml drunk'), '2.5');
    expect(screen.getByText('Enter whole ml from 1 to 9,708.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('ml drunk'), '250');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText(/^Test badam milk: 250 ml \(257\.5 g\), 309 kcal/)).toBeOnTheScreen();
  });

  it('a packaged food has its units beside its label’s serving, and opens on its default', async () => {
    await openSearch();
    await open('dark bar', /^Test dark bar/);
    expect(screen.getByLabelText('Measure: Bar (20 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 104 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Bar (20 g)' }));
    expect(wheel('Measure')).toEqual(['Bar (20 g)', 'Pack (20 g)', 'Grams', 'oz (28.35 g)']);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    await back();
    await open('chips', /^Test chips/);
    // The label's serving is kept (R3); the database's Katori beside it.
    expect(screen.getByLabelText('Measure: Serving (25 g)')).toBeOnTheScreen();
    await pickAmount({ measure: 'Katori (150 g)' });
    await typeCount('0.5');
    expect(screen.getByText('Net wt: 75 g')).toBeOnTheScreen();
  });
});
