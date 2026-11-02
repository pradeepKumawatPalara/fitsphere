import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as client from '../api/client';
import { ME } from '../testing/fakes';
import { renderInApp } from '../testing/appHarness';
import { TrainingScreen } from './TrainingScreen';

// The Training tab (REQ-TRN-002, REQ-TRN-004; D-20): the empty state, "Start an empty workout",
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
  it('D-20 shows "No training plan yet", "Start an empty workout" and an empty history', async () => {
    await renderInApp(<TrainingScreen />);

    expect(await screen.findByText('No training plan yet.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start an empty workout' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Workouts you have logged' })).toBeOnTheScreen();
    expect(screen.getByText('No workouts logged yet.')).toBeOnTheScreen();
  });
});

describe('REQ-TRN-004 workouts you have logged', () => {
  it('REQ-TRN-004 lists workouts newest first, from this phone and from another, and opens one', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    const app = await renderInApp(<TrainingScreen />);
    app.server.storeWorkoutFromElsewhere(id, '2026-10-26', [SQUAT, PUSH_UP]);

    await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));

    const rows = await screen.findAllByRole('button', { name: /^(Wed 28 Oct|Mon 26 Oct): / });
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      'Wed 28 Oct: No exercises',
      'Mon 26 Oct: 2 exercises · Squat, Push-up',
    ]);
    await fireEvent.press(rows[1]!);
    expect(mockRouter.push).toHaveBeenLastCalledWith(`/workout/${id}`);
  });

  it('REQ-TRN-004 "Load older" reads the 90 days before the phone’s from the server and lists them, view-only', async () => {
    const { server } = await renderInApp(<TrainingScreen />);
    server.state.olderWorkouts = [
      { id: OLD_ID, day: '2026-07-01', exercises: [SQUAT], recordedAt: '2026-07-01T02:00:00.000Z', updatedAt: '2026-07-01T02:00:00.000Z' },
    ];

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByLabelText('Wed 1 Jul: 1 exercise · Squat')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Wed 1 Jul: 1 exercise · Squat' })).toBeNull();
    const call = server.calls.find((entry) => entry.path.endsWith('/workouts'));
    expect(call?.path).toBe(`/users/${ME.user.id}/workouts`);
  });

  it('REQ-TRN-004 says so when there are no older workouts', async () => {
    await renderInApp(<TrainingScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('No workouts from Sat 2 May to Thu 30 Jul.')).toBeOnTheScreen();
  });

  it('REQ-TRN-004 while older workouts load, only "Load older" waits; "Start an empty workout" stays ready', async () => {
    await renderInApp(<TrainingScreen />);
    // The server doesn't answer yet.
    const pending = jest.spyOn(client, 'callApi').mockReturnValue(new Promise(() => {}));
    try {
      await fireEvent.press(await screen.findByRole('button', { name: 'Load older' }));

      expect(screen.getByRole('button', { name: 'Load older' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Start an empty workout' })).toBeEnabled();
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));
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
