import type { ListedExercise, SetsExercise } from '@fitsphere/shared';
import type { SqlDb } from '../local/sql';
import { replaceExercises } from '../local/store';
import type { fakeServer } from './fakeServer';

// Synthetic exercises for tests (invariant #7): a workout's exercises in today's shape (D-50), and a
// small exercise list with an exercise of each type. The METs are the list's own
// (data/exercises/exercise-list.csv), copied from the 2024 Adult Compendium.

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

/** One exercise of each type, and a few more dumbbell ones to search among. */
export const TEST_EXERCISE_LIST: ListedExercise[] = [
  { code: 'dumbbell-bench-press', name: 'Dumbbell bench press', group: 'dumbbell', logType: 'weight_reps', aliases: ['dumbbell press'], compendiumCode: '02054', met: 3.5 },
  { code: 'dumbbell-curl', name: 'Dumbbell curl', group: 'dumbbell', logType: 'weight_reps', aliases: [], compendiumCode: '02054', met: 3.5 },
  { code: 'hammer-curl', name: 'Hammer curl', group: 'dumbbell', logType: 'weight_reps', aliases: ['dumbbell hammer curl'], compendiumCode: '02054', met: 3.5 },
  { code: 'barbell-bench-press', name: 'Barbell bench press', group: 'barbell', logType: 'weight_reps', aliases: ['bench press'], compendiumCode: '02054', met: 3.5 },
  { code: 'push-up', name: 'Push-up', group: 'bodyweight', logType: 'reps', aliases: ['pushups', 'press-up'], compendiumCode: '02022', met: 3.8 },
  { code: 'parallel-bar-dip', name: 'Parallel bar dip', group: 'bodyweight', logType: 'reps', aliases: ['dips', 'dip'], compendiumCode: '02022', met: 3.8 },
  { code: 'plank', name: 'Plank', group: 'bodyweight', logType: 'time', aliases: [], compendiumCode: '02024', met: 2.8 },
  { code: 'farmers-walk', name: "Farmer's walk", group: 'dumbbell', logType: 'weight_time', aliases: ["farmer's carry"], compendiumCode: '17019', met: 6.5 },
  { code: 'running', name: 'Running', group: 'cardio', logType: 'distance_time', aliases: ['run'], compendiumCode: '12145', met: 10.5 },
  { code: 'treadmill-walking', name: 'Treadmill walking', group: 'cardio', logType: 'treadmill', aliases: ['treadmill walk'], compendiumCode: '17358', met: 4.8 },
  { code: 'exercise-bike', name: 'Exercise bike', group: 'cardio', logType: 'cardio_machine', aliases: ['stationary bike'], compendiumCode: '01200', met: 6.8 },
  { code: 'yoga', name: 'Yoga', group: 'yoga', logType: 'time_only', aliases: [], compendiumCode: '02175', met: 2.3 },
  { code: 'kabaddi', name: 'Kabaddi', group: 'sport', logType: 'time_only', aliases: [], compendiumCode: null, met: null },
];

/** A `renderInApp` step: the test list on the server, and already on the phone at the server's version. */
export async function withExerciseList(db: SqlDb, server: ReturnType<typeof fakeServer>): Promise<void> {
  server.state.exercises = TEST_EXERCISE_LIST;
  await replaceExercises(db, server.state.exercisesVersion, TEST_EXERCISE_LIST);
}
