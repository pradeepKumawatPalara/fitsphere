import type { IstDay, WorkoutExercise } from '@fitsphere/shared';
import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { formatDay } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { workoutSummary } from '../workouts';
import { Sheet, SheetHeading } from './Sheet';
import { Text, TextButton } from './ui';

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
// "Start a workout on this day". The redesign's 2.6 (locked by the owner, 2026-11-03): a dumbbell
// tile over the title; the workouts as a ruled list, each its name over its exercises.
export function WorkoutDaySheet({ day, workouts, onOpen, onStart, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const none = workouts.length === 0;
  const title = none ? `No workout on ${formatDay(day)}` : `Workouts on ${formatDay(day)}`;
  return (
    <Sheet
      header={<SheetHeading icon={Dumbbell} title={title} />}
      onClose={onClose}
      actions={
        <>
          {none && onStart ? (
            <TextButton
              title="Start a workout on this day"
              filled
              arrow
              onPress={() => {
                onClose();
                onStart();
              }}
            />
          ) : null}
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      {none ? null : (
        <View style={styles.list}>
          {workouts.map((workout, index) => {
            const name = `Workout ${index + 1}`;
            const summary = workoutSummary(workout.exercises);
            return (
              <Pressable
                key={workout.id}
                accessibilityRole="button"
                accessibilityLabel={`${name} · ${summary}`}
                onPress={() => {
                  onClose();
                  onOpen(workout.id);
                }}
                style={({ pressed }) => [styles.row, index > 0 && styles.ruled, pressed && styles.pressed]}
              >
                <View style={styles.text}>
                  <Text style={styles.name}>{name}</Text>
                  <Text numberOfLines={1} style={styles.summary}>
                    {summary}
                  </Text>
                </View>
                <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

// Rows 64 tall on a raised card.
const useStyles = themedStyles((c) => ({
  list: { borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  name: { ...TYPE.metric, fontSize: 20, lineHeight: 22 },
  summary: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
}));
