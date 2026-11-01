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
  weightRangeIn,
  type BodyWeightUnit,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { parseOneDecimal, parseWholeNumber } from './format';

// Workouts on screen (REQ-TRN-003…005): exercises as sets × reps × weight with an optional note
// (Q-042), within the limits of the contracts (MVP defaults, D-29). Weights are typed and shown in
// the lifting-weight unit setting (REQ-TRN-005, REQ-ACC-002) and stored in grams, so changing the
// setting converts the history shown. The limits are 0.1–500 kg in either unit, rounded inwards to
// one decimal (MVP default, D-31).

export function exerciseRules(unit: BodyWeightUnit) {
  const { min, max } = weightRangeIn(unit, LIFT_WEIGHT_GRAMS_MIN, LIFT_WEIGHT_GRAMS_MAX);
  return {
    name: `Enter a name of up to ${EXERCISE_NAME_MAX} characters.`,
    sets: `Enter sets from 1 to ${EXERCISE_SETS_MAX}.`,
    reps: `Enter reps from 1 to ${EXERCISE_REPS_MAX}.`,
    weight: `Enter a weight from ${min.toFixed(1)} to ${max.toFixed(1)} ${unit}, with at most one decimal, or leave it empty.`,
    note: `Notes can be up to ${EXERCISE_NOTE_MAX} characters.`,
  } as const;
}

/** The exercise sheet's fields as typed. */
export type ExerciseText = { name: string; sets: string; reps: string; weight: string; note: string };

export const EMPTY_EXERCISE: ExerciseText = { name: '', sets: '', reps: '', weight: '', note: '' };

/** An exercise as the sheet shows it for editing, its weight in `unit`. */
export function toExerciseText(exercise: WorkoutExercise, unit: BodyWeightUnit): ExerciseText {
  return {
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weight: exercise.weightGrams === null ? '' : fromGrams(exercise.weightGrams, unit).toFixed(1),
    note: exercise.note ?? '',
  };
}

/** Reads the sheet's fields, the weight typed in `unit`: the exercise, or the rule for the first
 * field that cannot be saved. */
export function parseExercise(text: ExerciseText, unit: BodyWeightUnit): { exercise: WorkoutExercise } | { problem: string } {
  const rules = exerciseRules(unit);
  const name = text.name.trim();
  if (name.length === 0 || name.length > EXERCISE_NAME_MAX) return { problem: rules.name };
  const sets = parseWholeNumber(text.sets, 1, EXERCISE_SETS_MAX);
  if (sets === null) return { problem: rules.sets };
  const reps = parseWholeNumber(text.reps, 1, EXERCISE_REPS_MAX);
  if (reps === null) return { problem: rules.reps };
  let weightGrams: number | null = null;
  if (text.weight.trim() !== '') {
    const value = parseOneDecimal(text.weight);
    const { min, max } = weightRangeIn(unit, LIFT_WEIGHT_GRAMS_MIN, LIFT_WEIGHT_GRAMS_MAX);
    weightGrams = value === null || value < min || value > max ? null : toGrams(value, unit);
    if (weightGrams === null || !isLiftWeightGramsInRange(weightGrams)) return { problem: rules.weight };
  }
  const note = text.note.trim();
  if (note.length > EXERCISE_NOTE_MAX) return { problem: rules.note };
  return { exercise: { name, sets, reps, weightGrams, note: note === '' ? null : note } };
}

/** e.g. "3 × 10 × 40.0 kg", or "3 × 10" with no weight. */
export function formatSets(exercise: Pick<WorkoutExercise, 'sets' | 'reps' | 'weightGrams'>, unit: BodyWeightUnit): string {
  const setsAndReps = `${exercise.sets} × ${exercise.reps}`;
  return exercise.weightGrams === null ? setsAndReps : `${setsAndReps} × ${formatWeight(exercise.weightGrams, unit)}`;
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
