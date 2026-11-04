import { CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput } from './ui';

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
// Nothing is saved until the value is valid; Cancel closes without saving. The redesign's 2.4 (locked
// by the owner, 2026-11-03): the number large in a sunken box with its unit, the outline caramel
// while typing and red with the rule under it when the value can't be saved; a spinner on Save.
export function NumberEntrySheet({ title, label, unit, initialText, parse, rule, decimal, onSave, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState(initialText);
  // The field opens focused, the keyboard up.
  const [focused, setFocused] = useState(true);
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
          <TextButton title="Save" filled busy={busy} onPress={() => void save()} />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <View style={[styles.box, focused && styles.boxFocused, problem ? styles.boxProblem : null]}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={setText}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {problem ? (
        <View style={styles.problem}>
          <CircleAlert size={16} color={colors.danger} />
          <Text accessibilityRole="alert" style={styles.problemText}>
            {problem}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

// A box 76 tall, the number 44 in condensed fixed-width figures.
const useStyles = themedStyles((c) => ({
  box: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxFocused: { borderColor: c.accent },
  boxProblem: { borderColor: c.danger },
  input: { ...TYPE.metric, flex: 1, fontSize: 44, lineHeight: 48, paddingVertical: 8 },
  unit: { ...TYPE.label, fontSize: 20, lineHeight: 24, letterSpacing: 1 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  problemText: { ...TYPE.small, flexShrink: 1, color: c.danger },
}));
