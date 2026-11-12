import { IFCT_ACKNOWLEDGEMENT, type Dish, type Food, type MealItem, type MealType } from '@fitsphere/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { getEntry, replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { GRAMS_RULE } from '../mealItems';
import { NOW, renderInApp } from '../testing/appHarness';
import { nutrients, pickAmount, wheel } from '../testing/foodPage';
import { LIGHT_COLORS } from '../theme';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
// The phone's back is held while Log meal has changes not saved (D-68): what the screen last asked.
type Prevented = (options: { data: { action: unknown }; repeat(): void }) => void;
let mockLeave: { prevent: boolean; callback?: Prevented } = { prevent: false };
const mockRepeat = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  usePreventRemove: (prevent: boolean, callback?: Prevented) => {
    mockLeave = { prevent, callback };
    return () => undefined;
  },
}));

/** The phone's back: held and asked about while there are changes not saved, else it goes back. */
async function pressBack() {
  if (mockLeave.prevent) await act(async () => mockLeave.callback?.({ data: { action: { type: 'GO_BACK' } }, repeat: mockRepeat }));
  else mockRepeat();
}

// Log meal (REQ-LOG-001…003, REQ-LOG-007, REQ-LOG-008, REQ-ACC-005). Today is Wednesday 28 October
// 2026. Synthetic values; the two foods are IFCT rows as printed.

const TODAY = '2026-10-28';
const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [], portions: [] },
  { source: 'ifct2017', code: 'T013', name: 'Ghee', foodGroup: 'Edible Oils and Fats', aliases: [], proteinG: 0, fibreG: 0, fatG: 100, carbsG: 0, kcal: 900, kcalEstimated: true, measures: [], portions: [] },
];

// Foods as logged, the way the phone keeps them: 60 g of the atta and 5 g of the ghee above.
const ATTA_60: MealItem = { source: 'ifct2017', ref: 'A019', name: 'Wheat flour, atta', amount: { unit: 'g', value: 60 }, kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82, estimated: false };
const GHEE_5: MealItem = { source: 'ifct2017', ref: 'T013', name: 'Ghee', amount: { unit: 'g', value: 5 }, kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, fibreG: 0, estimated: true };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

/** Today's meals already on the phone, saved a minute apart in the order given (synthetic). */
function withMeals(...meals: [id: string, mealType: MealType, items: MealItem[]][]) {
  return async (db: SqlDb, server: FakeServer) => {
    await withFoods(db, server);
    for (const [index, [id, mealType, items]] of meals.entries()) {
      await saveEntry(db, 'meal', {
        changeId: `00000000-0000-4000-b000-0000000d000${index}`,
        data: { id, day: TODAY, mealType, tags: [], items, recordedAt: new Date(NOW.getTime() - (meals.length - index) * 60_000).toISOString() },
      });
    }
  };
}

/** The food list on the phone and on the fake server, so the first sync keeps it. */
async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  await replaceFoods(db, server.state.foodsVersion, FOODS);
}

function render(
  params: Record<string, string> = { day: TODAY },
  before: (db: SqlDb, server: FakeServer) => Promise<void> = withFoods,
) {
  mockParams = params;
  return renderInApp(<LogMealScreen now={() => NOW} />, undefined, before);
}

async function addFood(search: string, name: RegExp, grams: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), search);
  await fireEvent.press(await screen.findByRole('button', { name }));
  await fireEvent.changeText(screen.getByLabelText('Grams eaten'), grams);
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.push.mockClear();
  mockRepeat.mockClear();
  mockLeave = { prevent: false };
});

describe('D-58 Log meal in steps (the owner’s "3.5 Log meal in steps", locked 2026-11-06)', () => {
  const cue = (text: string) => screen.queryByText(text);

  it('says what to tap at the step to do now: the meal, then a way to add food, then Save; no frame', async () => {
    await render();
    expect(await screen.findByText('Start here: tap your meal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1')).toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
    expect(screen.getByLabelText('Step 2')).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
    // The owner removed the step's caramel frame (2026-11-06).
    expect(screen.getByTestId('step-1')).not.toHaveStyle({ borderWidth: 1.5 });
    expect(screen.getByTestId('step-1')).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.accentTint });

    await fireEvent.press(screen.getByRole('radio', { name: 'Breakfast' }));
    expect(screen.getByLabelText('Step 1')).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
    expect(cue('Start here: tap your meal')).toBeNull();
    expect(cue('Next: tap how to add your food')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 2')).toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });

    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(cue('Next: tap how to add your food')).toBeNull();
    expect(cue('Last: check your foods, then Save breakfast')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 3')).toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
    // No step turns green: green is for the meals with food (D-68, option A).
    expect(screen.queryByLabelText(/^Step \d, done$/)).toBeNull();
    expect(screen.getByLabelText('Step 2')).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.success });
  });

  it('foods added before the meal: the meal step asks for the meal to save', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(cue('Choose the meal to save')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1')).toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
  });

  it('opened for a meal (from its + on Home), starts at adding food', async () => {
    await render({ day: TODAY, slot: 'lunch' });
    expect(await screen.findByText('Next: tap how to add your food')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1')).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.primary });
  });

  it('the four ways to add food are in one row, each with its own tint, named in full', async () => {
    await render();
    const row = await screen.findByTestId('add-food-ways');
    expect(row).toHaveStyle({ flexDirection: 'row' });
    expect(row).not.toHaveStyle({ flexWrap: 'wrap' });
    for (const name of ['Search foods', 'Scan barcode', 'Enter your own food', 'Saved meals']) {
      expect(within(row).getByRole('button', { name })).toBeOnTheScreen();
    }
    expect(within(row).getByText(/^Own\s+food$/)).toBeOnTheScreen();
  });
});

