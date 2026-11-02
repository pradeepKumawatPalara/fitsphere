import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Button } from 'react-native';
import { getEntry } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { renderInApp } from '../testing/appHarness';
import { exerciseRules } from '../workouts';
import { TrainingScreen } from './TrainingScreen';
import { WorkoutScreen } from './WorkoutScreen';

const RULES = exerciseRules('kg');

// One workout (REQ-TRN-003, REQ-TRN-005; Q-025, Q-042; MVP defaults, D-29). The Training tab and
// the workout screen are rendered together; "opening" a workout sets the screen's route parameter.

const mockParams = { id: '' };
const mockRouter = {
  push: jest.fn((path: string) => {
    mockParams.id = path.replace('/workout/', '');
  }),
  back: jest.fn(),
  replace: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

beforeEach(() => {
  mockParams.id = '';
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
});

const SQUAT = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };

function PickDay({ day }: { day: string }) {
  const { select } = useSelectedDay();
  return <Button title={`Pick ${day}`} onPress={() => select(day)} />;
}

async function startWorkout(pickDay?: string) {
  const app = await renderInApp(
    <>
      {pickDay ? <PickDay day={pickDay} /> : null}
      <TrainingScreen />
      <WorkoutScreen />
    </>,
  );
  if (pickDay) await fireEvent.press(await screen.findByRole('button', { name: `Pick ${pickDay}` }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));
  await screen.findByText(/^Workout · /);
  return { ...app, id: mockParams.id };
}

type Fields = Partial<Record<'name' | 'sets' | 'reps' | 'weight' | 'note', string>>;

async function fill(fields: Fields) {
  const labels = { name: 'Exercise name', sets: 'Sets', reps: 'Reps', weight: 'Weight in kg (optional)', note: 'Note (optional)' };
  for (const [field, value] of Object.entries(fields)) {
    await fireEvent.changeText(screen.getByLabelText(labels[field as keyof Fields]), value);
  }
}

async function addExercise(fields: Fields) {
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fill(fields);
  await fireEvent.press(screen.getByRole('button', { name: 'Save exercise' }));
}

