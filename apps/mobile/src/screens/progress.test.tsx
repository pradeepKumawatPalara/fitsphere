import type { MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { applyServerEntries, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { renderInApp } from '../testing/appHarness';
import { ProgressScreen } from './ProgressScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The Progress tab (REQ-PRG-001…003, REQ-PRG-005, REQ-PRG-006; D-30). Today is Wednesday
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

    expect(await screen.findByLabelText(/^Latest weigh-in · Wed 28 Oct: /)).toBeOnTheScreen();
    // On the card, and as the lowest value on the chart's scale.
    // The card's weight has no unit: it is in the heading ("Weight over 4 weeks · kg"); the week table's has it.
    expect(screen.getByText('Weight over 4 weeks · kg')).toBeOnTheScreen();
    expect(screen.getAllByText('78.8 kg')).toHaveLength(1);
    expect(screen.getByLabelText('Down 1.2 kg since Wed 30 Sep')).toBeOnTheScreen();
    expect(screen.getByLabelText('Down 0.3 kg a week')).toBeOnTheScreen();
  });

  it('replaces the rate with the not-enough-data message with less than a week of weigh-ins', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'weighIn', weighIns({ '2026-10-25': 79_300, '2026-10-28': 78_800 }));
    });

    expect(await screen.findByLabelText('Down 0.5 kg since Sun 25 Oct')).toBeOnTheScreen();
    expect(screen.getByLabelText('Not enough data for a weekly rate yet. Log your weight for at least a week.')).toBeOnTheScreen();
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
      await applyServerEntries(db, 'target', [{ kind: 'calories', day: '2026-10-20', value: 2000, setAt: AT, setByUserId: null }]);
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
        { kind: 'calories', day: '2026-10-20', value: 2000, setAt: AT, setByUserId: null },
        { kind: 'protein', day: '2026-10-20', value: 120, setAt: AT, setByUserId: null },
        { kind: 'body_weight', day: '2026-10-20', value: 75_000, setAt: AT, setByUserId: null },
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

    expect(await screen.findByText('No measurements in the last 90 days.')).toBeOnTheScreen();
    expect(screen.getByText('Track your upper and lower waist once a week.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add first' }));
    expect(screen.getByLabelText('Date: Wed 28 Oct')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Upper waist (cm)'), '81.2');
    await fireEvent.changeText(screen.getByLabelText('Lower waist (cm)'), '84.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));

    expect(await screen.findByLabelText('Upper waist: 81.2 cm')).toBeOnTheScreen();
    expect(screen.getByText('Measurements · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add first' })).toBeNull();
    // Once there is an entry, no Add button: the pencil edits it.
    expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit measurements' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('measurements').get('2026-10-28')).toMatchObject({ upperWaistMm: 812 }));
  });

  it('shows the latest entry; all of them, the latest too, fold under "Show all measurements (N)", newest first, and each opens to edit', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'measurements', [
        { day: '2026-10-12', upperWaistMm: 820, lowerWaistMm: 850, ...NO_OPTIONAL, recordedAt: AT },
        { day: '2026-10-05', upperWaistMm: 825, lowerWaistMm: 855, ...NO_OPTIONAL, recordedAt: AT },
        { day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT },
      ]);
    });

    // Only the latest as a card; the older ones folded.
    const titles = await screen.findAllByText(/^Measurements · /);
    expect(titles.map((title) => title.props.children)).toEqual(['Measurements · Mon 26 Oct']);
    expect(screen.queryByRole('button', { name: /^Edit measurements, / })).toBeNull();

    // The owner, 2026-11-16: "(N)" counts every entry, so the table holds N rows.
    await fireEvent.press(screen.getByRole('button', { name: 'Show all measurements (3)' }));
    const rows = screen.getAllByRole('button', { name: /^Edit measurements, / });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Edit measurements, Mon 26 Oct: Upper waist 80.0 cm, Lower waist 83.0 cm',
      'Edit measurements, Mon 12 Oct: Upper waist 82.0 cm, Lower waist 85.0 cm',
      'Edit measurements, Mon 5 Oct: Upper waist 82.5 cm, Lower waist 85.5 cm',
    ]);

    await fireEvent.press(rows[1]!);
    expect(screen.getByLabelText('Date: Mon 12 Oct')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Upper waist (cm)'), '81.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));

    expect(
      await screen.findByRole('button', { name: 'Edit measurements, Mon 12 Oct: Upper waist 81.5 cm, Lower waist 85.0 cm' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Upper waist: 80.0 cm')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByRole('button', { name: /^Edit measurements, / })).toBeNull();
  });

  it('with two entries, "Show all measurements (2)" lists both (the owner, 2026-11-16)', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'measurements', [
        { day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT },
        { day: '2026-10-19', upperWaistMm: 810, lowerWaistMm: 840, ...NO_OPTIONAL, recordedAt: AT },
      ]);
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (2)' }));

    expect(screen.getAllByRole('button', { name: /^Edit measurements, / })).toHaveLength(2);
  });

  it('with an entry, the heading has no Add measurements button, only the pencil on the card', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'measurements', [{ day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT }]);
    });

    await screen.findByRole('header', { name: 'Measurements' });
    expect(screen.queryByRole('button', { name: 'Add measurements' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit measurements' })).toBeOnTheScreen();
  });

  it('with one entry, shows it, and "Show all measurements (1)" leads to other dates (D-114)', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await applyServerEntries(db, 'measurements', [{ day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT }]);
    });

    expect(await screen.findByText('Measurements · Mon 26 Oct')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all measurements (1)' }));
    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
  });

  it('shows lengths in the cm/in unit last chosen on this phone', async () => {
    await renderInApp(<ProgressScreen />, undefined, async (db) => {
      await setMeta(db, 'measurement_unit', 'in');
      await applyServerEntries(db, 'measurements', [{ day: '2026-10-26', upperWaistMm: 813, lowerWaistMm: 846, ...NO_OPTIONAL, recordedAt: AT }]);
    });

    expect(await screen.findByLabelText('Upper waist: 32.0 in')).toBeOnTheScreen();
  });
});

