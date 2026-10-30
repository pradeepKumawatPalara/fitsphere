import type { MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { applyServerEntries, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The Progress tab (REQ-PRG-001…003, REQ-PRG-005, REQ-PRG-006; D-P1). Today is Wednesday
// 28 October 2026; its week is Mon 26 Oct – Sun 1 Nov. Synthetic values only.

const AT = '2026-10-20T03:00:00.000Z';
const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };
let ids = 0;

function meal(day: string, kcal: number, proteinG: number) {
  ids += 1;
  const item: MealItem = {
    source: 'own',
    ref: null,
    name: 'Synthetic meal',
    amount: { unit: 'g', value: 100 },
    kcal,
    proteinG,
    carbsG: null,
    fatG: null,
    fibreG: null,
    estimated: false,
  };
  return {
    deleted: false,
    id: `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`,
    day,
    mealType: 'lunch' as const,
    tags: [],
    items: [item],
    recordedAt: AT,
  };
}

function weighIns(entries: Record<string, number>) {
  return Object.entries(entries).map(([day, weightGrams]) => ({ day, weightGrams, recordedAt: AT }));
}

/** An account created on 1 August 2026, so the 28-day count and all 12 weeks apply. */
async function olderAccount(db: SqlDb) {
  await setMeta(db, 'account_created_day', '2026-08-01');
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

describe('REQ-PRG-001 weight over 4 weeks', () => {
  it('shows the latest weigh-in, the change since the one nearest 28 days back and the weekly rate', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await olderAccount(db);
      await applyServerEntries(db, 'weighIn', weighIns({ '2026-09-30': 80_000, '2026-10-14': 79_000, '2026-10-28': 78_800 }));
    });

    expect(await screen.findByText('78.8 kg')).toBeOnTheScreen();
    expect(screen.getByText('Latest weigh-in · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Down 1.2 kg since Wed 30 Sep')).toBeOnTheScreen();
    expect(screen.getByText('Down 0.3 kg a week')).toBeOnTheScreen();
  });

  it('replaces the rate with the not-enough-data message with less than a week of weigh-ins', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'weighIn', weighIns({ '2026-10-25': 79_300, '2026-10-28': 78_800 }));
    });

    expect(await screen.findByText('Down 0.5 kg since Sun 25 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Not enough data for a weekly rate yet. Log your weight for at least a week.')).toBeOnTheScreen();
  });

  it('says so with no weigh-ins, and "All weigh-ins" opens the weight history', async () => {
    await renderInApp(<ProgressScreen />);

    expect(await screen.findByText('No weigh-ins yet. Log your weight on Home.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'All weigh-ins' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/weight-history');
  });
});

describe('REQ-PRG-002 and REQ-PRG-003 the last 4 weeks of eating', () => {
  it('averages the days with meals against the calorie target, and counts the days logged', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await olderAccount(db);
      await applyServerEntries(db, 'meal', [
        meal('2026-09-30', 9000, 1),
        meal('2026-10-20', 1500, 80),
        meal('2026-10-27', 1000, 40),
        meal('2026-10-27', 1000, 50),
        meal('2026-10-28', 1700, 90),
      ]);
      await applyServerEntries(db, 'target', [{ kind: 'calories', value: 2000, setAt: AT, setByUserId: null }]);
    });

    expect(await screen.findByText('1,733 kcal a day')).toBeOnTheScreen();
    expect(screen.getByText('Target 2,000 kcal a day')).toBeOnTheScreen();
    expect(screen.getByText('Meals logged: 3 of 28 days')).toBeOnTheScreen();
  });

  it('with nothing logged and no target, says so and offers "Set a target"; a new account counts from today', async () => {
    await renderInApp(<ProgressScreen />);

    expect(await screen.findByText('No meals logged in the last 4 weeks.')).toBeOnTheScreen();
    expect(screen.getByText('No calorie target')).toBeOnTheScreen();
    // The fake account was created today (GET /v1/me).
    expect(await screen.findByText('Meals logged: 0 of 1 day')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set a target' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/targets');
  });
});

