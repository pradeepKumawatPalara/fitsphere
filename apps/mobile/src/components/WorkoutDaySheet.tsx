import type { IstDay, WorkoutExercise } from '@fitsphere/shared';
import { formatDay } from '../format';
import { workoutSummary } from '../workouts';
import { ActionsSheet } from './MealSheets';
import { Sheet } from './Sheet';
import { TextButton } from './ui';

type Props = {
  day: IstDay;
  /** That day's workouts, in the order they were started. */
  workouts: readonly { id: string; exercises: readonly Pick<WorkoutExercise, 'name'>[] }[];
  onOpen(id: string): void;
  /** Starts a workout on the day; offered when it has none. */
  onStart?(): void;
  onClose(): void;
};

// A day's workouts (REQ-HOME-007, REQ-TRN-004; D-34), from Home's tracker and Training's history:
// with several, the one to open, each as "Workout 1 · 2 exercises · Squat, Push-up"; with none,
// "Start a workout on this day".
export function WorkoutDaySheet({ day, workouts, onOpen, onStart, onClose }: Props) {
  if (workouts.length === 0) {
    return (
      <Sheet
        title={`No workout on ${formatDay(day)}`}
        onClose={onClose}
        actions={
          <>
            {onStart ? (
              <TextButton
                title="Start a workout on this day"
                filled
                onPress={() => {
                  onClose();
                  onStart();
                }}
              />
            ) : null}
            <TextButton title="Cancel" wide onPress={onClose} />
          </>
        }
      />
    );
  }
  return (
    <ActionsSheet
      title={`Workouts on ${formatDay(day)}`}
      actions={workouts.map((workout, index) => ({
        label: `Workout ${index + 1} · ${workoutSummary(workout.exercises)}`,
        onPress: () => onOpen(workout.id),
      }))}
      onClose={onClose}
    />
  );
}
