import type { WorkoutExercise } from '@fitsphere/shared';
import { Trash } from 'lucide-react-native';
import { useState } from 'react';
import { View, type TextInputProps } from 'react-native';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { exerciseProblems, parseExercise, type ExerciseText } from '../workouts';
import { Sheet } from './Sheet';
import { Problem, Text, TextButton, TextInput, useFieldLabelStyle } from './ui';

type Props = {
  title: string;
  initial: ExerciseText;
  onSave(exercise: WorkoutExercise): Promise<void>;
  /** Shown when editing an exercise already in the workout. */
  onRemove?: () => Promise<void>;
  onClose(): void;
};

// A bottom sheet for one exercise: sets × reps × weight with an optional note (REQ-TRN-003, Q-042),
// the weight in the lifting-weight unit setting (REQ-TRN-005, REQ-ACC-002). Nothing is saved until
// every field is valid; Cancel closes without saving (as Q-029).
export function ExerciseSheet({ title, initial, onSave, onRemove, onClose }: Props) {
  const styles = useStyles();
  const unit = useLiftingWeightUnit();
  const [text, setText] = useState(initial);
  // Each field's problem, shown under it once Save is pressed.
  const [problems, setProblems] = useState<Partial<Record<keyof ExerciseText, string>>>({});
  const [busy, setBusy] = useState(false);

  function field(name: keyof ExerciseText) {
    return {
      value: text[name],
      onChangeText: (value: string) => setText((current) => ({ ...current, [name]: value })),
      problem: problems[name],
    };
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    await action();
    setBusy(false);
    onClose();
  }

  function save() {
    const parsed = parseExercise(text, unit);
    if ('problem' in parsed) {
      setProblems(exerciseProblems(text, unit));
      return;
    }
    void run(() => onSave(parsed.exercise));
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={
        <>
          <TextButton title="Save exercise" filled disabled={busy} onPress={save} />
          <TextButton title="Cancel" wide onPress={onClose} />
        </>
      }
    >
      <Input label="Exercise name" autoCapitalize="sentences" autoFocus {...field('name')} />
      <View style={styles.numbers}>
        <Input label="Sets" keyboardType="number-pad" kind="count" style={styles.number} {...field('sets')} />
        <Input label="Reps" keyboardType="number-pad" kind="count" style={styles.number} {...field('reps')} />
      </View>
      <Input label={`Weight in ${unit} (optional)`} keyboardType="decimal-pad" kind="weight" unit={unit} {...field('weight')} />
      <Input label="Note (optional)" multiline kind="note" {...field('note')} />
      {onRemove ? <TextButton title="Remove exercise" destructive icon={Trash} disabled={busy} onPress={() => void run(onRemove)} /> : null}
    </Sheet>
  );
}

/**
 * One field: its label over a sunken box, the outline caramel while typing and red with its problem
 * under it once Save finds one. Sets and reps are large condensed figures; the weight shows its unit.
 */
function Input({
  label,
  problem,
  style,
  kind = 'text',
  unit,
  onFocus,
  onBlur,
  ...input
}: { label: string; problem?: string | undefined; kind?: 'text' | 'count' | 'weight' | 'note'; unit?: string } & TextInputProps) {
  const styles = useStyles();
  const fieldLabel = useFieldLabelStyle();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <Text style={fieldLabel}>{label}</Text>
      <View style={[styles.box, kind === 'count' && styles.boxCount, kind === 'note' && styles.boxNote, focused && styles.focused, problem ? styles.refused : null]}>
        <TextInput
          accessibilityLabel={label}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.value, kind === 'count' && styles.count, kind === 'weight' && styles.weight, kind === 'note' && styles.note]}
          {...input}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {problem ? <Problem text={problem} /> : null}
    </View>
  );
}

// The redesign's 4.3 (locked by the owner, 2026-11-03): fields as Field's (2.4), sets and reps side by
// side in large figures, Remove exercise a red link at the foot of the form, away from Save, the one
// filled action.
const useStyles = themedStyles((c) => ({
  numbers: { flexDirection: 'row', gap: 12 },
  number: { flex: 1 },
  field: { gap: 8 },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxCount: { minHeight: 64 },
  boxNote: { minHeight: 84, alignItems: 'flex-start' },
  focused: { borderColor: c.accent },
  refused: { borderColor: c.danger },
  value: { ...TYPE.input, flex: 1, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  count: { ...TYPE.metric, fontSize: 32, lineHeight: 36, paddingVertical: 10 },
  weight: { ...TYPE.metric, fontSize: 24, lineHeight: 28 },
  note: { minHeight: 80, textAlignVertical: 'top', lineHeight: 24 },
  unit: { ...TYPE.label, fontSize: 16, lineHeight: 20, letterSpacing: 1, color: c.inkMuted },
}));
