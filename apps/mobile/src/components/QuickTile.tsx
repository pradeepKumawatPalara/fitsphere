import { Pressable, StyleSheet, Text } from 'react-native';
import type { SyncState } from '../local/store';

type Props = {
  label: string;
  /** The day's value, formatted, or null when nothing is logged. */
  value: string | null;
  syncState: SyncState | null;
  onPress(): void;
};

// A Home quick tile (REQ-HOME-006): the selected day's value, or "+ Add"; tapping it opens the
// entry sheet.
export function QuickTile({ label, value, syncState, onPress }: Props) {
  const shown = value ?? '+ Add';
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`} onPress={onPress} style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{shown}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 4 },
  label: { color: '#555' },
  value: { fontSize: 18, fontWeight: '600' },
  note: { color: '#8a5a00', fontSize: 12 },
});
