import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Button, Keyboard, StyleSheet, type EmitterSubscription } from 'react-native';
import { getEntry, replaceExercises, saveEntry, saveWeighIn, type WorkoutData } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets, TEST_EXERCISE_LIST, withExerciseList } from '../testing/exercises';
import { exerciseRules, type SetText } from '../workouts';
import { TrainingScreen } from './TrainingScreen';
import { WorkoutScreen } from './WorkoutScreen';
import { setCheckPause } from '../fieldChecks';

const RULES = exerciseRules('kg');

// One workout (REQ-TRN-003, REQ-TRN-005; Q-025, Q-042; MVP defaults, D-29; the exercise list, sets
// and cardio, D-50). The Training tab and the workout screen are rendered together; "opening" a
// workout sets the screen's route parameter. The phone holds the test exercise list.

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

const NONE = { durationSeconds: null, calories: null, averageHeartRateBpm: null, highestHeartRateBpm: null, note: null };
const CARDIO = { speedMetresPerHour: null, inclinePermille: null, level: null, distanceMetres: null };

function PickDay({ day }: { day: string }) {
  const { select } = useSelectedDay();
  return <Button title={`Pick ${day}`} onPress={() => select(day)} />;
}

/** Training and the workout screen, the test exercise list on the phone, and a weigh-in the day before when given. */
async function startWorkout(pickDay?: string, weightGrams?: number) {
  const app = await renderInApp(
    <>
      {pickDay ? <PickDay day={pickDay} /> : null}
      <TrainingScreen />
      <WorkoutScreen now={() => NOW} />
    </>,
    undefined,
    async (db, server) => {
      await withExerciseList(db, server);
      if (weightGrams !== undefined) {
        await saveWeighIn(db, { changeId: '00000000-0000-4000-8000-0000000000c1', day: '2026-10-27', weightGrams, recordedAt: '2026-10-27T02:00:00.000Z' });
      }
    },
  );
  if (pickDay) await fireEvent.press(await screen.findByRole('button', { name: `Pick ${pickDay}` }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Log workout for / }));
  await screen.findByText(/^Workout \d+ · /);
  return { ...app, id: mockParams.id };
}

async function openSheet() {
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
}

/** Types a name and leaves the field, as when it is not one of the matches. */
async function typeName(name: string) {
  const field = screen.getByLabelText('Exercise name');
  await fireEvent.changeText(field, name);
  await fireEvent(field, 'blur');
}

/** Searches for `query` and picks `name` from the matches. */
async function pick(query: string, name: string) {
  await fireEvent.changeText(screen.getByLabelText('Exercise name'), query);
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) }));
}

const COLUMNS = { reps: 'Reps', weight: 'Weight in kg', seconds: 'Time in sec' };

/** Types each set's fields, adding a set (a copy of the last) before each after the first. */
async function fillSets(sets: Partial<SetText>[]) {
  for (const [index, set] of sets.entries()) {
    if (index > 0) await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    for (const [column, value] of Object.entries(set)) {
      const label = new RegExp(`^Set ${index + 1}, ${COLUMNS[column as keyof SetText]}`);
      await fireEvent.changeText(await screen.findByLabelText(label), value);
      // Moving on to the next field, as the user does (D-99: an empty field's problem shows once left).
      await fireEvent(screen.getByLabelText(label), 'blur');
    }
  }
}

async function save() {
  await fireEvent.press(screen.getByRole('button', { name: 'Save exercise' }));
}

/** An exercise of the user's own, logged as sets of reps and an optional weight. */
async function addOwn({ name = 'Squat', reps = '10', weight, note }: { name?: string; reps?: string; weight?: string; note?: string }) {
  await openSheet();
  await typeName(name);
  if (name.trim() !== '') await fillSets([{ reps, ...(weight === undefined ? {} : { weight }) }]);
  if (note !== undefined) await fireEvent.changeText(screen.getByLabelText('Note (optional)'), note);
  await save();
}

