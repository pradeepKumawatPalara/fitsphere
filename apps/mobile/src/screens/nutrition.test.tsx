import type { MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { describeRejected } from '../components/RejectedChanges';
import { listSavedMeals, saveEntry, type OutboxEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { HomeScreen } from './HomeScreen';
import { NutritionScreen } from './NutritionScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockParams: { tab?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// Nutrition (REQ-NUT-001…004, REQ-PLAN-007, REQ-SAVED-001/002), and the Home parts that use meals
// (REQ-HOME-002…005, REQ-NAV-003). Today is Wednesday 28 October 2026. Synthetic values only.

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
const GHEE: MealItem = { ...ATTA, ref: 'T013', name: 'Ghee', amount: { unit: 'g', value: 5 }, kcal: 45, proteinG: 0, carbsG: 0, fatG: 5, fibreG: 0, estimated: true };
const BAR: MealItem = { ...ATTA, source: 'own', ref: null, name: 'Synthetic bar', kcal: 180, proteinG: 4, carbsG: 24, fatG: 8, fibreG: null };

let ids = 0;
function id(): string {
  ids += 1;
  return `00000000-0000-4000-a000-${String(ids).padStart(12, '0')}`;
}

async function meal(db: SqlDb, fields: { day?: string; mealType?: 'breakfast' | 'lunch' | 'snack' | 'dinner'; tags?: ('dessert' | 'before_training')[]; items?: MealItem[] } = {}) {
  const mealId = id();
  await saveEntry(db, 'meal', {
    changeId: id(),
    data: { id: mealId, day: fields.day ?? TODAY, mealType: fields.mealType ?? 'lunch', tags: fields.tags ?? [], items: fields.items ?? [ATTA], recordedAt: AT },
  });
  return mealId;
}

/** Opens a meal slot, whose meals are folded at first (D-34). */
async function open(slot: string) {
  await fireEvent.press(await screen.findByRole('button', { name: `Show ${slot} meals` }));
}

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  delete mockParams.tab;
});

describe('REQ-NUT-001 Nutrition tabs', () => {
  it('REQ-PLAN-007 the Diet plan tab shows its empty state (D-20)', async () => {
    await renderInApp(<NutritionScreen />);

    await fireEvent.press(await screen.findByRole('tab', { name: 'Diet plan' }));

    expect(screen.getByText('No diet plan yet. Your coach will add one here.')).toBeOnTheScreen();
  });

  it('Q-023 opens on Consumed, and on the tab named by the link that opened it', async () => {
    mockParams.tab = 'saved';
    await renderInApp(<NutritionScreen />);

    expect(await screen.findByRole('tab', { name: 'Saved' })).toBeSelected();
  });
});

describe('REQ-NUT-002 and REQ-NUT-003 Consumed', () => {
  it('REQ-NUT-002 with nothing logged every value is a dash, and each slot invites a meal', async () => {
    await renderInApp(<NutritionScreen />);

    expect(await screen.findByLabelText('Eaten: –')).toBeOnTheScreen();
    for (const nutrient of ['Protein', 'Carbs', 'Fat', 'Fibre']) expect(screen.getByLabelText(`${nutrient}: –`)).toBeOnTheScreen();
    expect(screen.getAllByText('Tap to add what you ate')).toHaveLength(4);
  });

  it('REQ-NUT-003 a slot’s "+" opens Log meal preset to that slot and the selected date', async () => {
    await renderInApp(<NutritionScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Add to Dinner' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/log-meal', params: { day: TODAY, slot: 'dinner' } });
  });

  it('REQ-NUT-002 the summary adds up the day’s meals; each meal shows in its slot with its tags (Q-031)', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db, { mealType: 'lunch', tags: ['dessert'], items: [ATTA, GHEE] });
      await meal(db, { mealType: 'snack', items: [BAR] });
      await meal(db, { day: '2026-10-27', items: [ATTA] });
    });

    expect(await screen.findByLabelText('Eaten: 417 kcal')).toBeOnTheScreen();
    expect(screen.getByLabelText('Protein: 10.3 g')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fibre: 6.8 g')).toBeOnTheScreen();
    // Each slot folded at first: its kcal, its meals and its foods (D-34).
    expect(screen.getByText('237 kcal · 1 meal')).toBeOnTheScreen();
    expect(screen.getByText('Wheat flour, atta, Ghee')).toBeOnTheScreen();
    expect(screen.getByText('180 kcal · 1 meal')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Edit Lunch/ })).toBeNull();
    await open('Lunch');
    expect(screen.getByRole('button', { name: 'Edit Lunch: Wheat flour, atta + 1 more' })).toBeOnTheScreen();
    expect(screen.getByText('Dessert')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Edit Snack: Synthetic bar' })).toBeNull();
    await open('Snack');
    expect(screen.getByRole('button', { name: 'Edit Snack: Synthetic bar' })).toBeOnTheScreen();
    expect(screen.getAllByText('Tap to add what you ate')).toHaveLength(2);
  });

  it('Q-019 the week strip fills the status box of each day with a meal', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db, { day: '2026-10-27' });
    });

    expect(await screen.findByRole('button', { name: 'Tuesday 27 Oct, meal logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Monday 26 Oct' })).toBeOnTheScreen();
    expect(screen.getByTestId('status-2026-10-27')).toHaveStyle({ backgroundColor: '#2e7d32' });
  });
});

