import { fromGrams } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { BODY_WEIGHT_UNIT, formatDay, parseWeightInput, WEIGHT_RULE } from '../format';

type Props = {
  day: string;
  initialGrams: number | null;
  onSave(weightGrams: number): Promise<void>;
  onClose(): void;
};

// The weight entry sheet (REQ-HOME-006): one decimal, 20–300 kg (Q-028). A new value replaces the
// day's value (Q-030).
export function EntrySheet({ day, initialGrams, onSave, onClose }: Props) {
  const [text, setText] = useState(initialGrams === null ? '' : fromGrams(initialGrams, BODY_WEIGHT_UNIT).toFixed(1));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const grams = parseWeightInput(text);
    if (grams === null) {
      setProblem(WEIGHT_RULE);
      return;
    }
    setBusy(true);
    await onSave(grams);
    setBusy(false);
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            Weight · {formatDay(day)}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel={`Weight in ${BODY_WEIGHT_UNIT}`}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              autoFocus
              style={styles.input}
            />
            <Text>{BODY_WEIGHT_UNIT}</Text>
          </View>
          {problem ? (
            <Text accessibilityRole="alert" style={styles.problem}>
              {problem}
            </Text>
          ) : null}
          <Button title="Save" disabled={busy} onPress={() => void save()} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', padding: 24, gap: 12, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 20 },
  problem: { color: '#b00020' },
});
