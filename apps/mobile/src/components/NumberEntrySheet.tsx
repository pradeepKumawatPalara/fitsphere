import { useState } from 'react';
import { Button, View } from 'react-native';
import { themedStyles } from '../theme';
import { Sheet } from './Sheet';
import { Text, TextInput } from './ui';

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
          <Button title="Save" disabled={busy} onPress={() => void save()} />
          <Button title="Cancel" onPress={onClose} />
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
          style={styles.input}
        />
        <Text>{unit}</Text>
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
  input: { flex: 1, borderWidth: 1, borderColor: c.textFaint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 20 },
  problem: { color: c.error },
}));