describe('D-34 meal slots fold and open', () => {
  it('a slot opens to each meal with the time it was saved, in India time, and closes again', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db, { mealType: 'breakfast', items: [ATTA] });
      await meal(db, { mealType: 'breakfast', items: [GHEE] });
    });

    expect(await screen.findByText('237 kcal · 2 meals')).toBeOnTheScreen();
    const show = screen.getByRole('button', { name: 'Show Breakfast meals' });
    expect(show).toHaveStyle({ width: 44, height: 44 });
    await fireEvent.press(show);

    expect(screen.getAllByText('Saved 9:00 am')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hide Breakfast meals' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Hide Breakfast meals' }));
    expect(screen.queryByText('Saved 9:00 am')).toBeNull();
    expect(screen.getByText('Wheat flour, atta, Ghee')).toBeOnTheScreen();
  });

  it('a closed slot lists five foods, then how many more', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db, {
        mealType: 'dinner',
        items: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => ({ ...ATTA, ref: `X${letter}`, name: `Food ${letter}` })),
      });
    });

    expect(await screen.findByText('Food A, Food B, Food C, Food D, Food E + 2 more')).toBeOnTheScreen();
  });

  it('opened slots close again when the day changes', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db);
    });
    await open('Lunch');
    expect(screen.getByRole('button', { name: 'Hide Lunch meals' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Wednesday 28 Oct, today, meal logged' }));

    expect(await screen.findByRole('button', { name: 'Show Lunch meals' })).toBeOnTheScreen();
  });
});

describe('REQ-NUT-004 the meal card’s actions', () => {
  it('REQ-NUT-004 Delete asks first, then removes the meal and sends the deletion', async () => {
    let mealId = '';
    const { server } = await renderInApp(<NutritionScreen />, undefined, async (db) => {
      mealId = await meal(db);
    });
    await waitFor(() => expect(server.entries('meals').get(mealId)).toMatchObject({ deleted: false }));

    await open('Lunch');
    const remove = await screen.findByRole('button', { name: 'Delete Lunch: Wheat flour, atta' });
    // The icons are 44 to tap; Delete's stands out in the "over" red from Edit's blue.
    expect(remove).toHaveStyle({ width: 44, height: 44 });
    expect(within(remove).getByText(/./)).toHaveStyle({ color: LIGHT_COLORS.over });
    expect(within(screen.getByRole('button', { name: 'Edit Lunch: Wheat flour, atta' })).getByText(/./)).toHaveStyle({
      color: LIGHT_COLORS.primary,
    });
    await fireEvent.press(remove);
    expect(screen.getByText('Delete this meal?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Delete Lunch/ })).toBeNull());
    await waitFor(() => expect(server.entries('meals').get(mealId)).toMatchObject({ deleted: true }));
  });

  it('REQ-NUT-004 Cancel keeps the meal', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db);
    });

    await open('Lunch');
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Lunch: Wheat flour, atta' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete Lunch: Wheat flour, atta' })).toBeOnTheScreen();
    expect(screen.queryByText('Delete this meal?')).toBeNull();
  });

  it('REQ-NUT-004 Edit opens Log meal with the meal', async () => {
    let mealId = '';
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      mealId = await meal(db);
    });

    await open('Lunch');
    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Lunch: Wheat flour, atta' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/log-meal', params: { mealId } });
  });

  it('REQ-NUT-004 "Save to my meals" keeps a copy, named from its foods, in Saved', async () => {
    const { db } = await renderInApp(<NutritionScreen />, undefined, async (seed) => {
      await meal(seed, { mealType: 'dinner', tags: ['before_training'], items: [ATTA, GHEE] });
    });

    await open('Dinner');
    await fireEvent.press(await screen.findByRole('button', { name: 'Save Dinner: Wheat flour, atta + 1 more to my meals' }));
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Wheat flour, atta + 1 more');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Two rotis with ghee');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await listSavedMeals(db)).toHaveLength(1));
    expect((await listSavedMeals(db))[0]).toMatchObject({ name: 'Two rotis with ghee', mealType: 'dinner', tags: ['before_training'], kcal: 237 });
    await fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));
    expect(await screen.findByRole('button', { name: 'Two rotis with ghee' })).toBeOnTheScreen();
  });
});

