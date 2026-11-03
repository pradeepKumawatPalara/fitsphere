import { View } from 'react-native';
import { formatInteger } from '../format';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

type Props = {
  title: string;
  unit: string;
  /** Eaten on the selected day, in `unit`. */
  eaten: number;
  /** The user's target, or null when none is set (REQ-ROLE-007). */
  target: number | null;
  onSetTarget(): void;
  /** The screen's one hero number: what is left (or over, or eaten) in big italic. */
  hero?: boolean;
};

// The calories card (REQ-HOME-003) and the protein card (REQ-HOME-004). With no target, only the
// amount eaten and "Set a target". Over the target, the bar is full in the warning gold with "X kcal
// over" (Q-022). The redesign's 2.3 (locked by the owner, 2026-11-03): the bar is plates, 20 for the
// hero, 10 otherwise, filled in caramel; the hero counts down what is left.
export function TargetProgressCard({ title, unit, eaten, target, onSetTarget, hero = false }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (target === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {hero ? (
          <Hero value={formatInteger(eaten)} unit={unit} word="eaten" over={false} />
        ) : (
          <Text style={styles.metric}>
            {formatInteger(eaten)} {unit} eaten
          </Text>
        )}
        <View style={styles.setTarget}>
          <TextButton title="Set a target" outlined onPress={onSetTarget} />
        </View>
      </View>
    );
  }
  const percent = Math.round((eaten / target) * 100);
  const over = eaten > target;
  const plates = hero ? 20 : 10;
  const filled = Math.min(plates, Math.round((percent / 100) * plates));
  const left = `${formatInteger(over ? eaten - target : target - eaten)} ${unit} ${over ? 'over' : 'remaining'}`;
  return (
    <View style={styles.card}>
      <View style={[styles.row, hero && styles.clearCorner]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.title, over && styles.over]}>{percent}%</Text>
      </View>
      {hero ? (
        <>
          <Hero value={formatInteger(over ? eaten - target : target - eaten)} unit={unit} word={over ? 'over' : 'remaining'} over={over} />
          <Text style={styles.line}>
            <Text style={styles.reading}>{formatInteger(eaten)}</Text> of {formatInteger(target)} {unit}
          </Text>
        </>
      ) : (
        <Text style={styles.metric}>
          {formatInteger(eaten)} of {formatInteger(target)} {unit}
        </Text>
      )}
      <View
        testID={`${title}-bar`}
        accessibilityRole="progressbar"
        accessibilityLabel={`${title} progress`}
        accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
        style={[styles.plates, hero && styles.heroPlates]}
      >
        {Array.from({ length: plates }, (_, index) => (
          <View
            key={index}
            testID={`${title}-plate`}
            style={[styles.plate, hero && styles.heroPlate, { backgroundColor: index < filled ? (over ? colors.warning : colors.primary) : colors.track }]}
          />
        ))}
      </View>
      {hero ? null : <Text style={[styles.note, over && styles.over]}>{left}</Text>}
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

// Plates 3 apart, radius 2: the hero's 14 tall, the others 10.
const useStyles = themedStyles((c) => ({
  card: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  // Clear of the hero card's cut corner.
  clearCorner: { paddingRight: 30 },
  title: { ...TYPE.label, color: c.inkMuted },
  over: { color: c.warning },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  heroNumber: TYPE.heroNumber,
  heroWord: { ...TYPE.metric, fontSize: 18, lineHeight: 19, paddingBottom: 14, color: c.accent },
  line: { color: c.inkMuted, fontSize: 15, lineHeight: 22 },
  reading: { color: c.ink, fontWeight: '600' },
  metric: { ...TYPE.metric, fontSize: 26, lineHeight: 28 },
  plates: { flexDirection: 'row', gap: 3, marginTop: 4 },
  heroPlates: { marginTop: 8 },
  plate: { flex: 1, height: 10, borderRadius: 2 },
  heroPlate: { height: 14 },
  note: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  setTarget: { marginTop: 6 },
}));
