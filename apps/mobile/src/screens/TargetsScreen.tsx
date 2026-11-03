import type { TargetKind } from '@fitsphere/shared';
import { SquarePen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { Text } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listTargets, type LocalTarget } from '../local/store';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { TARGET_ORDER, targetTexts } from '../targets';
import { themedStyles, useTheme } from '../theme';

// "Your targets" (REQ-ROLE-007, D-20): the user sets their own daily calories, protein and steps,
// weekly workouts and target body weight. Opened from Account and from the Home cards (MVP
// default, D-23). Every target in the MVP is the user's own, so each reads "Set by you". Each tile
// opens its target to edit, and shows so with a pencil at its top right, as a meal's Edit.
export function TargetsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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
            accessibilityHint="Opens it to edit"
            onPress={() => setEditing(kind)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.head}>
              <Text style={styles.label}>{texts[kind].label}</Text>
              {/* The tile is the button; the pencil only shows it edits. */}
              <SquarePen
                testID={`edit-${kind}`}
                size={20}
                color={colors.accent}
                importantForAccessibility="no"
                accessibilityElementsHidden
              />
            </View>
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

const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 12 },
  row: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pressed: { opacity: 0.6 },
  label: { fontSize: 13, color: c.inkMuted },
  value: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: c.inkMuted },
  problem: { fontSize: 13, color: c.danger },
}));
