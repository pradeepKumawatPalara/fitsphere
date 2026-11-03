import type { WorkoutExercise } from '@fitsphere/shared';
import { useState } from 'react';
import { View, type TextInputProps } from 'react-native';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { themedStyles } from '../theme';
import { exerciseProblems, parseExercise, type ExerciseText } from '../workouts';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle, useFieldLabelStyle } from './ui';

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
        <Input label="Sets" keyboardType="number-pad" style={styles.number} {...field('sets')} />
        <Input label="Reps" keyboardType="number-pad" style={styles.number} {...field('reps')} />
      </View>
      <Input label={`Weight in ${unit} (optional)`} keyboardType="decimal-pad" {...field('weight')} />
      <Input label="Note (optional)" multiline {...field('note')} />
      {onRemove ? <TextButton title="Remove exercise" destructive disabled={busy} onPress={() => void run(onRemove)} /> : null}
    </Sheet>
  );
}

// As Field: a 13 label, 6 above its input, its problem under it; numbers in fixed-width digits.
function Input({ label, problem, style, ...input }: { label: string; problem?: string } & TextInputProps) {
  const styles = useStyles();
  const fieldInput = useFieldInputStyle();
  const fieldLabel = useFieldLabelStyle();
  return (
    <View style={[styles.field, style]}>
      <Text style={fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[fieldInput, styles.digits]} {...input} />
      {problem ? (
        <Text accessibilityRole="alert" style={styles.problem}>
          {problem}
        </Text>
      ) : null}
    </View>
  );
}

// Remove exercise is a red link at the foot of the form, away from Save, the one filled action.
const useStyles = themedStyles((c) => ({
  // Sets and Reps side by side, each half; every field 48 tall on the same edges.
  numbers: { flexDirection: 'row', gap: 12 },
  number: { flex: 1 },
  field: { gap: 6 },
  digits: { fontVariant: ['tabular-nums'] },
  problem: { fontSize: 13, color: c.error },
}));
