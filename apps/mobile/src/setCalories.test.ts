import type { WorkoutData } from './local/store';
import { getEntry, listEntries, migrateLocal, replaceExercises, saveEntry, saveWeighIn } from './local/store';
import type { SqlDb } from './local/sql';
import { kcalFromSets, REST_SECONDS, SECONDS_PER_REP, setsSeconds } from './setCalories';
import { caloriesBurned } from './workouts';
import { sameSets, TEST_EXERCISE_LIST } from './testing/exercises';
import { memoryDb } from './testing/memoryDb';

// Calories burned from the sets (the owner, 2026-11-24). Synthetic data only.

const DAY = '2026-11-23';
const AT = `${DAY}T04:00:00.000Z`;
const ID = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
const CURL = TEST_EXERCISE_LIST.find((exercise) => exercise.code === 'dumbbell-curl')!; // MET 3.5
let db: SqlDb;
let n = 0;
const changeId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
  await replaceExercises(db, 'v1', TEST_EXERCISE_LIST);
  await saveWeighIn(db, { changeId: changeId(), day: '2026-11-20', weightGrams: 70_000, recordedAt: AT });
});
afterEach(async () => {
  await db.closeAsync();
});

async function saveWorkout(exercise = sameSets('Dumbbell curl', 3, 10, 12_000), workout: Partial<WorkoutData> = {}) {
  await saveEntry(db, 'workout', { changeId: changeId(), data: { id: ID, day: DAY, exercises: [exercise], recordedAt: AT, timer: null, ...workout } });
}

describe('the time of the sets', () => {
  it('3 s a rep and 60 s of rest between the sets', () => {
    expect(setsSeconds(sameSets('x', 3, 10, null).sets)).toBe(3 * 10 * SECONDS_PER_REP + 2 * REST_SECONDS); // 210
    expect(setsSeconds(sameSets('x', 1, 10, null).sets)).toBe(30);
  });
  it('a timed set counts its own seconds', () => {
    expect(setsSeconds([{ reps: null, seconds: 45 }, { reps: null, seconds: 30 }])).toBe(75 + 60);
  });
});

describe('kcal from the sets', () => {
  it('is MET × kg × hours: 3 × 10 reps at 70 kg is 14, and 3 × 12 reps is 16', () => {
    expect(kcalFromSets(sameSets('Dumbbell curl', 3, 10, 12_000) as never, CURL, 70_000)).toBe(14);
    expect(kcalFromSets(sameSets('Dumbbell curl', 3, 12, 12_000) as never, CURL, 70_000)).toBe(16);
  });
  it('has none without a weigh-in or for an exercise not in the list', () => {
    expect(kcalFromSets(sameSets('Dumbbell curl', 3, 10, null) as never, CURL, null)).toBeNull();
    expect(kcalFromSets(sameSets('My own', 3, 10, null) as never, null, 70_000)).toBeNull();
  });
});

describe('what the phone reads', () => {
  it('a set changed changes the calories, in the day list and in the workout', async () => {
    await saveWorkout();
    const first = caloriesBurned((await listEntries(db, 'workout', DAY, DAY))[0]!.exercises);
    expect(first).toEqual({ kcal: 14, estimated: true });

    await saveWorkout(sameSets('Dumbbell curl', 3, 12, 12_000));

    expect(caloriesBurned((await listEntries(db, 'workout', DAY, DAY))[0]!.exercises)?.kcal).toBe(16);
    expect(caloriesBurned((await getEntry(db, 'workout', ID))!.exercises)?.kcal).toBe(16);
  });

  it('calories typed by the user stay as typed, and an exercise with no estimate keeps what it had', async () => {
    await saveWorkout({ ...sameSets('Dumbbell curl', 3, 10, 12_000), calories: { kcal: 99, estimated: false } });
    expect(caloriesBurned((await getEntry(db, 'workout', ID))!.exercises)?.kcal).toBe(99);

    await saveWorkout({ ...sameSets('My own lift', 3, 10, 12_000), calories: { kcal: 40, estimated: true } });
    expect(caloriesBurned((await getEntry(db, 'workout', ID))!.exercises)?.kcal).toBe(40);
  });
});
