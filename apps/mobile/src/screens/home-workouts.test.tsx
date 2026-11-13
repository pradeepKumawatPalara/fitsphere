import type { WorkoutExercise } from '@fitsphere/shared';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Button } from 'react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { migrateLocal } from '../local/store';
import { SelectedDayProvider } from '../navigation/SelectedDayProvider';
import { SyncProvider, useSync } from '../sync/SyncProvider';
import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { HomeScreen } from './HomeScreen';
import { sameSets } from '../testing/exercises';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// Home's workouts with real workouts (D-103, replacing the workout tracker of REQ-HOME-007): a dumbbell
// under each day of the strip with a workout Training lists (D-65), and a line under the strip counting
// the week's against its target (MVP default, D-29; D-41: only a workout with an exercise counts). The
// line's texts are tested on their own in targets.test.tsx.

// Wednesday 28 October 2026, 09:00 IST. The week shown is Mon 26 Oct – Sun 1 Nov.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;
const noNetworkEvents = { watch: () => ({ remove: () => undefined }) };
const SQUAT: WorkoutExercise = sameSets('Squat', 3, 10, 40_000);

let ids = 0;
function newId() {
  ids += 1;
  return `00000000-0000-4000-a000-${String(ids).padStart(12, '0')}`;
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

/**
 * Home, with workouts (each with a squat) and a weekly target of 5 already on the server, so the
 * first sync brings them; `emptyDays` adds workouts with no exercise.
 */
async function renderHome(workoutDays: string[], extra?: ReactNode, emptyDays: string[] = []) {
  const db = memoryDb();
  await migrateLocal(db);
  const server = fakeServer(NOW);
  // Since 1 Oct, so every week shown has it (D-77).
  server.storeTargetFromElsewhere('weekly_workouts', 5, '2026-10-01');
  workoutDays.forEach((day) => server.storeWorkoutFromElsewhere(newId(), day, [SQUAT]));
  emptyDays.forEach((day) => server.storeWorkoutFromElsewhere(newId(), day, []));
  const client = fakeAuthClient(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
  await render(
    <AuthProvider deps={deps(client, server.fetchImpl)}>
      <LocalDatabaseProvider owner="user-1" open={async () => ({ db, cipherVersion: '4.6.1' })}>
        <SyncProvider now={clock} newId={newId} network={noNetworkEvents}>
          <SelectedDayProvider now={clock}>
            {extra}
            <HomeScreen />
          </SelectedDayProvider>
        </SyncProvider>
      </LocalDatabaseProvider>
    </AuthProvider>,
  );
  return { db, server };
}

function StartWorkout() {
  const sync = useSync();
  return (
    <>
      <Button title="Start a test workout" onPress={() => void sync.startWorkout('2026-10-28')} />
      <Button
        title="Save a test workout with a squat"
        onPress={() => void sync.save('workout', { id: newId(), day: '2026-10-28', exercises: [SQUAT], recordedAt: NOW.toISOString(), timer: null })}
      />
    </>
  );
}

describe('D-103 the strip’s dumbbells and the week’s line count real workouts', () => {
  it('D-41 a workout with an exercise counts, "1 of 5 workouts this week", with a dumbbell on its day; an empty one does not', async () => {
    await renderHome(['2026-10-26'], undefined, ['2026-10-27']);

    expect(await screen.findByText('1 of 5 workouts this week')).toBeOnTheScreen();
    const monday = screen.getByRole('button', { name: 'Monday 26 Oct, 1 workout logged' });
    expect(within(monday).getByTestId('workout-2026-10-26')).toBeOnTheScreen();
    // The empty workout is not listed on Training (D-65), so it gets no dumbbell.
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct' })).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-2026-10-27')).toBeNull();
    // No workouts card on Home any more.
    expect(screen.queryByText('Workouts this week')).toBeNull();
    expect(screen.queryByText('Mon 26 Oct – Sun 1 Nov')).toBeNull();
  });

  it('D-29 two workouts on one day count 2, with one dumbbell; the week before is not counted', async () => {
    await renderHome(['2026-10-27', '2026-10-27', '2026-10-25']);

    expect(await screen.findByText('2 of 5 workouts this week')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tuesday 27 Oct, 2 workouts logged' })).toBeOnTheScreen();
    expect(screen.getAllByTestId('workout-2026-10-27')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Sunday 1 Nov, not available' })).toBeOnTheScreen();
  });

  it('D-41 "target achieved" once the week has as many workouts as the target, or more', async () => {
    await renderHome(['2026-10-26', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-28', '2026-10-28', '2026-10-28']);

    expect(await screen.findByText('7 workouts this week · target achieved')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today, 4 workouts logged' })).toBeOnTheScreen();
  });

  it('the line follows the strip: an earlier week shows its own dumbbells and says "that week"', async () => {
    await renderHome(['2026-10-25', '2026-10-28']);
    await screen.findByText('1 of 5 workouts this week');

    await fireEvent.press(screen.getByRole('button', { name: 'Earlier days' }));

    // The previous week, Mon 19 – Sun 25 Oct, holds one workout, on the Sunday.
    expect(await screen.findByText('1 of 5 workouts that week')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sunday 25 Oct, 1 workout logged' })).toBeOnTheScreen();
    expect(screen.getByTestId('workout-2026-10-25')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-2026-10-28')).toBeNull();
  });

  it('D-41 a workout started on the phone counts once it has an exercise, before it syncs', async () => {
    const { server } = await renderHome([], <StartWorkout />);
    await screen.findByText('0 of 5 workouts this week');
    server.state.offline = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Start a test workout' }));
    expect(await screen.findByText('0 of 5 workouts this week')).toBeOnTheScreen();
    expect(screen.queryByTestId('workout-2026-10-28')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Save a test workout with a squat' }));

    expect(await screen.findByText('1 of 5 workouts this week')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today, 1 workout logged' })).toBeOnTheScreen();
  });
});

describe('ADR-0007 rule 2 a rejected workout on Home', () => {
  it('D-29 shows "This workout wasn\'t saved…", and Edit opens the workout', async () => {
    const { server } = await renderHome([], <StartWorkout />);
    await screen.findByText('0 of 5 workouts this week');
    server.state.rejectWith = 'DAY_IN_FUTURE';

    await fireEvent.press(screen.getByRole('button', { name: 'Start a test workout' }));

    expect(
      await screen.findByText("This workout wasn't saved: the date is in the future. Edit or discard it."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\/00000000-0000-4000-a000-\d{12}$/));
  });
});