describe('D-68 Log meal holds the date’s meals (the owner’s "3.5 Log meal · save and stay", locked 2026-11-10)', () => {
  const LUNCH = '00000000-0000-4000-c000-0000000d0001';
  const LUNCH_2 = '00000000-0000-4000-c000-0000000d0002';
  const BREAKFAST = '00000000-0000-4000-c000-0000000d0003';
  const tick = (slot: MealType) => screen.queryByTestId(`has-food-${slot}`);
  const atta = 'Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein';

  it('a meal with food has a green tick; the meal chosen is filled, with no tick of its own', async () => {
    await render({ day: TODAY }, withMeals([BREAKFAST, 'breakfast', [ATTA_60]]));

    expect(await screen.findByTestId('has-food-breakfast')).toHaveStyle({ backgroundColor: LIGHT_COLORS.success });
    expect(screen.getByRole('radio', { name: 'Breakfast' })).toHaveAccessibilityValue({ text: 'has food' });
    expect(tick('lunch')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Lunch' }));
    expect(screen.getByRole('radio', { name: 'Lunch' })).toBeChecked();
    expect(tick('lunch')).toBeNull();
    expect(screen.getByText('No foods in Lunch.')).toBeOnTheScreen();
    await addFood('ghee', /^Ghee/, '5');
    expect(tick('lunch')).toBeOnTheScreen();
  });

  it('a meal tapped shows its saved foods; a food added joins that same meal on Save', async () => {
    const { db } = await render({ day: TODAY }, withMeals([LUNCH, 'lunch', [ATTA_60]]));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));

    expect(await screen.findByLabelText(atta)).toBeOnTheScreen();
    // Nothing changed yet: nothing to save.
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    await addFood('ghee', /^Ghee/, '5');
    expect(screen.getByLabelText('Lunch total: 237 kcal, 6.3 g protein')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save lunch' }));

    expect(await screen.findByText('Lunch saved · 2 foods · 237 kcal')).toBeOnTheScreen();
    expect(await db.getAllAsync('SELECT id FROM meals', [])).toEqual([{ id: LUNCH }]);
    expect(await getEntry(db, 'meal', LUNCH)).toMatchObject({ mealType: 'lunch', kcal: 237 });
  });

  it('every food removed: the tick goes, it says the meal will be removed, and Save removes it', async () => {
    const { db } = await render({ day: TODAY }, withMeals([LUNCH, 'lunch', [ATTA_60]]));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Change Wheat flour, atta' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove from meal' }));

    expect(tick('lunch')).toBeNull();
    expect(screen.getByText('Lunch has no foods now. Saving removes it from Wed 28 Oct.')).toBeOnTheScreen();
    expect(screen.getByText('Last: Save lunch to remove it')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save lunch' }));

    expect(await screen.findByText('Lunch removed')).toBeOnTheScreen();
    expect(await getEntry(db, 'meal', LUNCH)).toBeFalsy();
  });

  it('each meal keeps its own changes; Save saves them all and says so', async () => {
    const { db } = await render();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await addFood('atta', /^Wheat flour, atta/, '60');
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));
    expect(screen.getByText('No foods in Snack.')).toBeOnTheScreen();
    await addFood('ghee', /^Ghee/, '5');
    expect(tick('lunch')).toBeOnTheScreen();
    expect(tick('snack')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Lunch' }));
    expect(screen.getByLabelText(atta)).toBeOnTheScreen();
    expect(screen.queryByText('Ghee')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save 2 meals' }));

    expect(await screen.findByText('Lunch and Snack saved')).toBeOnTheScreen();
    const rows = await db.getAllAsync<{ meal_type: string; kcal: number }>('SELECT meal_type, kcal FROM meals ORDER BY meal_type', []);
    expect(rows).toEqual([
      { meal_type: 'lunch', kcal: 192 },
      { meal_type: 'snack', kcal: 45 },
    ]);
  });

  it('a meal saved twice on a date shows all its foods; each stays in its own meal on Save', async () => {
    const { db } = await render({ day: TODAY }, withMeals([LUNCH, 'lunch', [ATTA_60]], [LUNCH_2, 'lunch', [GHEE_5]]));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    expect(await screen.findByLabelText(atta)).toBeOnTheScreen();
    expect(screen.getByText('Ghee')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Ghee' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove from meal' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save lunch' }));

    expect(await screen.findByText('Lunch saved · 1 food · 192 kcal')).toBeOnTheScreen();
    expect(await db.getAllAsync('SELECT id FROM meals', [])).toEqual([{ id: LUNCH }]);
  });

  it('back with changes not saved asks; Leave without saving goes back and saves nothing', async () => {
    const { db } = await render();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await addFood('atta', /^Wheat flour, atta/, '60');

    await pressBack();
    expect(screen.getByRole('header', { name: "Lunch isn't saved" })).toBeOnTheScreen();
    expect(screen.getByText('You changed Lunch. Save it before you leave?')).toBeOnTheScreen();
    expect(mockRepeat).not.toHaveBeenCalled();
    // Its icon and title in one line; Leave without saving the sheet's width, centred (the owner, 2026-11-10).
    expect(screen.getByTestId('leave-heading')).toHaveStyle({ flexDirection: 'row', alignItems: 'center' });
    expect(within(screen.getByTestId('leave-heading')).getByRole('header', { name: "Lunch isn't saved" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leave without saving' })).toHaveStyle({ alignSelf: 'stretch', justifyContent: 'center' });
    await fireEvent.press(screen.getByRole('button', { name: 'Leave without saving' }));

    expect(mockRepeat).toHaveBeenCalled();
    expect(await db.getAllAsync('SELECT id FROM meals', [])).toEqual([]);
  });

  it('the leave question’s Save saves, then goes back', async () => {
    const { db } = await render();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await addFood('atta', /^Wheat flour, atta/, '60');

    await pressBack();
    const saves = screen.getAllByRole('button', { name: 'Save lunch' });
    await fireEvent.press(saves[saves.length - 1]!);

    await waitFor(() => expect(mockRepeat).toHaveBeenCalled());
    expect(await db.getAllAsync('SELECT meal_type FROM meals', [])).toEqual([{ meal_type: 'lunch' }]);
  });

  it('with nothing to save, back goes straight back', async () => {
    await render();
    await screen.findByRole('button', { name: 'Save meal' });

    await pressBack();
    expect(mockRepeat).toHaveBeenCalled();
    expect(screen.queryByRole('header', { name: /isn't saved$/ })).toBeNull();
  });

  it('another date with changes asks first; Don’t save shows that date’s meals', async () => {
    const { db } = await render();
    await fireEvent.press(await screen.findByRole('radio', { name: 'Lunch' }));
    await addFood('atta', /^Wheat flour, atta/, '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Date: Wed 28 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 October 2026, Nothing logged' }));

    expect(screen.getByText('You changed Lunch. Save it before you change the date?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Don't save" }));

    expect(await screen.findByRole('button', { name: 'Date: Tue 27 Oct' })).toBeOnTheScreen();
    expect(await screen.findByText('No foods in Lunch.')).toBeOnTheScreen();
    expect(await db.getAllAsync('SELECT id FROM meals', [])).toEqual([]);
  });

  it('editing a meal: back with a change asks too, and leaving keeps the meal as it was', async () => {
    const { db } = await render({ mealId: LUNCH }, withMeals([LUNCH, 'lunch', [ATTA_60]]));
    await screen.findByLabelText(atta);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));

    await pressBack();
    expect(screen.getByText('You changed this meal. Save it before you leave?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave without saving' }));

    expect(mockRepeat).toHaveBeenCalled();
    expect(await getEntry(db, 'meal', LUNCH)).toMatchObject({ mealType: 'lunch' });
  });
});

describe('REQ-LOG-001 and REQ-LOG-002 the date', () => {
  it('Q-011 opens on the date it was given, and the slot it was given (REQ-NUT-003)', async () => {
    await render({ day: '2026-10-26', slot: 'dinner' });

    expect(await screen.findByRole('button', { name: 'Date: Mon 26 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Dinner' })).toBeChecked();
  });

  it('REQ-LOG-002 the date chip lists today, yesterday and five more days with their status (Q-037)', async () => {
    await render({ day: TODAY }, async (db, server) => {
      await withFoods(db, server);
      for (const [index, day] of [TODAY, '2026-10-27', '2026-10-27'].entries()) {
        await saveEntry(db, 'meal', {
          changeId: `00000000-0000-4000-b000-00000000000${index}`,
          data: {
            id: `00000000-0000-4000-c000-00000000000${index}`,
            day,
            mealType: 'lunch',
            tags: [],
            items: [{ source: 'own', ref: null, name: 'x', amount: { unit: 'g', value: 1 }, kcal: 1, proteinG: 0, carbsG: null, fatG: null, fibreG: null, estimated: false }],
            recordedAt: NOW.toISOString(),
          },
        });
      }
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Date: Wed 28 Oct' }));

    // The calendar, titled for logging (D-33), each day with its status (Q-037).
    expect(await screen.findByRole('header', { name: 'Log this meal to' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 October 2026, today, 1 meal logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 October 2026, 2 meals logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Thursday 22 October 2026, Nothing logged' })).toBeOnTheScreen();
    // Log meal's calendar keeps its dots: no green days, workouts or key, which are the header's (D-84).
    expect(screen.queryByText('Meals logged')).toBeNull();
    expect(screen.queryByText(/workouts?$/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 October 2026, 2 meals logged' }));
    expect(screen.getByRole('button', { name: 'Date: Tue 27 Oct' })).toBeOnTheScreen();
  });

  it('REQ-LOG-002 the calendar picks any past day in the phone’s 90 days, and no future day (Q-017)', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Date: Wed 28 Oct' }));

    expect(screen.getByRole('button', { name: 'Thursday 29 October 2026, not available' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 7 September 2026, Nothing logged' }));

    expect(screen.getByRole('button', { name: /^Date: Mon 7 Sep/ })).toBeOnTheScreen();
  });

  it('Q-017 a future or unknown date in the link falls back to today', async () => {
    await render({ day: '2026-10-29' });

    expect(await screen.findByRole('button', { name: 'Date: Wed 28 Oct' })).toBeOnTheScreen();
  });
});

describe('REQ-LOG-007 adding foods without AI', () => {
  it('REQ-ACC-005 searches the cached list offline, shows the IFCT acknowledgement behind the i, and adds the grams eaten', async () => {
    const { server } = await render();
    server.state.offline = true;

    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' });
    expect(screen.queryByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Food sources' }));
    expect(screen.getByRole('header', { name: 'Food sources' })).toBeOnTheScreen();
    expect(screen.getByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '60');
    // What it adds, with all four nutrients (the owner, 2026-11-04).
    expect(screen.getByLabelText('Adds 192 kcal')).toBeOnTheScreen();
    expect(['Protein', 'Carbs', 'Fat', 'Fibre'].map((name) => screen.getByLabelText(new RegExp(`^${name}: `)).props.accessibilityLabel)).toEqual([
      'Protein: 6.3 g',
      'Carbs: 38.5 g',
      'Fat: 0.9 g',
      'Fibre: 6.8 g',
    ]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
  });

  it('D-26 marks the oils’ kcal as estimated', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'ghee');

    expect(await screen.findByRole('button', { name: 'Ghee, 900 kcal per 100 g, estimated' })).toBeOnTheScreen();
  });

  it.each(['0', '2001', '12.5', ''])('D-26 refuses "%s" grams', async (grams) => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: /^Wheat flour, atta/ }));

    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), grams);

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByText('Enter whole grams from 1 to 2,000.')).toBeOnTheScreen();
  });

  it('ADR-0007 rule 6 before the food list was ever downloaded, says that needs internet', async () => {
    await render({ day: TODAY }, async (_db, server) => {
      server.state.offline = true;
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));

    expect(screen.getByText('Downloading the food list needs an internet connection.')).toBeOnTheScreen();
  });

  it('REQ-LOG-007 your own food: the label values per 100 g and the grams eaten; fibre is optional', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Enter your own food' }));

    await fireEvent.changeText(screen.getByLabelText('Food name'), 'Synthetic biscuits');
    await fireEvent.changeText(screen.getByLabelText('kcal per 100 g'), '450');
    await fireEvent.changeText(screen.getByLabelText('Protein per 100 g (g)'), '7');
    await fireEvent.changeText(screen.getByLabelText('Carbs per 100 g (g)'), '70');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Fat per 100 g (g)'), '15.5');
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '40');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Synthetic biscuits: 40 g, 180 kcal, 2.8 g protein')).toBeOnTheScreen();
  });

  it('REQ-SAVED-001 a saved meal’s foods can be added; it chooses no meal, since it has none (D-69)', async () => {
    await render({ day: TODAY }, async (db, server) => {
      await withFoods(db, server);
      await saveEntry(db, 'savedMeal', {
        changeId: '00000000-0000-4000-b000-000000000001',
        data: {
          id: '00000000-0000-4000-c000-000000000001',
          name: 'Synthetic dinner',
          tags: [],
          items: [{ source: 'own', ref: null, name: 'Synthetic dal', amount: { unit: 'g', value: 150 }, kcal: 160, proteinG: 9, carbsG: 20, fatG: 4, fibreG: 5, estimated: false }],
          savedAt: NOW.toISOString(),
        },
      });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Synthetic dinner (Synthetic dal)' }));

    expect(screen.getByLabelText('Synthetic dal: 150 g, 160 kcal, 9.0 g protein')).toBeOnTheScreen();
    for (const slot of ['Breakfast', 'Lunch', 'Snack', 'Dinner']) expect(screen.getByRole('radio', { name: slot })).not.toBeChecked();
  });

  it('two saved meals with the same name are both listed (the owner’s phone test, 2026-11-04)', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await render({ day: TODAY }, async (db, server) => {
      await withFoods(db, server);
      for (const n of [1, 2]) {
        await saveEntry(db, 'savedMeal', {
          changeId: `00000000-0000-4000-b000-00000000010${n}`,
          data: {
            id: `00000000-0000-4000-c000-00000000010${n}`,
            name: 'Dal rice',
            tags: [],
            items: [{ source: 'own', ref: null, name: 'Dal rice', amount: { unit: 'g', value: 200 + n }, kcal: 300, proteinG: 9, carbsG: 50, fatG: 4, fibreG: 5, estimated: false }],
            savedAt: NOW.toISOString(),
          },
        });
      }
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));

    expect(screen.getAllByRole('button', { name: 'Dal rice (Dal rice)' })).toHaveLength(2);
    expect(errors.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false);
    errors.mockRestore();
  });
});

describe('D-44 Search foods fills the screen (the owner’s phone test, 2026-11-04)', () => {
  it('opens full screen with its title, the i and a back arrow, and no Close at the foot; the back arrow closes it', async () => {
    await render();

    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));

    expect(screen.getByRole('header', { name: 'Search foods' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Food sources' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByRole('header', { name: 'Search foods' })).toBeNull();
  });

  it('a food’s amount opens over the results, and Back to search returns to the same results', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');

    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    expect(screen.getByRole('header', { name: 'Wheat flour, atta' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));

    expect(screen.queryByRole('header', { name: 'Wheat flour, atta' })).toBeNull();
    expect(screen.getByLabelText('Search foods')).toHaveProp('value', 'atta');
    expect(screen.getByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' })).toBeOnTheScreen();
  });
});

describe('D-45 a food’s page (the owner, 2026-11-04, after HealthifyMe’s)', () => {
  it('shows the food, its quantity and measure, and the macronutrients breakdown of that amount; refused grams show the rule', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));

    expect(screen.getByRole('header', { name: 'Wheat flour, atta' })).toBeOnTheScreen();
    expect(screen.getByText('Per 100 g: 320 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grams eaten')).toHaveDisplayValue('100');
    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Macronutrients breakdown' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 320 kcal')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 100 g')).toBeOnTheScreen();
    expect(nutrients()).toEqual(['Protein: 10.6 g', 'Carbs: 64.2 g', 'Fat: 1.5 g', 'Fibre: 11.4 g']);

    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '2500');
    expect(screen.getByText('Enter whole grams from 1 to 2,000.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds –')).toBeOnTheScreen();
    expect(nutrients()).toEqual(['Protein: –', 'Carbs: –', 'Fat: –', 'Fibre: –']);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});

describe('REQ-LOG-003 and the review before saving', () => {
  it('REQ-LOG-003 Save needs a meal type and at least one food; it names the meal (D-68)', async () => {
    await render();
    // Nothing to save: Save is greyed, with what to do; there is no Done (the owner, 2026-11-10).
    expect(await screen.findByRole('button', { name: 'Save meal' })).toBeDisabled();
    expect(screen.getByText('Add at least one food to save the meal.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    expect(screen.getByText('Choose the meal: Breakfast, Lunch, Snack or Dinner.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lunch' }));

    expect(screen.getByRole('button', { name: 'Save lunch' })).toBeEnabled();
  });

  it('REQ-LOG-007 the review can change an amount or remove a food, and shows the total', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');
    await addFood('ghee', /^Ghee/, '5');
    expect(screen.getByLabelText('Total: 237 kcal, 6.3 g protein')).toBeOnTheScreen();

    // D-64: a food opens its own page on its amount in the meal.
    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    expect(await screen.findByText('In this meal now: 60 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grams eaten')).toHaveDisplayValue('60');
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));
    expect(screen.getByLabelText('Wheat flour, atta: 90 g, 288 kcal, 9.5 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Ghee' }));
    // Remove from meal stands out in red, centred under Save change.
    expect(await screen.findByText('Remove from meal')).toHaveStyle({ color: LIGHT_COLORS.danger });
    expect(screen.getByRole('button', { name: 'Remove from meal' })).toHaveStyle({ alignSelf: 'stretch', justifyContent: 'center' });
    await fireEvent.press(screen.getByRole('button', { name: 'Remove from meal' }));
    expect(screen.queryByText('Ghee')).toBeNull();
    expect(screen.getByLabelText('Total: 288 kcal, 9.5 g protein')).toBeOnTheScreen();
  });

  it('D-64 a food’s page from the review leaves the meal as it was on Back', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');

    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    await fireEvent.changeText(await screen.findByLabelText('Grams eaten'), '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the meal' }));

    expect(screen.queryByText('In this meal now: 60 g')).toBeNull();
    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
  });

  it('REQ-LOG-003 saving keeps the date and meal type, syncs the meal, and stays for the next meal (D-68)', async () => {
    const { db, server } = await render({ day: '2026-10-26' });
    await addFood('atta', /^Wheat flour, atta/, '60');
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Save snack' }));

    expect(await screen.findByText('Snack saved · 1 food · 192 kcal')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    const rows = await db.getAllAsync<{ id: string; day: string; meal_type: string; tags: string; kcal: number }>(
      'SELECT id, day, meal_type, tags, kcal FROM meals',
      [],
    );
    expect(rows).toEqual([{ id: expect.any(String), day: '2026-10-26', meal_type: 'snack', tags: '[]', kcal: 192 }]);
    await waitFor(() => expect(server.entries('meals').get(rows[0]!.id)).toMatchObject({ deleted: false, mealType: 'snack' }));
    // Snack stays on show with its saved food; the next step is another meal. Save waits for a change.
    expect(screen.getByRole('radio', { name: 'Snack' })).toBeChecked();
    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    expect(screen.getByText('Next: tap another meal')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    // Nothing left to save: back goes straight back.
    await pressBack();
    expect(mockRepeat).toHaveBeenCalled();
  });

  it('D-68 the AI box is left out for now, and the tips are shown (REQ-LOG-008)', async () => {
    await render();

    expect(await screen.findByText('Tips: give amounts in grams; say whether a food is raw or cooked; add each food separately.')).toBeOnTheScreen();
    expect(screen.queryByText('AI meal reading is coming soon')).toBeNull();
    // The cooked-rice example has no supporting source (D-26 answer 3, amended 2026-10-30).
    expect(screen.queryByText(/cooked rice weighs/)).toBeNull();
  });
});

