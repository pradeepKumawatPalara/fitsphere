import type { WorkoutSetData } from '@fitsphere/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Button, Keyboard, type EmitterSubscription } from 'react-native';
import { getEntry, saveEntry, saveWeighIn } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { NOW, renderInApp } from '../testing/appHarness';
import { sameSets, withExerciseList } from '../testing/exercises';
import { exerciseRules, type SetText } from '../workouts';
import { TrainingScreen } from './TrainingScreen';
import { WorkoutScreen } from './WorkoutScreen';

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
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
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
    expect(screen.getByText('No exercises yet.')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Wed 28 Oct, Workout 1: No exercises' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ deleted: false, day: '2026-10-28', exercises: [] }));
    expect(await getEntry(db, 'workout', id)).toMatchObject({ syncState: 'synced' });
  });

  it('Q-011 a workout started with a past date selected belongs to that day', async () => {
    const { server, id } = await startWorkout('2026-10-20');

    expect(screen.getByText('Workout 1 · Tue 20 Oct')).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('workouts').get(id)).toMatchObject({ day: '2026-10-20' }));
  });
});

describe('D-50 picking from the exercise list', () => {
  it('lists the matches of a search with their group, "dumbell" finding the dumbbell exercises', async () => {
    await startWorkout();
    await openSheet();
    expect(screen.getByText(/^Type to search the exercise list/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'dumbell');

    expect(await screen.findByRole('button', { name: 'Dumbbell bench press, Dumbbell' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dumbbell curl, Dumbbell' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Farmer's walk, Dumbbell" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Push-up, Bodyweight' })).toBeNull();
    expect(screen.queryByText('Sets')).toBeNull();
  });

  it('a weighted exercise asks for the weight of every set, each set with its own reps and weight', async () => {
    const { server, id } = await startWorkout();
    await openSheet();

    await pick('dumbell', 'Dumbbell bench press');
    expect(screen.getByText('Weight and reps')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell')).toBeOnTheScreen();
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

    expect(await screen.findByText('Set 2: enter the weight you lifted, from 0.1 to 500.0 kg.')).toBeOnTheScreen();
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
    await waitFor(() => expect(server.entries('workouts').get(id)?.exercises).toEqual([sameSets('Push-up', 3, 15, null)]));
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
    await save();
    expect(await screen.findByText(RULES.time)).toBeOnTheScreen();
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
      expect(await screen.findByRole('button', { name: 'Dumbbell curl, Dumbbell' })).toBeOnTheScreen();
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
    [{ weight: '500.1' }, `Set 1: ${RULES.optionalWeight}`],
    [{ weight: '40.25' }, `Set 1: ${RULES.optionalWeight}`],
    [{ weight: 'abc' }, `Set 1: ${RULES.optionalWeight}`],
    [{ note: 'x'.repeat(501) }, RULES.note],
  ])('refuses %j with its rule and saves nothing', async (wrong, rule) => {
    const { db, id } = await startWorkout();

    await addOwn(wrong);

    expect(await screen.findByText(rule)).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
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
      const data = { id, day: '2026-10-28', exercises: earlier, recordedAt: '2026-10-28T02:00:00.000Z' } as unknown as WorkoutSetData;
      await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000a1', data });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Push-up: 2 sets, 15 × 10.0 kg' }));
    expect((await screen.findByLabelText('Set 2, Weight in kg (optional)')).props.value).toBe('10.0');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

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

    expect(await screen.findByText('No exercises yet.')).toBeOnTheScreen();
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

    expect(await screen.findByText('No exercises yet.')).toBeOnTheScreen();
    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([]);
  });

  it('Q-029 Cancel closes the sheet and saves nothing', async () => {
    const { db, id } = await startWorkout();

    await openSheet();
    await typeName('Squat');
    await fillSets([{ reps: '10' }]);
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
    // D-63: an empty workout counts nowhere, so only that it can't be undone.
    expect(screen.getByText('Delete Workout 1 on Wed 28 Oct?')).toBeOnTheScreen();
    expect(screen.getByText("You can't undo this.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep' }));
    expect(await getEntry(db, 'workout', id)).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete workout' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'workout', id)).toBeNull();
    expect(await screen.findByText('No workouts logged yet.')).toBeOnTheScreen();
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
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
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
    expect(screen.getByText('estimated')).toBeOnTheScreen();
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
    expect(screen.getByText('As you typed it, from your machine or watch.')).toBeOnTheScreen();
    expect(screen.queryByText('estimated')).toBeNull();
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
    expect(await screen.findByText('Add the time spent to see an estimate.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Time spent in min (optional)'), '12');
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
    await fireEvent.changeText(screen.getByLabelText('Average heart rate'), '150');
    await fireEvent.changeText(screen.getByLabelText('Highest heart rate'), '140');
    await save();
    expect(await screen.findByText(RULES.heartRateOrder)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Highest heart rate'), '251');
    await save();
    expect(await screen.findByText(RULES.heartRate)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Highest heart rate'), '172');
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
