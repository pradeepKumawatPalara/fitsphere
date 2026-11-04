import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { PORTIONS_MAX, PORTIONS_MIN, stepPortions } from '../mealItems';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// Portions of a dish, in halves from 0.5 to 10 (MVP default, D-26; D-28), or household units of a
// food, in halves up to their `max` (D-36). Chosen with − and +, so a number out of range cannot be
// entered. The redesign's 3.6 (locked by the owner, 2026-11-03): square buttons, 56, around the
// count in condensed capitals. A USDA serving's long name (D-39) goes under the count, `stacked`.
export function PortionStepper({
  value,
  onChange,
  max = PORTIONS_MAX,
  unit = { one: 'portion', many: 'portions' },
  stacked = false,
}: {
  value: number;
  onChange(count: number): void;
  max?: number;
  /** What is counted, e.g. glass and glasses. */
  unit?: { one: string; many: string };
  stacked?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const atMin = value <= PORTIONS_MIN;
  const atMax = value >= max;
  const label = `${unit.many.charAt(0).toUpperCase()}${unit.many.slice(1)}: ${value}`;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Half a ${unit.one} fewer`}
        accessibilityState={{ disabled: atMin }}
        disabled={atMin}
        onPress={() => onChange(stepPortions(value, -1, max))}
        style={({ pressed }) => [styles.step, atMin && styles.off, pressed && styles.pressed]}
      >
        <Minus size={24} strokeWidth={2.5} color={colors.accent} />
      </Pressable>
      {stacked ? (
        <View accessible accessibilityLabel={label} style={styles.stacked}>
          <Text style={styles.count}>{value}</Text>
          <Text style={styles.name}>{unit.one}</Text>
        </View>
      ) : (
        <Text accessibilityLabel={label} style={styles.value}>
          {value} {value === 1 ? unit.one : unit.many}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Half a ${unit.one} more`}
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        onPress={() => onChange(stepPortions(value, 1, max))}
        style={({ pressed }) => [styles.step, atMax && styles.off, pressed && styles.pressed]}
      >
        <Plus size={24} strokeWidth={2.5} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: {
    width: 56,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  // At the size of a value, in fixed-width digits.
  value: { ...TYPE.metric, flex: 1, fontSize: 32, lineHeight: 36, textAlign: 'center' },
  stacked: { flex: 1, alignItems: 'center' },
  count: { ...TYPE.metric, fontSize: 44, lineHeight: 46 },
  name: { ...TYPE.label, color: c.inkMuted, textAlign: 'center' },
}));
