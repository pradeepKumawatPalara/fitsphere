import type { TargetKind } from '@fitsphere/shared';
import { Droplet, Dumbbell, Drumstick, Flame, Footprints, Leaf, Scale, SquarePen, Wheat, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { Text } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listTargets, type LocalTarget } from '../local/store';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { TARGET_GROUPS, targetTexts } from '../targets';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

const ICONS: Record<TargetKind, LucideIcon> = {
  calories: Flame,
  protein: Drumstick,
  carbs: Wheat,
  fat: Droplet,
  fibre: Leaf,
  steps: Footprints,
  weekly_workouts: Dumbbell,
  body_weight: Scale,
};

// "Your targets" (REQ-ROLE-007, D-20): the user sets their own daily calories, protein, carbs, fat,
// fibre (D-70) and steps, weekly workouts and target body weight. Opened from Account, from the Home
// cards (MVP default, D-23) and from Insight's "Set a target". Every target in the MVP is the user's
// own, so each reads "Set by you". Each tile opens its target to edit, and shows so with a pencil at
// its top right, as a meal's Edit. The redesign's 6.2 (locked again by the owner, 2026-11-10): two
// groups, Food and Activity and body, tiles two by two, the calories and the body weight across.
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
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {TARGET_GROUPS.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>
            {group.title}
          </Text>
          <View style={styles.tiles}>
            {group.kinds.map((kind) => {
              const target = targets[kind];
              const value = target ? texts[kind].format(target.value) : 'Not set';
              // "2,000 kcal": the number large, its unit small in caramel.
              const space = value.indexOf(' ');
              const note =
                target?.syncState === 'rejected'
                  ? 'Not saved'
                  : target?.syncState === 'pending'
                    ? 'Set by you · waiting to sync'
                    : target
                      ? 'Set by you'
                      : null;
              const Icon = ICONS[kind];
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityLabel={`${texts[kind].label}: ${value}`}
                  accessibilityHint="Opens it to edit"
                  onPress={() => setEditing(kind)}
                  style={({ pressed }) => [styles.tile, group.wide.includes(kind) && styles.wide, pressed && styles.pressed]}
                >
                  <View style={styles.head}>
                    <View style={styles.iconTile}>
                      <Icon size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
                    </View>
                    {/* The tile is the button; the pencil only shows it edits. */}
                    <SquarePen
                      testID={`edit-${kind}`}
                      size={20}
                      color={colors.accent}
                      importantForAccessibility="no"
                      accessibilityElementsHidden
                    />
                  </View>
                  <Text style={styles.label}>{texts[kind].label}</Text>
                  {target ? (
                    <Text style={styles.value}>
                      {value.slice(0, space)}
                      <Text style={styles.unit}> {value.slice(space + 1)}</Text>
                    </Text>
                  ) : (
                    <Text style={styles.unset}>{value}</Text>
                  )}
                  {note ? (
                    <View style={styles.noteRow}>
                      <View style={[styles.dot, target?.syncState === 'rejected' && styles.dotProblem]} />
                      <Text style={[styles.note, target?.syncState === 'rejected' && styles.problem]}>{note}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
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

// Each group under its name; two tiles a row, 10 apart; a wide tile takes its row.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 22 },
  group: { gap: 10 },
  groupTitle: { ...TYPE.label, fontSize: 15, lineHeight: 18, color: c.inkMuted },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '40%', flexGrow: 1, minHeight: 132, padding: 14, gap: 8, borderRadius: 4, backgroundColor: c.surface },
  wide: { flexBasis: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  iconTile: { width: 36, height: 36, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  label: { ...TYPE.label, color: c.inkMuted },
  value: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 30, lineHeight: 32, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase', color: c.accent },
  unset: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 22, lineHeight: 32, textTransform: 'uppercase', color: c.inkSubtle },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  note: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: c.inkMuted },
  problem: { color: c.danger },
}));