describe('REQ-TRN-003 starting a workout', () => {
  it('Q-025 "Log workout" saves a workout with no exercises on today, opens it and syncs it', async () => {
    const { db, server, id } = await startWorkout();

    expect(mockRouter.push).toHaveBeenCalledWith(`/workout/${id}`);
    expect(screen.getByText('Workout 1 · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.getByText('No exercises yet. Add one to log this workout.')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ deleted: false, day: '2026-10-28', exercises: [] }));
    expect(await getEntry(db, 'workout', id)).toMatchObject({ syncState: 'synced' });
    // D-65: with no exercise yet, Training doesn't list it.
    expect(screen.getByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
  });

  it('D-65 a workout is numbered among the day’s workouts with an exercise: an empty one doesn’t count', async () => {
    await renderInApp(
      <>
        <TrainingScreen />
        <WorkoutScreen now={() => NOW} />
      </>,
      undefined,
      async (db, server) => {
        await withExerciseList(db, server);
        server.storeWorkoutFromElsewhere('0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b', '2026-10-28', []);
      },
    );

    await fireEvent.press(await screen.findByRole('button', { name: /^Log workout for / }));

    expect(await screen.findByText('Workout 1 · Wed 28 Oct')).toBeOnTheScreen();
  });

  it('Q-011 a workout started with a past date selected belongs to that day', async () => {
    const { server, id } = await startWorkout('2026-10-20');

    expect(screen.getByText('Workout 1 · Tue 20 Oct')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ day: '2026-10-20' }));
  });
});

describe('D-50 picking from the exercise list', () => {
  it('lists the matches of a search with their category and sub-group, or their group, "dumbell" finding the dumbbell exercises', async () => {
    await startWorkout();
    await openSheet();
    expect(screen.getByText(/^Pick a category to see its exercises, or type to search all of them/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'dumbell');

    expect(await screen.findByRole('button', { name: 'Dumbbell bench press, Dumbbell · Chest' })).toBeOnTheScreen();
    // A (the owner, 2026-11-10): the category and sub-group on a second line under the name.
    expect(within(screen.getByRole('button', { name: 'Dumbbell bench press, Dumbbell · Chest' })).getByText('Dumbbell · Chest')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell curl, Dumbbell · Biceps' })).toBeOnTheScreen();
    // In no category of the library (D-67): its group, as D-50 tags it.
    expect(screen.getByRole('button', { name: "Farmer's walk, Dumbbell" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Push-up, / })).toBeNull();
    expect(screen.queryByText('Sets')).toBeNull();
  });

  it('a weighted exercise asks for the weight of every set, each set with its own reps and weight', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('dumbell', 'Dumbbell bench press');
    expect(screen.getByText('Weight and reps')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell · Chest')).toBeOnTheScreen();
    await fillSets([
      { reps: '10', weight: '20' },
      { reps: '8', weight: '22.5' },
      { reps: '6', weight: '25' },
    ]);
    await save();

    expect(await screen.findByRole('button', { name: 'Dumbbell bench press: Set 1, 10 × 20.0 kg; Set 2, 8 × 22.5 kg; Set 3, 6 × 25.0 kg' })).toBeOnTheScreen();
    // D-63: each set on its own row, its number beside it.
    for (const [label, value] of [
      ['Set 1', '10 × 20.0 kg'],
      ['Set 2', '8 × 22.5 kg'],
      ['Set 3', '6 × 25.0 kg'],
    ] as const) {
      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByText(value)).toBeOnTheScreen();
    }
    // D-93: the name stands out in bold; the sets are plain running text, not condensed capitals.
    expect(screen.getByText('Dumbbell bench press')).toHaveStyle({ fontFamily: 'Barlow_700Bold' });
    expect(screen.getByText('Set 1')).toHaveStyle({ fontFamily: 'Barlow_400Regular' });
    expect(screen.getByText('Set 1')).not.toHaveStyle({ textTransform: 'uppercase' });
    expect(screen.getByText('10 × 20.0 kg')).toHaveStyle({ fontFamily: 'Barlow_400Regular' });
    expect(screen.getByText('10 × 20.0 kg')).not.toHaveStyle({ textTransform: 'uppercase' });
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([
        {
          kind: 'sets',
          name: 'Dumbbell bench press',
          sets: [
            { reps: 10, weightGrams: 20_000, seconds: null },
            { reps: 8, weightGrams: 22_500, seconds: null },
            { reps: 6, weightGrams: 25_000, seconds: null },
          ],
          ...NONE,
          // D-120-style: the time follows the reps, 24 reps × 4 s (the exercise-time plan).
          durationSeconds: 96,
        },
      ]),
    );
  });

  it('refuses a set of a weighted exercise without its weight, naming the set, and saves nothing', async () => {
    const { db, id } = await startWorkout();
    await openSheet();

    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }, { reps: '8', weight: '' }]);
    await save();

    expect(await screen.findByText('Set 2: enter the weight you lifted, from 0.1 to 1000.0 kg.')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('a bodyweight exercise shows no weight; Add set copies the last set', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('push', 'Push-up');
    expect(screen.queryByLabelText(/^Set 1, Weight/)).toBeNull();
    await fillSets([{ reps: '15' }, {}, {}]);
    await save();

    expect(await screen.findByRole('button', { name: 'Push-up: 3 sets, 15 reps' })).toBeOnTheScreen();
    // D-63: sets all the same share one row.
    expect(screen.getByText('3 sets')).toBeOnTheScreen();
    expect(screen.getByText('15 reps')).toBeOnTheScreen();
    expect(screen.queryByText('Set 1')).toBeNull();
    await waitFor(() => expect(server.entries('workouts').get(id)?.exercises).toEqual([{ ...sameSets('Push-up', 3, 15, null), durationSeconds: 135 }]));
  });

  it('a set can be removed while another is left', async () => {
    await startWorkout();
    await openSheet();
    await pick('push', 'Push-up');
    expect(screen.queryByRole('button', { name: 'Remove set 1' })).toBeNull();

    await fillSets([{ reps: '15' }, { reps: '12' }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove set 1' }));
    await save();

    expect(await screen.findByRole('button', { name: 'Push-up: 1 set, 12 reps' })).toBeOnTheScreen();
  });

  it('a timed exercise asks for each set’s time', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('plank', 'Plank');
    await fillSets([{ seconds: '60' }, { seconds: '45' }]);
    await save();

    expect(await screen.findByRole('button', { name: 'Plank: Set 1, 1:00; Set 2, 0:45' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([
        {
          kind: 'sets',
          name: 'Plank',
          sets: [
            { reps: null, weightGrams: null, seconds: 60 },
            { reps: null, weightGrams: null, seconds: 45 },
          ],
          ...NONE,
        },
      ]),
    );
  });

  it('a weight-and-time exercise asks for both on every set', async () => {
    await startWorkout();
    await openSheet();

    await pick('farmer', "Farmer's walk");
    await fillSets([{ weight: '24', seconds: '45' }, {}, {}]);
    await save();

    expect(await screen.findByRole('button', { name: "Farmer's walk: 3 sets, 0:45 × 24.0 kg" })).toBeOnTheScreen();
  });

  it('running asks for the time and the distance, and shows the average speed and pace', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('run', 'Running');
    expect(screen.getByText('Distance and time')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '30');
    await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), '5');
    expect(screen.getByText('Average speed 10.0 km/h · 6:00 /km')).toBeOnTheScreen();
    await save();

    expect(await screen.findByRole('button', { name: 'Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km' })).toBeOnTheScreen();
    // D-93: the cardio line is plain running text too.
    expect(screen.getByText('30:00 · 5.00 km')).toHaveStyle({ fontFamily: 'Barlow_400Regular' });
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([
        { kind: 'cardio', name: 'Running', ...NONE, ...CARDIO, durationSeconds: 1_800, distanceMetres: 5_000 },
      ]),
    );
  });

  it('a treadmill asks for its speed and incline', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('treadmill', 'Treadmill walking');
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '30');
    await fireEvent.changeText(screen.getByLabelText('Speed in km/h (optional)'), '6');
    await fireEvent.changeText(screen.getByLabelText('Incline in % (optional)'), '8');
    await save();

    expect(await screen.findByRole('button', { name: 'Treadmill walking: 30:00 · 6.0 km/h, 8.0 % incline' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([
        { kind: 'cardio', name: 'Treadmill walking', ...NONE, ...CARDIO, durationSeconds: 1_800, speedMetresPerHour: 6_000, inclinePermille: 80 },
      ]),
    );
  });

  it('a cardio machine asks for its level', async () => {
    await startWorkout();
    await openSheet();

    await pick('bike', 'Exercise bike');
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '20');
    await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), '6.5');
    await fireEvent.changeText(screen.getByLabelText('Level (optional)'), '8');
    await save();

    expect(await screen.findByRole('button', { name: 'Exercise bike: 20:00 · 6.50 km, 19.5 km/h · 3:05 /km · Level 8' })).toBeOnTheScreen();
  });

  it('time only asks for its time, and refuses none', async () => {
    const { db, id } = await startWorkout();
    await openSheet();

    await pick('yoga', 'Yoga');
    // D-99: Save waits, saying what is missing; the time's rule shows once its box is left empty.
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeDisabled();
    expect(screen.getByText('Enter the time to save.')).toBeOnTheScreen();
    expect(screen.queryByText(RULES.time)).toBeNull();
    await fireEvent(screen.getByLabelText('Time, minutes'), 'blur');
    expect(await screen.findByText(RULES.time)).toBeOnTheScreen();
    await save();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '45');
    await save();

    expect(await screen.findByRole('button', { name: 'Yoga: 45:00' })).toBeOnTheScreen();
  });

  it.each<[Partial<Record<'minutes' | 'seconds' | 'distance', string>>, string]>([
    [{ distance: '0' }, RULES.distance],
    [{ distance: '500.01' }, RULES.distance],
    [{ distance: '5.123' }, RULES.distance],
    [{ minutes: '1441' }, RULES.time],
    [{ seconds: '60' }, RULES.time],
  ])('D-50 refuses a cardio value out of range, %j', async (wrong, rule) => {
    await startWorkout();
    await openSheet();
    await pick('run', 'Running');

    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), wrong.minutes ?? '30');
    if (wrong.seconds) await fireEvent.changeText(screen.getByLabelText('Time, seconds'), wrong.seconds);
    if (wrong.distance) await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), wrong.distance);
    await save();

    expect(await screen.findByText(rule)).toBeOnTheScreen();
  });

  it('a name of the user’s own asks "Log as": sets with an optional weight, a time, or cardio', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await typeName('Hill sprints');
    expect(screen.getByRole('radio', { name: 'Log as: Sets and reps' })).toBeChecked();
    expect(screen.getByLabelText('Set 1, Weight in kg (optional)')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Log as: Cardio' }));
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '20');
    await save();

    expect(await screen.findByRole('button', { name: 'Hill sprints: 20:00' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([{ kind: 'cardio', name: 'Hill sprints', ...NONE, ...CARDIO, durationSeconds: 1_200 }]),
    );
  });

  it('closing the keyboard ends the search, so a name of the user’s own that has matches shows its fields', async () => {
    const hide: (() => void)[] = [];
    const listen = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      if (event === 'keyboardDidHide') hide.push(listener as () => void);
      return { remove: () => undefined } as EmitterSubscription;
    });
    try {
      await startWorkout();
      await openSheet();
      await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Curl');
      expect(await screen.findByRole('button', { name: 'Dumbbell curl, Dumbbell · Biceps' })).toBeOnTheScreen();
      expect(screen.queryByLabelText('Set 1, Reps')).toBeNull();

      await act(() => hide.forEach((listener) => listener()));

      expect(await screen.findByRole('radio', { name: 'Log as: Sets and reps' })).toBeChecked();
      expect(screen.getByLabelText('Set 1, Reps')).toBeOnTheScreen();
    } finally {
      listen.mockRestore();
    }
  });

  it('a name typed in full counts as picked, whatever its spelling', async () => {
    await startWorkout();
    await openSheet();

    await typeName('pushups');

    await waitFor(() => expect(screen.queryByRole('radio', { name: /^Log as/ })).toBeNull());
    expect(screen.queryByLabelText(/^Set 1, Weight/)).toBeNull();
  });
});

