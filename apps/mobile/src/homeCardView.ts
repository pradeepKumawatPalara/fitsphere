import type { WorkoutExercise } from '@fitsphere/shared';
import { caloriesBurned, listedWorkouts } from './workouts';

/** Which view Home's first card shows (D-123): the day's food, or the day's workouts. */
export type HomeCardView = 'calories' | 'workout';

/** What was kept on this phone (`sync_meta` `home_card_view`); a missing or unknown value opens on Calories. */
export function readCardView(raw: string | null): HomeCardView {
  return raw === 'workout' ? 'workout' : 'calories';
}

type WorkoutLike = { id: string; recordedAt: string; exercises: readonly Pick<WorkoutExercise, 'calories'>[] };

/** One workout's row in the Workout view. */
export type WorkoutBurnRow = {
  id: string;
  /** "Workout 1", numbered as Training numbers them. */
  name: string;
  /** "4 exercises". */
  exercises: string;
  /** Calories burned, typed or estimated (D-50); null when no exercise has calories. */
  kcal: number | null;
  estimated: boolean;
  /** The row's bar, 0 to 1, against the day's biggest workout (there is no burn goal, D-123). */
  share: number;
};

export type WorkoutBurn = {
  rows: WorkoutBurnRow[];
  /** The day's calories burned; null when no workout has calories. */
  kcal: number | null;
  estimated: boolean;
};

/**
 * The selected day's workouts for Home's Workout view (D-123): only those with an exercise (D-108),
 * in the order they were started and numbered as Training numbers them (D-34), each with its calories
 * burned and its bar against the biggest.
 */
export function workoutBurn(workouts: readonly WorkoutLike[]): WorkoutBurn {
  const ordered = [...listedWorkouts(workouts)].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const burned = ordered.map((workout) => caloriesBurned(workout.exercises));
  const biggest = Math.max(0, ...burned.map((entry) => entry?.kcal ?? 0));
  const rows = ordered.map((workout, index) => {
    const entry = burned[index];
    const count = workout.exercises.length;
    return {
      id: workout.id,
      name: `Workout ${index + 1}`,
      exercises: `${count} ${count === 1 ? 'exercise' : 'exercises'}`,
      kcal: entry ? entry.kcal : null,
      estimated: entry?.estimated ?? false,
      share: entry && biggest > 0 ? entry.kcal / biggest : 0,
    };
  });
  const counted = burned.flatMap((entry) => (entry ? [entry] : []));
  return {
    rows,
    kcal: counted.length === 0 ? null : counted.reduce((sum, entry) => sum + entry.kcal, 0),
    estimated: counted.some((entry) => entry.estimated),
  };
}
