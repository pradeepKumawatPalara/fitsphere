import type { WorkoutExercise } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, View, type TextInputProps } from 'react-native';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { themedStyles } from '../theme';
import { parseExercise, type ExerciseText } from '../workouts';
import { Sheet } from './Sheet';
import { Text, TextInput } from './ui';

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
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function field(name: keyof ExerciseText) {
    return { value: text[name], onChangeText: (value: string) => setText((current) => ({ ...current, [name]: value })) };
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
      setProblem(parsed.problem);
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
          <Button title="Save exercise" disabled={busy} onPress={save} />
          {onRemove ? <Button title="Remove exercise" disabled={busy} onPress={() => void run(onRemove)} /> : null}
          <Button title="Cancel" onPress={onClose} />
        </>
      }
    >
      <Input label="Exercise name" autoCapitalize="sentences" autoFocus {...field('name')} />
      <View style={styles.numbers}>
        <Input label="Sets" keyboardType="number-pad" style={styles.number} {...field('sets')} />
        <Input label="Reps" keyboardType="number-pad" style={styles.number} {...field('reps')} />
        <Input
          label={`Weight in ${unit} (optional)`}
          keyboardType="decimal-pad"
          style={styles.number}
          {...field('weight')}
        />
      </View>
      <Input label="Note (optional)" multiline {...field('note')} />
      {problem ? (
        <Text accessibilityRole="alert" style={styles.problem}>
          {problem}
        </Text>
      ) : null}
    </Sheet>
  );
}

function Input({ label, style, ...input }: { label: string } & TextInputProps) {
  const styles = useStyles();
  return (
    <View style={[styles.field, style]}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} {...input} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  numbers: { flexDirection: 'row', gap: 8 },
  number: { flex: 1 },
  field: { gap: 4 },
  input: { borderWidth: 1, borderColor: c.textFaint, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 18 },
  problem: { color: c.error },
}));
