import { formatWeight } from '@fitsphere/shared';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BODY_WEIGHT_UNIT } from '../format';
import type { LocalWeighIn } from '../local/store';

// REQ-HOME-006: the day's weight, or "+ Add"; tapping it opens the entry sheet.
export function WeightTile({ weighIn, onPress }: { weighIn: LocalWeighIn | null; onPress(): void }) {
  const value = weighIn ? formatWeight(weighIn.weightGrams, BODY_WEIGHT_UNIT) : '+ Add';
  const note = weighIn?.syncState === 'pending' ? 'Waiting to sync' : weighIn?.syncState === 'rejected' ? 'Not saved' : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Weight: ${value}`} onPress={onPress} style={styles.tile}>
      <Text style={styles.label}>Weight</Text>
      <Text style={styles.value}>{value}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 4 },
  label: { color: '#555' },
  value: { fontSize: 22, fontWeight: '600' },
  note: { color: '#8a5a00' },
});