describe('REQ-TRN-003 starting a workout', () => {
  it('Q-025 "Start an empty workout" saves a workout with no exercises on today, opens it and syncs it', async () => {
    const { db, server, id } = await startWorkout();

    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${id}`);
    expect(screen.getByText('Workout · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByText('No exercises yet.')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Wed 28 Oct: No exercises' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ deleted: false, day: '2026-10-28', exercises: [] }));
    expect(await getEntry(db, 'workout', id)).toMatchObject({ syncState: 'synced' });
  });

  it('Q-011 a workout started with a past date selected belongs to that day', async () => {
    const { server, id } = await startWorkout('2026-10-20');

    expect(screen.getByText('Workout · Tue 20 Oct')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ day: '2026-10-20' }));
  });
});

describe('REQ-TRN-003 exercises as sets × reps × weight with an optional note (Q-042)', () => {
  it('Q-042 adds exercises with and without a weight and a note, in kg (REQ-TRN-005), and syncs them in grams', async () => {
    const { server, id } = await startWorkout();

    await addExercise({ name: 'Squat', sets: '3', reps: '10', weight: '40' });
    await screen.findByRole('button', { name: 'Squat: 3 × 10 × 40.0 kg' });
    await addExercise({ name: ' Push-up ', sets: '2', reps: '20', note: 'Slow on the way down' });

    expect(await screen.findByRole('button', { name: 'Push-up: 2 × 20' })).toBeOnTheScreen();
    expect(screen.getByText('Slow on the way down')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Wed 28 Oct: 2 exercises · Squat, Push-up' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([
        SQUAT,
        { name: 'Push-up', sets: 2, reps: 20, weightGrams: null, note: 'Slow on the way down' },
      ]),
    );
  });

  it.each([
    [{ name: '' }, RULES.name],
    [{ name: '   ' }, RULES.name],
    [{ name: 'x'.repeat(81) }, RULES.name],
    [{ sets: '0' }, RULES.sets],
    [{ sets: '21' }, RULES.sets],
    [{ sets: '2.5' }, RULES.sets],
    [{ reps: '' }, RULES.reps],
    [{ reps: '201' }, RULES.reps],
    [{ weight: '0' }, RULES.weight],
    [{ weight: '500.1' }, RULES.weight],
    [{ weight: '40.25' }, RULES.weight],
    [{ weight: 'abc' }, RULES.weight],
    [{ note: 'x'.repeat(501) }, RULES.note],
  ])('D-29 refuses %j with its rule and saves nothing', async (wrong, rule) => {
    const { db, id } = await startWorkout();

    await addExercise({ name: 'Squat', sets: '3', reps: '10', ...wrong });

    expect(await screen.findByText(rule)).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('D-29 shows every problem at once, each under its field', async () => {
    await startWorkout();

    await addExercise({ name: 'Squat', sets: '0', reps: '' });

    expect(await screen.findByText(RULES.sets)).toBeOnTheScreen();
    expect(screen.getByText(RULES.reps)).toBeOnTheScreen();
    expect(screen.queryByText(RULES.name)).toBeNull();
  });

  it('D-29 accepts the ends of each range', async () => {
    const { db, id } = await startWorkout();

    await addExercise({ name: 'x'.repeat(80), sets: '20', reps: '200', weight: '500.0', note: 'x'.repeat(500) });
    await screen.findByRole('button', { name: `${'x'.repeat(80)}: 20 × 200 × 500.0 kg` });
    await addExercise({ name: 'Plate', sets: '1', reps: '1', weight: '0,1' });

    await waitFor(async () =>
      expect((await getEntry(db, 'workout', id))?.exercises.map((exercise) => exercise.weightGrams)).toEqual([500_000, 100]),
    );
  });

  it('REQ-TRN-003 editing an exercise opens it filled in and saves the change', async () => {
    const { server, id } = await startWorkout();
    await addExercise({ name: 'Squat', sets: '3', reps: '10', weight: '40', note: 'Felt easy' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Squat: 3 × 10 × 40.0 kg' }));
    expect(screen.getByText('Edit exercise')).toBeOnTheScreen();
    expect(screen.getByLabelText('Weight in kg (optional)').props.value).toBe('40.0');
    expect(screen.getByLabelText('Note (optional)').props.value).toBe('Felt easy');
    await fill({ reps: '12', note: '' });
    await fireEvent.press(screen.getByRole('button', { name: 'Save exercise' }));

    expect(await screen.findByRole('button', { name: 'Squat: 3 × 12 × 40.0 kg' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)?.exercises).toEqual([{ ...SQUAT, reps: 12 }]));
  });

  it('REQ-TRN-003 removing an exercise needs no confirmation', async () => {
    const { db, id } = await startWorkout();
    await addExercise({ name: 'Squat', sets: '3', reps: '10' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Squat: 3 × 10' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove exercise' }));

    expect(await screen.findByText('No exercises yet.')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('Q-029 Cancel closes the sheet and saves nothing', async () => {
    const { db, id } = await startWorkout();

    await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
    await fill({ name: 'Squat', sets: '3', reps: '10' });
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('header', { name: 'Add exercise' })).toBeNull();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });
});

describe('REQ-TRN-003 deleting a workout', () => {
  it('D-29 asks first; Keep keeps it, Delete removes it from the phone and the server', async () => {
    const { db, server, id } = await startWorkout();
    await waitFor(() => expect(server.entries('workouts').get(id)).toBeDefined());

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    expect(screen.getByText('Delete this workout? It leaves your history and your weekly count.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect(await getEntry(db, 'workout', id)).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'workout', id)).toBeNull();
    expect(await screen.findByText('No workouts logged yet.')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ deleted: true }));
  });
});

describe('REQ-NFR-004 workouts offline', () => {
  it('ADR-0007 a workout started and logged offline waits on the phone, then syncs once the connection is back', async () => {
    const { server, id } = await renderOfflineThenStart();

    await addExercise({ name: 'Squat', sets: '3', reps: '10', weight: '40' });
    expect(await screen.findByText('Waiting to sync')).toBeOnTheScreen();
    expect(await screen.findByText('waiting to sync')).toBeOnTheScreen();
    expect(server.entries('workouts').size).toBe(0);

    server.state.offline = false;
    await addExercise({ name: 'Push-up', sets: '2', reps: '20' });

    await waitFor(() => expect(server.entries('workouts').get(id)?.exercises).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText('Waiting to sync')).toBeNull());
  });
});

async function renderOfflineThenStart() {
  const app = await renderInApp(
    <>
      <TrainingScreen />
      <WorkoutScreen />
    </>,
  );
  app.server.state.offline = true;
  await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));
  await screen.findByText(/^Workout · /);
  return { ...app, id: mockParams.id };
}
