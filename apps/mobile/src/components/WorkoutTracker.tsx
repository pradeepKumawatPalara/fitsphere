import { istWeekDays, type IstDay } from '@fitsphere/shared';
import { Button, StyleSheet, Text, View } from 'react-native';
import { dayParts } from '../format';

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
// Workouts are logged from the Training slice; until then the count is 0 (D-23).
export function WorkoutTracker({ day, workoutDays, count, target, onSetTarget }: Props) {
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
      {target === null ? <Button title="Set a weekly workout target" onPress={onSetTarget} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 8 },
  title: { color: '#555' },
  summary: { fontSize: 20, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dotColumn: { alignItems: 'center', gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#1565c0' },
  done: { backgroundColor: '#1565c0' },
  dotLabel: { fontSize: 12, color: '#555' },
});