describe('REQ-PRG-005 week by week', () => {
  it('shows the Target row and each week’s averages over the days with entries', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await olderAccount(db);
      await applyServerEntries(db, 'weighIn', weighIns({ '2026-10-26': 80_000, '2026-10-27': 80_500, '2026-10-20': 81_000 }));
      await applyServerEntries(db, 'meal', [meal('2026-10-27', 1800, 90.5), meal('2026-10-28', 2200, 100)]);
      await applyServerEntries(db, 'steps', [
        { day: '2026-10-26', steps: 8000, recordedAt: AT },
        { day: '2026-10-28', steps: 10_000, recordedAt: AT },
      ]);
      await applyServerEntries(db, 'target', [
        { kind: 'calories', value: 2000, setAt: AT, setByUserId: null },
        { kind: 'protein', value: 120, setAt: AT, setByUserId: null },
        { kind: 'body_weight', value: 75_000, setAt: AT, setByUserId: null },
      ]);
    });

    expect(await screen.findByLabelText('Target: weight 75.0 kg, 2,000 kcal, 120 g protein, no steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('This week: weight 80.3 kg, 2,000 kcal, 95 g protein, 9,000 steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('19 Oct: weight 81.0 kg, no calories, no protein, no steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('10 Aug: no weight, no calories, no protein, no steps')).toBeOnTheScreen();
    // The heading row is hidden from screen readers; each row reads out in full.
    expect(screen.getByText('Weight (kg)', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('starts at the week the account was created', async () => {
    await renderInApp(<ProgressScreen />);

    expect(await screen.findByLabelText('This week: no weight, no calories, no protein, no steps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Target: no weight, no calories, no protein, no steps')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByLabelText(/^19 Oct:/)).toBeNull());
  });
});

describe('REQ-PRG-006 measurements', () => {
  it('with none, recommends weekly waist tracking; "Add first" opens the sheet on today and the entry is listed', async () => {
    const { server } = await renderInApp(<ProgressScreen />);

    expect(await screen.findByText('No measurements yet.')).toBeOnTheScreen();
    expect(screen.getByText('Track your upper and lower waist once a week.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add first' }));
    expect(screen.getByLabelText('Date: Wed 28 Oct')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Upper waist (cm)'), '81.2');
    await fireEvent.changeText(screen.getByLabelText('Lower waist (cm)'), '84.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));

    expect(await screen.findByLabelText('Upper waist: 81.2 cm')).toBeOnTheScreen();
    expect(screen.getByText('Measurements · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add first' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add measurements' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ upperWaistMm: 812 }));
  });

  it('lists the entries newest first; "Edit measurements" corrects that date’s entry', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'measurements', [
        { day: '2026-10-12', upperWaistMm: 820, lowerWaistMm: 850, ...NO_OPTIONAL, recordedAt: AT },
        { day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT },
      ]);
    });

    const titles = await screen.findAllByText(/^Measurements · /);
    expect(titles.map((title) => title.props.children)).toEqual([
      ['Measurements · ', 'Mon 26 Oct'],
      ['Measurements · ', 'Mon 12 Oct'],
    ]);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Edit measurements' })[1]!);
    expect(screen.getByLabelText('Date: Mon 12 Oct')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Upper waist (cm)'), '81.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));

    expect(await screen.findByLabelText('Upper waist: 81.5 cm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Upper waist: 80.0 cm')).toBeOnTheScreen();
  });

  it('shows lengths in the cm/in unit last chosen on this phone', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await setMeta(db, 'measurement_unit', 'in');
      await applyServerEntries(db, 'measurements', [{ day: '2026-10-26', upperWaistMm: 813, lowerWaistMm: 846, ...NO_OPTIONAL, recordedAt: AT }]);
    });

    expect(await screen.findByLabelText('Upper waist: 32.0 in')).toBeOnTheScreen();
  });
});
