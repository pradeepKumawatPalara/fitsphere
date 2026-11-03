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

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The Home workout tracker with real workouts (REQ-HOME-007; Q-025; MVP default, D-29). The
// tracker's texts are tested on their own in targets.test.tsx.

// Wednesday 28 October 2026, 09:00 IST. The week shown is Mon 26 Oct – Sun 1 Nov.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;
const noNetworkEvents = { watch: () => ({ remove: () => undefined }) };
const SQUAT: WorkoutExercise = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };

let ids = 0;
function newId() {
  ids += 1;
  return `00000000-0000-4000-a000-${String(ids).padStart(12, '0')}`;
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

/** Home, with workouts and a weekly target of 5 already on the server, so the first sync brings them. */
async function renderHome(workoutDays: string[], extra?: ReactNode) {
  const db = memoryDb();
  await migrateLocal(db);
  const server = fakeServer(NOW);
  server.storeTargetFromElsewhere('weekly_workouts', 5);
  workoutDays.forEach((day, index) => server.storeWorkoutFromElsewhere(newId(), day, index % 2 === 0 ? [] : [SQUAT]));
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
  return <Button title="Start a test workout" onPress={() => void sync.startWorkout('2026-10-28')} />;
}

describe('REQ-HOME-007 the workout tracker counts real workouts', () => {
  it('Q-025 one workout with no exercises counts: "1 of 5 · 4 left" and its dot', async () => {
    await renderHome(['2026-10-26']);

    expect(await screen.findByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday 26 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tuesday 27 Oct: no workout')).toBeOnTheScreen();
  });

  it('D-29 two workouts on one day count 2 with one dot; the week before is not counted', async () => {
    await renderHome(['2026-10-27', '2026-10-27', '2026-10-25']);

    expect(await screen.findByText('2 of 5 · 3 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Tuesday 27 Oct: 2 workouts')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sunday 1 Nov: future')).toBeOnTheScreen();
  });

  it('D-23 "target reached" once the week has as many workouts as the target', async () => {
    await renderHome(['2026-10-26', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-28']);

    expect(await screen.findByText('5 of 5 · target reached')).toBeOnTheScreen();
  });

  it('Q-026 the count follows the week of the selected date', async () => {
    await renderHome(['2026-10-25', '2026-10-28'], <PickDay day="2026-10-20" />);
    await screen.findByText('1 of 5 · 4 left');

    await fireEvent.press(screen.getByRole('button', { name: 'Pick 2026-10-20' }));

    // The previous week, Mon 19 – Sun 25 Oct, holds one workout, on the Sunday.
    expect(await screen.findByLabelText('Sunday 25 Oct: 1 workout')).toBeOnTheScreen();
    expect(screen.getByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wednesday 21 Oct: no workout')).toBeOnTheScreen();
  });

  it('REQ-HOME-007 a workout started on the phone counts at once, before it syncs', async () => {
    const { server } = await renderHome([], <StartWorkout />);
    await screen.findByText('0 of 5 · 5 left');
    server.state.offline = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Start a test workout' }));

    expect(await screen.findByText('1 of 5 · 4 left')).toBeOnTheScreen();
    expect(screen.getByLabelText('Wednesday 28 Oct: 1 workout')).toBeOnTheScreen();
  });
});

describe('D-34 each day of the tracker can be tapped', () => {
  it('a day with one workout opens it', async () => {
    await renderHome(['2026-10-26']);

    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct: 1 workout' }));

    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/workout\/00000000-0000-4000-a000-\d{12}$/));
  });

  it('a day with two shows 2 on its dot, and asks which to open', async () => {
    await renderHome(['2026-10-27', '2026-10-27']);

    const day = await screen.findByRole('button', { name: 'Tuesday 27 Oct: 2 workouts' });
    expect(within(day).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(day);

    expect(screen.getByRole('header', { name: 'Workouts on Tue 27 Oct' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Workout [12] · No exercises$/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Workout [12] · 1 exercise · Squat$/ }));
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
