import type { MealItem, TargetKind } from '@fitsphere/shared';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { InsightScreen } from './InsightScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockParams: { day?: string; scope?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// Insight (REQ-NUT-005, REQ-NUT-006; D-70): a meal's or the day's calories, its nutrients against the
// daily targets, and its top foods. Today is Wednesday 28 October 2026. Synthetic values only.

const TODAY = '2026-10-28';
const AT = NOW.toISOString();
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
const GHEE: MealItem = { ...ATTA, ref: 'T013', name: 'Ghee', amount: { unit: 'g', value: 5 }, kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, fibreG: 0 };
const BAR: MealItem = { ...ATTA, source: 'own', ref: null, name: 'Synthetic bar', amount: { unit: 'own', name: 'piece', value: 1 }, kcal: 180, proteinG: 4, carbsG: 24, fatG: 8, fibreG: null };

let ids = 0;
function id(): string {
  ids += 1;
  return `00000000-0000-4000-b000-${String(ids).padStart(12, '0')}`;
}

async function meal(db: SqlDb, mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner', items: MealItem[]) {
  await saveEntry(db, 'meal', { changeId: id(), data: { id: id(), day: TODAY, mealType, tags: [], items, recordedAt: AT } });
}

async function target(db: SqlDb, kind: TargetKind, value: number) {
  await saveEntry(db, 'target', { changeId: id(), data: { kind, value, setAt: AT } });
}

/** Breakfast: atta; lunch: atta and ghee; targets for calories and protein only. */
async function seedDay(db: SqlDb) {
  await meal(db, 'breakfast', [ATTA]);
  await meal(db, 'lunch', [ATTA, GHEE]);
  await target(db, 'calories', 2_000);
  await target(db, 'protein', 110);
}

async function show(scope: string, seed: (db: SqlDb) => Promise<void> = seedDay) {
  mockParams.day = TODAY;
  mockParams.scope = scope;
  return renderInApp(<InsightScreen now={() => NOW} />, undefined, seed);
}

beforeEach(() => {
  mockRouter.push.mockClear();
  delete mockParams.day;
  delete mockParams.scope;
});

