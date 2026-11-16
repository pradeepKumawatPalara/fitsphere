import type { MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { FUTURE_DAY, OLDER_MONTH_TEXTS } from '../components/CalendarSheet';
import { OLDER_DAY_TEXTS } from '../components/ShowingDayBanner';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { saveEntry } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets } from '../testing/exercises';
import { LIGHT_COLORS } from '../theme';
import { AccountScreen } from './AccountScreen';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The header's calendar (REQ-NAV-002, REQ-DATE-001), back to any date (D-106; it stopped at the
// phone's 90 days, D-23). Today is Wednesday 28 October 2026; the phone's 90 days start on Friday
// 31 July 2026; older days are read from the server when shown.

async function renderHome() {
  return renderInApp(
    <>
      <HeaderTitle />
      <HeaderActions />
      <HomeScreen />
    </>,
  );
}

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

describe('REQ-NAV-002 calendar', () => {
  it('REQ-NAV-002 opens on the selected month; a future day is greyed and says why it cannot be picked (Q-017, D-34)', async () => {
    await renderHome();

    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    // Each day says what was logged on it (D-84), once the calendar has read the phone's days.
    expect(await screen.findByRole('button', { name: 'Wednesday 28 October 2026, today, Nothing logged' })).toBeSelected();
    const tomorrow = screen.getByRole('button', { name: 'Thursday 29 October 2026, not available' });
    expect(tomorrow).toBeDisabled();
    await fireEvent.press(tomorrow);
    expect(screen.getByRole('alert')).toHaveTextContent(FUTURE_DAY);
    expect(screen.getByText('October 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Selected date: Today · Wed 28 Oct')).toBeOnTheScreen();
  });

  it('D-34 browses up to 12 months ahead, every day there greyed', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    for (let month = 0; month < 12; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByText('October 2027')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Friday 1 October 2027, not available' })).toBeDisabled();
  });

  it('D-106 goes back past the 90 days the phone holds: an older month’s meals and workouts are read from the server', async () => {
    const { server } = await renderInApp(
      <>
        <HeaderTitle />
        <HeaderActions />
        <HomeScreen />
      </>,
      undefined,
      async (_, fake) => {
        fake.storeMealFromElsewhere({ id: '00000000-0000-4000-8000-00000000a001', day: '2025-03-12', mealType: 'lunch', tags: [], items: [OLD_FOOD], recordedAt: NOW.toISOString() });
        fake.storeWorkoutFromElsewhere('00000000-0000-4000-8000-00000000a002', '2025-03-14', [SQUAT]);
      },
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    // July 2026 holds the first of the 90 days: every day of it can be picked, and the months before.
    for (let month = 0; month < 3; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('July 2026')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Thursday 30 July 2026, Nothing logged' })).toBeEnabled();
    for (let month = 0; month < 16; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('March 2025')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Wednesday 12 March 2025, 1 meal logged' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Friday 14 March 2025, 1 workout logged' })).toBeEnabled();
    expect(screen.getByText('1 workout')).toBeOnTheScreen();
    expect(server.state.dayQueries).toContainEqual({ from: '2025-03-01', to: '2025-03-31' });
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();

    // Chosen, it shows on Home with its year, as a day of the phone's 90 does.
    await fireEvent.press(screen.getByRole('button', { name: 'Wednesday 12 March 2025, 1 meal logged' }));
    expect(await screen.findByText('Showing Wed 12 Mar 2025')).toBeOnTheScreen();
    expect(screen.getByLabelText('Selected date: Wed 12 Mar 2025')).toBeOnTheScreen();
    expect(await screen.findByLabelText('321 kcal eaten')).toBeOnTheScreen();
    expect(screen.queryByText(OLDER_DAY_TEXTS.loading)).toBeNull();
  });

  it('D-106 offline, an older month says so and marks nothing', async () => {
    const { server } = await renderInApp(
      <>
        <HeaderTitle />
        <HeaderActions />
        <HomeScreen />
      </>,
      undefined,
      async (_, fake) => {
        fake.storeMealFromElsewhere({ id: '00000000-0000-4000-8000-00000000a003', day: '2025-03-12', mealType: 'lunch', tags: [], items: [OLD_FOOD], recordedAt: NOW.toISOString() });
      },
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));
    server.state.offline = true;

    for (let month = 0; month < 19; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(await screen.findByText(OLDER_MONTH_TEXTS.offline)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 12 March 2025, Nothing logged' })).toBeEnabled();
  });

  it('REQ-DATE-001 choosing a day closes the calendar and selects it in the header, the banner and the week strip', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 5 October 2026, Nothing logged' }));

    await waitFor(() => expect(screen.queryByText('October 2026')).toBeNull());
    expect(screen.getByLabelText('Selected date: Mon 5 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Showing Mon 5 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Monday 5 Oct' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.getByLabelText('Selected date: Today · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
  });

  it('REQ-NAV-002 the avatar opens Account', async () => {
    await renderHome();

    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/account');
  });
});

// The header's calendar marks each day's meals and workouts (D-84; canvas "2.2 Calendar · workout
// days", C locked, then "2.2 Calendar · an apple for meals", B locked). Synthetic: meals on Mon 26 Oct (two) and Tue 27 Oct; a workout on Mon 26 Oct, two
// on Wed 21 Oct and one on Thu 10 Sep; on Thu 22 Oct a workout with no exercise, which no list shows (D-65).
const SQUAT = sameSets('Squat', 3, 10, 40_000);
/** A meal of an older day, on the server only (D-106). */
const OLD_FOOD: MealItem = { source: 'own', ref: null, name: 'Synthetic old dinner', amount: { unit: 'g', value: 100 }, kcal: 321, proteinG: 9, carbsG: null, fatG: null, fibreG: null, estimated: false };
const FOOD: MealItem = { source: 'own', ref: null, name: 'Synthetic food', amount: { unit: 'g', value: 100 }, kcal: 100, proteinG: 5, carbsG: null, fatG: null, fibreG: null, estimated: false };

async function renderWithDays() {
  return renderInApp(
    <>
      <HeaderTitle />
      <HeaderActions />
      <HomeScreen />
    </>,
    undefined,
    async (db, server) => {
      for (const [index, day] of ['2026-10-26', '2026-10-26', '2026-10-27'].entries()) {
        await saveEntry(db, 'meal', {
          changeId: `00000000-0000-4000-b000-0000000c000${index}`,
          data: { id: `00000000-0000-4000-8000-0000000c000${index}`, day, mealType: index === 0 ? 'breakfast' : 'lunch', tags: [], items: [FOOD], recordedAt: NOW.toISOString() },
        });
      }
      const workouts: [day: string, exercises: (typeof SQUAT)[]][] = [
        ['2026-10-26', [SQUAT]],
        ['2026-10-21', [SQUAT]],
        ['2026-10-21', [SQUAT]],
        ['2026-10-22', []],
        ['2026-09-10', [SQUAT]],
      ];
      for (const [index, [day, exercises]] of workouts.entries()) {
        server.storeWorkoutFromElsewhere(`00000000-0000-4000-a000-0000000c000${index}`, day, exercises);
      }
    },
  );
}

describe('D-84 the header calendar marks meals and workouts', () => {
  it('D-84 a day with a meal has an apple, a day with a workout a dumbbell, no day is tinted; each day says what was logged', async () => {
    await renderWithDays();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    const monday = await screen.findByRole('button', { name: 'Monday 26 October 2026, 2 meals logged, 1 workout logged' });
    const tuesday = screen.getByRole('button', { name: 'Tuesday 27 October 2026, 1 meal logged' });
    const wednesday = screen.getByRole('button', { name: 'Wednesday 21 October 2026, 2 workouts logged' });
    const empty = screen.getByRole('button', { name: 'Thursday 22 October 2026, Nothing logged' });
    // The days' own marks: Home's strip under the sheet marks this week's days too (D-103).
    expect(within(monday).getByTestId('meals-2026-10-26')).toBeOnTheScreen();
    expect(within(tuesday).getByTestId('meals-2026-10-27')).toBeOnTheScreen();
    expect(within(wednesday).queryByTestId('meals-2026-10-21')).toBeNull();
    expect(within(monday).getByTestId('workout-2026-10-26')).toBeOnTheScreen();
    expect(within(wednesday).getByTestId('workout-2026-10-21')).toBeOnTheScreen();
    expect(within(tuesday).queryByTestId('workout-2026-10-27')).toBeNull();
    // No green days (the owner, 2026-11-12): a day with meals keeps the plain background.
    for (const day of [monday, tuesday, wednesday]) expect(day).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.successTint });
    // A workout with no exercise is not marked (D-65).
    expect(within(empty).queryByTestId('workout-2026-10-22')).toBeNull();
    expect(screen.queryByTestId('meals-2026-10-22')).toBeNull();
    // The key under the days.
    expect(screen.getByLabelText('Key: an apple marks meals logged; a dumbbell marks a workout')).toBeOnTheScreen();
    expect(screen.getByText('Meals logged')).toBeOnTheScreen();
    expect(screen.getByText('Workout')).toBeOnTheScreen();
  });

  it('D-84 counts the month’s workouts under its name: the shown month’s only, a workout with no exercise left out', async () => {
    await renderWithDays();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    expect(await screen.findByText('3 workouts')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeOnTheScreen();
    expect(screen.getByText('1 workout')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('November 2026')).toBeOnTheScreen();
    expect(screen.getByText('No workouts')).toBeOnTheScreen();
  });
});

describe('D-106 the date strip goes back past the 90 days', () => {
  it('D-106 "Earlier days" goes on past the week holding the first of the 90 days, every day enabled', async () => {
    await renderHome();
    const earlier = await screen.findByRole('button', { name: 'Earlier days' });

    for (let week = 0; week < 14; week += 1) await fireEvent.press(earlier);

    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Monday 20 Jul' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Thursday 23 Jul' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sunday 26 Jul' })).toBeEnabled();
  });

  it('D-106 a day of the 90 in a week that starts before them is on the phone: no line, no dashes', async () => {
    const { server } = await renderHome();
    server.state.daysFailWith = 503;
    const earlier = await screen.findByRole('button', { name: 'Earlier days' });
    for (let week = 0; week < 13; week += 1) await fireEvent.press(earlier);

    await fireEvent.press(screen.getByRole('button', { name: 'Friday 31 Jul' }));

    expect(await screen.findByText('Showing Fri 31 Jul')).toBeOnTheScreen();
    // The week's days before the 90 (27 to 30 Jul) were asked for, and failed.
    await waitFor(() => expect(server.state.dayQueries).toContainEqual({ from: '2026-07-27', to: '2026-07-30' }));
    expect(screen.queryByText(OLDER_DAY_TEXTS.failed)).toBeNull();
    expect(screen.queryByLabelText('kcal eaten: not loaded')).toBeNull();
  });

  it('D-106 an older day not loaded: Try again and dashes, then its data; offline the banner says so', async () => {
    const { server } = await renderInApp(
      <>
        <HeaderTitle />
        <HeaderActions />
        <HomeScreen />
      </>,
      undefined,
      async (_, fake) => {
        fake.storeMealFromElsewhere({ id: '00000000-0000-4000-8000-00000000a004', day: '2026-07-20', mealType: 'lunch', tags: [], items: [OLD_FOOD], recordedAt: NOW.toISOString() });
        fake.storeStepsFromElsewhere('2026-07-20', 8_410);
      },
    );
    const earlier = await screen.findByRole('button', { name: 'Earlier days' });
    server.state.daysFailWith = 503;
    for (let week = 0; week < 14; week += 1) await fireEvent.press(earlier);
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 20 Jul' }));

    // Not loaded: the banner says so, with Try again; the cards show dashes, not "nothing logged".
    expect(await screen.findByText(OLDER_DAY_TEXTS.failed)).toBeOnTheScreen();
    expect(screen.getByLabelText('kcal eaten: not loaded')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Steps: not loaded' })).toBeOnTheScreen();

    server.state.daysFailWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('321 kcal eaten')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Steps: 8,410 steps' })).toBeOnTheScreen();
    expect(screen.queryByText(OLDER_DAY_TEXTS.failed)).toBeNull();
    expect(screen.getByText('Showing Mon 20 Jul')).toBeOnTheScreen();
    expect(server.state.dayQueries).toContainEqual({ from: '2026-07-20', to: '2026-07-26' });

    // Offline, a week not read yet says why.
    server.state.offline = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 13 Jul' }));
    expect(await screen.findByText(OLDER_DAY_TEXTS.offline)).toBeOnTheScreen();
  });
});

describe('REQ-NAV-002 Account', () => {
  it('REQ-ACC-008 shows the email and Log out; the development tools only in development builds', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />);

    // On the Profile card (6.1).
    expect(await screen.findByText('user@example.test')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeOnTheScreen();
    expect(screen.queryByText('Development')).toBeNull();
  });
});
