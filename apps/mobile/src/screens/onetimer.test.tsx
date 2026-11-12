import type { WorkoutTimer } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { saveEntry } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets } from '../testing/exercises';
import { WorkoutScreen } from './WorkoutScreen';

// One workout timer at a time (D-83; the owner, 2026-11-12: "if the one wrkout timer is running user
// should not be able to start a New work work"): while another workout's timer runs or is paused,
// Start workout, and Resume after Mark done, are greyed, saying why, with a link to that workout.
// Today is Wed 28 Oct 2026, 09:00 in India.

const mockParams = { id: '' };
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

const OTHER_ID = '66666666-6666-4666-8666-666666666666';
const THIS_ID = '77777777-7777-4777-8777-777777777777';
const SQUAT = sameSets('Squat', 3, 10, 40_000);
const RUNNING: WorkoutTimer = { startedAt: '2026-10-28T03:00:00.000Z', countedSeconds: 0, runningSince: '2026-10-28T03:00:00.000Z', doneAt: null };
const PAUSED: WorkoutTimer = { ...RUNNING, countedSeconds: 600, runningSince: null };
const DONE: WorkoutTimer = { startedAt: '2026-10-28T01:00:00.000Z', countedSeconds: 1800, runningSince: null, doneAt: '2026-10-28T01:30:00.000Z' };

beforeEach(() => {
  mockParams.id = THIS_ID;
  mockRouter.push.mockClear();
});

async function renderWith(other: WorkoutTimer | null, own: WorkoutTimer | null = null) {
  await renderInApp(<WorkoutScreen now={() => NOW} />, undefined, async (db) => {
    await saveEntry(db, 'workout', {
      changeId: '00000000-0000-4000-8000-0000000000e1',
      data: { id: OTHER_ID, day: '2026-10-28', exercises: [SQUAT], recordedAt: '2026-10-28T02:00:00.000Z', timer: other },
    });
    await saveEntry(db, 'workout', {
      changeId: '00000000-0000-4000-8000-0000000000e2',
      data: { id: THIS_ID, day: '2026-10-28', exercises: [SQUAT], recordedAt: '2026-10-28T03:10:00.000Z', timer: own },
    });
  });
  await screen.findByText(/^Workout 2 · /);
}

describe('D-83 one workout timer at a time', () => {
  it('greys Start workout while another workout’s timer runs, says why and opens that workout', async () => {
    await renderWith(RUNNING);

    expect(await screen.findByText("Another workout's timer is running: Workout 1 · Wed 28 Oct. Mark it done to start this one.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Workout 1' }));

    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${OTHER_ID}`);
  });

  it('counts a paused timer too', async () => {
    await renderWith(PAUSED);

    expect(await screen.findByText("Another workout's timer is paused: Workout 1 · Wed 28 Oct. Mark it done to start this one.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeDisabled();
  });

  it('lets a timer start once the other is marked done', async () => {
    await renderWith(DONE);

    expect(await screen.findByRole('button', { name: 'Start workout' })).toBeEnabled();
    expect(screen.queryByText(/^Another workout's timer/)).toBeNull();
  });

  it('greys Resume after Mark done while another workout’s timer runs', async () => {
    await renderWith(RUNNING, DONE);

    expect(await screen.findByText("Another workout's timer is running: Workout 1 · Wed 28 Oct. Mark it done to start this one.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled();
  });
});
