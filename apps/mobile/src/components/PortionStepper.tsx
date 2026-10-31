import { Pressable, View } from 'react-native';
import { PORTIONS_MAX, PORTIONS_MIN, stepPortions } from '../mealItems';
import { formatPortions } from '../meals';
import { themedStyles } from '../theme';
import { Text } from './ui';

// Portions of a dish, in halves from 0.5 to 10 (MVP default, D-26; D-28). Chosen with − and +, so a
// number out of range cannot be entered.
export function PortionStepper({ value, onChange }: { value: number; onChange(portions: number): void }) {
  const styles = useStyles();
  const atMin = value <= PORTIONS_MIN;
  const atMax = value >= PORTIONS_MAX;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Half a portion fewer"
        accessibilityState={{ disabled: atMin }}
        disabled={atMin}
        onPress={() => onChange(stepPortions(value, -1))}
        style={[styles.step, atMin && styles.off]}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Portions: ${value}`} style={styles.value}>
        {formatPortions(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Half a portion more"
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        onPress={() => onChange(stepPortions(value, 1))}
        style={[styles.step, atMax && styles.off]}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSelected },
  off: { opacity: 0.4 },
  stepText: { fontSize: 22, fontWeight: '600', color: c.primaryStrong },
  value: { minWidth: 110, textAlign: 'center', fontSize: 16, fontWeight: '600' },
}));
