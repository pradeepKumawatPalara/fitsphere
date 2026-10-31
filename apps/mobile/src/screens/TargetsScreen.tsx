import type { TargetKind } from '@fitsphere/shared';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listTargets, type LocalTarget } from '../local/store';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { TARGET_ORDER, targetTexts } from '../targets';

// "Your targets" (REQ-ROLE-007, D-20): the user sets their own daily calories, protein and steps,
// weekly workouts and target body weight. Opened from Account and from the Home cards (MVP
// default, D-23). Every target in the MVP is the user's own, so each reads "Set by you".
export function TargetsScreen() {
  const local = useLocalDatabase();
  const sync = useSync();
  const texts = targetTexts(useBodyWeightUnit());
  const [targets, setTargets] = useState<Partial<Record<TargetKind, LocalTarget>>>({});
  const [editing, setEditing] = useState<TargetKind | null>(null);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listTargets(local.state.db).then((list) => {
      if (active) setTargets(Object.fromEntries(list.map((target) => [target.kind, target])));
    });
    return () => {
      active = false;
    };
  }, [local.state, sync.version]);

  const text = editing ? texts[editing] : null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {TARGET_ORDER.map((kind) => {
        const target = targets[kind];
        const value = target ? texts[kind].format(target.value) : 'Not set';
        const note =
          target?.syncState === 'rejected'
            ? 'Not saved'
            : target?.syncState === 'pending'
              ? 'Set by you · waiting to sync'
              : target
                ? 'Set by you'
                : null;
        return (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={`${texts[kind].label}: ${value}`}
            onPress={() => setEditing(kind)}
            style={styles.row}
          >
            <Text style={styles.label}>{texts[kind].label}</Text>
            <Text style={styles.value}>{value}</Text>
            {note ? <Text style={target?.syncState === 'rejected' ? styles.problem : styles.note}>{note}</Text> : null}
          </Pressable>
        );
      })}
      {editing && text ? (
        <NumberEntrySheet
          title={text.label}
          label={`${text.label} in ${text.unit}`}
          unit={text.unit}
          initialText={targets[editing] ? text.toText(targets[editing].value) : ''}
          parse={text.parse}
          rule={text.rule}
          decimal={text.decimal}
          onSave={(value) => sync.save('target', { kind: editing, value })}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 4 },
  label: { color: '#555' },
  value: { fontSize: 20, fontWeight: '600' },
  note: { color: '#555' },
  problem: { color: '#b00020' },
});
