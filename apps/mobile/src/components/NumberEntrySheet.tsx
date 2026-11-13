import { Calendar, CircleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useFieldChecks } from '../fieldChecks';
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
  /** A line under the number: its first words in bold, e.g. a target's "From today, Wed 11 Nov." (D-77). */
  note?: { lead: string; text: string };
  onSave(value: number): Promise<void>;
  onClose(): void;
};

// A bottom sheet for one number: a weight, steps, sleep or a target (REQ-HOME-006, REQ-ROLE-007).
// Nothing is saved until the value is valid; Cancel closes without saving. The redesign's 2.4 (locked
// by the owner, 2026-11-03): the number large in a sunken box with its unit, the outline caramel
// while typing and red with the rule under it when the value can't be saved; a spinner on Save.
// Since D-99 the rule shows once typing pauses or the box is left (an empty box only once left), not
// when Save is pressed: Save is greyed until the value can be saved.
export function NumberEntrySheet({ title, label, unit, initialText, parse, rule, decimal, note, onSave, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState(initialText);
  // The field opens focused, the keyboard up.
  const [focused, setFocused] = useState(true);
  const [busy, setBusy] = useState(false);
  const checks = useFieldChecks({ value: text });
  const value = parse(text);
  const problem = value === null && checks.shows('value') ? rule : null;

  async function save() {
    if (value === null) return;
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
          <TextButton title="Save" filled busy={busy} disabled={value === null} onPress={() => void save()} />
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
          onFocus={() => {
            setFocused(true);
            checks.focus('value');
          }}
          onBlur={() => {
            setFocused(false);
            checks.blur('value');
          }}
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
      {note ? (
        <View style={styles.note}>
          <Calendar size={18} color={colors.accent} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            <Text style={styles.noteLead}>{note.lead}</Text> {note.text}
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
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteIcon: { marginTop: 2 },
  noteText: { fontSize: 15, lineHeight: 22, flexShrink: 1, color: c.inkMuted },
  noteLead: { fontWeight: '600', color: c.ink },
}));
