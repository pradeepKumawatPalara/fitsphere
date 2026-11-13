import { View } from 'react-native';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text, TextInput } from './ui';

// The grams eaten of a listed food or a barcode product (the redesign's 3.6 and 3.7), or the quantity
// of a My food in its unit (D-39): large, in a box with their unit, red when they can't be added.
export function GramsBox({
  value,
  onChangeText,
  refused,
  autoFocus = false,
  label = 'Grams eaten',
  unit = 'g',
  decimal = false,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText(text: string): void;
  refused: boolean;
  autoFocus?: boolean;
  label?: string;
  unit?: string;
  decimal?: boolean;
  onFocus?(): void;
  onBlur?(): void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.box, refused && styles.refused]}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        autoFocus={autoFocus}
        {...(onFocus ? { onFocus } : {})}
        {...(onBlur ? { onBlur } : {})}
        style={styles.amount}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  box: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.accent,
    backgroundColor: c.surfaceSunken,
  },
  refused: { borderColor: c.danger },
  amount: { ...TYPE.metric, flex: 1, fontSize: 44, lineHeight: 48, paddingVertical: 8 },
  unit: { ...TYPE.label, fontSize: 20, lineHeight: 24, letterSpacing: 1 },
}));
