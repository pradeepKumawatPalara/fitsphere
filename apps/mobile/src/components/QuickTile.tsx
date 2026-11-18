import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
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
  /** A day before the phone's 90 not loaded yet (D-106): a dash, not "+ Add". */
  waiting?: boolean;
  /** An icon beside the label. */
  icon?: ReactNode;
  /** What is drawn in place of `value` (the spoken label keeps `value`): Steps drops its repeated unit. */
  shownValue?: string | null;
  onPress(): void;
};

// A Home quick tile (REQ-HOME-006): the selected day's value, or "+ Add"; tapping it opens the
// entry sheet. The redesign's 2.3 (locked by the owner, 2026-11-03): one column of Home's strip of
// three, its reading in condensed capitals.
export function QuickTile({ label, value, syncState, divider = false, waiting = false, icon, shownValue, onPress }: Props) {
  const styles = useStyles();
  const spoken = waiting ? '–' : (value ?? '+ Add');
  const shown = waiting ? '–' : ((shownValue ?? value) || '+ Add');
  const note = syncState === 'pending' ? 'Waiting to sync' : syncState === 'rejected' ? 'Not saved' : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${waiting ? 'not loaded' : spoken}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, divider && styles.divider, pressed && styles.pressed]}
    >
      <View style={styles.labelRow}>
        {icon}
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, waiting ? styles.waiting : value === null && styles.add]}>{shown}</Text>
      {note ? <Text style={[styles.note, syncState === 'rejected' && styles.notSaved]}>{note}</Text> : null}
    </Pressable>
  );
}

const useStyles = themedStyles((c) => ({
  tile: { flex: 1, minHeight: 88, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', gap: 4 },
  divider: { borderLeftWidth: 1, borderLeftColor: c.border },
  pressed: { opacity: 0.6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...TYPE.label, color: c.inkMuted },
  value: TYPE.metric,
  // "+ Add" reads as an action, not a value.
  add: { color: c.accent },
  waiting: { color: c.inkSubtle },
  note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  notSaved: { color: c.danger },
}));