// D-114 (the owner's B on the canvas): the last 90 days at first; other dates from a row of choices,
// days older than the phone's 90 read online. Today is Wed 28 Oct 2026, so the phone's 90 days are
// Fri 31 Jul to Wed 28 Oct.
describe('D-114 measurements by dates', () => {
  const RECENT = { day: '2026-10-26', upperWaistMm: 800, lowerWaistMm: 830, ...NO_OPTIONAL, recordedAt: AT };
  const rowNames = () => screen.getAllByRole('button', { name: /^Edit measurements, / }).map((row) => row.props.accessibilityLabel);

  async function renderWithOlder(recent = true) {
    return renderInApp(<ProgressScreen />, undefined, async (db, server) => {
      if (recent) await applyServerEntries(db, 'measurements', [RECENT]);
      server.storeMeasurementsFromElsewhere('2024-03-03', 940, 995);
      server.storeMeasurementsFromElsewhere('2024-12-15', 910, 965);
      server.storeMeasurementsFromElsewhere('2026-03-01', 880, 930);
      server.storeMeasurementsFromElsewhere('2026-07-05', 860, 910);
    });
  }

  it('unfolded, shows the last 90 days with a count line; the choices are Pick dates, Last 90 days and each year back to 2000', async () => {
    const { server } = await renderWithOlder();

    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    expect(screen.getAllByRole('radio').map((choice) => choice.props.accessibilityLabel).slice(0, 4)).toEqual(['Pick dates', 'Last 90 days', '2026', '2025']);
    expect(screen.getByRole('radio', { name: '2000' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
    expect(screen.getByText('1 measurement · Fri 31 Jul – Wed 28 Oct')).toBeOnTheScreen();
    expect(rowNames()).toEqual(['Edit measurements, Mon 26 Oct: Upper waist 80.0 cm, Lower waist 83.0 cm']);
    // The last 90 days are the phone's: nothing is read online.
    expect(server.state.measurementQueries).toEqual([]);
  });

  it('a year shows its measurements, read online, newest first with their year; Show fewer goes back to the last 90 days', async () => {
    const { server } = await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));

    expect(await screen.findByText('2 measurements · Mon 1 Jan 2024 – Tue 31 Dec 2024')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '2024' })).toBeChecked();
    expect(rowNames()).toEqual([
      'Edit measurements, Sun 15 Dec 2024: Upper waist 91.0 cm, Lower waist 96.5 cm',
      'Edit measurements, Sun 3 Mar 2024: Upper waist 94.0 cm, Lower waist 99.5 cm',
    ]);
    expect(server.state.measurementQueries).toEqual([{ from: '2024-01-01', to: '2024-12-31', cursor: null }]);

    await fireEvent.press(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.queryByRole('radio')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all measurements (1)' }));
    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
  });

  it('this year reads online only the days before the phone’s 90, and lists them with the phone’s', async () => {
    const { server } = await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: '2026' }));

    expect(await screen.findByText('3 measurements · Thu 1 Jan – Wed 28 Oct')).toBeOnTheScreen();
    expect(rowNames().map((name) => name.split(':')[0])).toEqual([
      'Edit measurements, Mon 26 Oct',
      'Edit measurements, Sun 5 Jul',
      'Edit measurements, Sun 1 Mar',
    ]);
    expect(server.state.measurementQueries).toEqual([{ from: '2026-01-01', to: '2026-07-30', cursor: null }]);
  });

  it('reads every page the server sends', async () => {
    const { server } = await renderWithOlder();
    server.state.measurementsPageSize = 1;
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));

    expect(await screen.findByText('2 measurements · Mon 1 Jan 2024 – Tue 31 Dec 2024')).toBeOnTheScreen();
    expect(server.state.measurementQueries.map((query) => query.cursor)).toEqual([null, '1']);
  });

  it('a year with none says so', async () => {
    await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: '2023' }));

    expect(await screen.findByText('No measurements from Sun 1 Jan 2023 to Sun 31 Dec 2023.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Edit measurements, / })).toBeNull();
  });

  it('offline, says older measurements need the internet; Try again loads them once online', async () => {
    const { server } = await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));
    server.state.offline = true;

    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));

    expect(await screen.findByText('Measurements older than 90 days need an internet connection.')).toBeOnTheScreen();
    server.state.offline = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 measurements · Mon 1 Jan 2024 – Tue 31 Dec 2024')).toBeOnTheScreen();
  });

  it('a server error says these could not load, with Try again', async () => {
    const { server } = await renderWithOlder();
    server.state.measurementsFailWith = 500;
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));

    expect(await screen.findByText('Couldn’t load these measurements.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('Pick dates: From and To open the calendar, a To before From moves From, and Show lists those dates', async () => {
    const { server } = await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Pick dates' }));
    expect(screen.getByText('Measurements older than 90 days load online.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'From: Fri 31 Jul. Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wednesday 1 July 2026' }));
    expect(screen.getByRole('button', { name: 'From: Wed 1 Jul. Change' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'To: Wed 28 Oct. Change' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'To: Wed 28 Oct. Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Friday 3 July 2026' }));
    expect(screen.getByRole('button', { name: 'To: Fri 3 Jul. Change' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'To: Fri 3 Jul. Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 29 June 2026' }));
    // To before From: From moves to it.
    expect(screen.getByRole('button', { name: 'From: Mon 29 Jun. Change' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'To: Mon 29 Jun. Change' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'From: Mon 29 Jun. Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sunday 1 March 2026' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByText('1 measurement · Sun 1 Mar – Mon 29 Jun')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Pick dates' })).toBeChecked();
    expect(rowNames()).toEqual(['Edit measurements, Sun 1 Mar: Upper waist 88.0 cm, Lower waist 93.0 cm']);
    expect(server.state.measurementQueries).toEqual([{ from: '2026-03-01', to: '2026-06-29', cursor: null }]);
  });

  it('Cancel leaves the dates as they were', async () => {
    await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Pick dates' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
    expect(screen.getByText('1 measurement · Fri 31 Jul – Wed 28 Oct')).toBeOnTheScreen();
  });

  it('with none in the last 90 days, Older measurements opens the choices, and a year lists its measurements', async () => {
    await renderWithOlder(false);

    expect(await screen.findByText('No measurements in the last 90 days.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Show all measurements/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Older measurements' }));

    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
    expect(screen.getByText('No measurements from Fri 31 Jul to Wed 28 Oct.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Older measurements' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));
    expect(await screen.findByText('2 measurements · Mon 1 Jan 2024 – Tue 31 Dec 2024')).toBeOnTheScreen();
  });

  it('an older entry opens to edit, and the list shows the change', async () => {
    await renderWithOlder();
    await fireEvent.press(await screen.findByRole('button', { name: 'Show all measurements (1)' }));
    await fireEvent.press(screen.getByRole('radio', { name: '2024' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Edit measurements, Sun 15 Dec 2024: Upper waist 91.0 cm, Lower waist 96.5 cm' }));
    expect(screen.getByLabelText('Date: Sun 15 Dec 2024')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('Upper waist (cm)').props.value).toBe('91.0'));
    await fireEvent.changeText(screen.getByLabelText('Upper waist (cm)'), '90.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Save measurements' }));

    expect(
      await screen.findByRole('button', { name: 'Edit measurements, Sun 15 Dec 2024: Upper waist 90.5 cm, Lower waist 96.5 cm' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '2024' })).toBeChecked();
  });
});