describe('REQ-TRN-003 the rules of an exercise (Q-042; D-29, D-50)', () => {
  it.each([
    [{ name: '' }, RULES.name],
    [{ name: '   ' }, RULES.name],
    [{ name: 'x'.repeat(81) }, RULES.name],
    [{ reps: '0' }, `Set 1: ${RULES.reps}`],
    [{ reps: '201' }, `Set 1: ${RULES.reps}`],
    [{ reps: '2.5' }, `Set 1: ${RULES.reps}`],
    [{ reps: '' }, `Set 1: ${RULES.reps}`],
    [{ weight: '0' }, `Set 1: ${RULES.optionalWeight}`],
    [{ weight: '1000.1' }, `Set 1: ${RULES.optionalWeight}`],
    [{ weight: '40.25' }, `Set 1: ${RULES.optionalWeight}`],
    [{ weight: 'abc' }, `Set 1: ${RULES.optionalWeight}`],
    [{ note: 'x'.repeat(501) }, RULES.note],
  ])('refuses %j with its rule and saves nothing', async (wrong, rule) => {
    const { db, id } = await startWorkout();

    await addOwn(wrong);

    expect(await screen.findByText(rule)).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('D-99 a set’s problem shows once typing pauses, without Save, which waits; put right, it goes at once', async () => {
    // A short pause in place of the three seconds.
    setCheckPause(300);
    await startWorkout();
    await openSheet();
    await typeName('Squat');

    await fireEvent.changeText(screen.getByLabelText(/^Set 1, Reps/), '0');
    expect(screen.queryByText(`Set 1: ${RULES.reps}`)).toBeNull();
    expect(await screen.findByText(`Set 1: ${RULES.reps}`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeDisabled();
    expect(screen.getByText('Fix the fields in red to save.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(/^Set 1, Reps/), '10');
    expect(screen.queryByText(`Set 1: ${RULES.reps}`)).toBeNull();
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeEnabled();
  });

  it('shows every problem at once, each under its field', async () => {
    await startWorkout();

    await addOwn({ name: 'x'.repeat(81), reps: '' });

    expect(await screen.findByText(`Set 1: ${RULES.reps}`)).toBeOnTheScreen();
    expect(screen.getByText(RULES.name)).toBeOnTheScreen();
  });

  it('accepts the ends of each range, and twenty sets at most', async () => {
    const { db, id } = await startWorkout();
    await openSheet();
    await typeName('x'.repeat(80));
    await fillSets([{ reps: '200', weight: '500.0' }, ...Array.from({ length: 19 }, () => ({}))]);
    expect(screen.queryByRole('button', { name: 'Add set' })).toBeNull();
    expect(screen.getByText('An exercise holds up to 20 sets.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), 'x'.repeat(500));
    await save();
    await screen.findByRole('button', { name: `${'x'.repeat(80)}: 20 sets, 200 × 500.0 kg` });
    await addOwn({ name: 'Plate', reps: '1', weight: '0,1' });

    await waitFor(async () =>
      expect(
        (await getEntry(db, 'workout', id))?.exercises.map((exercise) => (exercise.kind === 'sets' ? exercise.sets[0]?.weightGrams : null)),
      ).toEqual([500_000, 100]),
    );
  });
});

describe('REQ-TRN-003 editing and removing exercises', () => {
  it('editing an exercise opens it filled in, each set as saved, and saves the change', async () => {
    const { server, id } = await startWorkout();
    await openSheet();
    await typeName('Squat');
    await fillSets([{ reps: '10', weight: '40' }, {}, {}]);
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), 'Felt easy');
    await save();

    await fireEvent.press(await screen.findByRole('button', { name: 'Squat: 3 sets, 10 × 40.0 kg' }));
    expect(screen.getByText('Edit exercise')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 3, Weight in kg (optional)').props.value).toBe('40.0');
    expect(screen.getByLabelText('Note (optional)').props.value).toBe('Felt easy');
    await fireEvent.changeText(screen.getByLabelText('Set 2, Reps'), '12');
    await fireEvent.changeText(screen.getByLabelText('Note (optional)'), '');
    await save();

    expect(await screen.findByRole('button', { name: 'Squat: Set 1, 10 × 40.0 kg; Set 2, 12 × 40.0 kg; Set 3, 10 × 40.0 kg' })).toBeOnTheScreen();
    const squat = sameSets('Squat', 3, 10, 40_000);
    await waitFor(() =>
      expect(server.entries('workouts').get(id)?.exercises).toEqual([{ ...squat, sets: [squat.sets[0], { ...squat.sets[1], reps: 12 }, squat.sets[2]] }]),
    );
  });

  it('D-50 an exercise saved before opens as its sets, keeping a weight its list type would not ask for', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    mockParams.id = id;
    const earlier = [
      { name: 'Push-up', sets: 2, reps: 15, weightGrams: 10_000, note: null },
      { name: 'Running', sets: 1, reps: 1, weightGrams: null, note: null },
    ];
    await renderInApp(<WorkoutScreen />, undefined, async (db, server) => {
      await withExerciseList(db, server);
      const data = { id, day: '2026-10-28', exercises: earlier, recordedAt: '2026-10-28T02:00:00.000Z', timer: null } as unknown as WorkoutData;
      await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000a1', data });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Push-up: 2 sets, 15 × 10.0 kg' }));
    expect((await screen.findByLabelText('Set 2, Weight in kg (optional)')).props.value).toBe('10.0');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the workout' }));

    // Running is listed as cardio, but this one was saved in sets: it keeps them, as a name of the user's own.
    await fireEvent.press(screen.getByRole('button', { name: 'Running: 1 set, 1 rep' }));
    expect(await screen.findByRole('radio', { name: 'Log as: Sets and reps' })).toBeChecked();
    expect(screen.getByLabelText('Set 1, Reps').props.value).toBe('1');
  });

  it('D-42 an exercise’s bin asks first; Keep keeps it, Remove removes it; no Done', async () => {
    const { db, id } = await startWorkout();
    await addOwn({ name: 'Squat' });
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Squat' }));
    expect(screen.getByText('Remove Squat from this workout?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect((await getEntry(db, 'workout', id))?.exercises).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Squat' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('No exercises yet. Add one to log this workout.')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('D-42 an exercise’s pencil opens it to edit', async () => {
    await startWorkout();
    await addOwn({ name: 'Squat' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Edit Squat' }));

    expect(screen.getByRole('header', { name: 'Edit exercise' })).toBeOnTheScreen();
  });

  it('removing an exercise from its sheet needs no confirmation', async () => {
    const { db, id } = await startWorkout();
    await addOwn({ name: 'Squat' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Squat: 1 set, 10 reps' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove exercise' }));

    expect(await screen.findByText('No exercises yet. Add one to log this workout.')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('Q-029 Cancel closes the sheet and saves nothing', async () => {
    const { db, id } = await startWorkout();

    await openSheet();
    await typeName('Squat');
    await fillSets([{ reps: '10' }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the workout' }));

    expect(screen.queryByRole('header', { name: 'Add exercise' })).toBeNull();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });
});

describe('REQ-TRN-003 deleting a workout', () => {
  it('D-29 asks first; Keep keeps it, Delete removes it from the phone and the server', async () => {
    const { db, server, id } = await startWorkout();
    await waitFor(() => expect(server.entries('workouts').get(id)).toBeDefined());

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    // D-63: an empty workout counts nowhere, so only that it can't be undone.
    expect(screen.getByText('Delete Workout 1 on Wed 28 Oct?')).toBeOnTheScreen();
    expect(screen.getByText("You can't undo this.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect(await getEntry(db, 'workout', id)).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'workout', id)).toBeNull();
    expect(await screen.findByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ deleted: true }));
  });

  it('D-63 says what goes with it: its exercises, and its count in this week', async () => {
    await startWorkout();
    await addOwn({ name: 'Squat' });
    await addOwn({ name: 'Lunge' });
    await screen.findByRole('button', { name: 'Edit Lunge' });

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));

    expect(screen.getByText('Delete Workout 1 on Wed 28 Oct?')).toBeOnTheScreen();
    expect(
      screen.getByText("Its 2 exercises will be deleted too. It will no longer count in this week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
  });

  it("D-63 a workout of an earlier week says that week's workouts", async () => {
    await startWorkout('2026-10-20');
    await addOwn({ name: 'Squat' });
    await screen.findByRole('button', { name: 'Edit Squat' });

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));

    expect(screen.getByText('Delete Workout 1 on Tue 20 Oct?')).toBeOnTheScreen();
    expect(
      screen.getByText("Its 1 exercise will be deleted too. It will no longer count in that week's workouts. You can't undo this."),
    ).toBeOnTheScreen();
  });
});

describe('REQ-NFR-004 workouts offline', () => {
  it('ADR-0007 a workout started and logged offline waits on the phone, then syncs once the connection is back; the list works offline', async () => {
    const { server, id } = await renderOfflineThenStart();

    await addOwn({ name: 'Squat', weight: '40' });
    expect(await screen.findByText('Waiting to sync')).toBeOnTheScreen();
    expect(await screen.findByText('waiting to sync')).toBeOnTheScreen();
    expect(server.entries('workouts').size).toBe(0);

    server.state.offline = false;
    await openSheet();
    await pick('push', 'Push-up');
    await fillSets([{ reps: '20' }]);
    await save();

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
    undefined,
    withExerciseList,
  );
  app.server.state.offline = true;
  await fireEvent.press(await screen.findByRole('button', { name: /^Log workout for / }));
  await screen.findByText(/^Workout \d+ · /);
  return { ...app, id: mockParams.id };
}

describe('D-50 calories burned and heart rate', () => {
  async function run(km: string) {
    await openSheet();
    await pick('run', 'Running');
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '30');
    await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), km);
  }

  it('estimates a run with the Compendium value for its speed and the latest weigh-in, marked estimated', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await run('5');

    expect(
      await screen.findByText('Estimated: 9.3 MET for 10.0 km/h × 70.0 kg × 30 min. Type the number from your machine or watch to replace it.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('326');
    expect(screen.getByTestId('calories-estimated')).toHaveTextContent('Estimated');
    await save();

    expect(await screen.findByRole('button', { name: 'Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km · 326 kcal · estimated' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByLabelText('326 kcal burned, estimated')).toHaveLength(2));
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: { kcal: 326, estimated: true } }] }));
  });

  it('a faster run burns more', async () => {
    await startWorkout(undefined, 70_000);
    await run('6');

    expect(await screen.findByText(/^Estimated: 11\.0 MET for 12\.0 km\/h × 70\.0 kg × 30 min/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('385');
  });

  it('calories typed from a machine or watch replace the estimate', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await run('5');
    await screen.findByText(/^Estimated: /);

    await fireEvent.changeText(screen.getByLabelText('Calories burned (optional)'), '360');
    // D-107: typed over an estimate, the line says what the estimate is and how to go back to it.
    expect(screen.getByText('The estimate is 326 kcal: tap the arrow to use it.')).toBeOnTheScreen();
    expect(screen.queryByTestId('calories-estimated')).toBeNull();
    await save();

    expect(await screen.findByRole('button', { name: 'Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km · 360 kcal' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: { kcal: 360, estimated: false } }] }));
  });

  it('refuses calories out of range', async () => {
    const { db, id } = await startWorkout(undefined, 70_000);
    await run('5');
    await fireEvent.changeText(screen.getByLabelText('Calories burned (optional)'), '5001');
    await save();

    expect(await screen.findByText(RULES.kcal)).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('without a weigh-in, or for a name of the user’s own, there is no estimate', async () => {
    const { server, id } = await startWorkout();
    await run('5');

    expect(await screen.findByText('Log your weight to see an estimate.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('');
    await save();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: null }] }));

    await openSheet();
    await typeName('Hill sprints');
    expect(screen.getByText('Your own exercises have no estimate: type the number from your machine or watch.')).toBeOnTheScreen();
  });

  it('sets are estimated from the time spent, and a timed exercise from its sets’ times', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }]);
    // The time comes from the reps: 10 reps × 4 s = 40 s (the exercise-time plan).
    expect(await screen.findByText('Estimated: 3.5 MET × 70.0 kg × 0:40. Type the number from your machine or watch to replace it.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Time spent, minutes (optional)'), '12');
    await fireEvent.changeText(screen.getByLabelText('Time spent, seconds (optional)'), '0');
    expect(await screen.findByText('Estimated: 3.5 MET × 70.0 kg × 12 min. Type the number from your machine or watch to replace it.')).toBeOnTheScreen();
    await save();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ durationSeconds: 720, calories: { kcal: 49, estimated: true } }] }),
    );

    await openSheet();
    await pick('plank', 'Plank');
    await fillSets([{ seconds: '60' }, { seconds: '45' }]);
    expect(await screen.findByText('Estimated: 2.8 MET × 70.0 kg × 1:45. Type the number from your machine or watch to replace it.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('6');
  });

  it('keeps a heart rate, and refuses one out of range or a highest below the average', async () => {
    const { server, id } = await startWorkout();
    await openSheet();
    await pick('yoga', 'Yoga');
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '45');
    await fireEvent.changeText(screen.getByLabelText('Average heart rate (optional)'), '150');
    await fireEvent.changeText(screen.getByLabelText('Highest heart rate (optional)'), '140');
    await save();
    expect(await screen.findByText(RULES.heartRateOrder)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Highest heart rate (optional)'), '251');
    await save();
    expect(await screen.findByText(RULES.heartRate)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Highest heart rate (optional)'), '172');
    await save();
    expect(await screen.findByRole('button', { name: 'Yoga: 45:00, heart rate 150 average, 172 highest' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ averageHeartRateBpm: 150, highestHeartRateBpm: 172 }] }),
    );
  });

  it('the i explains the estimate with this exercise’s numbers, and credits the Compendium', async () => {
    await startWorkout(undefined, 70_000);
    await run('5');
    await screen.findByText(/^Estimated: /);

    await fireEvent.press(screen.getByRole('button', { name: 'How calories are estimated' }));

    expect(screen.getByText('9.3 MET × 70.0 kg × 0.5 h = 326 kcal')).toBeOnTheScreen();
    expect(screen.getByText(/^Activity values: Herrmann SD/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText(/^Activity values/)).toBeNull();
  });
});

