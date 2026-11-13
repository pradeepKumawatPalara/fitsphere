import { Dumbbell } from 'lucide-react-native';
import { View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { Text } from './ui';

/**
 * The strip's week's workouts against its target (D-103, MVP default; it replaced the workout tracker's
 * "1 of 5 · 4 left", REQ-HOME-007): "3 of 4 workouts this week", "4 workouts this week · target achieved"
 * (D-41), or with no target "2 workouts that week", "No workouts this week".
 */
export function weekWorkoutsText(count: number, target: number | null, thisWeek: boolean): string {
  const which = thisWeek ? 'this week' : 'that week';
  const workouts = (n: number) => (n === 1 ? 'workout' : 'workouts');
  if (target !== null && count >= target) return `${count} ${workouts(count)} ${which} · target achieved`;
  if (target !== null) return `${count} of ${target} ${workouts(target)} ${which}`;
  return count === 0 ? `No workouts ${which}` : `${count} ${workouts(count)} ${which}`;
}

type Props = {
  /** The week's workouts with an exercise (D-41), or null while they load. */
  count: number | null;
  /** The week's target, its Sunday's (D-77), or null. */
  target: number | null;
  thisWeek: boolean;
};

// One line under Home's date strip, as the month calendar counts its workouts under its name (D-84): a green
// dumbbell and the words, lined up with the strip's days. Empty while the week loads, so nothing moves.
export function WeekWorkouts({ count, target, thisWeek }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="week-workouts" style={styles.row}>
      {count === null ? null : (
        <>
          <Dumbbell size={14} strokeWidth={2.25} color={colors.success} importantForAccessibility="no" accessibilityElementsHidden />
          <Text style={styles.text}>{weekWorkoutsText(count, target, thisWeek)}</Text>
        </>
      )}
    </View>
  );
}

// 30 in: the strip's arrow (28) and its gap (2).
const useStyles = themedStyles((c) => ({
  row: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 30 },
  text: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', color: c.inkMuted },
}));
