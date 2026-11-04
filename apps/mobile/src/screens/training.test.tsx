import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as client from '../api/client';
import { getEntry } from '../local/store';
import { ME } from '../testing/fakes';
import { renderInApp } from '../testing/appHarness';
import { TrainingScreen } from './TrainingScreen';

// The Training tab (REQ-TRN-002, REQ-TRN-004; D-20): the empty state, "Log workout",
// the workouts the user has logged, older ones read online (ADR-0007 rules 1 and 6), and rejected
// workout changes (ADR-0007 rule 2). The workout screen is tested in workout.test.tsx.

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));

beforeEach(() => {
  mockRouter.push.mockClear();
});

const SQUAT = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };
const PUSH_UP = { name: 'Push-up', sets: 2, reps: 20, weightGrams: null, note: null };
const OLD_ID = '7c2a9e40-1d3b-4f5a-9e6d-2b1c0a9f8e7d';

describe('REQ-TRN-002 the Training tab', () => {
  it('D-20 shows "No training plan yet", "Log workout" and an empty history', async () => {
    await renderInApp(<TrainingScreen />);

    expect(await screen.findByText('No training plan yet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Log workout' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Workouts you have logged' })).toBeOnTheScreen();
    expect(screen.getByText('No workouts logged yet.')).toBeOnTheScreen();
  });
});

describe('REQ-TRN-004 workouts you have logged', () => {
  it('REQ-TRN-004 lists workouts newest first, from this phone and from another, and opens one', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    const app = await renderInApp(<TrainingScreen />);
    app.server.storeWorkoutFromElsewhere(id, '2026-10-26', [SQUAT, PUSH_UP]);

    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));

    const rows = await screen.findAllByRole('button', { name: /^(Wed 28 Oct|Mon 26 Oct), Workout \d: / });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Wed 28 Oct, Workout 1: No exercises',
      'Mon 26 Oct, Workout 1: 2 exercises · Squat, Push-up',
    ]);
    await fireEvent.press(rows[1]!);
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${id}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Workout 1 on Mon 26 Oct' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${id}`);
  });

  it('D-42 a date’s card offers another workout on that date, which opens new and empty', async () => {
    const app = await renderInApp(<TrainingScreen />);
    app.server.storeWorkoutFromElsewhere('0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b', '2026-10-26', [SQUAT]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
    mockRouter.push.mockClear();

    await screen.findByRole('button', { name: 'Mon 26 Oct, Workout 1: 1 exercise · Squat' });
    // Each date's card has its own; the second is Mon 26 Oct's (the first, today's, from "Log workout").
    await fireEvent.press(screen.getAllByRole('button', { name: 'Log another workout' })[1]!);

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\//)));
    const newId = (mockRouter.push.mock.calls[0]![0] as string).slice('/workout/'.length);
    expect(newId).not.toBe('0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b');
    expect(await getEntry(app.db, 'workout', newId)).toMatchObject({ day: '2026-10-26', exercises: [] });
  });

  it('D-42 workouts on the same date share one card, each on its own row in the order started', async () => {
    const app = await renderInApp(<TrainingScreen />);
    app.server.storeWorkoutFromElsewhere('0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b', '2026-10-26', [SQUAT]);
    app.server.storeWorkoutFromElsewhere('1c8f2e3d-4b5a-4f6e-9d8c-7b6a5f4e3d2c', '2026-10-26', [PUSH_UP]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));

    expect(await screen.findByLabelText('Mon 26 Oct: 2 workouts')).toBeOnTheScreen();
    // Both were started at the same time here, so either may be Workout 1.
    const rows = screen.getAllByRole('button', { name: /^Mon 26 Oct, Workout \d: / });
    const labels = rows.map((row) => String(row.props.accessibilityLabel));
    expect(labels.map((label) => label.slice(0, 'Mon 26 Oct, Workout 1'.length))).toEqual(['Mon 26 Oct, Workout 1', 'Mon 26 Oct, Workout 2']);
    expect(labels.map((label) => label.split(' · ')[1]).sort()).toEqual(['Push-up', 'Squat']);
    await fireEvent.press(screen.getByRole('button', { name: /^Mon 26 Oct, Workout \d: 1 exercise · Push-up$/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/workout/1c8f2e3d-4b5a-4f6e-9d8c-7b6a5f4e3d2c');
  });

  it('D-42 a workout’s bin asks first; Keep keeps it, Delete removes it from the phone and the server', async () => {
    const app = await renderInApp(<TrainingScreen />);
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    app.server.storeWorkoutFromElsewhere(id, '2026-10-26', [SQUAT]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' }));
    expect(screen.getByText('Delete Workout 1 on Mon 26 Oct? It leaves your history and your weekly count.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect(await getEntry(app.db, 'workout', id)).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Workout 1 on Mon 26 Oct' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await getEntry(app.db, 'workout', id)).toBeNull());
    await waitFor(() => expect(app.server.entries('workouts').get(id)).toMatchObject({ deleted: true }));
    expect(screen.queryByLabelText('Mon 26 Oct: 1 workout')).toBeNull();
  });

  it('REQ-TRN-004 "Load older" reads the 90 days before the phone’s from the server and lists them, view-only', async () => {
    const { server } = await renderInApp(<TrainingScreen />);
    server.state.olderWorkouts = [
      { id: OLD_ID, day: '2026-07-01', exercises: [SQUAT], recordedAt: '2026-07-01T02:00:00.000Z', updatedAt: '2026-07-01T02:00:00.000Z' },
    ];

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByLabelText('Wed 1 Jul, Workout 1: 1 exercise · Squat')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wed 1 Jul, Workout 1: 1 exercise · Squat' })).toBeNull();
    expect(screen.queryByRole('button', { name: /on Wed 1 Jul$/ })).toBeNull();
    const call = server.calls.find((entry) => entry.path.endsWith('/workouts'));
    expect(call?.path).toBe(`/users/${ME.user.id}/workouts`);
  });

  it('REQ-TRN-004 says so when there are no older workouts', async () => {
    await renderInApp(<TrainingScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('No workouts from Sat 2 May to Thu 30 Jul.')).toBeOnTheScreen();
  });

  it('REQ-TRN-004 while older workouts load, only "Load older" waits; "Log workout" stays ready', async () => {
    await renderInApp(<TrainingScreen />);
    // The server doesn't answer yet.
    const pending = jest.spyOn(client, 'callApi').mockReturnValue(new Promise(() => {}));
    try {
      await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

      expect(screen.getByRole('button', { name: 'Load older' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Log workout' })).toBeEnabled();
    } finally {
      pending.mockRestore();
    }
  });

  it('ADR-0007 rule 6 "Load older" offline shows the named warning', async () => {
    const { server } = await renderInApp(<TrainingScreen />);
    server.state.offline = true;

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('Loading older workouts needs an internet connection.')).toBeOnTheScreen();
  });
});

describe('ADR-0007 rule 2 rejected workout changes', () => {
  it('D-29 shows "This workout wasn\'t saved…"; Edit opens the workout; Discard removes it', async () => {
    const { server } = await renderInApp(<TrainingScreen />);
    server.state.rejectWith = 'DAY_IN_FUTURE';
    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
    const id = String(mockRouter.push.mock.calls[0]?.[0]).replace('/workout/', '');

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
    expect(await screen.findByText('No workouts logged yet.')).toBeOnTheScreen();
  });
});