// D-107 (canvas "Calories burned changed by you", B locked by the owner, 2026-11-16): calories typed
// over an estimate, or emptied, show an Edited tag and an arrow at the box's end that puts it back.
describe('D-107 calories changed by you: the Edited tag and the arrow back to the estimate', () => {
  const BACK = 'The estimate is 326 kcal: tap the arrow to use it.';
  const kcalBox = () => screen.getByLabelText('Calories burned (optional)');
  const arrow = () => screen.queryByRole('button', { name: /^Use the estimate, / });

  /** Running, 30 min and `km`: 9.3 MET × 70.0 kg × 0.5 h = 326 kcal for 5 km with the 70 kg weigh-in. */
  async function run(km = '5') {
    await openSheet();
    await pick('run', 'Running');
    await fireEvent.changeText(screen.getByLabelText('Time, minutes'), '30');
    await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), km);
  }

  it('the estimate has no tag and no arrow', async () => {
    await startWorkout(undefined, 70_000);
    await run();
    await screen.findByText(/^Estimated: /);

    expect(screen.queryByText('Edited')).toBeNull();
    expect(arrow()).toBeNull();
  });

  it('a typed number shows Edited and the arrow; the arrow puts the estimate back, which follows the run again and saves as an estimate', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    try {
      const { server, id } = await startWorkout(undefined, 70_000);
      await run();
      await screen.findByText(/^Estimated: /);
      await fireEvent.changeText(kcalBox(), '360');

      expect(screen.getByText('Edited')).toBeOnTheScreen();
      expect(screen.getByText(BACK)).toBeOnTheScreen();
      expect(screen.queryByTestId('calories-estimated')).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: 'Use the estimate, 326 kcal' }));
      expect(kcalBox().props.value).toBe('326');
      expect(screen.getByTestId('calories-estimated')).toHaveTextContent('Estimated');
      expect(screen.getByText(/^Estimated: 9\.3 MET for 10\.0 km\/h/)).toBeOnTheScreen();
      expect(screen.queryByText('Edited')).toBeNull();
      expect(arrow()).toBeNull();
      expect(announce).toHaveBeenCalledWith('Calories burned: the estimate, 326 kcal');

      // The estimate again, not the number it had: a faster run burns more.
      await fireEvent.changeText(screen.getByLabelText('Distance in km (optional)'), '6');
      expect(kcalBox().props.value).toBe('385');
      await save();
      await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: { kcal: 385, estimated: true } }] }));
    } finally {
      announce.mockRestore();
    }
  });

  it('an emptied box says no calories will be saved, with the arrow; saved so, it has none', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await run();
    await screen.findByText(/^Estimated: /);
    await fireEvent.changeText(kcalBox(), '');

    expect(screen.getByText(`Empty: no calories will be saved. ${BACK}`)).toBeOnTheScreen();
    expect(screen.getByText('Edited')).toBeOnTheScreen();
    expect(arrow()).toBeOnTheScreen();
    await save();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: null }] }));
  });

  it('a number out of range keeps the arrow beside its message', async () => {
    await startWorkout(undefined, 70_000);
    await run();
    await screen.findByText(/^Estimated: /);
    await fireEvent.changeText(kcalBox(), '5001');

    expect(await screen.findByText(RULES.kcal)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Use the estimate, 326 kcal' }));
    expect(kcalBox().props.value).toBe('326');
    expect(screen.queryByText(RULES.kcal)).toBeNull();
  });

  it('Edit exercise on calories typed before shows Edited and the arrow, and saves the estimate once it is used', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await run();
    await screen.findByText(/^Estimated: /);
    await fireEvent.changeText(kcalBox(), '360');
    await save();

    await fireEvent.press(await screen.findByRole('button', { name: 'Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km · 360 kcal' }));
    expect(screen.getByRole('header', { name: 'Edit exercise' })).toBeOnTheScreen();
    expect(kcalBox().props.value).toBe('360');
    expect(await screen.findByText('Edited')).toBeOnTheScreen();
    expect(screen.getByText(BACK)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Use the estimate, 326 kcal' }));
    await save();
    expect(await screen.findByRole('button', { name: 'Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km · 326 kcal · estimated' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ calories: { kcal: 326, estimated: true } }] }));
  });

  it('with no estimate to go back to (no weigh-in, or a name of the user’s own) there is no tag and no arrow', async () => {
    await startWorkout();
    await run();
    await screen.findByText('Log your weight to see an estimate.');
    await fireEvent.changeText(kcalBox(), '300');

    expect(screen.getByText('As you typed it, from your machine or watch.')).toBeOnTheScreen();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(arrow()).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the workout' }));

    await openSheet();
    await typeName('Hill sprints');
    await fireEvent.changeText(kcalBox(), '200');
    expect(screen.getByText('As you typed it, from your machine or watch.')).toBeOnTheScreen();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(arrow()).toBeNull();
  });
});

