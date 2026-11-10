import type { ListedExercise, WorkoutSetData } from '@fitsphere/shared';
import { sameSets, TEST_EXERCISE_LIST } from '../testing/exercises';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import { findListedExercise, getEntry, getMeta, migrateLocal, replaceExercises, saveEntry, searchExercises, setMeta } from './store';

// The exercise list on the phone (D-50): replaced whole with its version, searched offline, and a name
// typed in full matched whatever its case, hyphens and doubled letters. Workouts saved before D-50 are
// read in today's shape.

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
  await replaceExercises(db, 'v1', TEST_EXERCISE_LIST);
});

afterEach(async () => {
  await db.closeAsync();
});

const names = (list: ListedExercise[]) => list.map((exercise) => exercise.name);

describe('D-50 the exercise list on the phone', () => {
  it('keeps the list with its version, and replaces it whole', async () => {
    expect(await getMeta(db, 'exercise_list_version')).toBe('v1');
    expect(await findListedExercise(db, 'Running')).toEqual(TEST_EXERCISE_LIST.find((exercise) => exercise.code === 'running'));

    await replaceExercises(db, 'v2', TEST_EXERCISE_LIST.slice(0, 2));

    expect(await getMeta(db, 'exercise_list_version')).toBe('v2');
    expect(await findListedExercise(db, 'Running')).toBeNull();
    expect(names(await searchExercises(db, 'dumbbell'))).toEqual(['Dumbbell bench press', 'Dumbbell curl']);
  });

  it('finds every word of a search, whatever the spelling of dumbbell, names starting with the first word first', async () => {
    expect(names(await searchExercises(db, 'dumbell'))).toEqual(['Dumbbell bench press', 'Dumbbell curl', "Farmer's walk", 'Hammer curl']);
    expect(names(await searchExercises(db, 'DB bench'))).toEqual(['Dumbbell bench press']);
    expect(names(await searchExercises(db, 'bench'))).toEqual(['Barbell bench press', 'Dumbbell bench press']);
    expect(names(await searchExercises(db, 'curl'))).toEqual(['Dumbbell curl', 'Hammer curl']);
    expect(names(await searchExercises(db, 'run'))).toEqual(['Running']);
  });

  it('finds a name written with or without its hyphen, and a plural', async () => {
    expect(names(await searchExercises(db, 'pushups'))).toEqual(['Push-up']);
    expect(names(await searchExercises(db, 'push up'))).toEqual(['Push-up']);
    expect(names(await searchExercises(db, 'dips'))).toEqual(['Parallel bar dip']);
    expect(names(await searchExercises(db, 'farmers'))).toEqual(["Farmer's walk"]);
  });

  it('gives at most 8 matches, and none for a blank search or a name not in the list', async () => {
    expect(await searchExercises(db, 'e')).toHaveLength(8);
    expect(await searchExercises(db, '  ')).toEqual([]);
    expect(await searchExercises(db, 'quidditch')).toEqual([]);
  });

  it('matches a name or another name typed in full, whatever its case, hyphens and doubled letters', async () => {
    expect((await findListedExercise(db, 'push up'))?.code).toBe('push-up');
    expect((await findListedExercise(db, 'PRESS-UP'))?.code).toBe('push-up');
    expect((await findListedExercise(db, ' Dumbell bench press '))?.code).toBe('dumbbell-bench-press');
    expect((await findListedExercise(db, 'bench press'))?.code).toBe('barbell-bench-press');
    expect(await findListedExercise(db, 'push')).toBeNull();
    expect(await findListedExercise(db, '')).toBeNull();
  });
});

describe('D-50 workouts saved before the exercise list', () => {
  it('reads an exercise saved before D-50 as identical sets', async () => {
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    const earlier = { name: 'Squat', sets: 2, reps: 10, weightGrams: 40_000, note: null };
    const data = { id, day: '2026-10-27', exercises: [earlier], recordedAt: '2026-10-27T03:00:00.000Z' } as unknown as WorkoutSetData;
    await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-000000000001', data });

    expect((await getEntry(db, 'workout', id))?.exercises).toEqual([sameSets('Squat', 2, 10, 40_000)]);
  });
});

describe('Local schema version 13', () => {
  it('D-50 the update from version 12 adds the exercise list, to be downloaded', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await old.execAsync(
        'DROP TABLE exercises; ALTER TABLE foods DROP COLUMN search_name; ALTER TABLE foods DROP COLUMN search_aliases; ALTER TABLE packaged_foods DROP COLUMN search_name; ALTER TABLE packaged_foods DROP COLUMN search_brand; PRAGMA user_version = 12;',
      );
      await setMeta(old, 'exercise_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 15 });
      expect(await getMeta(old, 'exercise_list_version')).toBeNull();
      expect(await searchExercises(old, 'run')).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});
