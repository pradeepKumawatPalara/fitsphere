import { Pressable } from 'react-native';
import type { SyncState } from '../local/store';
import { themedStyles } from '../theme';
import { Text } from './ui';

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
  const styles = useStyles();
  const shown = value ?? '+ Add';
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, value === null && styles.add]}>{shown}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Pressable>
  );
}

const useStyles = themedStyles((c) => ({
  tile: { flex: 1, minHeight: 88, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: c.surface, gap: 6 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 13, color: c.textMuted },
  value: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // "+ Add" reads as an action, not a value.
  add: { color: c.primary },
  note: { color: c.warning, fontSize: 12 },
}));