/** Opens the picker `label` (Category or Sub-group), whatever it shows, and picks `choice` (its name, before the count). */
async function choosePlace(label: 'Category' | 'Sub-group', choice: string) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${label}: `) }));
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${choice.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}, \\d+ exercises?$`) }));
}

describe('D-67 Category and Sub-group', () => {
  it('opens on every category; a category lists its exercises before a word is typed, each with its sub-group', async () => {
    await startWorkout();
    await openSheet();
    expect(screen.getByRole('button', { name: 'Category: All categories' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sub-group: All sub-groups' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Category: All categories' }));
    expect(await screen.findByRole('button', { name: 'All categories, 15 exercises' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Smith Machine, 1 exercise' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell, 3 exercises' }));

    expect(screen.queryByRole('button', { name: /^Barbell, / })).toBeNull();
    expect(screen.getByRole('button', { name: 'Category: Dumbbell' })).toBeOnTheScreen();
    expect(await screen.findByText('Dumbbell · 3 exercises')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell bench press, Chest' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell curl, Biceps' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hammer curl, Biceps' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Farmer's walk/ })).toBeNull();
    expect(screen.getByPlaceholderText('Search Dumbbell')).toBeOnTheScreen();
  });

  it('the sub-groups follow the category; typing narrows the choice; no match offers to search them all', async () => {
    await startWorkout();
    await openSheet();
    await choosePlace('Category', 'Dumbbell');

    await fireEvent.press(screen.getByRole('button', { name: 'Sub-group: All sub-groups' }));
    expect(screen.getByRole('button', { name: 'All sub-groups, 3 exercises' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Chest, 1 exercise' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Push, / })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Biceps, 2 exercises' }));

    expect(await screen.findByText('Dumbbell · Biceps · 2 exercises')).toBeOnTheScreen();
    // With both chosen, a match needs no tag.
    expect(screen.getByRole('button', { name: 'Hammer curl' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'hammer');
    expect(await screen.findByText('1 match in Dumbbell · Biceps')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Dumbbell curl' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'squat');
    expect(await screen.findByText('No exercise in Dumbbell · Biceps matches \u201csquat\u201d. Search them all, or keep your own name.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Search all categories' }));

    expect(screen.getByRole('button', { name: 'Category: All categories' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Smith Machine Squat, Smith Machine' })).toBeOnTheScreen();
  });

  it('a sub-group alone finds it in every category; a category without sub-groups reads "No sub-groups" and clears the one chosen', async () => {
    await startWorkout();
    await openSheet();
    await choosePlace('Sub-group', 'Push');

    expect(await screen.findByText('Push · 2 exercises')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Push-up, Bodyweight / Calisthenics' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Parallel bar dip, Bodyweight / Calisthenics' })).toBeOnTheScreen();

    await choosePlace('Category', 'Smith Machine');

    expect(screen.getByRole('button', { name: 'Sub-group: No sub-groups' })).toBeDisabled();
    expect(await screen.findByText('Smith Machine · 1 exercise')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Smith Machine Squat' })).toBeOnTheScreen();
  });

  it('picking an exercise works as before, and one with no Compendium activity has no estimate: calories are typed', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await openSheet();
    await choosePlace('Category', 'Sandbag / Strongman');
    await fireEvent.press(await screen.findByRole('button', { name: 'Sled Drag (Harness), Strongman' }));

    expect(screen.getByText('Sandbag / Strongman · Strongman')).toBeOnTheScreen();
    expect(screen.getByText('Weight and time')).toBeOnTheScreen();
    expect(screen.getByText('This exercise has no estimate: type the number from your machine or watch.')).toBeOnTheScreen();
    await fillSets([{ weight: '60', seconds: '30' }]);
    await fireEvent.changeText(screen.getByLabelText('Calories burned (optional)'), '45');
    await save();

    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({
        exercises: [{ name: 'Sled Drag (Harness)', kind: 'sets', sets: [{ reps: null, weightGrams: 60_000, seconds: 30 }], calories: { kcal: 45, estimated: false } }],
      }),
    );
  });
});

describe('D-67 Edit shows Category and Sub-group (the owner, 2026-11-16)', () => {
  it('an exercise added from Dumbbell › Biceps opens in Edit with Dumbbell and Biceps chosen', async () => {
    await startWorkout();
    await openSheet();
    await choosePlace('Category', 'Dumbbell');
    await choosePlace('Sub-group', 'Biceps');
    await fireEvent.press(await screen.findByRole('button', { name: 'Hammer curl' }));
    await fillSets([{ reps: '10', weight: '12' }, {}, {}]);
    await save();

    await fireEvent.press(await screen.findByRole('button', { name: 'Hammer curl: 3 sets, 10 × 12.0 kg' }));

    expect(screen.getByText('Edit exercise')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Category: Dumbbell' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sub-group: Biceps' })).toBeOnTheScreen();
    // The exercise and its sets stay as saved.
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Hammer curl');
    expect(screen.getByLabelText('Set 1, Reps').props.value).toBe('10');
  });

  it('an exercise in several places shows its first', async () => {
    await startWorkout();
    await openSheet();
    await pick('dip', 'Parallel bar dip');
    await fillSets([{ reps: '8' }, {}, {}]);
    await save();

    // The card's first button opens the exercise (the others are its sets and the bar's).
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Parallel bar dip: / }))[0]!);

    expect(await screen.findByRole('button', { name: 'Category: Bodyweight / Calisthenics' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sub-group: Push' })).toBeOnTheScreen();
  });

  it('a name of the user’s own, in no place, shows every category', async () => {
    await startWorkout();
    await addOwn({ name: 'Synthetic own move' });

    // The card's first button opens the exercise (the others are its sets and the bar's).
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Synthetic own move: / }))[0]!);

    expect(screen.getByText('Edit exercise')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Category: All categories' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sub-group: All sub-groups' })).toBeOnTheScreen();
  });
});

describe('the exercise’s tag line (the owner’s report, 2026-11-17)', () => {
  it('wraps when its tag is long, so how the exercise is logged moves on rather than standing a letter a line', async () => {
    await startWorkout();
    await openSheet();

    await pick('push', 'Push-up');

    // "Bodyweight / Calisthenics · Push", "Reps" and How to do it on one line left "Reps" no width, and
    // the line grew hundreds of points tall: the line wraps, the tag may shrink, how it is logged never.
    const line = screen.getByTestId('exercise-type-line');
    expect(line).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(within(line).getByText('Bodyweight / Calisthenics · Push')).toHaveStyle({ flexShrink: 1 });
    expect(screen.getByTestId('exercise-log-type')).toHaveTextContent('Reps');
    expect(screen.getByTestId('exercise-log-type')).toHaveStyle({ flexShrink: 0 });
    // Since D-111 How to do it is beside the name, no longer on this line.
    expect(within(line).queryByRole('button', { name: 'How to do Push-up' })).toBeNull();
  });
});

