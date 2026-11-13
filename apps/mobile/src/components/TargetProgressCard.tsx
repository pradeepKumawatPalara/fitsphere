import { View } from 'react-native';
import { formatInteger } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { NoTargetNote } from './NoTargetNote';
import { Text, TextButton } from './ui';

type Props = {
  title: string;
  unit: string;
  /** Eaten on the selected day, in `unit`. */
  eaten: number;
  /** The user's target on the day shown, or null when none held (REQ-ROLE-007, D-77). */
  target: number | null;
  /** Null on a past date with no target: one set now starts today (D-77). */
  onSetTarget: (() => void) | null;
};

// The calories card (REQ-HOME-003), Home's hero. With no target, only the amount eaten and "Set a
// target". Over the target, the bar is full in the warning gold with "X kcal over" (Q-022). The
// redesign's 2.3 (locked by the owner, 2026-11-03): the bar is 20 plates filled in caramel, and the
// hero counts down what is left. Since D-103 the protein card it also drew is gone: protein shows with
// carbs, fat and fibre under it (NutrientTargets).
export function TargetProgressCard({ title, unit, eaten, target, onSetTarget }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (target === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Hero value={formatInteger(eaten)} unit={unit} word="eaten" over={false} />
        {onSetTarget ? (
          <View style={styles.setTarget}>
            <TextButton title="Set a target" outlined onPress={onSetTarget} />
          </View>
        ) : (
          <NoTargetNote />
        )}
      </View>
    );
  }
  // A target of 0 (D-100): nothing eaten is all of it; anything eaten is over it.
  const percent = target > 0 ? Math.round((eaten / target) * 100) : eaten > 0 ? 100 : 0;
  const over = eaten > target;
  const plates = 20;
  const filled = Math.min(plates, Math.round((percent / 100) * plates));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.title, over && styles.over]}>{target > 0 ? `${percent}%` : '–'}</Text>
      </View>
      <Hero value={formatInteger(over ? eaten - target : target - eaten)} unit={unit} word={over ? 'over' : 'remaining'} over={over} />
      <Text style={styles.line}>
        <Text style={styles.reading}>{formatInteger(eaten)}</Text> of {formatInteger(target)} {unit}
      </Text>
      <View
        testID={`${title}-bar`}
        accessibilityRole="progressbar"
        accessibilityLabel={`${title} progress`}
        accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
        style={styles.plates}
      >
        {Array.from({ length: plates }, (_, index) => (
          <View
            key={index}
            testID={`${title}-plate`}
            style={[styles.plate, { backgroundColor: index < filled ? (over ? colors.warning : colors.primary) : colors.track }]}
          />
        ))}
      </View>
    </View>
  );
}

/** The hero number with its unit and word beside it ("1,180 KCAL / REMAINING"), read out as one. */
function Hero({ value, unit, word, over }: { value: string; unit: string; word: string; over: boolean }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={`${value} ${unit} ${word}`} style={styles.hero}>
      <Text style={[styles.heroNumber, over && styles.over]}>{value}</Text>
      <Text style={[styles.heroWord, over && styles.over]}>
        {unit}
        {'\n'}
        {word}
      </Text>
    </View>
  );
}

// Plates 14 tall, 3 apart, radius 2.
const useStyles = themedStyles((c) => ({
  card: { gap: 6 },
  // Clear of the card's cut corner.
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 30 },
  title: { ...TYPE.label, color: c.inkMuted },
  over: { color: c.warning },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroNumber: TYPE.heroNumber,
  heroWord: { ...TYPE.metric, fontSize: 18, lineHeight: 19, paddingBottom: 14, color: c.accent },
  line: { color: c.inkMuted, fontSize: 15, lineHeight: 22 },
  reading: { color: c.ink, fontWeight: '600' },
  plates: { flexDirection: 'row', gap: 3, marginTop: 8 },
  plate: { flex: 1, height: 14, borderRadius: 2 },
  setTarget: { marginTop: 6 },
}));
