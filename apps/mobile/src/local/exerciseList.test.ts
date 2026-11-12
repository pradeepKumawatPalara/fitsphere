import type { ListedExercise } from '@fitsphere/shared';
import { sameSets, TEST_DETAILS, TEST_EXERCISE_LIST } from '../testing/exercises';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  exercisePlaceCounts,
  findListedExercise,
  getEntry,
  getMeta,
  migrateLocal,
  replaceExercises,
  saveEntry,
  searchExercises,
  setMeta,
  type WorkoutData,
} from './store';

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
    const data = { id, day: '2026-10-27', exercises: [earlier], recordedAt: '2026-10-27T03:00:00.000Z', timer: null } as unknown as WorkoutData;
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
        'ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; DROP TABLE exercises; ALTER TABLE foods DROP COLUMN search_name; ALTER TABLE foods DROP COLUMN search_aliases; ALTER TABLE packaged_foods DROP COLUMN search_name; ALTER TABLE packaged_foods DROP COLUMN search_brand; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 12;',
      );
      await setMeta(old, 'exercise_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await getMeta(old, 'exercise_list_version')).toBeNull();
      expect(await searchExercises(old, 'run')).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('D-67 the exercise library on the phone', () => {
  it('keeps each exercise\u2019s places', async () => {
    expect((await findListedExercise(db, 'Parallel bar dip'))?.places).toEqual([
      { category: 'Bodyweight / Calisthenics', subGroup: 'Push' },
      { category: 'CrossFit / Functional Fitness', subGroup: 'Gymnastics' },
    ]);
    expect((await findListedExercise(db, 'Running'))?.places).toEqual([]);
  });

  it('narrows a search to a category, a sub-group or both, and with no words lists them all by name', async () => {
    expect(names(await searchExercises(db, '', 100, { category: 'Dumbbell', subGroup: null }))).toEqual(['Dumbbell bench press', 'Dumbbell curl', 'Hammer curl']);
    expect(names(await searchExercises(db, 'curl', 100, { category: 'Dumbbell', subGroup: null }))).toEqual(['Dumbbell curl', 'Hammer curl']);
    expect(names(await searchExercises(db, '', 100, { category: 'Dumbbell', subGroup: 'Biceps' }))).toEqual(['Dumbbell curl', 'Hammer curl']);
    expect(names(await searchExercises(db, '', 100, { category: null, subGroup: 'Push' }))).toEqual(['Parallel bar dip', 'Push-up']);
    expect(names(await searchExercises(db, '', 100, { category: null, subGroup: 'Gymnastics' }))).toEqual(['Parallel bar dip']);
    expect(names(await searchExercises(db, '', 100, { category: 'Smith Machine', subGroup: null }))).toEqual(['Smith Machine Squat']);
    // "Core" is not "Core & Mobility"; a category is not another's sub-group.
    expect(await searchExercises(db, '', 100, { category: null, subGroup: 'Core' })).toEqual([]);
    expect(await searchExercises(db, 'squat', 100, { category: 'Dumbbell', subGroup: null })).toEqual([]);
    expect(await searchExercises(db, '', 100, { category: null, subGroup: null })).toEqual([]);
  });

  it('puts an exercise named exactly as typed, or with another name so, before the others', async () => {
    const pushUp = TEST_EXERCISE_LIST.find((exercise) => exercise.code === 'push-up')!;
    await replaceExercises(db, 'v2', [
      { ...pushUp, code: 'push-up-pilates', name: 'Push-Up (Pilates)', aliases: [] },
      { ...pushUp, code: 'standard-push-up', name: 'Standard Push-Up', aliases: ['Push-up', 'pushups'] },
      { ...pushUp, code: 'push-up-plus', name: 'Push-Up Plus', aliases: [] },
    ]);

    expect(names(await searchExercises(db, 'push-up'))).toEqual(['Standard Push-Up', 'Push-Up (Pilates)', 'Push-Up Plus']);
    expect(names(await searchExercises(db, 'push'))).toEqual(['Push-Up (Pilates)', 'Push-Up Plus', 'Standard Push-Up']);
  });

  it('counts each category\u2019s, each sub-group\u2019s and each sub-group name\u2019s exercises, each once', async () => {
    const counts = await exercisePlaceCounts(db);
    expect(counts.total).toBe(15);
    expect(counts.byCategory.get('Dumbbell')).toBe(3);
    expect(counts.byCategory.get('Bodyweight / Calisthenics')).toBe(2);
    expect(counts.byPlace.get('Dumbbell>Biceps')).toBe(2);
    expect(counts.bySubGroup.get('Push')).toBe(2);
    expect(counts.bySubGroup.get('Chest')).toBe(2);
    expect(counts.byCategory.get('Barbell')).toBe(1);
    expect(counts.byCategory.get('Machine')).toBeUndefined();
  });
});

describe('Local schema version 16', () => {
  it('D-67 the update from version 15 adds the exercises\u2019 places, the list to be downloaded again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await old.execAsync('ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; ALTER TABLE exercises DROP COLUMN details; ALTER TABLE exercises DROP COLUMN places; ALTER TABLE exercises DROP COLUMN place_keys; ALTER TABLE workouts DROP COLUMN timer; PRAGMA user_version = 15;');
      await setMeta(old, 'exercise_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await getMeta(old, 'exercise_list_version')).toBeNull();
      await replaceExercises(old, 'v2', TEST_EXERCISE_LIST);
      expect(names(await searchExercises(old, '', 100, { category: 'Barbell', subGroup: 'Chest' }))).toEqual(['Barbell bench press']);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('D-82 how to do each exercise on the phone', () => {
  it('keeps each exercise\u2019s details, or none', async () => {
    expect((await findListedExercise(db, 'pushups'))?.details).toEqual(TEST_DETAILS['push-up']);
    expect((await findListedExercise(db, 'Running'))?.details).toBeNull();
  });

  it('the update from version 19 adds the details, the list to be downloaded again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await old.execAsync('ALTER TABLE packaged_foods DROP COLUMN aliases; ALTER TABLE packaged_foods DROP COLUMN search_aliases; ALTER TABLE exercises DROP COLUMN details; PRAGMA user_version = 19;');
      await setMeta(old, 'exercise_list_version', 'v1');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 22 });
      expect(await getMeta(old, 'exercise_list_version')).toBeNull();
      await replaceExercises(old, 'v2', TEST_EXERCISE_LIST);
      expect((await findListedExercise(old, 'Dumbbell bench press'))?.details?.howTo).toHaveLength(3);
    } finally {
      await old.closeAsync();
    }
  });
});
