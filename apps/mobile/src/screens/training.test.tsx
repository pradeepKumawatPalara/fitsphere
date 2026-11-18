import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as client from '../api/client';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { getEntry, saveEntry } from '../local/store';
import { ME } from '../testing/fakes';
import { NOW, renderInApp } from '../testing/appHarness';
import { TrainingScreen, monthSummary } from './TrainingScreen';
import { sameSets } from '../testing/exercises';

// The Training tab (REQ-TRN-002…004; D-20, D-65): the date strip, "By day" (the selected date's
// workouts and "Log workout for <date>") and "All workouts" (the workouts by month, the last 90 days or
// the dates chosen, D-116), older ones read online (ADR-0007 rules 1 and 6), and rejected workout
// changes (ADR-0007 rule 2). The workout screen
// is tested in workout.test.tsx. Today is Wed 28 Oct 2026.

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));

beforeEach(() => {
  mockRouter.push.mockClear();
});

const SQUAT = sameSets('Squat', 3, 10, 40_000);
const PUSH_UP = sameSets('Push-up', 2, 20, null);
const ID_1 = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
const ID_2 = '1c8f2e3d-4b5a-4f6e-9d8c-7b6a5f4e3d2c';
const ID_3 = '2d7a3f4e-5c6b-4a7f-8e9d-8c7b6a5f4e3d';
const OLD_ID = '7c2a9e40-1d3b-4f5a-9e6d-2b1c0a9f8e7d';

/** The Training tab, with workouts stored from another phone before it opens. */
async function renderTraining(workouts: [id: string, day: string, exercises: ReturnType<typeof sameSets>[]][] = []) {
  return renderInApp(
    <>
      <HeaderTitle />
      <HeaderActions />
      <TrainingScreen />
    </>,
    undefined,
    async (_db, server) => {
      for (const [id, day, exercises] of workouts) server.storeWorkoutFromElsewhere(id, day, exercises);
    },
  );
}

async function showAll() {
  await fireEvent.press(await screen.findByRole('tab', { name: 'All workouts' }));
}

/**
 * The Training tab, with workouts on the server from another phone: those older than the phone's 90
 * days stay on the server, as sync sends only the 90 days (ADR-0007 rule 1); checked here.
 */
async function renderWithOlder(workouts: [id: string, day: string, exercises: ReturnType<typeof sameSets>[]][]) {
  const app = await renderTraining(workouts);
  for (const [id, day] of workouts) if (day < '2026-07-31') expect(await getEntry(app.db, 'workout', id)).toBeNull();
  return app;
}