describe('D-111 the exercise page with less scrolling (the owner’s B, 2026-11-17)', () => {
  it('How to do it sits beside the exercise name, only while the name is an exercise of the list', async () => {
    await startWorkout();
    await openSheet();
    // No name yet: no How to do it.
    expect(screen.queryByTestId('exercise-how-to')).toBeNull();

    await pick('push', 'Push-up');
    expect(screen.getByTestId('exercise-how-to')).toBe(screen.getByRole('button', { name: 'How to do Push-up' }));
    expect(screen.getByRole('button', { name: 'How to do Push-up' })).toBeOnTheScreen();

    // A name of the user's own has no How to do it; nor a name being typed that the list doesn't hold.
    await typeName('My own stretch');
    expect(screen.queryByTestId('exercise-how-to')).toBeNull();
  });

  it('shows the optional fields two to a row with short labels, each still read by its whole name, and the note one line', async () => {
    await startWorkout();
    await openSheet();
    await pick('push', 'Push-up');

    const effort = screen.getByTestId('exercise-effort');
    // The two boxes share one row, their labels the row above, so the boxes line up whatever the
    // labels hold (the owner, 2026-11-17: Calories' info button and tag had set its box lower).
    const boxes = screen.getByTestId('exercise-effort-boxes');
    expect(boxes).toHaveStyle({ flexDirection: 'row' });
    expect(within(boxes).getByLabelText('Time spent, minutes (optional)')).toBeOnTheScreen();
    expect(within(boxes).getByLabelText('Time spent, seconds (optional)')).toBeOnTheScreen();
    expect(within(boxes).getByLabelText('Calories burned (optional)')).toBeOnTheScreen();
    const labels = screen.getByTestId('exercise-effort-labels');
    expect(labels).toHaveStyle({ flexDirection: 'row' });
    expect(within(labels).getByText('Time spent')).toBeOnTheScreen();
    expect(within(labels).getByText('Calories')).toBeOnTheScreen();
    // "estimated" sits beside the Calories label, not in the half-wide box, where it hid the number
    // (the owner, 2026-11-17).
    expect(within(effort).queryByText('estimated')).toBeNull();
    expect(within(effort).getByText('Time spent')).toBeOnTheScreen();
    expect(within(effort).getByText('Calories')).toBeOnTheScreen();
    expect(within(effort).getByLabelText('Time spent, minutes (optional)')).toBeOnTheScreen();
    expect(within(effort).getByLabelText('Calories burned (optional)')).toBeOnTheScreen();
    expect(screen.getByText('Average HR')).toBeOnTheScreen();
    expect(screen.getByText('Highest HR')).toBeOnTheScreen();
    expect(screen.getByLabelText('Average heart rate (optional)')).toBeOnTheScreen();
    expect(screen.queryByText('Time spent, minutes (optional)')).toBeNull();
    // The note: one line under its label (the owner, 2026-11-17: keep the label), nothing inside it.
    expect(screen.getByText('Note (optional)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Note (optional)')).not.toHaveProp('placeholder');
  });

  it('a cardio exercise has Calories alone in the row: it has no time spent', async () => {
    await startWorkout();
    await openSheet();
    await pick('running', 'Running');

    const effort = screen.getByTestId('exercise-effort');
    expect(within(effort).queryByLabelText('Time spent, minutes (optional)')).toBeNull();
    expect(within(effort).getByLabelText('Calories burned (optional)')).toBeOnTheScreen();
  });
});

