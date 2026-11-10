import { type Food, type MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getEntry, listSavedMeals, replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { SavedMealScreen } from './SavedMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// A saved meal made or changed on its own screen (REQ-SAVED-003, D-69): its name, given first, and
// its foods, added as in Search foods and changed as in Log meal; no meal of its own; the same foods
// and amounts never saved twice (REQ-SAVED-001). Today is Wednesday 28 October 2026. Synthetic values;
// the two foods are IFCT rows as printed.

const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [], portions: [] },
  { source: 'ifct2017', code: 'T013', name: 'Ghee', foodGroup: 'Edible Oils and Fats', aliases: [], proteinG: 0, fibreG: 0, fatG: 100, carbsG: 0, kcal: 900, kcalEstimated: true, measures: [], portions: [] },
];
const ATTA_60: MealItem = {
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
const SAVED_ID = '00000000-0000-4000-c000-000000000301';

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  await replaceFoods(db, server.state.foodsVersion, FOODS);
}

/** A saved meal already on the phone: two rotis' worth of atta. */
function withSaved(name: string) {
  return async (db: SqlDb, server: FakeServer) => {
    await withFoods(db, server);
    await saveEntry(db, 'savedMeal', {
      changeId: '00000000-0000-4000-b000-000000000301',
      data: { id: SAVED_ID, name, tags: [], items: [ATTA_60], savedAt: NOW.toISOString() },
    });
  };
}

function render(params: Record<string, string>, before: (db: SqlDb, server: FakeServer) => Promise<void> = withFoods) {
  mockParams = params;
  return renderInApp(<SavedMealScreen now={() => NOW} />, undefined, before);
}

async function addFood(search: string, name: RegExp, grams: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Add food' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), search);
  await fireEvent.press(await screen.findByRole('button', { name }));
  await fireEvent.changeText(screen.getByLabelText('Grams eaten'), grams);
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.push.mockClear();
});

describe('REQ-SAVED-003 a new saved meal (D-69)', () => {
  it('opens with its name and no foods; Save waits for a food', async () => {
    await render({ name: 'Monday breakfast' });

    expect(await screen.findByRole('header', { name: 'Monday breakfast' })).toBeOnTheScreen();
    expect(screen.getByText('Next: tap Add food to find each food')).toBeOnTheScreen();
    expect(screen.getByText('No foods yet.')).toBeOnTheScreen();
    expect(screen.getByText('Add at least one food to save the meal.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    // A saved meal has no meal of its own.
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('adds several foods from Search foods, changes one on its page, and saves them under its name, with no meal', async () => {
    const { db, server } = await render({ name: 'Monday breakfast' });

    await addFood('atta', /^Wheat flour, atta/, '60');
    await addFood('ghee', /^Ghee/, '5');
    expect(screen.getByRole('header', { name: 'Foods · 2' })).toBeOnTheScreen();
    expect(screen.queryByText('Next: tap Add food to find each food')).toBeNull();
    expect(screen.getByLabelText('Total: 237 kcal, 6.3 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    expect(await screen.findByText('In this meal now: 60 g')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '120');
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));
    expect(screen.getByLabelText(/^Wheat flour, atta: 120 g, /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(async () => expect(await listSavedMeals(db)).toHaveLength(1));
    const [saved] = await listSavedMeals(db);
    expect(saved).toMatchObject({ name: 'Monday breakfast', tags: [] });
    expect(saved!.items.map((item) => [item.name, item.amount])).toEqual([
      ['Wheat flour, atta', { unit: 'g', value: 120 }],
      ['Ghee', { unit: 'g', value: 5 }],
    ]);
    expect(saved).not.toHaveProperty('mealType');
    expect(mockRouter.back).toHaveBeenCalled();
    await waitFor(() => expect(server.entries('savedMeals').get(saved!.id)).toMatchObject({ name: 'Monday breakfast' }));
    expect(server.entries('savedMeals').get(saved!.id)).not.toHaveProperty('mealType');
  });

  it('its name can be changed, never to nothing', async () => {
    await render({ name: 'Monday breakfast' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Change the name' }));
    expect(screen.getByRole('header', { name: 'Change the name' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Monday breakfast');
    await fireEvent.changeText(screen.getByLabelText('Name'), ' ');
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sunday brunch');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByRole('header', { name: 'Sunday brunch' })).toBeOnTheScreen();
  });

  it('REQ-SAVED-001 the same foods and amounts as another saved meal are not saved again; it says which', async () => {
    const { db } = await render({ name: 'Monday breakfast' }, withSaved('Two rotis'));

    await addFood('atta', /^Wheat flour, atta/, '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    expect(await screen.findByRole('header', { name: 'Already in my meals' })).toBeOnTheScreen();
    expect(screen.getByText('These foods and amounts are already saved as Two rotis.')).toBeOnTheScreen();
    expect(await listSavedMeals(db)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Saved' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('a different amount of the same food is a different saved meal', async () => {
    const { db } = await render({ name: 'Monday breakfast' }, withSaved('Two rotis'));

    await addFood('atta', /^Wheat flour, atta/, '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(async () => expect((await listSavedMeals(db)).map((saved) => saved.name)).toEqual(['Monday breakfast', 'Two rotis']));
  });
});

describe('REQ-SAVED-003 changing a saved meal (D-69)', () => {
  it('opens with its name and foods, and Save changes replaces the same saved meal', async () => {
    const { db } = await render({ savedId: SAVED_ID }, withSaved('Two rotis'));

    expect(await screen.findByRole('header', { name: 'Two rotis' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    await addFood('ghee', /^Ghee/, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Change the name' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Two rotis with ghee');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => expect(await getEntry(db, 'savedMeal', SAVED_ID)).toMatchObject({ name: 'Two rotis with ghee', kcal: 237 }));
    expect(await listSavedMeals(db)).toHaveLength(1);
  });

  it('saved unchanged, it is not taken for a copy of itself', async () => {
    await render({ savedId: SAVED_ID }, withSaved('Two rotis'));

    await fireEvent.press(await screen.findByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(screen.queryByText('Already in my meals')).toBeNull();
  });

  it('says so when the saved meal is no longer on the phone', async () => {
    await render({ savedId: SAVED_ID });

    expect(await screen.findByText('This saved meal is no longer on this phone.')).toBeOnTheScreen();
  });
});
