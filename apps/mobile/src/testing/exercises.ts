import type { ExerciseDetails, ListedExercise, SetsExercise, SpeedMet } from '@fitsphere/shared';
import type { SqlDb } from '../local/sql';
import { replaceExercises } from '../local/store';
import type { fakeServer } from './fakeServer';

// Synthetic exercises for tests (invariant #7): a workout's exercises in today's shape (D-50), and a
// small exercise list with an exercise of each type. The METs and speed bands are the list's own
// (data/exercises/), copied from the 2024 Adult Compendium.

/** An exercise done in `count` sets of the same reps and weight, with no time, calories or heart rate. */
export function sameSets(name: string, count: number, reps: number | null, weightGrams: number | null, note: string | null = null): SetsExercise {
  return {
    kind: 'sets',
    name,
    sets: Array.from({ length: count }, () => ({ reps, weightGrams, seconds: null })),
    durationSeconds: null,
    calories: null,
    averageHeartRateBpm: null,
    highestHeartRateBpm: null,
    note,
  };
}

function bands(rows: [fromKmh: number, compendiumCode: string, met: number][]): SpeedMet[] {
  return rows.map(([fromKmh, compendiumCode, met]) => ({ fromKmh, compendiumCode, met }));
}

const RUNNING_BANDS = bands([
  [4.2, '12026', 3.3],
  [6.4, '12028', 6.5],
  [6.9, '12029', 7.8],
  [8.0, '12030', 8.5],
  [8.9, '12045', 9.0],
  [9.7, '12050', 9.3],
  [10.8, '12060', 10.5],
  [11.3, '12070', 11.0],
  [12.1, '12080', 11.8],
]);

const TREADMILL_WALKING_BANDS = bands([
  [0, '17340', 2.1],
  [4.0, '17352', 3.5],
  [4.8, '17355', 3.8],
  [5.6, '17358', 4.8],
  [6.4, '17361', 5.8],
]);

/** How to do two of them (D-82), as the library's details read; the others have none. Synthetic text. */
export const TEST_DETAILS: Record<string, ExerciseDetails> = {
  'dumbbell-bench-press': {
    place: { category: 'Dumbbell', subGroup: 'Chest' },
    primaryMuscle: 'Chest',
    musclesWorked: ['Chest', 'Front delts', 'Triceps'],
    equipment: 'Dumbbell',
    tags: ['Chest', 'Front delts', 'Triceps', 'Dumbbell'],
    howTo: ['Lie on a flat bench, a dumbbell in each hand.', 'Lower them to your chest.', 'Press them back up.'],
    watchFor: 'Arching the back. Bouncing at the bottom.',
    videoUrl: null,
  },
  'push-up': {
    place: { category: 'Bodyweight / Calisthenics', subGroup: 'Push' },
    primaryMuscle: 'Chest',
    musclesWorked: ['Chest', 'Triceps'],
    equipment: 'Bodyweight',
    tags: ['Chest', 'Triceps', 'Bodyweight'],
    howTo: ['Start in a high plank.', 'Lower your chest.'],
    watchFor: 'Hips sagging.',
    videoUrl: 'https://www.youtube.com/watch?v=pushup',
  },
};