describe('REQ-NUT-005 Insight', () => {
  it('opens on the meal tapped, for its date: its kcal and its share of the daily target, with each meal’s kcal and what is left today', async () => {
    await show('lunch');

    expect(await screen.findByText('Today · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Lunch' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Whole day' })).not.toBeChecked();
    // A green tick on each meal with food.
    expect(screen.getByTestId('has-food-breakfast')).toBeOnTheScreen();
    expect(screen.getByTestId('has-food-lunch')).toBeOnTheScreen();
    expect(screen.queryByTestId('has-food-snack')).toBeNull();

    expect(screen.getByText('Lunch · calories')).toBeOnTheScreen();
    expect(screen.getByLabelText('237 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Lunch: 12% of your 2,000 kcal daily target')).toBeOnTheScreen();
    expect(screen.getByLabelText('Breakfast: 192 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lunch: 237 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Snack: nothing logged')).toBeOnTheScreen();
    expect(screen.getByLabelText('Left today: 1,571 kcal')).toBeOnTheScreen();
    // The day's bar: the meal opened in caramel, the others muted.
    expect(screen.getByTestId('kcal-bar-lunch')).toHaveStyle({ backgroundColor: LIGHT_COLORS.accent });
    expect(screen.getByTestId('kcal-bar-breakfast')).toHaveStyle({ backgroundColor: LIGHT_COLORS.inkSubtle });
    expect(screen.queryByTestId('kcal-bar-snack')).toBeNull();
  });

  it('shows each nutrient against its daily target: the meal’s part and the rest of today; one with no target offers to set it', async () => {
    await show('lunch');

    const protein = await screen.findByTestId('nutrient-protein');
    expect(within(protein).getByLabelText('Protein: 6.3 g of 110 g')).toBeOnTheScreen();
    expect(within(protein).getByText('6% of target')).toBeOnTheScreen();
    expect(within(protein).getByText('97.3 g left today')).toBeOnTheScreen();
    expect(within(protein).getByTestId('rest-protein')).toBeOnTheScreen();

    const carbs = screen.getByTestId('nutrient-carbs');
    expect(within(carbs).getByLabelText('Carbs: 38.5 g, no daily target')).toBeOnTheScreen();
    await fireEvent.press(within(carbs).getByRole('button', { name: 'Set a target' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/targets');
  });

  it('switches to the whole day; over a target, the bar turns gold and says by how much', async () => {
    await show('lunch', async (db) => {
      await seedDay(db);
      await target(db, 'fat', 5);
    });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Whole day' }));

    expect(screen.getByRole('radio', { name: 'Whole day' })).toBeChecked();
    expect(screen.getByText('Whole day · calories')).toBeOnTheScreen();
    expect(screen.getByLabelText('429 kcal')).toBeOnTheScreen();
    expect(screen.getByText('21% of your 2,000 kcal daily target')).toBeOnTheScreen();
    const fat = screen.getByTestId('nutrient-fat');
    expect(within(fat).getByText('1.8 g over today')).toHaveStyle({ color: LIGHT_COLORS.warning });
    expect(within(fat).getByTestId('bar-fat')).toHaveStyle({ backgroundColor: LIGHT_COLORS.warning, width: '100%' });
    expect(within(fat).queryByTestId('rest-fat')).toBeNull();
  });

  it('a meal with nothing logged offers to add to it', async () => {
    await show('snack');

    expect(await screen.findByText('Nothing logged for Snack on Wed 28 Oct.')).toBeOnTheScreen();
    expect(screen.queryByText('Snack · calories')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to Snack' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/log-meal', params: { day: TODAY, slot: 'snack' } });
  });

  it('with no calorie target, says so and offers to set one', async () => {
    await show('breakfast', async (db) => {
      await meal(db, 'breakfast', [ATTA]);
    });

    expect(await screen.findByText('Breakfast · calories')).toBeOnTheScreen();
    expect(screen.queryByText(/% of your/)).toBeNull();
    expect(screen.queryByLabelText(/^Left today/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Set a target' })).toHaveLength(5);
  });
});

describe('REQ-NUT-006 Top foods', () => {
  it('ranks the meal’s foods by calories first, then by the nutrient chosen', async () => {
    await show('lunch');

    expect(await screen.findByText('Top foods · Lunch')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Calories' })).toBeChecked();
    expect(screen.getByLabelText('1: Wheat flour, atta, 60 g, 192 kcal, 81%')).toBeOnTheScreen();
    expect(screen.getByLabelText('2: Ghee, 5 g, 45 kcal, 19%')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Fat' }));

    expect(screen.getByLabelText('1: Ghee, 5 g, 5 g, 84%')).toBeOnTheScreen();
    expect(screen.getByLabelText('2: Wheat flour, atta, 60 g, 0.9 g, 16%')).toBeOnTheScreen();
  });

  it('on the whole day, the same food from two meals is one row, its amounts added and its meals named', async () => {
    await show('day');

    expect(await screen.findByText('Top foods · whole day')).toBeOnTheScreen();
    expect(screen.getByLabelText('1: Wheat flour, atta, Breakfast, Lunch · 120 g, 384 kcal, 90%')).toBeOnTheScreen();
  });

  it('leaves out a food with no value for the nutrient, and says so', async () => {
    await show('lunch', async (db) => {
      await meal(db, 'lunch', [ATTA, BAR]);
    });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Fibre' }));

    expect(screen.getByLabelText('1: Wheat flour, atta, 60 g, 6.8 g, 100%')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/Synthetic bar/)).toBeNull();
    expect(screen.getByText('Synthetic bar has no fibre value, so it is not listed.')).toBeOnTheScreen();
    expect(within(screen.getByTestId('nutrient-fibre')).getByText('Synthetic bar has no fibre value.')).toBeOnTheScreen();
  });

  it('shows five foods, then "Show all"', async () => {
    const foods = Array.from({ length: 7 }, (_, index) => ({ ...ATTA, ref: `X00${index}`, name: `Synthetic food ${index + 1}`, kcal: 100 - index }));
    await show('dinner', async (db) => {
      await meal(db, 'dinner', foods);
    });

    expect(await screen.findByLabelText(/^5: Synthetic food 5,/)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^6: /)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show all 7 foods' }));

    expect(screen.getByLabelText(/^7: Synthetic food 7,/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Show the top 5' })).toBeOnTheScreen();
  });
});
