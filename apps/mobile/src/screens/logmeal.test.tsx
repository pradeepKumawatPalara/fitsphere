import { IFCT_ACKNOWLEDGEMENT, type Dish, type Food, type MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getEntry, replaceFoods, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { GRAMS_RULE } from '../mealItems';
import { NOW, renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// Log meal (REQ-LOG-001…003, REQ-LOG-007, REQ-LOG-008, REQ-ACC-005). Today is Wednesday 28 October
// 2026. Synthetic values; the two foods are IFCT rows as printed.

const TODAY = '2026-10-28';
const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [], portions: [] },
  { source: 'ifct2017', code: 'T013', name: 'Ghee', foodGroup: 'Edible Oils and Fats', aliases: [], proteinG: 0, fibreG: 0, fatG: 100, carbsG: 0, kcal: 900, kcalEstimated: true, measures: [], portions: [] },
];

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

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
  it('REQ-ACC-005 searches the cached list offline, shows the IFCT acknowledgement, and adds the grams eaten', async () => {
    const { server } = await render();
    server.state.offline = true;

    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    expect(await screen.findByText(`Food values: ${IFCT_ACKNOWLEDGEMENT}`)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '60');
    expect(screen.getByLabelText('Adds 192 kcal and 6.3 g protein')).toBeOnTheScreen();
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

  it('REQ-SAVED-001 a saved meal’s foods can be added, and its slot is used when none is chosen', async () => {
    await render({ day: TODAY }, async (db, server) => {
      await withFoods(db, server);
      await saveEntry(db, 'savedMeal', {
        changeId: '00000000-0000-4000-b000-000000000001',
        data: {
          id: '00000000-0000-4000-c000-000000000001',
          name: 'Synthetic dinner',
          mealType: 'dinner',
          tags: [],
          items: [{ source: 'own', ref: null, name: 'Synthetic dal', amount: { unit: 'g', value: 150 }, kcal: 160, proteinG: 9, carbsG: 20, fatG: 4, fibreG: 5, estimated: false }],
          savedAt: NOW.toISOString(),
        },
      });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Synthetic dinner (Synthetic dal)' }));

    expect(screen.getByLabelText('Synthetic dal: 150 g, 160 kcal, 9.0 g protein')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Dinner' })).toBeChecked();
  });
});

describe('REQ-LOG-003 and the review before saving', () => {
  it('REQ-LOG-003 Save needs a meal type and at least one food', async () => {
    await render();
    const save = await screen.findByRole('button', { name: 'Save meal' });
    expect(save).toBeDisabled();

    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(screen.getByRole('button', { name: 'Save meal' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Lunch' }));

    expect(screen.getByRole('button', { name: 'Save meal' })).toBeEnabled();
  });

  it('REQ-LOG-007 the review can change an amount or remove a food, and shows the total', async () => {
    await render();
    await addFood('atta', /^Wheat flour, atta/, '60');
    await addFood('ghee', /^Ghee/, '5');
    expect(screen.getByLabelText('Total: 237 kcal, 6.3 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    await fireEvent.changeText(screen.getByLabelText('New grams'), '90');
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 90 g' }));
    expect(screen.getByLabelText('Wheat flour, atta: 90 g, 288 kcal, 9.5 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Ghee' }));
    // Remove stands out in red.
    expect(screen.getByText('Remove')).toHaveStyle({ color: LIGHT_COLORS.danger });
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('Ghee')).toBeNull();
    expect(screen.getByLabelText('Total: 288 kcal, 9.5 g protein')).toBeOnTheScreen();
  });

  it('REQ-LOG-003 saving keeps the date, meal type and tags, syncs the meal, and goes back', async () => {
    const { db, server } = await render({ day: '2026-10-26' });
    await addFood('atta', /^Wheat flour, atta/, '60');
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Before training' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const rows = await db.getAllAsync<{ id: string; day: string; meal_type: string; tags: string; kcal: number }>(
      'SELECT id, day, meal_type, tags, kcal FROM meals',
      [],
    );
    expect(rows).toEqual([{ id: expect.any(String), day: '2026-10-26', meal_type: 'snack', tags: '["before_training"]', kcal: 192 }]);
    await waitFor(() => expect(server.entries('meals').get(rows[0]!.id)).toMatchObject({ deleted: false, mealType: 'snack' }));
  });

  it('REQ-LOG-004 the AI box says AI meal reading is coming soon (D-26), and the tips are shown (REQ-LOG-008)', async () => {
    await render();

    expect(await screen.findByText('AI meal reading is coming soon')).toBeOnTheScreen();
    expect(
      screen.getByText('Tips: give amounts in grams; say whether a food is raw or cooked; add each food separately.'),
    ).toBeOnTheScreen();
    // The cooked-rice example has no supporting source (D-26 answer 3, amended 2026-10-30).
    expect(screen.queryByText(/cooked rice weighs/)).toBeNull();
  });
});

describe('what Log meal says about missing values', () => {
  it('Save meal says to add a food first', async () => {
    await render();

    expect(await screen.findByText('Add at least one food to save the meal.')).toBeOnTheScreen();
    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(screen.queryByText('Add at least one food to save the meal.')).toBeNull();
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
    expect(screen.getByRole('checkbox', { name: 'Dessert' })).toBeChecked();
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
    expect(await screen.findByRole('button', { name: 'Test flatbread, dish, 120 kcal per piece, estimated' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Test dal, dish, 150 kcal per katori (200 ml), estimated' })).toBeOnTheScreen();

    // A dish the server does not list (not approved, or blocked) is never on the phone.
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'chicken curry');
    expect(await screen.findByText('No foods found. Try another word, or enter your own food.')).toBeOnTheScreen();
  });

  it('a dish is added in portions, in halves from 0.5 to 10, with its values for that many', async () => {
    await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('flatbread', /^Test flatbread, dish/);

    expect(screen.getByText('One portion is one piece: 120 kcal · 3.6 g protein (estimated)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Portions: 1')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Grams eaten')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Half a portion fewer' }));
    expect(screen.getByLabelText('Portions: 0.5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Half a portion fewer' })).toBeDisabled();
    expect(screen.getByLabelText('Adds 60 kcal and 1.8 g protein')).toBeOnTheScreen();

    for (let press = 0; press < 25; press += 1) await fireEvent.press(screen.getByRole('button', { name: 'Half a portion more' }));
    expect(screen.getByLabelText('Portions: 10')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Half a portion more' })).toBeDisabled();
    expect(screen.getByLabelText('Adds 1,200 kcal and 36.0 g protein')).toBeOnTheScreen();

    for (let press = 0; press < 17; press += 1) await fireEvent.press(screen.getByRole('button', { name: 'Half a portion fewer' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByLabelText('Test flatbread: 1.5 portions, 180 kcal, 5.4 g protein')).toBeOnTheScreen();
    expect(screen.getByText('1.5 portions · 180 kcal · 5.4 g protein · estimated')).toBeOnTheScreen();
  });

  it('the review can change a dish’s portions, and a food’s grams as before', async () => {
    await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('dal', /^Test dal, dish/);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await addFood('atta', /^Wheat flour, atta/, '60');
    expect(screen.getByLabelText('Total: 342 kcal, 14.3 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Test dal' }));
    expect(screen.getByLabelText('Portions: 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Half a portion more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 1.5 portions' }));

    expect(screen.getByLabelText('Test dal: 1.5 portions, 225 kcal, 12.0 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wheat flour, atta: 60 g, 192 kcal, 6.3 g protein')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total: 417 kcal, 18.3 g protein')).toBeOnTheScreen();
  });

  it('saving keeps the dish as logged: its code, the portions and their values, estimated', async () => {
    const { db, server } = await render({ day: TODAY }, withDishes);
    await screen.findByRole('button', { name: 'Search foods' });
    await chooseDish('dal', /^Test dal, dish/);
    await fireEvent.press(screen.getByRole('button', { name: 'Half a portion more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Dinner' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
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
  await fireEvent.press(screen.getByRole('radio', { name: 'glass' }));
  for (let press = 0; press < more; press += 1) await fireEvent.press(screen.getByRole('button', { name: 'Half a glass more' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

describe('D-36 household units', () => {
  it('a food with a unit offers Grams and the unit; a unit is counted in halves, its values for the grams it comes to', async () => {
    await render({ day: TODAY }, withMilk);
    await chooseMilk();

    expect(screen.getByRole('radio', { name: 'Grams' })).toBeChecked();
    expect(screen.getByLabelText('Grams eaten')).toHaveDisplayValue('100');
    await fireEvent.press(screen.getByRole('radio', { name: 'glass' }));

    expect(screen.getByRole('radio', { name: 'glass' })).toBeChecked();
    expect(screen.queryByLabelText('Grams eaten')).toBeNull();
    expect(screen.getByLabelText('Glasses: 1')).toBeOnTheScreen();
    expect(screen.getByText('One glass (250 ml) is 258 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adds 188 kcal and 8.4 g protein')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Half a glass fewer' }));
    expect(screen.getByLabelText('Glasses: 0.5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Half a glass fewer' })).toBeDisabled();

    // 7.5 glasses is 1,935 g; 8 would pass 2,000 g, the most for one food.
    for (let press = 0; press < 20; press += 1) await fireEvent.press(screen.getByRole('button', { name: 'Half a glass more' }));
    expect(screen.getByLabelText('Glasses: 7.5')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Half a glass more' })).toBeDisabled();

    for (let press = 0; press < 12; press += 1) await fireEvent.press(screen.getByRole('button', { name: 'Half a glass fewer' }));
    expect(screen.getByLabelText('Adds 283 kcal and 12.6 g protein')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Milk, whole, Cow: 1.5 glasses (387 g), 283 kcal, 12.6 g protein')).toBeOnTheScreen();
  });

  it('a food without units is in grams only, as before', async () => {
    await render({ day: TODAY }, withMilk);
    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: /^Wheat flour, atta/ }));

    expect(screen.queryByRole('radio', { name: 'Grams' })).toBeNull();
    expect(screen.getByLabelText('Grams eaten')).toBeOnTheScreen();
  });

  it('the review changes a unit item’s count; the same food in the same unit joins it, and in grams stays apart (D-34)', async () => {
    await render({ day: TODAY }, withMilk);
    await addGlasses();

    await fireEvent.press(screen.getByRole('button', { name: 'Change Milk, whole, Cow' }));
    expect(screen.getByLabelText('Glasses: 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Half a glass more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Change to 1.5 glasses' }));
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

    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
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