describe('D-112 every set value whole (the owner’s A, 2026-11-17)', () => {
  const headings = () => screen.getByTestId('exercise-set-headings');

  it('the units are in the column headings, each box holds only its number, centred', async () => {
    await startWorkout();
    await openSheet();
    await pick('dumbbell bench', 'Dumbbell bench press');

    expect(within(headings()).getByText('Reps')).toBeOnTheScreen();
    expect(within(headings()).getByText('Weight · kg')).toBeOnTheScreen();
    expect(within(headings()).queryByText('optional')).toBeNull();
    // No unit in the boxes: "kg" was in each weight box.
    expect(screen.queryByText('kg')).toBeNull();
    for (const label of ['Set 1, Reps', 'Set 1, Weight in kg']) {
      expect(screen.getByLabelText(label)).toHaveStyle({ textAlign: 'center', fontSize: 20 });
    }
  });

  it('an edit that kept a column has three boxes: "optional" under it, the numbers 18 high, the largest values whole', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1c';
    mockParams.id = id;
    // Farmer's walk is done with weight and time; saved with reps too, it keeps them as a third column (D-50).
    const saved = {
      kind: 'sets',
      name: "Farmer's walk",
      sets: [
        { reps: 200, weightGrams: 1_000_000, seconds: 3600 },
        { reps: 10, weightGrams: 40_000, seconds: 45 },
      ],
      durationSeconds: null,
      calories: null,
      averageHeartRateBpm: null,
      highestHeartRateBpm: null,
      note: null,
    };
    await renderInApp(<WorkoutScreen />, undefined, async (db, server) => {
      await withExerciseList(db, server);
      const data = { id, day: '2026-10-28', exercises: [saved], recordedAt: '2026-10-28T02:00:00.000Z', timer: null } as unknown as WorkoutData;
      await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000a2', data });
    });

    await fireEvent.press(await screen.findByRole('button', { name: /^Farmer's walk: Set 1, / }));

    expect(await screen.findByText('Weight · kg')).toBeOnTheScreen();
    expect(within(headings()).getByText('Time · sec')).toBeOnTheScreen();
    expect(within(headings()).getByText('Reps')).toBeOnTheScreen();
    expect(within(headings()).getByText('optional')).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 1, Weight in kg')).toHaveDisplayValue('1000.0');
    expect(screen.getByLabelText('Set 1, Time in sec')).toHaveDisplayValue('3600');
    expect(screen.getByLabelText('Set 1, Reps (optional)')).toHaveDisplayValue('200');
    for (const label of ['Set 1, Weight in kg', 'Set 1, Time in sec', 'Set 1, Reps (optional)']) {
      expect(screen.getByLabelText(label)).toHaveStyle({ textAlign: 'center', fontSize: 18 });
    }
    // The set's time has no unit beside it (its heading says Time · sec); the time spent's boxes are not on a timed exercise's sets.
    expect(screen.queryAllByText('sec')).toHaveLength(1);

    // The slim X removes a set, as the bin did.
    await fireEvent.press(screen.getByRole('button', { name: 'Remove set 2' }));
    expect(screen.queryByLabelText('Set 2, Weight in kg')).toBeNull();
  });
});

describe('D-67 the exercise page', () => {
  it('is a page with a back arrow; while a list shows, Save exercise steps aside, and the name while a choice list is open', async () => {
    await startWorkout();
    await openSheet();
    expect(screen.getByRole('header', { name: 'Add exercise' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Category: All categories' }));
    expect(screen.queryByLabelText('Exercise name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save exercise' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell, 3 exercises' }));

    expect(screen.getByLabelText('Exercise name')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Hammer curl, Biceps' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save exercise' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hammer curl, Biceps' }));
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to the workout' }));
    expect(screen.queryByRole('header', { name: 'Add exercise' })).toBeNull();
  });

  // The owner, 2026-11-13: Category, Sub-group and the names did not scroll. Inside the page's scroll
  // view a list's `flex: 1` holds nothing unless the page's content is exactly the page's height, so
  // the lists grew to their full length. The layout itself is the phone's; this checks the styles it needs.
  it('while a list shows, the page holds its content to its height, so Category, Sub-group and the names scroll; each list is only as tall as its rows', async () => {
    await startWorkout();
    await openSheet();
    const page = () => screen.getByTestId('exercise-page');
    const heldToThePage = () => {
      expect(page().props.scrollEnabled).toBe(false);
      expect(StyleSheet.flatten(page().props.contentContainerStyle)).toMatchObject({ flex: 1 });
    };
    // As tall as its rows, shrunk to the page's room when longer (the owner, 2026-11-17: a short list
    // left a large empty panel under its last choice).
    const fits = (testID: string) => {
      const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
      expect(style).toMatchObject({ flexGrow: 0, flexShrink: 1 });
      expect(style).not.toHaveProperty('flex');
    };
    expect(page().props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(page().props.contentContainerStyle) ?? {}).not.toHaveProperty('flex');

    await fireEvent.press(screen.getByRole('button', { name: 'Category: All categories' }));
    heldToThePage();
    fits('exercise-place-panel');
    fits('exercise-place-list');
    await fireEvent.press(screen.getByRole('button', { name: 'Dumbbell, 3 exercises' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sub-group: All sub-groups' }));
    heldToThePage();
    fits('exercise-place-panel');
    fits('exercise-place-list');
    await fireEvent.press(screen.getByRole('button', { name: 'Biceps, 2 exercises' }));

    expect(await screen.findByRole('button', { name: 'Hammer curl' })).toBeOnTheScreen();
    heldToThePage();
    fits('exercise-matches-panel');
    fits('exercise-matches');

    await fireEvent.press(screen.getByRole('button', { name: 'Hammer curl' }));
    expect(page().props.scrollEnabled).toBe(true);
    expect(StyleSheet.flatten(page().props.contentContainerStyle) ?? {}).not.toHaveProperty('flex');
  });
});

describe('D-67 the name’s chevron, and a choice the exercise is not in', () => {
  it('with nothing typed or chosen, the chevron opens every exercise, and closes it again', async () => {
    await startWorkout();
    await openSheet();
    const chevron = screen.getByRole('button', { name: 'Exercise list' });
    expect(chevron.props.accessibilityState).toMatchObject({ expanded: false });

    await fireEvent.press(chevron);
    expect(await screen.findByText('All exercises · 15')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Exercise list' }).props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByRole('button', { name: 'Kabaddi, Sport' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));
    expect(screen.queryByText(/^All exercises/)).toBeNull();
    expect(screen.getByText(/^Pick a category to see its exercises/)).toBeOnTheScreen();
  });

  it('closes the matches of a name typed, showing its fields, and opens them again', async () => {
    await startWorkout();
    await openSheet();
    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'curl');
    expect(await screen.findByRole('button', { name: 'Hammer curl, Dumbbell · Biceps' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));
    expect(screen.queryByRole('button', { name: /^Hammer curl/ })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Log as: Sets and reps' })).toBeChecked();

    await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));
    expect(await screen.findByRole('button', { name: 'Hammer curl, Dumbbell · Biceps' })).toBeOnTheScreen();
  });

  it('the owner, 2026-11-17: opened on an exercise picked in a category, the chevron lists all its exercises, the picked one highlighted', async () => {
    await startWorkout();
    await openSheet();
    await choosePlace('Category', 'Dumbbell');
    await fireEvent.press(await screen.findByRole('button', { name: 'Dumbbell curl, Biceps' }));
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Dumbbell curl');
    expect(screen.queryByText('Dumbbell · 3 exercises')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));

    // Not the name's own search, which found it alone: the whole category, the picked one highlighted.
    expect(await screen.findByText('Dumbbell · 3 exercises')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell curl, Biceps, picked' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Dumbbell bench press, Chest' })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Hammer curl, Biceps' })).not.toBeSelected();

    // Another picked from it replaces it, and the list closes.
    await fireEvent.press(screen.getByRole('button', { name: 'Hammer curl, Biceps' }));
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Hammer curl');
    expect(screen.queryByText('Dumbbell · 3 exercises')).toBeNull();
  });

  it('with no category, the chevron on an exercise picked lists every exercise, it highlighted; typing searches again', async () => {
    await startWorkout();
    await openSheet();
    await pick('hammer', 'Hammer curl');

    await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));
    expect(await screen.findByText('All exercises · 15')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hammer curl, Dumbbell · Biceps, picked' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Kabaddi, Sport' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'curl');
    expect(await screen.findByRole('button', { name: 'Dumbbell curl, Dumbbell · Biceps' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hammer curl, Dumbbell · Biceps' })).not.toBeSelected();
    expect(screen.queryByRole('button', { name: /^Kabaddi/ })).toBeNull();
  });

  it('a category or sub-group the picked exercise is not in clears its name; one it is in keeps it', async () => {
    await startWorkout();
    await openSheet();
    await pick('hammer', 'Hammer curl');
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Hammer curl');

    await choosePlace('Category', 'Dumbbell');
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Hammer curl');
    await choosePlace('Sub-group', 'Biceps');
    expect(screen.getByLabelText('Exercise name').props.value).toBe('Hammer curl');

    await choosePlace('Category', 'Barbell');
    expect(screen.getByLabelText('Exercise name').props.value).toBe('');
    expect(await screen.findByText('Barbell · 1 exercise')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Barbell bench press, Chest' })).toBeOnTheScreen();
  });

  it('a name of the user’s own stays whatever the choice', async () => {
    await startWorkout();
    await openSheet();
    await typeName('Tyre flips');

    await choosePlace('Category', 'Barbell');

    expect(screen.getByLabelText('Exercise name').props.value).toBe('Tyre flips');
  });
});

describe('D-67 a long list on the exercise page', () => {
  it('draws at most 300 rows, says how to find the others, and nests no virtualized list in the page', async () => {
    const error = jest.spyOn(console, 'error');
    const drills = Array.from({ length: 320 }, (_, index) => ({
      ...TEST_EXERCISE_LIST.find((exercise) => exercise.code === 'push-up')!,
      code: `drill-${String(index + 1).padStart(3, '0')}`,
      name: `Drill ${String(index + 1).padStart(3, '0')}`,
      aliases: [],
    }));
    try {
      await renderInApp(
        <>
          <TrainingScreen />
          <WorkoutScreen now={() => NOW} />
        </>,
        undefined,
        async (db, server) => {
          server.state.exercises = drills;
          await replaceExercises(db, server.state.exercisesVersion, drills);
        },
      );
      await fireEvent.press(await screen.findByRole('button', { name: /^Log workout for / }));
      await openSheet();

      await fireEvent.press(screen.getByRole('button', { name: 'Exercise list' }));

      expect(await screen.findByText('All exercises · 320')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: /^Drill \d{3}/ })).toHaveLength(300);
      expect(screen.getByText('The first 300 are shown: type a name or pick a category to find the others.')).toBeOnTheScreen();
      expect(error.mock.calls.some(([message]) => String(message).includes('VirtualizedLists should never be nested'))).toBe(false);
    } finally {
      error.mockRestore();
    }
  });
});

describe('D-71 the workout timer', () => {
  // The screens' clock, moved on by the tests.
  let clock = NOW;
  const later = (seconds: number) => {
    clock = new Date(clock.getTime() + seconds * 1000);
  };

  beforeEach(() => {
    clock = NOW;
  });

  /** Training and the workout screen on the tests' clock, with a workout just logged. */
  async function logTimed(pickDay?: string) {
    const app = await renderInApp(
      <>
        {pickDay ? <PickDay day={pickDay} /> : null}
        <TrainingScreen now={() => clock} />
        <WorkoutScreen now={() => clock} />
      </>,
      undefined,
      async (db, server) => withExerciseList(db, server),
    );
    if (pickDay) await fireEvent.press(await screen.findByRole('button', { name: `Pick ${pickDay}` }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Log workout for / }));
    await screen.findByText(/^Workout \d+ · /);
    return { ...app, id: mockParams.id };
  }

  it('a workout of today has Start workout; it starts the timer, saved and synced, and the time counts', async () => {
    const { server, id } = await logTimed();

    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));

    expect(await screen.findByLabelText('Workout time 0 minutes 0 seconds')).toBeOnTheScreen();
    expect(screen.getByText('Running')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    const started = { startedAt: NOW.toISOString(), countedSeconds: 0, runningSince: NOW.toISOString(), doneAt: null };
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [], timer: started }));

    later(754);

    expect(await screen.findByLabelText('Workout time 12 minutes 34 seconds', {}, { timeout: 3_000 })).toBeOnTheScreen();
    await addOwn({});
    expect(await screen.findByText('Running · 12:34', {}, { timeout: 3_000 })).toBeOnTheScreen();
  });

  it('D-108 with no exercise the timer counts on, but the workout is not logged: not listed, and Mark done waits for an exercise', async () => {
    const { server, id } = await logTimed();
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByRole('button', { name: 'Pause' });

    later(600);
    expect(await screen.findByLabelText('Workout time 10 minutes 0 seconds', {}, { timeout: 3_000 })).toBeOnTheScreen();
    expect(screen.getByText('No exercises yet. Add one to log this workout.')).toBeOnTheScreen();
    expect(screen.getByText('Add an exercise to log this workout and mark it done.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeDisabled();
    // Pause and Resume still work: the timer counts on.
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    // Training doesn't list it, nor its time.
    expect(screen.getByText('No workouts on Wed 28 Oct.')).toBeOnTheScreen();
    expect(screen.queryByText(/^Running · /)).toBeNull();

    await addOwn({});

    // Logged once it has an exercise: listed with its time, and Mark done can be tapped.
    expect(await screen.findByText('Running · 10:00')).toBeOnTheScreen();
    expect(screen.queryByText('Add an exercise to log this workout and mark it done.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark done' }));
    expect(await screen.findByLabelText('Done, total time 10 minutes 0 seconds')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ timer: { countedSeconds: 600, doneAt: clock.toISOString() } }));
  });

  it('Pause stops the count and Resume counts on, the time paused left out; Mark done shows the total', async () => {
    const { server, id } = await logTimed();
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByRole('button', { name: 'Pause' });

    later(600);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByLabelText('Workout time 10 minutes 0 seconds, paused')).toBeOnTheScreen();
    expect(screen.getByText('Paused')).toBeOnTheScreen();

    later(300);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByLabelText('Workout time 10 minutes 0 seconds')).toBeOnTheScreen();

    later(154);
    await addOwn({});
    await fireEvent.press(await screen.findByRole('button', { name: 'Mark done' }));

    expect(await screen.findByLabelText('Done, total time 12 minutes 34 seconds')).toBeOnTheScreen();
    expect(screen.getByText('Done · total time')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({
        timer: { startedAt: NOW.toISOString(), countedSeconds: 754, runningSince: null, doneAt: clock.toISOString() },
      }),
    );
    expect(await screen.findByText('Done · 12:34')).toBeOnTheScreen();
  });

  it('Resume after Mark done, on a workout of today, counts on from the total', async () => {
    const { server, id } = await logTimed();
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    await addOwn({});
    later(754);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mark done' }));
    await screen.findByText('Done · total time');

    later(60);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(await screen.findByLabelText('Workout time 12 minutes 34 seconds')).toBeOnTheScreen();
    expect(screen.queryByText('Done · total time')).toBeNull();
    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({
        timer: { countedSeconds: 754, runningSince: clock.toISOString(), doneAt: null },
      }),
    );
  });

  it('a workout of another date has no Start workout', async () => {
    await logTimed('2026-10-27');

    expect(screen.getByText('Workout 1 · Tue 27 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    expect(screen.queryByLabelText(/^Workout time /)).toBeNull();
  });

  it('a timer started before midnight can still be paused and marked done the next day, with no Resume after', async () => {
    const { server, id } = await logTimed();
    await fireEvent.press(screen.getByRole('button', { name: 'Start workout' }));
    await screen.findByRole('button', { name: 'Pause' });
    await addOwn({});

    // 09:00 to 01:00 the next day, India time.
    later(16 * 3_600);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByLabelText('Workout time 16 hours 0 minutes 0 seconds, paused')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark done' }));

    expect(await screen.findByLabelText('Done, total time 16 hours 0 minutes 0 seconds')).toBeOnTheScreen();
    expect(screen.getByText('Workout 1 · Wed 28 Oct')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ day: '2026-10-28', timer: { countedSeconds: 57_600 } }));
  });
});