describe('what Log meal says about missing values', () => {
  it('Save meal says to add a food first, in a meal being edited', async () => {
    const mealId = '00000000-0000-4000-c000-00000000e0f1';
    await render({ mealId }, async (db, server) => {
      await withFoods(db, server);
      await saveEntry(db, 'meal', {
        changeId: '00000000-0000-4000-b000-00000000e0f1',
        data: { id: mealId, day: TODAY, mealType: 'lunch', tags: [], items: [ATTA_60], recordedAt: NOW.toISOString() },
      });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Change Wheat flour, atta' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove from meal' }));
    expect(screen.getByText('Add at least one food to save the meal.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
  });

  it('own food: Add says what is missing; each value gives its range, and the grams their rule', async () => {
    await render();
    await fireEvent.press(await screen.findByRole('button', { name: 'Enter your own food' }));

    expect(screen.getByText("Enter the food's name.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Food name'), 'Synthetic bar');
    expect(screen.getByText('Enter kcal, protein, carbs and fat to add.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('kcal per 100 g'), '950');
    expect(screen.getByText('Enter 0 to 900, with at most one decimal.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Protein per 100 g (g)'), '101');
    expect(screen.getByText('Enter 0 to 100, with at most one decimal.')).toBeOnTheScreen();
    for (const [label, value] of [
      ['kcal per 100 g', '400'],
      ['Protein per 100 g (g)', '10'],
      ['Carbs per 100 g (g)', '60'],
      ['Fat per 100 g (g)', '12'],
    ]) {
      await fireEvent.changeText(screen.getByLabelText(label!), value!);
    }
    expect(screen.getAllByText(GRAMS_RULE)).toHaveLength(1);
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '0');
    expect(screen.getAllByText(GRAMS_RULE)).toHaveLength(1);
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '40');
    expect(screen.queryByText(GRAMS_RULE)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });
});

describe('D-34 the same food added again to the meal', () => {
  it('asks; "Add to existing" puts the amounts together in one item', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');
    await addFood('atta', /^Wheat flour, atta/, '40');

    expect(screen.getByRole('header', { name: 'Already in this meal' })).toBeOnTheScreen();
    expect(screen.getByText('Wheat flour, atta is already in this meal (60 g). Add 40 g to it, for 100 g in all?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to existing' }));

    expect(screen.getAllByLabelText(/^Wheat flour, atta: /).map((row) => row.props.accessibilityLabel)).toEqual([
      'Wheat flour, atta: 100 g, 320 kcal, 10.6 g protein',
    ]);
  });

  it('"Keep separate" adds it as its own item', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');
    await addFood('atta', /^Wheat flour, atta/, '40');

    await fireEvent.press(screen.getByRole('button', { name: 'Keep separate' }));

    expect(screen.getAllByLabelText(/^Wheat flour, atta: /)).toHaveLength(2);
  });

  it('when together they would pass 2,000 g, says so and only keeps it separate', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '1500');
    await addFood('atta', /^Wheat flour, atta/, '600');

    expect(
      screen.getByText(
        "Wheat flour, atta is already in this meal (1,500 g). Together that would be over 2,000 g, the most for one food, so it's added on its own.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add to existing' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep separate' }));
    expect(screen.getAllByLabelText(/^Wheat flour, atta: /)).toHaveLength(2);
  });
});

describe('REQ-NUT-004 Edit', () => {
  const MEAL_ID = '00000000-0000-4000-c000-00000000e001';
  const ITEM: MealItem = { source: 'ifct2017', ref: 'A019', name: 'Wheat flour, atta', amount: { unit: 'g', value: 60 }, kcal: 192, proteinG: 6.34, carbsG: 38.5, fatG: 0.92, fibreG: 6.82, estimated: false };

  async function seedMeal(db: SqlDb, server: FakeServer) {
    await withFoods(db, server);
    await saveEntry(db, 'meal', {
      changeId: '00000000-0000-4000-b000-00000000e001',
      data: { id: MEAL_ID, day: '2026-10-25', mealType: 'lunch', tags: ['dessert'], items: [ITEM], recordedAt: NOW.toISOString() },
    });
  }

  it('REQ-NUT-004 opens the meal filled in, with its date fixed', async () => {
    await render({ mealId: MEAL_ID }, seedMeal);

    expect(await screen.findByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Date: Sun 25 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Date:/ })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Lunch' })).toBeChecked();
  });

  it('D-40 offers no tags, and a meal edited keeps the tags it has', async () => {
    const { db } = await render({ mealId: MEAL_ID }, seedMeal);
    await screen.findByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein');

    expect(screen.queryByRole('checkbox', { name: 'Dessert' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Before training' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'meal', MEAL_ID)).toMatchObject({ mealType: 'dinner', tags: ['dessert'] });
  });

  it('REQ-NUT-004 saving replaces the same meal', async () => {
    const { db } = await render({ mealId: MEAL_ID }, seedMeal);
    await screen.findByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein');

    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));
    await addFood('ghee', /^Ghee/, '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'meal', MEAL_ID)).toMatchObject({ day: '2026-10-25', mealType: 'dinner', kcal: 237 });
    expect(await db.getAllAsync('SELECT id FROM meals', [])).toEqual([{ id: MEAL_ID }]);
  });

  it('says so when the meal is no longer on the phone', async () => {
    await render({ mealId: '00000000-0000-4000-c000-00000000dead' });

    expect(await screen.findByText('This meal is no longer on this phone.')).toBeOnTheScreen();
  });
});

describe('D-28 dishes, logged in portions', () => {
  // Synthetic dishes: made-up values for one portion, not recipe data.
  const DISHES: Dish[] = [
    { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 120, proteinG: 3.6, carbsG: 20, fatG: 3, fibreG: 2 },
    { code: 'test_dal', name: 'Test dal', portionUnit: 'katori', kcal: 150, proteinG: 8, carbsG: 20, fatG: 4, fibreG: 5 },
  ];

  async function withDishes(db: SqlDb, server: FakeServer) {
    server.state.foods = FOODS;
    server.state.dishes = DISHES;
    await replaceFoods(db, server.state.foodsVersion, FOODS, DISHES);
  }

  async function chooseDish(search: string, name: RegExp) {
    await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), search);
    await fireEvent.press(await screen.findByRole('button', { name }));
  }

  it('REQ-LOG-007 search finds the dishes on the phone, each per piece or per katori, estimated', async () => {
    await render({ day: TODAY }, withDishes);
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));

    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'test');
    expect(await screen.findByRole('button', { name: 'Test flatbread, 120 kcal per piece, estimated' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Test dal, 150 kcal per katori (200 ml), estimated' })).toBeOnTheScreen();

    // A dish the server does not list (not approved, or blocked) is never on the phone.
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'chicken curry');
    expect(await screen.findByText('No foods found. Try another word, or enter your own food.')).toBeOnTheScreen();
  });

  it('a dish is added in portions, in halves from 0.5 to 10, with its values for that many', async () => {
    await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('flatbread', /^Test flatbread, /);

    expect(screen.getByText('One piece: 120 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Piece')).toBeOnTheScreen();
    expect(screen.getByText('Estimated')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Grams eaten')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Quantity: 1' }));
    expect(wheel('Quantity')).toEqual(Array.from({ length: 20 }, (_, index) => String((index + 1) / 2)));
    expect(wheel('Measure')).toEqual(['Piece']);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    await pickAmount({ quantity: '0.5' });
    expect(screen.getByLabelText('Quantity: 0.5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 60 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 1.8 g')).toBeOnTheScreen();

    await pickAmount({ quantity: '10' });
    expect(screen.getByLabelText('Adds 1,200 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 36.0 g')).toBeOnTheScreen();

    await pickAmount({ quantity: '1.5' });
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test flatbread: 1.5 portions, 180 kcal, 5.4 g protein')).toBeOnTheScreen();
    expect(screen.getByText('1.5 portions · 180 kcal · 5.4 g protein · estimated')).toBeOnTheScreen();
  });

  it('the review can change a dish’s portions, and a food’s grams as before', async () => {
    await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('dal', /^Test dal, /);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(screen.getByLabelText('Total: 342 kcal, 14.3 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Test dal' }));
    expect(await screen.findByLabelText('Quantity: 1')).toBeOnTheScreen();
    await pickAmount({ quantity: '1.5' });
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));

    expect(screen.getByLabelText('Test dal: 1.5 portions, 225 kcal, 12.0 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total: 417 kcal, 18.3 g protein')).toBeOnTheScreen();
  });

  it('saving keeps the dish as logged: its code, the portions and their values, estimated', async () => {
    const { db, server } = await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('dal', /^Test dal, /);
    await pickAmount({ quantity: '1.5' });
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Save dinner' }));

    await screen.findByText(/^Dinner saved · /);
    const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    const dish: MealItem = {
      source: 'dish',
      ref: 'test_dal',
      name: 'Test dal',
      amount: { unit: 'portion', value: 1.5 },
      kcal: 225,
      proteinG: 12,
      carbsG: 30,
      fatG: 6,
      fibreG: 7.5,
      estimated: true,
    };
    expect(await getEntry(db, 'meal', row!.id)).toMatchObject({ items: [dish], kcal: 225 });
    await waitFor(() => expect(server.entries('meals').get(row!.id)).toMatchObject({ items: [dish], totals: { kcal: 225, proteinG: 12 } }));
  });
});

