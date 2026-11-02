import { istWeekDays, type IstDay } from '@fitsphere/shared';
import { View } from 'react-native';
import { dayParts } from '../format';
import { themedStyles } from '../theme';
import { Text, TextButton } from './ui';

type Props = {
  /** Any day of the Mon–Sun week shown: the selected date's week. */
  day: IstDay;
  /** Days of that week with at least one workout. */
  workoutDays: readonly IstDay[];
  /** Workouts completed that week; an empty workout counts (Q-025). */
  count: number;
  /** The user's weekly workout target, or null (REQ-ROLE-007). */
  target: number | null;
  onSetTarget(): void;
};

// The workout tracker (REQ-HOME-007): "1 of 5 · 4 left", with Mon–Sun dots marking workout days.
// Workouts are logged on the Training tab (D-29).
export function WorkoutTracker({ day, workoutDays, count, target, onSetTarget }: Props) {
  const styles = useStyles();
  const summary =
    target === null
      ? `${count} ${count === 1 ? 'workout' : 'workouts'} this week`
      : count >= target
        ? `${count} of ${target} · target reached`
        : `${count} of ${target} · ${target - count} left`;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Workouts this week</Text>
      <Text style={styles.summary}>{summary}</Text>
      <View style={styles.dots}>
        {istWeekDays(day).map((weekDay) => {
          const done = workoutDays.includes(weekDay);
          const { weekday } = dayParts(weekDay);
          return (
            <View key={weekDay} accessibilityLabel={`${weekday}: ${done ? 'workout' : 'no workout'}`} style={styles.dotColumn}>
              <View style={[styles.dot, done && styles.done]} />
              <Text style={styles.dotLabel}>{weekday.charAt(0)}</Text>
            </View>
          );
        })}
      </View>
      {target === null ? <TextButton title="Set a weekly workout target" outlined onPress={onSetTarget} /> : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 10 },
  title: { fontSize: 15, fontWeight: '600' },
  summary: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingHorizontal: 4 },
  dotColumn: { alignItems: 'center', gap: 6 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.primary },
  done: { backgroundColor: c.primary },
  dotLabel: { fontSize: 12, color: c.textMuted },
}));