// The time spent follows the reps (docs/plans/exercise-time-per-rep.md): every rep of every set × the
// seconds one rep takes (weights 4, bodyweight 3), rest not counted; typed, it is the user's own, and the
// calories follow whichever time is shown. Made-up numbers.
describe('the time spent from the reps', () => {
  const time = () => ({
    minutes: screen.getByLabelText('Time spent, minutes (optional)'),
    seconds: screen.getByLabelText('Time spent, seconds (optional)'),
  });

  it('a weights exercise starts with its reps × 4 s, shown as minutes and seconds, and grows with the sets and reps', async () => {
    await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }]);

    // 10 reps × 4 s = 40 s; calories: 3.5 MET × 70 kg × 40 s = 2.7 kcal, rounded to 3.
    expect(time().minutes).toHaveDisplayValue('0');
    expect(time().seconds).toHaveDisplayValue('40');
    expect(screen.getByText('From reps')).toBeOnTheScreen();
    expect(screen.getByText('From 10 reps × 4 s = 0:40, rest not counted. Type your own time to replace it.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('3');

    // Two more sets of 10: 30 reps × 4 s = 2 minutes; 3.5 × 70 × 120 / 3600 = 8.2 kcal.
    await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    expect(time().minutes).toHaveDisplayValue('2');
    expect(time().seconds).toHaveDisplayValue('00');
    expect(screen.getByLabelText('Calories burned (optional)').props.value).toBe('8');

    // More reps in one set: 40 reps × 4 s = 160 s = 2:40.
    await fireEvent.changeText(screen.getByLabelText(/^Set 1, Reps/), '20');
    expect(time().minutes).toHaveDisplayValue('2');
    expect(time().seconds).toHaveDisplayValue('40');
  });

  it('a bodyweight exercise takes 3 s a rep', async () => {
    await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('push', 'Push-up');
    await fillSets([{ reps: '15' }, {}, {}]);

    // 3 sets × 15 reps × 3 s = 135 s = 2:15.
    expect(time().minutes).toHaveDisplayValue('2');
    expect(time().seconds).toHaveDisplayValue('15');
  });

  it('typing the time makes it the user’s own: it stops following the reps, says Edited, and the arrow brings the reps’ time back', async () => {
    await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }]);

    await fireEvent.changeText(time().minutes, '5');
    expect(time().seconds).toHaveDisplayValue('40');
    expect(screen.getByText('Edited')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    // Not followed any more: still 5:40.
    expect(time().minutes).toHaveDisplayValue('5');
    expect(screen.getByText('Your own time. The arrow brings back 20 reps × 4 s = 1:20.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Use the time from the reps, 1:20' }));
    expect(time().minutes).toHaveDisplayValue('1');
    expect(time().seconds).toHaveDisplayValue('20');
    expect(screen.getByText('From reps')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Use the time from the reps/ })).toBeNull();
  });

  it('saves the time shown, in seconds, with the estimate worked out from it', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }, { reps: '10', weight: '20' }, { reps: '10', weight: '20' }]);
    await save();

    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ durationSeconds: 120, calories: { kcal: 8, estimated: true } }] }),
    );
  });

  it('calories typed still win over the estimate from the reps’ time', async () => {
    const { server, id } = await startWorkout(undefined, 70_000);
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }]);
    await fireEvent.changeText(screen.getByLabelText('Calories burned (optional)'), '50');
    await save();

    await waitFor(() =>
      expect(server.entries('workouts').get(id)).toMatchObject({ exercises: [{ durationSeconds: 40, calories: { kcal: 50, estimated: false } }] }),
    );
  });

  it('a time that is not minutes and seconds is refused, with the rule', async () => {
    await startWorkout();
    await openSheet();
    await pick('db bench', 'Dumbbell bench press');
    await fillSets([{ reps: '10', weight: '20' }]);
    await fireEvent.changeText(time().seconds, '75');

    expect(await screen.findByText('Enter the time spent in minutes and seconds, up to 24 hours, or leave it empty.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save exercise' })).toBeDisabled();
  });

  it('an exercise of the user’s own gets no time from reps', async () => {
    await startWorkout(undefined, 70_000);
    await openSheet();
    await typeName('Hill sprints');
    await fillSets([{ reps: '10' }]);
    expect(time().minutes).toHaveDisplayValue('');
    expect(time().seconds).toHaveDisplayValue('');
    expect(screen.queryByText('From reps')).toBeNull();
  });
});

describe('the time spent of a saved exercise', () => {
  const saved = (name: string, durationSeconds: number) => ({
    kind: 'sets',
    name,
    sets: [{ reps: 10, weightGrams: 20_000, seconds: null }],
    durationSeconds,
    calories: null,
    averageHeartRateBpm: null,
    highestHeartRateBpm: null,
    note: null,
  });

  it('goes on following the reps when it matches them; another time stays the user’s', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c2d';
    mockParams.id = id;
    await renderInApp(<WorkoutScreen now={() => NOW} />, undefined, async (db, server) => {
      await withExerciseList(db, server);
      const data = {
        id,
        day: '2026-10-28',
        exercises: [saved('Dumbbell bench press', 40), saved('Barbell bench press', 90)],
        recordedAt: '2026-10-28T02:00:00.000Z',
        timer: null,
      } as unknown as WorkoutData;
      await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000a3', data });
    });

    // 10 reps × 4 s = 40 s: the saved time was the reps', so another set grows it to 80 s.
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Dumbbell bench press: / }))[0]!);
    await waitFor(() => expect(screen.getByLabelText('Time spent, seconds (optional)')).toHaveDisplayValue('40'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    await waitFor(() => expect(screen.getByLabelText('Time spent, seconds (optional)')).toHaveDisplayValue('20'));
    expect(screen.getByLabelText('Time spent, minutes (optional)')).toHaveDisplayValue('1');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the workout' }));

    // 90 s is not what 10 reps give: it stays the user's, whatever the reps do.
    await fireEvent.press((await screen.findAllByRole('button', { name: /^Barbell bench press: / }))[0]!);
    await waitFor(() => expect(screen.getByLabelText('Time spent, seconds (optional)')).toHaveDisplayValue('30'));
    await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
    expect(screen.getByLabelText('Time spent, minutes (optional)')).toHaveDisplayValue('1');
    expect(screen.getByLabelText('Time spent, seconds (optional)')).toHaveDisplayValue('30');
  });
});
