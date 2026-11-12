import type { WorkoutTimer } from '@fitsphere/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { saveEntry } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets } from '../testing/exercises';
import { runningWorkout, WorkoutInProgress } from './WorkoutInProgress';

// "Workout in progress" (D-83, the owner's B): a pill above the tabs while a workout's timer runs or
// is paused. Today is Wed 28 Oct 2026, 09:00 in India (03:30 UTC).

const SQUAT = sameSets('Squat', 3, 10, 40_000);
const running = (startedAt: string): WorkoutTimer => ({ startedAt, countedSeconds: 0, runningSince: startedAt, doneAt: null });
const paused = (startedAt: string, countedSeconds: number): WorkoutTimer => ({ startedAt, countedSeconds, runningSince: null, doneAt: null });
const done = (startedAt: string): WorkoutTimer => ({ startedAt, countedSeconds: 1800, runningSince: null, doneAt: '2026-10-28T03:00:00.000Z' });

const workout = (id: string, day: string, recordedAt: string, timer: WorkoutTimer | null, exercises = [SQUAT]) => ({ id, day, recordedAt, exercises, timer });

describe('D-83 the workout the pill shows', () => {
  it('shows a running timer before a paused one, the latest started, named by its place in its day', () => {
    const list = [
      workout('a', '2026-10-28', '2026-10-28T01:00:00.000Z', done('2026-10-28T01:00:00.000Z')),
      workout('b', '2026-10-28', '2026-10-28T02:00:00.000Z', paused('2026-10-28T02:00:00.000Z', 600)),
      workout('c', '2026-10-28', '2026-10-28T03:00:00.000Z', running('2026-10-28T03:00:00.000Z')),
    ];
    expect(runningWorkout(list, '2026-10-28')).toMatchObject({ id: 'c', name: 'Workout 3' });
    expect(runningWorkout(list.slice(0, 2), '2026-10-28')).toMatchObject({ id: 'b', name: 'Workout 2' });
    expect(runningWorkout(list.slice(0, 1), '2026-10-28')).toBeNull();
  });

  it('keeps yesterday’s (a timer can run past midnight), not older ones', () => {
    expect(runningWorkout([workout('y', '2026-10-27', '2026-10-27T17:00:00.000Z', running('2026-10-27T17:00:00.000Z'))], '2026-10-28')).toMatchObject({ id: 'y' });
    expect(runningWorkout([workout('o', '2026-10-25', '2026-10-25T10:00:00.000Z', paused('2026-10-25T10:00:00.000Z', 60))], '2026-10-28')).toBeNull();
  });

  it('counts a workout timed before its first exercise', () => {
    expect(runningWorkout([workout('e', '2026-10-28', '2026-10-28T03:00:00.000Z', running('2026-10-28T03:00:00.000Z'), [])], '2026-10-28')).toMatchObject({
      id: 'e',
      name: 'Workout 1',
    });
  });
});

describe('D-83 the pill', () => {
  async function renderPill(timer: WorkoutTimer | null) {
    const onOpen = jest.fn();
    await renderInApp(<WorkoutInProgress bottom={100} onOpen={onOpen} now={() => NOW} />, undefined, async (db) => {
      await saveEntry(db, 'workout', {
        changeId: '00000000-0000-4000-8000-0000000000d1',
        data: { id: '55555555-5555-4555-8555-555555555555', day: '2026-10-28', exercises: [SQUAT], recordedAt: '2026-10-28T03:00:00.000Z', timer },
      });
    });
    return onOpen;
  }

  it('shows a running workout’s time counting and opens the workout', async () => {
    const onOpen = await renderPill(running('2026-10-28T03:17:26.000Z'));

    const pill = await screen.findByRole('button', { name: 'Workout 1, running, 12 minutes 34 seconds' });
    expect(screen.getByText('12:34')).toBeOnTheScreen();
    await fireEvent.press(pill);

    expect(onOpen).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
  });

  it('shows a paused one with its time held', async () => {
    await renderPill(paused('2026-10-28T02:00:00.000Z', 1868));

    expect(await screen.findByRole('button', { name: 'Workout 1, paused, 31 minutes 8 seconds' })).toBeOnTheScreen();
  });

  it('shows nothing once the workout is done, or with no timer', async () => {
    await renderPill(done('2026-10-28T02:00:00.000Z'));
    // Let the phone's workouts be read before looking for the pill.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.queryByRole('button', { name: /^Workout 1, / })).toBeNull();
  });
});
