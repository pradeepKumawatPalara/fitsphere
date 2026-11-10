import type { WorkoutExercise } from '@fitsphere/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Button } from 'react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import { getEntry, migrateLocal } from '../local/store';
import { SelectedDayProvider, useSelectedDay } from '../navigation/SelectedDayProvider';
import { SyncProvider, useSync } from '../sync/SyncProvider';
import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { HomeScreen } from './HomeScreen';
import { sameSets } from '../testing/exercises';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The Home workout tracker with real workouts (REQ-HOME-007; MVP default, D-29; D-41: only a workout
// with an exercise counts). The tracker's texts are tested on their own in targets.test.tsx.

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
  server.storeTargetFromElsewhere('weekly_workouts', 5);
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

function PickDay({ day }: { day: string }) {
  const { select } = useSelectedDay();
  return <Button title={`Pick ${day}`} onPress={() => select(day)} />;
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

describe('REQ-HOME-007 the workout tracker counts real workouts', () => {
  it('D-41 a workout with an exercise counts, "1 of 5 · 4 left" with 1 on its day; an empty one does not', async () => {
    await renderHome(['2026-10-26'], undefined, ['2026-10-27']);

    expect(await screen.findByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: 'Monday 26 Oct: 1 workout' })).getByText('1')).toBeOnTheScreen();
    // This week, named with its dates (D-34).
    expect(screen.getByText('Workouts this week')).toBeOnTheScreen();
    expect(screen.getByText('Mon 26 Oct – Sun 1 Nov')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday 26 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tuesday 27 Oct: no workout')).toBeOnTheScreen();
  });

  it('D-29 two workouts on one day count 2 with one dot; the week before is not counted', async () => {
    await renderHome(['2026-10-27', '2026-10-27', '2026-10-25']);

    expect(await screen.findByText('2 of 5 · 3 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tuesday 27 Oct: 2 workouts')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday 1 Nov: future')).toBeOnTheScreen();
  });

  it('D-41 "target achieved" once the week has as many workouts as the target, or more', async () => {
    await renderHome(['2026-10-26', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-28', '2026-10-28', '2026-10-28']);

    expect(await screen.findByText('7 workouts · target achieved')).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: 'Wednesday 28 Oct: 4 workouts' })).getByText('4')).toBeOnTheScreen();
  });

  it('Q-026 the count follows the week of the selected date', async () => {
    await renderHome(['2026-10-25', '2026-10-28'], <PickDay day="2026-10-20" />);
    await screen.findByText('1 of 5 · 4 left');

    await fireEvent.press(screen.getByRole('button', { name: 'Pick 2026-10-20' }));

    // The previous week, Mon 19 – Sun 25 Oct, holds one workout, on the Sunday.
    expect(await screen.findByLabelText('Sunday 25 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.getByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wednesday 21 Oct: no workout')).toBeOnTheScreen();
    // An earlier week says so, and which it is (D-34).
    expect(screen.getByText('Workouts that week')).toBeOnTheScreen();
    expect(screen.getByText('Mon 19 Oct – Sun 25 Oct')).toBeOnTheScreen();
    expect(screen.queryByText('Workouts this week')).toBeNull();
  });

  it('D-41 a workout started on the phone counts once it has an exercise, before it syncs', async () => {
    const { server } = await renderHome([], <StartWorkout />);
    await screen.findByText('0 of 5 · 5 left');
    server.state.offline = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Start a test workout' }));
    await waitFor(() => expect(screen.getByText('0 of 5 · 5 left')).toBeOnTheScreen());
    expect(screen.getByLabelText('Wednesday 28 Oct: no workout')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save a test workout with a squat' }));

    expect(await screen.findByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wednesday 28 Oct: 1 workout')).toBeOnTheScreen();
  });
});

describe('D-34 each day of the tracker can be tapped', () => {
  it('D-42 a day with one workout lists it, and offers another workout on that day', async () => {
    const { db } = await renderHome(['2026-10-26']);

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct: 1 workout' }));
    expect(screen.getByRole('header', { name: 'Workouts on Mon 26 Oct' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Workout 1 · 1 exercise · Squat' }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\/00000000-0000-4000-a000-\d{12}$/));
    mockRouter.push.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Monday 26 Oct: 1 workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log another workout' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
    const id = (mockRouter.push.mock.calls[0]![0] as string).slice('/workout/'.length);
    expect(await getEntry(db, 'workout', id)).toMatchObject({ day: '2026-10-26', exercises: [] });
  });

  it('a day with two shows 2 on its square, and asks which to open, not listing an empty one (D-41, D-65)', async () => {
    await renderHome(['2026-10-27', '2026-10-27'], undefined, ['2026-10-27']);

    const day = await screen.findByRole('button', { name: 'Tuesday 27 Oct: 2 workouts' });
    expect(within(day).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(day);

    expect(screen.getByRole('header', { name: 'Workouts on Tue 27 Oct' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Workout \d · No exercises$/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Workout [12] · 1 exercise · Squat$/ })).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: /^Workout [12] · 1 exercise · Squat$/ })[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\//));
  });

  it('a day up to today with none offers to start one on that day', async () => {
    const { db } = await renderHome(['2026-10-26']);

    await fireEvent.press(await screen.findByRole('button', { name: 'Tuesday 27 Oct: no workout' }));
    expect(screen.getByRole('header', { name: 'No workout on Tue 27 Oct' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start a workout on this day' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const id = String(mockRouter.push.mock.calls[0]![0]).replace('/workout/', '');
    expect(await getEntry(db, 'workout', id)).toMatchObject({ day: '2026-10-27', exercises: [] });
  });

  it('a workout can be started on a day of an earlier week too', async () => {
    const { db } = await renderHome([], <PickDay day="2026-10-20" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Pick 2026-10-20' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Wednesday 21 Oct: no workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start a workout on this day' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const id = String(mockRouter.push.mock.calls[0]![0]).replace('/workout/', '');
    expect(await getEntry(db, 'workout', id)).toMatchObject({ day: '2026-10-21' });
  });

  it('a later day is greyed and cannot be tapped', async () => {
    await renderHome([]);

    expect(await screen.findByRole('button', { name: 'Thursday 29 Oct: future' })).toBeDisabled();
  });
});

describe('ADR-0007 rule 2 a rejected workout on Home', () => {
  it('D-29 shows "This workout wasn\'t saved…", and Edit opens the workout', async () => {
    const { server } = await renderHome([], <StartWorkout />);
    await screen.findByText('0 of 5 · 5 left');
    server.state.rejectWith = 'DAY_IN_FUTURE';

    await fireEvent.press(screen.getByRole('button', { name: 'Start a test workout' }));

    expect(
      await screen.findByText("This workout wasn't saved: the date is in the future. Edit or discard it."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\/00000000-0000-4000-a000-\d{12}$/));
  });
});
