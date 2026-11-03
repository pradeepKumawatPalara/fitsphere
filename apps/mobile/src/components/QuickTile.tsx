import { Pressable } from 'react-native';
import type { SyncState } from '../local/store';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

type Props = {
  label: string;
  /** The day's value, formatted, or null when nothing is logged. */
  value: string | null;
  syncState: SyncState | null;
  /** A line at its left, between it and the tile before it in the strip. */
  divider?: boolean;
  onPress(): void;
};

// A Home quick tile (REQ-HOME-006): the selected day's value, or "+ Add"; tapping it opens the
// entry sheet. The redesign's 2.3 (locked by the owner, 2026-11-03): one column of Home's strip of
// three, its reading in condensed capitals.
export function QuickTile({ label, value, syncState, divider = false, onPress }: Props) {
  const styles = useStyles();
  const shown = value ?? '+ Add';
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${shown}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, divider && styles.divider, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, value === null && styles.add]}>{shown}</Text>
      {note ? <Text style={[styles.note, syncState === 'rejected' && styles.notSaved]}>{note}</Text> : null}
    </Pressable>
  );
}

const useStyles = themedStyles((c) => ({
  tile: { flex: 1, minHeight: 88, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', gap: 4 },
  divider: { borderLeftWidth: 1, borderLeftColor: c.border },
  pressed: { opacity: 0.6 },
  label: { ...TYPE.label, color: c.inkMuted },
  value: TYPE.metric,
  // "+ Add" reads as an action, not a value.
  add: { color: c.accent },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
}));
