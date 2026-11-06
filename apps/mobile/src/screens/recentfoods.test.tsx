import type { Food, MealItem } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { itemFromFood, itemFromServings } from '../mealItems';
import { NOW, renderInApp } from '../testing/appHarness';
import { pickAmount } from '../testing/foodPage';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// Recent foods in Search foods (D-60; the redesign's 3.6 with recent foods, locked by the owner on
// 2026-11-06; REQ-LOG-007). Today is Wednesday 28 October 2026. Synthetic foods and values.

const TODAY = '2026-10-28';
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
// Your own food, not kept in My foods: it has no page.
const BAR: MealItem = { source: 'own', ref: null, name: 'Synthetic bar', amount: { unit: 'g', value: 40 }, kcal: 180, proteinG: 4, carbsG: null, fatG: null, fibreG: null, estimated: false };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = [ATTA, DAL];
  await replaceFoods(db, server.state.foodsVersion, [ATTA, DAL]);
}

let next = 0;
function id(): string {
  next += 1;
  return `00000000-0000-4000-c000-${String(next).padStart(12, '0')}`;
}

async function saveMeal(db: SqlDb, day: string, recordedAt: string, items: MealItem[]) {
  await saveEntry(db, 'meal', { changeId: id(), data: { id: id(), day, mealType: 'lunch', tags: [], items, recordedAt } });
}

/** Today: atta then the dal; yesterday: the atta in another amount and the bar; last week: too old. */
async function withMeals(db: SqlDb, server: FakeServer) {
  await withFoods(db, server);
  await saveMeal(db, TODAY, '2026-10-28T02:00:00.000Z', [itemFromFood(ATTA, 60), itemFromServings(DAL, DAL.portions[0]!, 1)]);
  await saveMeal(db, '2026-10-27', '2026-10-27T07:00:00.000Z', [BAR, itemFromFood(ATTA, 120)]);
  await saveMeal(db, '2026-10-21', '2026-10-21T07:00:00.000Z', [{ ...BAR, name: 'Old food' }]);
}

function render(before: (db: SqlDb, server: FakeServer) => Promise<void> = withMeals) {
  mockParams = { day: TODAY, slot: 'breakfast' };
  return renderInApp(<LogMealScreen now={() => NOW} />, undefined, before);
}

async function openSearch() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
}

const DAL_ROW = 'Test dal fry, 1 × bowl (180 g), 180 kcal';
const ATTA_ROW = 'Wheat flour, atta, 60 g, 192 kcal';
const BAR_ROW = 'Synthetic bar, 40 g, 180 kcal';

describe('D-60 Recent foods', () => {
  it('lists the last five days’ foods, latest first, each once with its last amount, untagged; the keyboard stays down', async () => {
    await render();
    await openSearch();

    const ticks = await screen.findAllByRole('checkbox');
    expect(ticks.map((tick) => tick.props.accessibilityLabel)).toEqual([DAL_ROW, ATTA_ROW, BAR_ROW]);
    expect(screen.getByRole('header', { name: 'Recent foods' })).toBeOnTheScreen();
    expect(screen.getByText('Last 5 days')).toBeOnTheScreen();
    expect(screen.queryByText('INDB')).toBeNull();
    expect(screen.queryByText(/Old food/)).toBeNull();
    expect(screen.getByLabelText('Search foods').props.autoFocus).toBe(false);
  });

  it('ticks foods, shows how many and their kcal, unticks one, deselects all', async () => {
    await render();
    await openSearch();

    await fireEvent.press(await screen.findByRole('checkbox', { name: DAL_ROW }));
    await fireEvent.press(screen.getByRole('checkbox', { name: ATTA_ROW }));
    expect(screen.getByRole('checkbox', { name: DAL_ROW })).toBeChecked();
    expect(screen.getByText('2 selected · 372 kcal')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 2 foods' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox', { name: DAL_ROW }));
    expect(screen.getByRole('checkbox', { name: DAL_ROW })).not.toBeChecked();
    expect(screen.getByText('1 selected · 192 kcal')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add 1 food' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Deselect all' }));
    expect(screen.queryByText(/selected ·/)).toBeNull();
    expect(screen.getByRole('checkbox', { name: ATTA_ROW })).not.toBeChecked();
  });

  it('adds the ticked foods to the meal as they were last logged', async () => {
    await render();
    await openSearch();
    await fireEvent.press(await screen.findByRole('checkbox', { name: BAR_ROW }));
    await fireEvent.press(screen.getByRole('checkbox', { name: DAL_ROW }));

    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 foods' }));

    expect(await screen.findByLabelText('Synthetic bar: 40 g, 180 kcal, 4.0 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Test dal fry: 1 × bowl (180 g), 180 kcal, 9.0 g protein')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: ATTA_ROW })).toBeNull();
  });

  it('opens a food’s page on its last amount; changed there, it goes in with the ticked foods', async () => {
    await render();
    await openSearch();
    await fireEvent.press(await screen.findByRole('checkbox', { name: ATTA_ROW }));

    await fireEvent.press(screen.getByRole('button', { name: `${DAL_ROW}, change the amount` }));
    expect(await screen.findByText('Last time: 1 × bowl (180 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Bowl (180 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByText('Your 1 ticked food goes in with it.')).toBeOnTheScreen();

    await pickAmount({ quantity: '2' });
    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 foods' }));

    expect(await screen.findByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Test dal fry: 2 × bowl (360 g), 360 kcal, 18.0 g protein')).toBeOnTheScreen();
  });

  it('a ticked food opened on its page goes in once, with the page’s amount', async () => {
    await render();
    await openSearch();
    await fireEvent.press(await screen.findByRole('checkbox', { name: ATTA_ROW }));

    await fireEvent.press(screen.getByRole('button', { name: `${ATTA_ROW}, change the amount` }));
    expect(await screen.findByLabelText('Grams eaten')).toHaveDisplayValue('60');
    expect(screen.queryByText(/ticked food/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByLabelText('Wheat flour, atta: 90 g, 288 kcal, 9.5 g protein')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Wheat flour, atta: 60 g/)).toBeNull();
  });

  it('keeps the ticked foods while searching, and adds them with a food found', async () => {
    await render();
    await openSearch();
    await fireEvent.press(await screen.findByRole('checkbox', { name: BAR_ROW }));

    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    expect(screen.queryByRole('checkbox', { name: BAR_ROW })).toBeNull();
    expect(screen.getByText('1 selected · 180 kcal')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    expect(screen.getByText('Your 1 ticked food goes in with it.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add 2 foods' }));

    expect(await screen.findByLabelText('Synthetic bar: 40 g, 180 kcal, 4.0 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wheat flour, atta: 100 g, 320 kcal, 10.6 g protein')).toBeOnTheScreen();
  });

  it('ticks a food that has no page when its name is tapped (MVP default)', async () => {
    await render();
    await openSearch();

    await fireEvent.press(await screen.findByRole('button', { name: `${BAR_ROW}, change the amount` }));

    expect(await screen.findByText('1 selected · 180 kcal')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: BAR_ROW })).toBeChecked();
  });

  it('with nothing logged in five days, says so and opens the keyboard', async () => {
    await render(withFoods);
    await openSearch();

    expect(await screen.findByText('Foods you log show here for 5 days, so you can add them again with a tap.')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByLabelText('Search foods').props.autoFocus).toBe(true);
  });
});
