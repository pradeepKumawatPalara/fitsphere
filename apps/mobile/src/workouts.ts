import {
  EXERCISE_NAME_MAX,
  EXERCISE_NOTE_MAX,
  EXERCISE_REPS_MAX,
  EXERCISE_SETS_MAX,
  formatWeight,
  fromGrams,
  isLiftWeightGramsInRange,
  LIFT_WEIGHT_GRAMS_MAX,
  LIFT_WEIGHT_GRAMS_MIN,
  toGrams,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { parseOneDecimal, parseWholeNumber } from './format';

// Workouts on screen (REQ-TRN-003…005): exercises as sets × reps × weight with an optional note
// (Q-042), within the limits of the contracts (MVP defaults, D-29).

/** The lifting-weight unit until the Settings slice adds the setting (REQ-TRN-005, REQ-ACC-002;
 * MVP default, D-29). Weights are stored in grams, so the setting will convert the history shown. */
export const LIFTING_WEIGHT_UNIT = 'kg';

export const EXERCISE_RULES = {
  name: `Enter a name of up to ${EXERCISE_NAME_MAX} characters.`,
  sets: `Enter sets from 1 to ${EXERCISE_SETS_MAX}.`,
  reps: `Enter reps from 1 to ${EXERCISE_REPS_MAX}.`,
  weight: `Enter a weight from ${fromGrams(LIFT_WEIGHT_GRAMS_MIN, LIFTING_WEIGHT_UNIT).toFixed(1)} to ${fromGrams(
    LIFT_WEIGHT_GRAMS_MAX,
    LIFTING_WEIGHT_UNIT,
  ).toFixed(1)} ${LIFTING_WEIGHT_UNIT}, with at most one decimal, or leave it empty.`,
  note: `Notes can be up to ${EXERCISE_NOTE_MAX} characters.`,
} as const;

/** The exercise sheet's fields as typed. */
export type ExerciseText = { name: string; sets: string; reps: string; weight: string; note: string };

export const EMPTY_EXERCISE: ExerciseText = { name: '', sets: '', reps: '', weight: '', note: '' };

/** An exercise as the sheet shows it for editing. */
export function toExerciseText(exercise: WorkoutExercise): ExerciseText {
  return {
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weight: exercise.weightGrams === null ? '' : fromGrams(exercise.weightGrams, LIFTING_WEIGHT_UNIT).toFixed(1),
    note: exercise.note ?? '',
  };
}

/** Reads the sheet's fields: the exercise, or the rule for the first field that cannot be saved. */
export function parseExercise(text: ExerciseText): { exercise: WorkoutExercise } | { problem: string } {
  const name = text.name.trim();
  if (name.length === 0 || name.length > EXERCISE_NAME_MAX) return { problem: EXERCISE_RULES.name };
  const sets = parseWholeNumber(text.sets, 1, EXERCISE_SETS_MAX);
  if (sets === null) return { problem: EXERCISE_RULES.sets };
  const reps = parseWholeNumber(text.reps, 1, EXERCISE_REPS_MAX);
  if (reps === null) return { problem: EXERCISE_RULES.reps };
  let weightGrams: number | null = null;
  if (text.weight.trim() !== '') {
    const value = parseOneDecimal(text.weight);
    weightGrams = value === null ? null : toGrams(value, LIFTING_WEIGHT_UNIT);
    if (weightGrams === null || !isLiftWeightGramsInRange(weightGrams)) return { problem: EXERCISE_RULES.weight };
  }
  const note = text.note.trim();
  if (note.length > EXERCISE_NOTE_MAX) return { problem: EXERCISE_RULES.note };
  return { exercise: { name, sets, reps, weightGrams, note: note === '' ? null : note } };
}

/** e.g. "3 × 10 × 40.0 kg", or "3 × 10" with no weight. */
export function formatSets(exercise: Pick<WorkoutExercise, 'sets' | 'reps' | 'weightGrams'>): string {
  const setsAndReps = `${exercise.sets} × ${exercise.reps}`;
  return exercise.weightGrams === null
    ? setsAndReps
    : `${setsAndReps} × ${formatWeight(exercise.weightGrams, LIFTING_WEIGHT_UNIT)}`;
}

/** e.g. "3 exercises · Squat, Bench press, Row", or "No exercises". */
export function workoutSummary(exercises: readonly Pick<WorkoutExercise, 'name'>[]): string {
  if (exercises.length === 0) return 'No exercises';
  const count = `${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'}`;
  const names = exercises
    .slice(0, 3)
    .map((exercise) => exercise.name)
    .join(', ');
  return `${count} · ${names}${exercises.length > 3 ? ', …' : ''}`;
}
