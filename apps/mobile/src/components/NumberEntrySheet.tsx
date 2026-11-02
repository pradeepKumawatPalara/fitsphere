import { useState } from 'react';
import { View } from 'react-native';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle } from './ui';

type Props = {
  title: string;
  /** The input's accessibility label, e.g. "Weight in kg". */
  label: string;
  unit: string;
  initialText: string;
  /** The value in its canonical unit, or null when it cannot be saved. */
  parse(text: string): number | null;
  /** Shown when the text cannot be saved. */
  rule: string;
  decimal: boolean;
  onSave(value: number): Promise<void>;
  onClose(): void;
};

// A bottom sheet for one number: a weight, steps, sleep or a target (REQ-HOME-006, REQ-ROLE-007).
// Nothing is saved until the value is valid; Cancel closes without saving.
export function NumberEntrySheet({ title, label, unit, initialText, parse, rule, decimal, onSave, onClose }: Props) {
  const styles = useStyles();
  const fieldInput = useFieldInputStyle();
  const [text, setText] = useState(initialText);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = parse(text);
    if (value === null) {
      setProblem(rule);
      return;
    }
    setBusy(true);
    await onSave(value);
    setBusy(false);
    onClose();
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={
        <>
          <TextButton title="Save" filled disabled={busy} onPress={() => void save()} />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={setText}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          autoFocus
          style={[fieldInput, styles.input]}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {problem ? (
        <Text accessibilityRole="alert" style={styles.problem}>
          {problem}
        </Text>
      ) : null}
    </Sheet>
  );
}

const useStyles = themedStyles((c) => ({
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // A field as Field, its number at the size of a value, in fixed-width digits.
  input: { flex: 1, fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, color: c.textMuted },
  problem: { fontSize: 13, color: c.error },
}));
