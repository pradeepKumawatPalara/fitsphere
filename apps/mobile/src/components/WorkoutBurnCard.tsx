import { View } from 'react-native';
import type { ReactNode } from 'react';
import { formatInteger } from '../format';
import type { WorkoutBurn } from '../homeCardView';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

type Props = {
  title: string;
  /** The selected day's workouts, or null while a day before the phone's 90 is not loaded (D-106). */
  burn: WorkoutBurn | null;
  /** At the left of the title, on its line (the Calories / Workout toggle). */
  leading?: ReactNode;
  /** At the right of the title, on its line ("By workout"). */
  action?: ReactNode;
  /** Start a workout on the day shown; null on a past date (as Training offers it on today only). */
  onLog: (() => void) | null;
};

// Home's Workout view (D-123, canvas boards `HomeWorkoutToggle*`): the Calories card's look with calories
// burned in place of eaten. There is no burn goal, so no "remaining" and no percentage: the hero is the
// day's kcal burned, the bar under it full, and under a divider one row per workout, its bar against the
// day's biggest workout.
export function WorkoutBurnCard({ title, burn, leading, action, onLog }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const plates = 20;
  const waiting = burn === null;
  const total = burn?.kcal ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          {leading}
          <Text style={styles.title}>{title}</Text>
        </View>
        {action}
      </View>
      <View
        accessible
        accessibilityLabel={waiting ? 'Calories burned: not loaded' : total === null ? 'No calories burned logged' : `${formatInteger(total)} kcal burned`}
        style={styles.hero}
      >
        <Text style={[styles.heroNumber, (waiting || total === null) && styles.none]}>{waiting || total === null ? '–' : formatInteger(total)}</Text>
        <Text style={[styles.heroWord, (waiting || total === null) && styles.none]}>
          kcal{'\n'}burned
        </Text>
      </View>
      {burn?.estimated ? <Text style={styles.line}>Includes estimated calories</Text> : null}
      <View testID="Workout-bar" style={styles.plates}>
        {Array.from({ length: plates }, (_, index) => (
          <View key={index} testID="Workout-plate" style={[styles.plate, { backgroundColor: total !== null ? colors.primary : colors.track }]} />
        ))}
      </View>
      {burn && burn.rows.length > 0 ? (
        <>
          <View style={styles.rule} />
          <View style={styles.rows}>
            {burn.rows.map((row) => (
              <View
                key={row.id}
                testID={`workout-row-${row.name}`}
                accessible
                accessibilityLabel={`${row.name}: ${row.exercises}, ${row.kcal === null ? 'no calories' : `${formatInteger(row.kcal)} kcal`}`}
                style={styles.row}
              >
                <View style={styles.rowLine}>
                  <Text style={styles.rowName}>{row.name}</Text>
                  <Text style={styles.rowValue}>
                    {row.exercises} · {row.kcal === null ? '– kcal' : `${formatInteger(row.kcal)} kcal`}
                  </Text>
                </View>
                <View style={styles.bar}>
                  <View testID={`bar-${row.name}`} style={[styles.fill, { width: `${Math.round(row.share * 100)}%`, backgroundColor: colors.accent }]} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {burn && burn.rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.line}>No workouts logged</Text>
          {onLog ? <TextButton title="Log workout" outlined onPress={onLog} /> : null}
        </View>
      ) : null}
    </View>
  );
}

// As the Calories card: hero 52, plates 14 tall and 3 apart; the rows as the nutrients' thin bars, 4 tall.
const useStyles = themedStyles((c) => ({
  card: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { ...TYPE.label, color: c.inkMuted },
  none: { color: c.inkSubtle },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroNumber: { ...TYPE.heroNumber, fontSize: 52, lineHeight: 54 },
  heroWord: { ...TYPE.metric, fontSize: 16, lineHeight: 17, paddingBottom: 8, color: c.accent },
  line: { color: c.inkMuted, fontSize: 15, lineHeight: 22 },
  plates: { flexDirection: 'row', gap: 3, marginTop: 8 },
  plate: { flex: 1, height: 14, borderRadius: 2 },
  rule: { height: 1, marginVertical: 10, backgroundColor: c.border },
  rows: { gap: 12 },
  row: { gap: 4 },
  rowLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowName: { ...TYPE.label, letterSpacing: 1.2, color: c.inkMuted },
  rowValue: { ...TYPE.metric, fontSize: 15, lineHeight: 18 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: c.track },
  fill: { height: 4 },
  empty: { marginTop: 8, gap: 10, alignItems: 'flex-start' },
}));
