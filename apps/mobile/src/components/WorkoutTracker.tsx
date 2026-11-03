import { istWeekDays, type IstDay } from '@fitsphere/shared';
import { Pressable, View } from 'react-native';
import { dayParts } from '../format';
import { themedStyles } from '../theme';
import { Text, TextButton } from './ui';

type Props = {
  /** Any day of the Mon–Sun week shown: the selected date's week. */
  day: IstDay;
  today: IstDay;
  /** Workouts on each day of that week. */
  dayCounts: Readonly<Record<IstDay, number>>;
  /** Workouts completed that week; an empty workout counts (Q-025). */
  count: number;
  /** The user's weekly workout target, or null (REQ-ROLE-007). */
  target: number | null;
  onSetTarget(): void;
  /** A day up to today was tapped: open its workout, choose one, or start one (D-34). */
  onDay(day: IstDay): void;
};

// The workout tracker (REQ-HOME-007): "1 of 5 · 4 left", with Mon–Sun dots marking workout days, a
// day with more than one showing how many. Each day up to today can be tapped (D-34); later days
// are greyed. Workouts are logged on the Training tab (D-29).
export function WorkoutTracker({ day, today, dayCounts, count, target, onSetTarget, onDay }: Props) {
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
          const workouts = dayCounts[weekDay] ?? 0;
          const future = weekDay > today;
          const parts = dayParts(weekDay);
          const what = future ? 'future' : workouts === 0 ? 'no workout' : workouts === 1 ? '1 workout' : `${workouts} workouts`;
          return (
            <Pressable
              key={weekDay}
              accessibilityRole="button"
              accessibilityLabel={`${parts.weekdayName} ${parts.date} ${parts.month}: ${what}`}
              accessibilityState={{ disabled: future }}
              disabled={future}
              onPress={() => onDay(weekDay)}
              style={({ pressed }) => [styles.day, pressed && styles.pressed]}
            >
              <View style={[styles.dot, workouts > 0 && styles.done, future && styles.later]}>
                {workouts > 1 ? <Text style={styles.dotCount}>{workouts}</Text> : null}
              </View>
              <Text style={[styles.dotLabel, future && styles.laterText]}>{parts.weekday.charAt(0)}</Text>
            </Pressable>
          );
        })}
      </View>
      {target === null ? <TextButton title="Set a weekly workout target" outlined onPress={onSetTarget} /> : null}
    </View>
  );
}

// Each day 44 wide and at least 44 tall to tap; its dot 22, holding the count when there are two or more.
const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 10 },
  title: { fontSize: 15, fontWeight: '600' },
  summary: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: c.primary },
  later: { borderColor: c.textFaint },
  dotCount: { color: c.onPrimary, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dotLabel: { fontSize: 12, color: c.textMuted },
  laterText: { color: c.textFaint },
}));
