import { formatWeight, type ChangeErrorCode } from '@fitsphere/shared';
import { Button, StyleSheet, Text, View } from 'react-native';
import { BODY_WEIGHT_UNIT, formatDay } from '../format';
import type { OutboxEntry } from '../local/store';

// A rejected change stays visible until the user fixes or discards it (ADR-0007 rule 2, D-14).
// Text from the error model: "This weight wasn't saved: <reason>. Edit or discard it."
const REASONS: Record<ChangeErrorCode, string> = {
  DAY_IN_FUTURE: 'the date is in the future',
  VALIDATION_FAILED: 'the value is not valid',
  ROLE_NOT_ENABLED: 'your account cannot log weight',
  NOT_ALLOWED: 'you cannot change it',
  UNKNOWN_CHANGE_TYPE: 'this version of the app is out of date',
};

export function rejectedText(code: string | null): string {
  const reason = REASONS[code as ChangeErrorCode] ?? REASONS.VALIDATION_FAILED;
  return `This weight wasn't saved: ${reason}. Edit or discard it.`;
}

type Props = {
  entries: OutboxEntry[];
  onEdit(day: string): void;
  onDiscard(changeId: string): void;
};

export function RejectedChanges({ entries, onEdit, onDiscard }: Props) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const data = entry.data as { day: string; weightGrams: number };
        return (
          <View key={entry.changeId} accessibilityRole="alert" style={styles.item}>
            <Text style={styles.what}>
              {formatDay(data.day)} · {formatWeight(data.weightGrams, BODY_WEIGHT_UNIT)}
            </Text>
            <Text>{rejectedText(entry.errorCode)}</Text>
            <View style={styles.actions}>
              <Button title="Edit" onPress={() => onEdit(data.day)} />
              <Button title="Discard" onPress={() => onDiscard(entry.changeId)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { padding: 12, gap: 6, borderRadius: 8, borderWidth: 1, borderColor: '#b00020' },
  what: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
});