// A listed food with a household unit (D-36). The 258 g for a glass is synthetic, not a measurement.
const MILK: Food = {
  source: 'ifct2017',
  code: 'L002',
  name: 'Milk, whole, Cow',
  foodGroup: 'Milk and Milk Products',
  aliases: [],
  proteinG: 3.26,
  fibreG: 0,
  fatG: 4.48,
  carbsG: 4.94,
  kcal: 73,
  kcalEstimated: false,
  measures: [{ measure: 'glass', grams: 258 }],
  portions: [],
};

async function withMilk(db: SqlDb, server: FakeServer) {
  server.state.foods = [...FOODS, MILK];
  await replaceFoods(db, server.state.foodsVersion, [...FOODS, MILK]);
}

async function chooseMilk() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), 'milk');
  await fireEvent.press(await screen.findByRole('button', { name: /^Milk, whole, Cow/ }));
}

async function addGlasses(more = 0) {
  await chooseMilk();
  await pickAmount({ measure: 'Glass (258 g)', quantity: String(1 + more / 2) });
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

describe('D-36 household units', () => {
  it('a food with a unit offers Grams and the unit; a unit is counted in halves, its values for the grams it comes to', async () => {
    await render({ day: TODAY }, withMilk);
    await chooseMilk();

    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grams eaten')).toHaveDisplayValue('100');
    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Grams' }));
    // D-76: the food's own measures first, then Grams, then oz.
    expect(wheel('Measure')).toEqual(['Glass (258 g)', 'Grams', 'oz (28.35 g)']);
    expect(screen.getByText('Type the grams in the box')).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByLabelText('Measure')).getByRole('button', { name: 'Glass (258 g)' }));
    // 7.5 glasses is 1,935 g; 8 would pass 2,000 g, the most for one food.
    expect(wheel('Quantity')).toEqual(Array.from({ length: 15 }, (_, index) => String((index + 1) / 2)));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByLabelText('Measure: Glass (258 g)')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Grams eaten')).toBeNull();
    expect(screen.getByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 258 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 188 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 8.4 g')).toBeOnTheScreen();

    await pickAmount({ quantity: '1.5' });
    expect(screen.getByText('Net wt: 387 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 283 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 12.6 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Milk, whole, Cow: 1.5 glasses (387 g), 283 kcal, 12.6 g protein')).toBeOnTheScreen();
  });

  it('D-76 a food without units opens on Grams, and can be logged in oz, 28.35 g each', async () => {
    await render({ day: TODAY }, withMilk);
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: /^Wheat flour, atta/ }));

    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    expect(screen.getByLabelText('Grams eaten')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Measure: Grams' }));
    expect(wheel('Measure')).toEqual(['Grams', 'oz (28.35 g)']);
    await fireEvent.press(within(screen.getByLabelText('Measure')).getByRole('button', { name: 'oz (28.35 g)' }));
    // 10 oz is 283.5 g: oz is counted in halves to 10, as other servings.
    expect(wheel('Quantity')).toEqual(Array.from({ length: 20 }, (_, index) => String((index + 1) / 2)));
    await fireEvent.press(within(screen.getByLabelText('Quantity')).getByRole('button', { name: '2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByLabelText('Measure: oz (28.35 g)')).toBeOnTheScreen();
    expect(screen.getByText('Net wt: 56.7 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 181 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 6.0 g')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Wheat flour, atta: 2 oz (56.7 g), 181 kcal, 6.0 g protein')).toBeOnTheScreen();

    // Opened again from the review (D-64), the page is on its oz.
    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    expect(await screen.findByText('In this meal now: 2 oz (56.7 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: oz (28.35 g)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity: 2')).toBeOnTheScreen();
  });

  it('D-64 the review changes a food’s measure: 100 g of milk becomes 1 glass', async () => {
    await render({ day: TODAY }, withMilk);
    await chooseMilk();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText(/^Milk, whole, Cow: 100 g, /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Milk, whole, Cow' }));
    expect(await screen.findByText('In this meal now: 100 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Grams')).toBeOnTheScreen();
    await pickAmount({ measure: 'Glass (258 g)', quantity: '1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));

    expect(screen.getByLabelText('Milk, whole, Cow: 1 glass (258 g), 188 kcal, 8.4 g protein')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Milk, whole, Cow: 100 g, /)).toBeNull();
  });

  it('the review changes a unit item’s count; the same food in the same unit joins it, and in grams stays apart (D-34)', async () => {
    await render({ day: TODAY }, withMilk);
    await addGlasses();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Milk, whole, Cow' }));
    expect(await screen.findByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Glass (258 g)')).toBeOnTheScreen();
    await pickAmount({ quantity: '1.5' });
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));
    expect(screen.getByLabelText('Milk, whole, Cow: 1.5 glasses (387 g), 283 kcal, 12.6 g protein')).toBeOnTheScreen();

    await addGlasses();
    expect(
      await screen.findByText('Milk, whole, Cow is already in this meal (1.5 glasses (387 g)). Add 1 glass (258 g) to it, for 2.5 glasses (645 g) in all?'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to existing' }));
    expect(screen.getByLabelText('Milk, whole, Cow: 2.5 glasses (645 g), 471 kcal, 21.0 g protein')).toBeOnTheScreen();

    await addFood('milk', /^Milk, whole, Cow/, '100');
    expect(screen.queryByRole('button', { name: 'Add to existing' })).toBeNull();
    expect(screen.getByLabelText('Milk, whole, Cow: 100 g, 73 kcal, 3.3 g protein')).toBeOnTheScreen();
  });

  it('saving keeps the unit, the count and the grams they came to, with their values', async () => {
    const { db, server } = await render({ day: TODAY }, withMilk);
    await addGlasses();
    await fireEvent.press(screen.getByRole('radio', { name: 'Breakfast' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));

    await screen.findByText(/^Breakfast saved · /);
    const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    const glass: MealItem = {
      source: 'ifct2017',
      ref: 'L002',
      name: 'Milk, whole, Cow',
      amount: { unit: 'measure', measure: 'glass', value: 1, grams: 258 },
      kcal: 188.34,
      proteinG: 8.41,
      carbsG: 12.75,
      fatG: 11.56,
      fibreG: 0,
      estimated: false,
    };
    expect(await getEntry(db, 'meal', row!.id)).toMatchObject({ items: [glass] });
    await waitFor(() => expect(server.entries('meals').get(row!.id)).toMatchObject({ items: [glass] }));
  });
});

describe('D-69 "Change amounts first" from a saved meal', () => {
  const DAL: MealItem = { source: 'own', ref: null, name: 'Synthetic dal', amount: { unit: 'g', value: 150 }, kcal: 160, proteinG: 9, carbsG: 20, fatG: 4, fibreG: 5, estimated: false };
  const SAVED_ID = '00000000-0000-4000-c000-000000000201';

  async function withSaved(db: SqlDb, server: FakeServer) {
    await withFoods(db, server);
    await saveEntry(db, 'savedMeal', {
      changeId: '00000000-0000-4000-b000-000000000201',
      data: { id: SAVED_ID, name: 'Monday breakfast', tags: [], items: [DAL], savedAt: NOW.toISOString() },
    });
  }

  it('opens with the saved meal’s foods and says where they came from; saving logs this day’s meal and leaves the saved meal as it is', async () => {
    const { db } = await render({ day: '2026-10-26', slot: 'breakfast', savedId: SAVED_ID }, withSaved);

    expect(await screen.findByText('From Monday breakfast')).toBeOnTheScreen();
    expect(screen.getByText('Change what you need for this day. Your saved meal stays as it is.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Synthetic dal: 150 g, 160 kcal, 9.0 g protein')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Breakfast' })).toBeChecked();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Synthetic dal' }));
    await fireEvent.changeText(screen.getByLabelText('New grams'), '100');
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 100 g' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));

    await waitFor(async () => expect(await db.getAllAsync('SELECT day, meal_type FROM meals', [])).toEqual([{ day: '2026-10-26', meal_type: 'breakfast' }]));
    const [meal] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    expect(await getEntry(db, 'meal', meal!.id)).toMatchObject({ items: [expect.objectContaining({ name: 'Synthetic dal', amount: { unit: 'g', value: 100 } })] });
    expect(await getEntry(db, 'savedMeal', SAVED_ID)).toMatchObject({ items: [DAL] });
  });

  it('with no meal chosen yet, asks for it as usual', async () => {
    await render({ day: TODAY, savedId: SAVED_ID }, withSaved);

    expect(await screen.findByText('From Monday breakfast')).toBeOnTheScreen();
    expect(screen.getByText('Choose the meal to save')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
  });
});
