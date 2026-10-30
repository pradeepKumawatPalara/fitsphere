import { Button, View } from 'react-native';
import { formatInteger } from '../format';
import { themedStyles, useTheme } from '../theme';
import { Text } from './ui';

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
// "X kcal over" (Q-022).
export function TargetProgressCard({ title, unit, eaten, target, onSetTarget }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (target === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.amount}>
          {formatInteger(eaten)} {unit} eaten
        </Text>
        <Button title="Set a target" onPress={onSetTarget} />
      </View>
    );
  }

  const percent = Math.round((eaten / target) * 100);
  const over = eaten > target;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.amount}>
        {formatInteger(eaten)} of {formatInteger(target)} {unit}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${title} progress`}
        accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100) }}
        style={styles.track}
      >
        <View
          testID={`${title}-bar`}
          style={[styles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: over ? colors.over : colors.primary }]}
        />
      </View>
      <View style={styles.row}>
        <Text>{percent}%</Text>
        <Text style={over ? styles.over : undefined}>
          {over ? `${formatInteger(eaten - target)} ${unit} over` : `${formatInteger(target - eaten)} ${unit} remaining`}
        </Text>
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 8 },
  title: { color: c.textMuted },
  amount: { fontSize: 20, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, backgroundColor: c.track, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  over: { color: c.over, fontWeight: '600' },
}));
