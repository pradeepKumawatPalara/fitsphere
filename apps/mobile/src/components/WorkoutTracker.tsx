import { addDays, istWeekDays, istWeekStart, type IstDay } from '@fitsphere/shared';
import { Pressable, View } from 'react-native';
import { dayParts, formatDay } from '../format';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { NoTargetNote } from './NoTargetNote';
import { Text, TextButton } from './ui';

type Props = {
  /** Any day of the Mon–Sun week shown: the selected date's week. */
  day: IstDay;
  today: IstDay;
  /** Workouts with at least one exercise on each day of that week (D-41). */
  dayCounts: Readonly<Record<IstDay, number>>;
  /** Workouts with at least one exercise that week; an empty one does not count (D-41). */
  count: number;
  /** The user's weekly workout target for that week, the one on its Sunday, or null (REQ-ROLE-007,
   * D-77). */
  target: number | null;
  /** Null for a past week with no target: one set now starts today (D-77). */
  onSetTarget: (() => void) | null;
  /** A day up to today was tapped: open its workout, choose one, or start one (D-34). */
  onDay(day: IstDay): void;
};

// The workout tracker (REQ-HOME-007): "1 of 5 · 4 left", and once the target is met "7 workouts ·
// target achieved" (D-41), with a square per day, Mon–Sun, holding that day's workouts as a number
// (D-41). Only a workout with at least one exercise counts (D-41). Each day up to today can be tapped
// (D-34); later days are greyed. Workouts are logged on the Training tab (D-29). It shows the week of
// the date picked on Home (Q-026), so it names that week's dates: "Workouts this week" for this week,
// "Workouts that week" for an earlier one (D-34). The redesign's 2.3 (locked by the owner,
// 2026-11-03): caramel on a workout day, dashed when there was none, dimmed ahead.
export function WorkoutTracker({ day, today, dayCounts, count, target, onSetTarget, onDay }: Props) {
  const styles = useStyles();
  const monday = istWeekStart(day);
  const thisWeek = monday === istWeekStart(today);
  const which = thisWeek ? 'this week' : 'that week';
  const summary =
    target === null
      ? `${count} ${count === 1 ? 'workout' : 'workouts'} ${which}`
      : count >= target
        ? `${count} ${count === 1 ? 'workout' : 'workouts'} · target achieved`
        : `${count} of ${target} · ${target - count} left`;
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.title}>Workouts {which}</Text>
        <Text style={styles.week}>
          {formatDay(monday)} – {formatDay(addDays(monday, 6))}
        </Text>
      </View>
      <Text style={[styles.summary, target !== null && count >= target && styles.reached]}>{summary}</Text>
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
              style={({ pressed }) => [styles.day, future && styles.later, pressed && styles.pressed]}
            >
              <View style={[styles.slot, workouts > 0 ? styles.done : future ? styles.ahead : styles.open]}>
                {workouts > 0 ? <Text style={styles.slotCount}>{workouts}</Text> : null}
              </View>
              <Text style={[styles.slotLabel, weekDay === today && styles.todayText]}>{parts.weekday.charAt(0)}</Text>
            </Pressable>
          );
        })}
      </View>
      {target === null && onSetTarget ? (
        <View style={styles.setTarget}>
          <TextButton title="Set a weekly workout target" outlined onPress={onSetTarget} />
        </View>
      ) : null}
      {target === null && !onSetTarget ? <NoTargetNote text="No target that week" /> : null}
    </View>
  );
}

// Each day a square 40 tall, 6 apart, with its initial under it; the whole day is the button.
const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 4, backgroundColor: c.surface, gap: 4 },
  title: { ...TYPE.label, color: c.inkMuted },
  week: { fontSize: 13, lineHeight: 18, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  summary: { ...TYPE.metric, marginTop: 4 },
  reached: { color: c.success },
  dots: { flexDirection: 'row', gap: 6, marginTop: 10 },
  day: { flex: 1, minHeight: 44, alignItems: 'center', gap: 6 },
  pressed: { opacity: 0.6 },
  later: { opacity: 0.45 },
  slot: { alignSelf: 'stretch', height: 40, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: c.primary },
  open: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.inkSubtle },
  ahead: { backgroundColor: c.track },
  slotCount: { ...TYPE.metric, fontSize: 17, lineHeight: 20, color: c.onPrimary },
  slotLabel: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  todayText: { color: c.accent },
  setTarget: { marginTop: 10 },
}));