describe('D-65 the Training tab', () => {
  it('REQ-TRN-002 opens By day on today: the date strip, "Log workout for today" and no workouts; no plan card', async () => {
    await renderTraining();

    expect(await screen.findByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'By day' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'All workouts' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Log workout for today' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Today, Wed 28 Oct' })).toBeOnTheScreen();
    expect(screen.getByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
    expect(screen.queryByText('No training plan yet.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load older' })).toBeNull();
  });

  it('the strip marks the days with a workout', async () => {
    await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);

    expect(await screen.findByRole('button', { name: 'Monday 26 Oct, 1 workout logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct' })).toBeOnTheScreen();
  });

  it('a day picked on the strip shows only its workouts, and Log workout names it and logs to it', async () => {
    const app = await renderTraining([
      [ID_1, '2026-10-26', [SQUAT, PUSH_UP]],
      [ID_2, '2026-10-27', [PUSH_UP]],
    ]);

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, 1 workout logged' }));

    expect(screen.getByLabelText('Selected date: Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.getByText('Showing Mon 26 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Mon 26 Oct · 1 workout' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Mon 26 Oct, Workout 1: 2 exercises · Squat, Push-up' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Tue 27 Oct, / })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Log workout for Mon 26 Oct' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\//)));
    const id = (mockRouter.push.mock.calls[0]![0] as string).slice('/workout/'.length);
    expect(id).not.toBe(ID_1);
    expect(await getEntry(app.db, 'workout', id)).toMatchObject({ day: '2026-10-26', exercises: [] });
  });

  it('D-65 a workout with no exercise is not listed, marked or counted, By day or in All workouts', async () => {
    await renderTraining([
      [ID_1, '2026-10-26', [SQUAT]],
      [ID_2, '2026-10-26', []],
      [ID_3, '2026-10-27', []],
    ]);

    expect(await screen.findByRole('button', { name: 'Monday 26 Oct, 1 workout logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 26 Oct, 1 workout logged' }));
    expect(screen.getByRole('header', { name: 'Mon 26 Oct · 1 workout' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mon 26 Oct, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /No exercises$/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tuesday 27 Oct' }));
    expect(screen.getByText('No workouts on Tue 27 Oct.')).toBeOnTheScreen();

    await showAll();
    expect(screen.getByRole('button', { name: 'October 2026: 1 workout on 1 day' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Mon 26 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /No exercises$/ })).toBeNull();
    expect(screen.queryByLabelText(/^Tue 27 Oct/)).toBeNull();
  });

  it('REQ-DATE-002 "Back to today" shows today again', async () => {
    await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, 1 workout logged' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));

    expect(screen.queryByText(/^Showing /)).toBeNull();
    expect(screen.getByRole('button', { name: 'Log workout for today' })).toBeOnTheScreen();
    expect(screen.getByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
  });

  it('a day picked in the header’s calendar, even from All workouts, shows By day for it', async () => {
    await renderTraining([[ID_1, '2026-10-20', [SQUAT]]]);
    await showAll();
    expect(screen.getByRole('tab', { name: 'All workouts' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Calendar' }));
    // The calendar marks the day's workout (D-84).
    await fireEvent.press(await screen.findByRole('button', { name: 'Tuesday 20 October 2026, 1 workout logged' }));

    expect(screen.getByRole('tab', { name: 'By day' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Log workout for Tue 20 Oct' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Tue 20 Oct, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();
    // The strip shows the week holding it.
    expect(screen.getByRole('button', { name: 'Tuesday 20 Oct, 1 workout logged' })).toBeSelected();
  });

  it('a day tapped on the strip while All workouts shows switches to By day', async () => {
    await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Wednesday 28 Oct, today' }));

    expect(screen.getByRole('tab', { name: 'By day' })).toBeSelected();
    expect(screen.getByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
  });

  it('D-42 By day: a workout’s pencil opens it; its bin asks first, and Delete removes it', async () => {
    const app = await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, 1 workout logged' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Workout 1 on Mon 26 Oct' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${ID_1}`);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' }));
    expect(
      screen.getByText("Workout 1 on Mon 26 Oct will be deleted, with its 1 exercise. It will no longer count in this week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await getEntry(app.db, 'workout', ID_1)).toBeNull());
    expect(await screen.findByText('No workouts on Mon 26 Oct.')).toBeOnTheScreen();
  });
});

describe('REQ-TRN-004 All workouts', () => {
  it('REQ-TRN-004 lists workouts newest first and opens one', async () => {
    await renderTraining([
      [ID_1, '2026-10-26', [SQUAT, PUSH_UP]],
      [ID_2, '2026-10-27', [PUSH_UP]],
    ]);
    await showAll();

    const rows = await screen.findAllByRole('button', { name: /^(Tue 27 Oct|Mon 26 Oct), Workout \d: / });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Tue 27 Oct, Workout 1: 1 exercise · Push-up',
      'Mon 26 Oct, Workout 1: 2 exercises · Squat, Push-up',
    ]);
    await fireEvent.press(rows[1]!);
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${ID_1}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Workout 1 on Mon 26 Oct' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${ID_1}`);
  });

  it('D-65 groups them by month: the newest open, the others folded to one line, each opened and folded by a tap', async () => {
    await renderTraining([
      [ID_1, '2026-10-26', [SQUAT]],
      [ID_2, '2026-09-30', [PUSH_UP]],
      [ID_3, '2026-09-29', [SQUAT]],
    ]);
    await showAll();

    const october = await screen.findByRole('button', { name: 'October 2026: 1 workout on 1 day' });
    const september = screen.getByRole('button', { name: 'September 2026: 2 workouts on 2 days' });
    expect(october.props.accessibilityState).toEqual({ expanded: true });
    expect(september.props.accessibilityState).toEqual({ expanded: false });
    expect(await screen.findByRole('button', { name: 'Mon 26 Oct, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Wed 30 Sep, / })).toBeNull();

    await fireEvent.press(september);
    expect(screen.getByRole('button', { name: 'Wed 30 Sep, Workout 1: 1 exercise · Push-up' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tue 29 Sep, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'October 2026: 1 workout on 1 day' }));
    expect(screen.queryByRole('button', { name: /^Mon 26 Oct, / })).toBeNull();
    expect(screen.getByRole('button', { name: 'September 2026: 2 workouts on 2 days' }).props.accessibilityState).toEqual({ expanded: true });
  });

  it('D-65 a month’s line counts every workout and every date', () => {
    expect(monthSummary([{ workouts: [1] }])).toBe('1 workout on 1 day');
    expect(monthSummary([{ workouts: [1, 2] }, { workouts: [3] }])).toBe('3 workouts on 2 days');
  });

  it('D-42 a date’s card offers another workout on that date, which opens new and empty', async () => {
    const app = await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);
    await showAll();

    await screen.findByRole('button', { name: 'Mon 26 Oct, Workout 1: 1 exercise · Squat' });
    await fireEvent.press(screen.getByRole('button', { name: 'Log another workout' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\//)));
    const newId = (mockRouter.push.mock.calls[0]![0] as string).slice('/workout/'.length);
    expect(newId).not.toBe(ID_1);
    expect(await getEntry(app.db, 'workout', newId)).toMatchObject({ day: '2026-10-26', exercises: [] });
  });

  it('D-42 workouts on the same date share one card, each on its own row in the order started', async () => {
    await renderTraining([
      [ID_1, '2026-10-26', [SQUAT]],
      [ID_2, '2026-10-26', [PUSH_UP]],
    ]);
    await showAll();

    expect(await screen.findByLabelText('Mon 26 Oct: 2 workouts')).toBeOnTheScreen();
    // Both were started at the same time here, so either may be Workout 1.
    const rows = screen.getAllByRole('button', { name: /^Mon 26 Oct, Workout \d: / });
    const labels = rows.map((row) => String(row.props.accessibilityLabel));
    expect(labels.map((label) => label.slice(0, 'Mon 26 Oct, Workout 1'.length))).toEqual(['Mon 26 Oct, Workout 1', 'Mon 26 Oct, Workout 2']);
    expect(labels.map((label) => label.split(' · ')[1]).sort()).toEqual(['Push-up', 'Squat']);
    await fireEvent.press(screen.getByRole('button', { name: /^Mon 26 Oct, Workout \d: 1 exercise · Push-up$/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${ID_2}`);
  });

  it('D-42 a workout’s bin asks first; Keep keeps it, Delete removes it from the phone and the server', async () => {
    const app = await renderTraining([[ID_1, '2026-10-26', [SQUAT]]]);
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' }));
    expect(
      screen.getByText("Workout 1 on Mon 26 Oct will be deleted, with its 1 exercise. It will no longer count in this week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect(await getEntry(app.db, 'workout', ID_1)).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await getEntry(app.db, 'workout', ID_1)).toBeNull());
    await waitFor(() => expect(app.server.entries('workouts').get(ID_1)).toMatchObject({ deleted: true }));
    expect(screen.queryByLabelText('Mon 26 Oct: 1 workout')).toBeNull();
    expect(screen.getByText('No workouts in the last 90 days.')).toBeOnTheScreen();
  });

  it('D-63 deleting says what goes: an earlier week’s workout and its exercises', async () => {
    await renderTraining([[ID_1, '2026-10-20', [SQUAT, PUSH_UP]]]);
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Workout 1 on Tue 20 Oct' }));
    expect(
      screen.getByText("Workout 1 on Tue 20 Oct will be deleted, with its 2 exercises. It will no longer count in that week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
  });
});

// D-116 (the owner's A, 2026-11-18): All workouts by dates, as Progress's measurements (D-114): the last
// 90 days, the phone's, at first; a year or Pick dates read the days before the phone's 90 online, in
// place of "Load older". Today is Wed 28 Oct 2026, so the phone's 90 days are Fri 31 Jul to Wed 28 Oct.
describe('D-116 All workouts by dates', () => {
  const OLD_ID_2 = '8d3b0f51-2e4c-4a6b-8f7e-3c2d1b0a9f8e';

  it('shows the last 90 days with a count line; the choices are Pick dates, Last 90 days and each year back to 2000; no Load older', async () => {
    const { server } = await renderTraining([
      [ID_1, '2026-10-26', [SQUAT]],
      [ID_2, '2026-08-03', [PUSH_UP]],
    ]);
    await showAll();

    expect(await screen.findByText('2 workouts on 2 days · Fri 31 Jul – Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((choice) => choice.props.accessibilityLabel).slice(0, 4)).toEqual(['Pick dates', 'Last 90 days', '2026', '2025']);
    expect(screen.getByRole('radio', { name: '2000' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Load older' })).toBeNull();
    // The last 90 days are the phone's: nothing is read online.
    expect(server.state.workoutQueries).toEqual([]);
  });

  it('a year lists its months read online, the newest open, its days with their year; an older card opens its date in By day', async () => {
    const { server } = await renderWithOlder([
      [ID_1, '2026-10-26', [SQUAT]],
      [OLD_ID, '2025-12-27', [SQUAT]],
      [OLD_ID_2, '2025-06-14', [PUSH_UP]],
    ]);
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('2 workouts on 2 days · Wed 1 Jan 2025 – Wed 31 Dec 2025')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '2025' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'December 2025: 1 workout on 1 day' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByRole('button', { name: 'June 2025: 1 workout on 1 day' }).props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByLabelText('Sat 27 Dec 2025, Workout 1: 1 exercise · Squat')).toBeOnTheScreen();
    // Read from the server: shown, with no pencil or bin; the card opens its date.
    expect(screen.queryByRole('button', { name: /on Sat 27 Dec 2025$/ })).toBeNull();
    expect(server.state.workoutQueries).toEqual([{ from: '2025-01-01', to: '2025-12-31', cursor: null }]);
    expect(server.calls.find((call) => call.path.endsWith('/workouts'))?.path).toBe(`/users/${ME.user.id}/workouts`);

    await fireEvent.press(screen.getByRole('button', { name: 'Sat 27 Dec 2025: 1 workout' }));

    expect(screen.getByRole('tab', { name: 'By day' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Log workout for Sat 27 Dec 2025' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Sat 27 Dec 2025, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete Workout 1 on Sat 27 Dec 2025' })).toBeOnTheScreen();
  });

  it('a workout deleted on its older day leaves the year’s list', async () => {
    const { server } = await renderWithOlder([[OLD_ID, '2025-12-27', [SQUAT]]]);
    await showAll();
    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sat 27 Dec 2025: 1 workout' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Workout 1 on Sat 27 Dec 2025' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(server.entries('workouts').get(OLD_ID)).toMatchObject({ deleted: true }));
    await showAll();

    expect(screen.getByRole('radio', { name: '2025' })).toBeChecked();
    expect(await screen.findByText('No workouts from Wed 1 Jan 2025 to Wed 31 Dec 2025.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Sat 27 Dec 2025: 1 workout')).toBeNull();
  });

  it('this year reads online only the days before the phone’s 90, and lists them with the phone’s', async () => {
    const { server } = await renderWithOlder([
      [ID_1, '2026-10-26', [SQUAT]],
      [OLD_ID, '2026-03-02', [PUSH_UP]],
    ]);
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2026' }));

    expect(await screen.findByText('2 workouts on 2 days · Thu 1 Jan – Wed 28 Oct')).toBeOnTheScreen();
    expect(server.state.workoutQueries).toEqual([{ from: '2026-01-01', to: '2026-07-30', cursor: null }]);
    // The phone's keeps its pencil and bin; the older month is folded.
    expect(screen.getByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'March 2026: 1 workout on 1 day' }).props.accessibilityState).toEqual({ expanded: false });
  });

  it('reads every page the server sends', async () => {
    const { server } = await renderWithOlder([
      [OLD_ID, '2025-12-27', [SQUAT]],
      [OLD_ID_2, '2025-06-14', [PUSH_UP]],
    ]);
    server.state.workoutsPageSize = 1;
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('2 workouts on 2 days · Wed 1 Jan 2025 – Wed 31 Dec 2025')).toBeOnTheScreen();
    expect(server.state.workoutQueries.map((query) => query.cursor)).toEqual([null, '1']);
  });

  it('a year with none says so', async () => {
    await renderTraining();
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2023' }));

    expect(await screen.findByText('No workouts from Sun 1 Jan 2023 to Sun 31 Dec 2023.')).toBeOnTheScreen();
  });

  it('ADR-0007 rule 6 offline, says older workouts need the internet; Try again loads them once online', async () => {
    const { server } = await renderWithOlder([[OLD_ID, '2025-12-27', [SQUAT]]]);
    await showAll();
    server.state.offline = true;

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('Workouts older than 90 days need an internet connection.')).toBeOnTheScreen();
    server.state.offline = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 workout on 1 day · Wed 1 Jan 2025 – Wed 31 Dec 2025')).toBeOnTheScreen();
  });

  it('a server error says these could not load, with Try again', async () => {
    const { server } = await renderTraining();
    server.state.workoutsFailWith = 500;
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('Couldn’t load these workouts.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('Pick dates: From from the calendar, and Show lists those dates', async () => {
    const { server } = await renderWithOlder([[OLD_ID, '2026-07-01', [SQUAT]]]);
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: 'Pick dates' }));
    expect(screen.getByText('Workouts older than 90 days load online.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'From: Fri 31 Jul. Change' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Wednesday 1 July 2026' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(await screen.findByText('1 workout on 1 day · Wed 1 Jul – Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Pick dates' })).toBeChecked();
    expect(server.state.workoutQueries).toEqual([{ from: '2026-07-01', to: '2026-07-30', cursor: null }]);
  });

  it('while a year loads, logging stays ready', async () => {
    await renderTraining();
    await showAll();
    // The server doesn't answer yet.
    const pending = jest.spyOn(client, 'callApi').mockReturnValue(new Promise(() => {}));
    try {
      await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

      expect(screen.getByText('Loading workouts…')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('tab', { name: 'By day' }));
      expect(screen.getByRole('button', { name: 'Log workout for today' })).toBeEnabled();
    } finally {
      pending.mockRestore();
    }
  });
});

describe('ADR-0007 rule 2 rejected workout changes', () => {
  it('D-29 shows "This workout wasn\'t saved…"; Edit opens the workout; Discard removes it', async () => {
    const id = ID_1;
    const { server } = await renderInApp(<TrainingScreen />, undefined, async (db, fake) => {
      fake.state.rejectWith = 'DAY_IN_FUTURE';
      await saveEntry(db, 'workout', {
        changeId: '00000000-0000-4000-8000-0000000000b1',
        data: { id, day: '2026-10-28', exercises: [SQUAT], recordedAt: '2026-10-28T02:00:00.000Z', timer: null },
      });
    });

    expect(
      await screen.findByText("This workout wasn't saved: the date is in the future. Edit or discard it."),
    ).toBeOnTheScreen();
    expect(screen.getByText('Wed 28 Oct · workout')).toBeOnTheScreen();
    expect(screen.getByText('not saved')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${id}`);

    server.state.rejectWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByText(/wasn't saved/)).toBeNull());
    expect(await screen.findByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
  });
});

describe('D-71 each workout’s timer on its row', () => {
  /** A time `seconds` before now. */
  const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();
  const DONE = { startedAt: ago(4_000), countedSeconds: 3_160, runningSince: null, doneAt: ago(600) };
  const RUNNING = { startedAt: ago(754), countedSeconds: 0, runningSince: ago(754), doneAt: null };
  const PAUSED = { startedAt: ago(90_000), countedSeconds: 1_868, runningSince: null, doneAt: null };

  async function renderTimed() {
    return renderInApp(<TrainingScreen now={() => NOW} />, undefined, async (_db, server) => {
      server.storeWorkoutFromElsewhere(ID_1, '2026-10-28', [SQUAT], DONE);
      server.storeWorkoutFromElsewhere(ID_2, '2026-10-28', [], RUNNING);
      server.storeWorkoutFromElsewhere(ID_3, '2026-10-27', [PUSH_UP], PAUSED);
    });
  }

  it('By day says Done with the total; D-108 a timed workout with no exercise is not listed, though its timer runs', async () => {
    await renderTimed();

    expect(await screen.findByText('Done · 52:40')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Today, Wed 28 Oct · 1 workout' })).toBeOnTheScreen();
    expect(screen.queryByText('Running · 12:34')).toBeNull();
    expect(screen.queryByRole('button', { name: /No exercises/ })).toBeNull();
  });

  it('By day says Running with the time counted once the running workout has an exercise', async () => {
    await renderInApp(<TrainingScreen now={() => NOW} />, undefined, async (_db, server) => {
      server.storeWorkoutFromElsewhere(ID_2, '2026-10-28', [SQUAT], RUNNING);
    });

    expect(await screen.findByText('Running · 12:34')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wed 28 Oct, Workout 1: 1 exercise · Squat; Running · 12:34' })).toBeOnTheScreen();
  });

  it('All workouts says Paused with the time counted; a workout with no timer says nothing of one', async () => {
    await renderInApp(<TrainingScreen now={() => NOW} />, undefined, async (_db, server) => {
      server.storeWorkoutFromElsewhere(ID_3, '2026-10-27', [PUSH_UP], PAUSED);
      server.storeWorkoutFromElsewhere(ID_1, '2026-10-26', [SQUAT]);
    });
    await showAll();

    expect(await screen.findByText('Paused · 31:08')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mon 26 Oct, Workout 1: 1 exercise · Squat' })).toBeOnTheScreen();
    expect(screen.queryByText(/^(Running|Done) · /)).toBeNull();
  });

  it('an older workout read from the server shows its total', async () => {
    const { server } = await renderTraining();
    server.state.olderWorkouts = [
      {
        id: OLD_ID,
        day: '2026-07-01',
        exercises: [SQUAT],
        timer: { startedAt: '2026-07-01T02:00:00.000Z', countedSeconds: 3_855, runningSince: null, doneAt: '2026-07-01T03:10:00.000Z' },
        recordedAt: '2026-07-01T02:00:00.000Z',
        updatedAt: '2026-07-01T03:10:00.000Z',
      },
    ];
    await showAll();

    await fireEvent.press(await screen.findByRole('radio', { name: '2026' }));

    expect(await screen.findByLabelText('Wed 1 Jul, Workout 1: 1 exercise · Squat; Done · 1:04:15')).toBeOnTheScreen();
  });
});
