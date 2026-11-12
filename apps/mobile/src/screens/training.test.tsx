import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as client from '../api/client';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { getEntry, saveEntry } from '../local/store';
import { ME } from '../testing/fakes';
import { NOW, renderInApp } from '../testing/appHarness';
import { TrainingScreen, monthSummary } from './TrainingScreen';
import { sameSets } from '../testing/exercises';

// The Training tab (REQ-TRN-002…004; D-20, D-65): the date strip, "By day" (the selected date's
// workouts and "Log workout for <date>") and "All workouts" (every workout, by month), older ones read
// online (ADR-0007 rules 1 and 6), and rejected workout changes (ADR-0007 rule 2). The workout screen
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

    expect(await screen.findByRole('button', { name: 'Monday 26 Oct, workout logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct' })).toBeOnTheScreen();
  });

  it('a day picked on the strip shows only its workouts, and Log workout names it and logs to it', async () => {
    const app = await renderTraining([
      [ID_1, '2026-10-26', [SQUAT, PUSH_UP]],
      [ID_2, '2026-10-27', [PUSH_UP]],
    ]);

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, workout logged' }));

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

    expect(await screen.findByRole('button', { name: 'Monday 26 Oct, workout logged' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Monday 26 Oct, workout logged' }));
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, workout logged' }));

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
    expect(screen.getByRole('button', { name: 'Tuesday 20 Oct, workout logged' })).toBeSelected();
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct, workout logged' }));

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
    expect(screen.getByText('No workouts logged yet.')).toBeOnTheScreen();
  });

  it('D-63 deleting says what goes: an earlier week’s workout and its exercises', async () => {
    await renderTraining([[ID_1, '2026-10-20', [SQUAT, PUSH_UP]]]);
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Workout 1 on Tue 20 Oct' }));
    expect(
      screen.getByText("Workout 1 on Tue 20 Oct will be deleted, with its 2 exercises. It will no longer count in that week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
  });

  it('REQ-TRN-004 "Load older" reads the 90 days before the phone’s from the server and opens their newest month, view-only', async () => {
    const { server } = await renderTraining();
    server.state.olderWorkouts = [
      { id: OLD_ID, day: '2026-07-01', exercises: [SQUAT], timer: null, recordedAt: '2026-07-01T02:00:00.000Z', updatedAt: '2026-07-01T02:00:00.000Z' },
    ];
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByLabelText('Wed 1 Jul, Workout 1: 1 exercise · Squat')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'July 2026: 1 workout on 1 day' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.queryByRole('button', { name: 'Wed 1 Jul, Workout 1: 1 exercise · Squat' })).toBeNull();
    expect(screen.queryByRole('button', { name: /on Wed 1 Jul$/ })).toBeNull();
    const call = server.calls.find((entry) => entry.path.endsWith('/workouts'));
    expect(call?.path).toBe(`/users/${ME.user.id}/workouts`);
  });

  it('REQ-TRN-004 says so when there are no older workouts', async () => {
    await renderTraining();
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('No workouts from Sat 2 May to Thu 30 Jul.')).toBeOnTheScreen();
  });

  it('REQ-TRN-004 while older workouts load, only "Load older" waits; logging stays ready', async () => {
    await renderTraining();
    await showAll();
    // The server doesn't answer yet.
    const pending = jest.spyOn(client, 'callApi').mockReturnValue(new Promise(() => {}));
    try {
      await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

      expect(screen.getByRole('button', { name: 'Load older' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('tab', { name: 'By day' }));
      expect(screen.getByRole('button', { name: 'Log workout for today' })).toBeEnabled();
    } finally {
      pending.mockRestore();
    }
  });

  it('ADR-0007 rule 6 "Load older" offline shows the named warning', async () => {
    const { server } = await renderTraining();
    server.state.offline = true;
    await showAll();

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('Loading older workouts needs an internet connection.')).toBeOnTheScreen();
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

  it('By day says Running with the time counted, or Done with the total; a timed workout is listed before its first exercise', async () => {
    await renderTimed();

    expect(await screen.findByText('Done · 52:40')).toBeOnTheScreen();
    expect(screen.getByText('Running · 12:34')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Today, Wed 28 Oct · 2 workouts' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Wed 28 Oct, Workout \d: No exercises; Running · 12:34$/ })).toBeOnTheScreen();
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

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByLabelText('Wed 1 Jul, Workout 1: 1 exercise · Squat; Done · 1:04:15')).toBeOnTheScreen();
  });
});
