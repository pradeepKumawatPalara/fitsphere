import type { WorkoutExercise } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, Modal, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { LIFTING_WEIGHT_UNIT, parseExercise, type ExerciseText } from '../workouts';

type Props = {
  title: string;
  initial: ExerciseText;
  onSave(exercise: WorkoutExercise): Promise<void>;
  /** Shown when editing an exercise already in the workout. */
  onRemove?: () => Promise<void>;
  onClose(): void;
};

// A bottom sheet for one exercise: sets × reps × weight with an optional note (REQ-TRN-003, Q-042),
// the weight in kg until the Settings slice (REQ-TRN-005). Nothing is saved until every field is
// valid; Cancel closes without saving (as Q-029).
export function ExerciseSheet({ title, initial, onSave, onRemove, onClose }: Props) {
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
    const parsed = parseExercise(text);
    if ('problem' in parsed) {
      setProblem(parsed.problem);
      return;
    }
    void run(() => onSave(parsed.exercise));
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Input label="Exercise name" autoCapitalize="sentences" autoFocus {...field('name')} />
          <View style={styles.numbers}>
            <Input label="Sets" keyboardType="number-pad" style={styles.number} {...field('sets')} />
            <Input label="Reps" keyboardType="number-pad" style={styles.number} {...field('reps')} />
            <Input
              label={`Weight in ${LIFTING_WEIGHT_UNIT} (optional)`}
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
          <Button title="Save exercise" disabled={busy} onPress={save} />
          {onRemove ? <Button title="Remove exercise" disabled={busy} onPress={() => void run(onRemove)} /> : null}
          <Button title="Cancel" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Input({ label, style, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={[styles.field, style]}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} {...input} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { flexGrow: 0, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  numbers: { flexDirection: 'row', gap: 8 },
  number: { flex: 1 },
  field: { gap: 4 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 18 },
  problem: { color: '#b00020' },
});