/** One exercise of each type, a few more dumbbell ones to search among, and two of the library's (D-67), most with places. */
const LISTED: Omit<ListedExercise, 'details'>[] = [
  { code: 'dumbbell-bench-press', name: 'Dumbbell bench press', group: 'dumbbell', logType: 'weight_reps', aliases: ['dumbbell press'], compendiumCode: '02054', met: 3.5, speedMets: [], places: [{ category: 'Dumbbell', subGroup: 'Chest' }] },
  { code: 'dumbbell-curl', name: 'Dumbbell curl', group: 'dumbbell', logType: 'weight_reps', aliases: [], compendiumCode: '02054', met: 3.5, speedMets: [], places: [{ category: 'Dumbbell', subGroup: 'Biceps' }] },
  { code: 'hammer-curl', name: 'Hammer curl', group: 'dumbbell', logType: 'weight_reps', aliases: ['dumbbell hammer curl'], compendiumCode: '02054', met: 3.5, speedMets: [], places: [{ category: 'Dumbbell', subGroup: 'Biceps' }] },
  { code: 'barbell-bench-press', name: 'Barbell bench press', group: 'barbell', logType: 'weight_reps', aliases: ['bench press'], compendiumCode: '02054', met: 3.5, speedMets: [], places: [{ category: 'Barbell', subGroup: 'Chest' }] },
  { code: 'push-up', name: 'Push-up', group: 'bodyweight', logType: 'reps', aliases: ['pushups', 'press-up'], compendiumCode: '02022', met: 3.8, speedMets: [], places: [{ category: 'Bodyweight / Calisthenics', subGroup: 'Push' }] },
  { code: 'parallel-bar-dip', name: 'Parallel bar dip', group: 'bodyweight', logType: 'reps', aliases: ['dips', 'dip'], compendiumCode: '02022', met: 3.8, speedMets: [], places: [
      { category: 'Bodyweight / Calisthenics', subGroup: 'Push' },
      { category: 'CrossFit / Functional Fitness', subGroup: 'Gymnastics' },
    ] },
  { code: 'plank', name: 'Plank', group: 'bodyweight', logType: 'time', aliases: [], compendiumCode: '02024', met: 2.8, speedMets: [], places: [] },
  { code: 'farmers-walk', name: "Farmer's walk", group: 'dumbbell', logType: 'weight_time', aliases: ["farmer's carry"], compendiumCode: '17019', met: 6.5, speedMets: [], places: [] },
  { code: 'running', name: 'Running', group: 'cardio', logType: 'distance_time', aliases: ['run'], compendiumCode: '12145', met: 10.5, speedMets: RUNNING_BANDS, places: [] },
  { code: 'treadmill-walking', name: 'Treadmill walking', group: 'cardio', logType: 'treadmill', aliases: ['treadmill walk'], compendiumCode: '17358', met: 4.8, speedMets: TREADMILL_WALKING_BANDS, places: [] },
  { code: 'exercise-bike', name: 'Exercise bike', group: 'cardio', logType: 'cardio_machine', aliases: ['stationary bike'], compendiumCode: '01200', met: 6.8, speedMets: [], places: [] },
  { code: 'yoga', name: 'Yoga', group: 'yoga', logType: 'time_only', aliases: [], compendiumCode: '02175', met: 2.3, speedMets: [], places: [] },
  { code: 'kabaddi', name: 'Kabaddi', group: 'sport', logType: 'time_only', aliases: [], compendiumCode: null, met: null, speedMets: [], places: [] },
  // Two of the exercise library's (D-67): one in a category without sub-groups, one with no Compendium activity.
  { code: 'smith-machine-squat', name: 'Smith Machine Squat', group: 'machine', logType: 'weight_reps', aliases: [], compendiumCode: '02052', met: 5.0, speedMets: [], places: [{ category: 'Smith Machine', subGroup: null }] },
  { code: 'sled-drag-harness', name: 'Sled Drag (Harness)', group: 'other', logType: 'weight_time', aliases: [], compendiumCode: null, met: null, speedMets: [], places: [{ category: 'Sandbag / Strongman', subGroup: 'Strongman' }] },
];

/** The test list, two of them with how to do them (D-82). */
export const TEST_EXERCISE_LIST: ListedExercise[] = LISTED.map((exercise) => ({ ...exercise, details: TEST_DETAILS[exercise.code] ?? null }));

/** A `renderInApp` step: the test list on the server, and already on the phone at the server's version. */
export async function withExerciseList(db: SqlDb, server: ReturnType<typeof fakeServer>): Promise<void> {
  server.state.exercises = TEST_EXERCISE_LIST;
  await replaceExercises(db, server.state.exercisesVersion, TEST_EXERCISE_LIST);
}
