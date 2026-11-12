import type { MealItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FUTURE_DAY, OLDER_DAY } from '../components/CalendarSheet';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { saveEntry } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets } from '../testing/exercises';
import { LIGHT_COLORS } from '../theme';
import { AccountScreen } from './AccountScreen';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The header's calendar and the 90-day window (REQ-NAV-002, REQ-DATE-001; MVP default, D-23).
// Today is Wednesday 28 October 2026; the window starts on Friday 31 July 2026.

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

  it('D-23 goes back only as far as the 90 days the phone holds', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    for (let month = 0; month < 3; month += 1) await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByText('July 2026')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Friday 31 July 2026, Nothing logged' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    // An older day is greyed too, and says why (D-34).
    const older = screen.getByRole('button', { name: 'Thursday 30 July 2026, not available' });
    expect(older).toBeDisabled();
    await fireEvent.press(older);
    expect(screen.getByRole('alert')).toHaveTextContent(OLDER_DAY);
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
// days", C locked). Synthetic: meals on Mon 26 Oct (two) and Tue 27 Oct; a workout on Mon 26 Oct, two
// on Wed 21 Oct and one on Thu 10 Sep; on Thu 22 Oct a workout with no exercise, which no list shows (D-65).
const SQUAT = sameSets('Squat', 3, 10, 40_000);
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
  it('D-84 a day with a meal is green, a day with a workout has a dumbbell; each day says what was logged', async () => {
    await renderWithDays();
    await fireEvent.press(await screen.findByRole('button', { name: 'Calendar' }));

    const monday = await screen.findByRole('button', { name: 'Monday 26 October 2026, 2 meals logged, 1 workout logged' });
    const tuesday = screen.getByRole('button', { name: 'Tuesday 27 October 2026, 1 meal logged' });
    const wednesday = screen.getByRole('button', { name: 'Wednesday 21 October 2026, 2 workouts logged' });
    const empty = screen.getByRole('button', { name: 'Thursday 22 October 2026, Nothing logged' });
    expect(monday).toHaveStyle({ backgroundColor: LIGHT_COLORS.loggedDayTint });
    expect(tuesday).toHaveStyle({ backgroundColor: LIGHT_COLORS.loggedDayTint });
    expect(wednesday).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.loggedDayTint });
    expect(screen.getByTestId('workout-2026-10-26')).toBeOnTheScreen();
    expect(screen.getByTestId('workout-2026-10-21')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-2026-10-27')).toBeNull();
    // A workout with no exercise is not marked (D-65).
    expect(empty).not.toHaveStyle({ backgroundColor: LIGHT_COLORS.loggedDayTint });
    expect(screen.queryByTestId('workout-2026-10-22')).toBeNull();
    // The key under the days.
    expect(screen.getByLabelText('Key: a green day has meals logged; a dumbbell marks a workout')).toBeOnTheScreen();
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

describe('D-23 date strip limit', () => {
  it('D-23 "Earlier days" stops at the week holding the first of the 90 days (Mon 27 Jul to Sun 2 Aug, D-79)', async () => {
    await renderHome();
    const earlier = await screen.findByRole('button', { name: 'Earlier days' });

    for (let week = 0; week < 13; week += 1) await fireEvent.press(earlier);

    expect(screen.getByRole('button', { name: 'Earlier days' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Monday 27 Jul, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Thursday 30 Jul, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Friday 31 Jul' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sunday 2 Aug' })).toBeEnabled();
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