describe('REQ-SAVED-001 and REQ-SAVED-002 Saved', () => {
  async function seedSaved(db: SqlDb) {
    await saveEntry(db, 'savedMeal', {
      changeId: id(),
      data: { id: id(), name: 'Synthetic dinner', mealType: 'dinner', tags: [], items: [ATTA, GHEE], savedAt: AT },
    });
  }

  it('REQ-SAVED-002 with no saved meals, explains how to save one', async () => {
    await renderInApp(<NutritionScreen />);

    await fireEvent.press(await screen.findByRole('tab', { name: 'Saved' }));

    expect(screen.getByText('No saved meals yet. In Consumed, tap the bookmark on a meal to save it to your meals.')).toBeOnTheScreen();
  });

  it('Q-036 tapping a saved meal re-logs it to the selected date, in its slot unless the user changes it', async () => {
    const { db } = await renderInApp(<NutritionScreen />, undefined, seedSaved);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Saved' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Synthetic dinner' }));
    expect(screen.getByText('To Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Dinner' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Breakfast' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log meal' }));

    await waitFor(async () =>
      expect(await db.getAllAsync('SELECT day, meal_type, kcal FROM meals', [])).toEqual([
        { day: '2026-10-26', meal_type: 'breakfast', kcal: 237 },
      ]),
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Consumed' }));
    await open('Breakfast');
    expect(await screen.findByRole('button', { name: 'Edit Breakfast: Wheat flour, atta + 1 more' })).toBeOnTheScreen();
  });

  it('REQ-SAVED-001 an empty name says so, and Save waits', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await meal(db);
    });

    await open('Lunch');
    await fireEvent.press(await screen.findByRole('button', { name: 'Save Lunch: Wheat flour, atta to my meals' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), '  ');

    expect(screen.getByText('Enter a name.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('REQ-SAVED-001 a saved meal can be deleted, after confirming', async () => {
    const { db } = await renderInApp(<NutritionScreen />, undefined, seedSaved);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Saved' }));

    // A saved meal has only Delete; tapping the card logs it again.
    const remove = await screen.findByRole('button', { name: 'Delete Synthetic dinner' });
    expect(screen.queryByRole('button', { name: 'Edit Synthetic dinner' })).toBeNull();
    await fireEvent.press(remove);
    expect(screen.getByText('Delete this saved meal?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await listSavedMeals(db)).toEqual([]));
  });
});

describe('Home with meals (REQ-HOME-002…005, REQ-NAV-003)', () => {
  it('REQ-HOME-003 the calories and protein cards use the day’s meals', async () => {
    await renderInApp(<HomeScreen />, undefined, async (db) => {
      await meal(db, { items: [ATTA, GHEE] });
      await db.runAsync(
        `INSERT INTO targets (kind, value, set_at, set_by_user_id, sync_state) VALUES ('calories', 2000, ?, null, 'synced')`,
        [AT],
      );
    });

    expect(await screen.findByText('237 of 2,000 kcal')).toBeOnTheScreen();
    expect(screen.getByText('1,763 kcal remaining')).toBeOnTheScreen();
    expect(screen.getByText('6 g eaten')).toBeOnTheScreen();
  });

  it('REQ-HOME-002 the week strip fills the box of days with a meal (Q-019)', async () => {
    await renderInApp(<HomeScreen />, undefined, async (db) => {
      await meal(db);
    });

    expect(await screen.findByRole('button', { name: 'Wednesday 28 Oct, today, meal logged' })).toBeOnTheScreen();
  });

  it('REQ-HOME-005 "By meal" opens Nutrition › Consumed for the day (Q-023)', async () => {
    await renderInApp(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'By meal' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/nutrition', params: { tab: 'consumed' } });
  });

  it('REQ-NAV-003 "+" on Home and Nutrition opens Log meal on the selected date (Q-011)', async () => {
    await renderInApp(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Log a meal' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/log-meal', params: { day: '2026-10-26' } });
  });

  it('ADR-0007 rule 2 a rejected meal says so on Home, and Edit opens it in Log meal', async () => {
    const { server } = await renderInApp(<HomeScreen />, undefined, async (db, fake) => {
      fake.state.rejectWith = 'VALIDATION_FAILED';
      await meal(db);
    });

    const item = await screen.findByText("This meal wasn't saved: the value is not valid. Edit or discard it.");
    server.state.rejectWith = null;
    await fireEvent.press(within(item.parent!).getByRole('button', { name: 'Edit' }));

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/log-meal', params: { mealId: expect.any(String) } });
  });

  it('ADR-0007 rule 2 a rejected deletion offers Discard only', () => {
    const deletion: OutboxEntry = {
      changeId: 'c',
      type: 'meal.delete',
      data: { id: 'x', deletedAt: AT },
      createdAt: AT,
      attempts: 1,
      status: 'rejected',
      errorCode: 'ROLE_NOT_ENABLED',
    };
    expect(describeRejected(deletion, 'kg')).toEqual({ what: 'A meal', notSaved: "This meal wasn't deleted" });
  });
});
