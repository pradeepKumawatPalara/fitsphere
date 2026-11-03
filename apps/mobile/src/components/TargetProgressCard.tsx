import { View } from 'react-native';
import { formatInteger } from '../format';
import { themedStyles, useTheme } from '../theme';
import { Text, TextButton } from './ui';

type Props = {
  title: string;
  unit: string;
  /** Eaten on the selected day, in `unit`. */
  eaten: number;
  /** The user's target, or null when none is set (REQ-ROLE-007). */
  target: number | null;
  onSetTarget(): void;
};

// The calories card (REQ-HOME-003) and the protein card (REQ-HOME-004). With no target, only the
// amount eaten and "Set a target". Over the target, the bar is full in a warning colour with
// "X kcal over" (Q-022). Home sets both in one panel; the bar reads like a tape, with a tick at each
// quarter of the target.
export function TargetProgressCard({ title, unit, eaten, target, onSetTarget }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (target === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.amount}>
          <Text style={styles.reading}>{formatInteger(eaten)}</Text> {unit} eaten
        </Text>
        <TextButton title="Set a target" outlined onPress={onSetTarget} />
      </View>
    );
  }

  const percent = Math.round((eaten / target) * 100);
  const over = eaten > target;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <Text style={over ? styles.over : styles.small}>{percent}%</Text>
      </View>
      <Text style={styles.amount}>
        <Text style={styles.reading}>{formatInteger(eaten)}</Text> of {formatInteger(target)} {unit}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${title} progress`}
        accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
        style={styles.track}
      >
        <View
          testID={`${title}-bar`}
          style={[styles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: over ? colors.warning : colors.primary }]}
        />
        {QUARTERS.map((left) => (
          <View key={left} style={[styles.tick, { left }]} />
        ))}
      </View>
      <Text style={over ? styles.over : styles.small}>
        {over ? `${formatInteger(eaten - target)} ${unit} over` : `${formatInteger(target - eaten)} ${unit} remaining`}
      </Text>
    </View>
  );
}

const QUARTERS = ['25%', '50%', '75%'] as const;

const useStyles = themedStyles((c) => ({
  card: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 15, color: c.inkMuted },
  reading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5, color: c.ink, fontVariant: ['tabular-nums'] },
  track: { height: 14, borderRadius: 7, backgroundColor: c.track, overflow: 'hidden' },
  fill: { height: 14 },
  // Cut in the panel's colour, so a tick shows on the empty and the filled part alike.
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: c.surface },
  small: { fontSize: 13, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  over: { fontSize: 13, color: c.warning, fontWeight: '600', fontVariant: ['tabular-nums'] },
}));
