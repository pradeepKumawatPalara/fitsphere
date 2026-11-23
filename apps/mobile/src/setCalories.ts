import { EXERCISE_KCAL_MAX, exerciseMet, type ListedExercise, type WorkoutExercise } from '@fitsphere/shared';

// Calories burned by an exercise done in sets, worked out from its sets every time it is shown (the
// owner, 2026-11-24): a change to a set's reps changes the calories on Home and on Training alike.
//
//   time    = sum over the sets (reps × SECONDS_PER_REP, or the set's own seconds when it is timed)
//             + REST_SECONDS between the sets
//   kcal    = MET × body weight in kg × time in hours, rounded, from 1 to the largest an exercise holds
//
// MET is the Compendium's value for the exercise in the list; the weight is the latest weigh-in on or
// before the workout's day. Calories the user typed (not estimated) are kept as typed.

export const SECONDS_PER_REP = 3;
export const REST_SECONDS = 60;

/** The time a set-based exercise takes, from its sets. */
export function setsSeconds(sets: readonly { reps: number | null; seconds: number | null }[]): number {
  const active = sets.reduce((sum, set) => sum + (set.seconds ?? (set.reps ?? 0) * SECONDS_PER_REP), 0);
  return active + Math.max(0, sets.length - 1) * REST_SECONDS;
}

/** The estimate for an exercise in sets, or null when there is none to make (not in the list, no MET, no weigh-in). */
export function kcalFromSets(
  exercise: Extract<WorkoutExercise, { kind: 'sets' }>,
  listed: Pick<ListedExercise, 'compendiumCode' | 'met' | 'speedMets'> | null,
  weightGrams: number | null,
): number | null {
  if (listed === null || weightGrams === null) return null;
  const activity = exerciseMet(listed, null);
  if (activity === null) return null;
  const seconds = setsSeconds(exercise.sets);
  if (seconds <= 0) return null;
  return Math.min(EXERCISE_KCAL_MAX, Math.max(1, Math.round((activity.met * (weightGrams / 1000) * seconds) / 3600)));
}

/**
 * The exercises with their calories read from their sets: a set-based exercise whose calories are an estimate
 * (or none) gets the estimate above, when there is one; typed calories, cardio, and an exercise with no
 * estimate are as stored.
 */
export function withSetCalories(
  exercises: readonly WorkoutExercise[],
  listedOf: (name: string) => Pick<ListedExercise, 'compendiumCode' | 'met' | 'speedMets'> | null,
  weightGrams: number | null,
): WorkoutExercise[] {
  return exercises.map((exercise) => {
    if (exercise.kind !== 'sets' || (exercise.calories && !exercise.calories.estimated)) return exercise;
    const kcal = kcalFromSets(exercise, listedOf(exercise.name), weightGrams);
    return kcal === null ? exercise : { ...exercise, calories: { kcal, estimated: true } };
  });
}
