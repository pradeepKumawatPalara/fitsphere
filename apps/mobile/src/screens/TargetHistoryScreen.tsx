import { istToday, type IstDay, type TargetKind } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { ArrowRight, Calendar, History } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listTargets, type LocalTarget } from '../local/store';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { TARGET_ORDER, targetChanges, targetPeriods, targetTexts } from '../targets';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { TARGET_ICONS } from './TargetsScreen';

/** The choices at the top: every change, or one target's values. */
type Shown = 'all' | TargetKind;

const CHOICE_LABELS: Record<Shown, string> = {
  all: 'All',
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fibre: 'Fibre',
  steps: 'Steps',
  weekly_workouts: 'Workouts',
  body_weight: 'Body weight',
};
const CHOICES: readonly Shown[] = ['all', ...TARGET_ORDER];

// Target history (REQ-ROLE-018, D-77; the redesign's 6.7, locked by the owner 2026-11-11): the user's
// own targets by date, read from the phone, so it works offline. All lists each change under its
// day, newest first; one target shows its value now and since when, then each earlier value with
// its days, then the days before the first, which had none. Read-only: a target is changed on Your
// targets, from today on. A change not saved (rejected) never held, so it is left out.
export function TargetHistoryScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const texts = targetTexts(useBodyWeightUnit());
  const today = istToday(now());
  const [targets, setTargets] = useState<LocalTarget[] | null>(null);
  const [shown, setShown] = useState<Shown>('all');

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listTargets(local.state.db).then((list) => {
      if (active) setTargets(list.filter((target) => target.syncState !== 'rejected'));
    });
    return () => {
      active = false;
    };
  }, [local.state, sync.version]);

  if (targets === null) return <View style={styles.screen} />;

  if (targets.length === 0) {
    return (
      <View style={[styles.screen, styles.empty]}>
        <View style={styles.emptyIcon}>
          <History size={28} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
        </View>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          No targets yet
        </Text>
        <Text style={styles.emptyText}>When you set a target, each change shows here with its date.</Text>
        <TextButton title="Set a target" outlined onPress={() => router.back()} />
      </View>
    );
  }

  /** "2,000 kcal" as its number and its unit. */
  const parts = (kind: TargetKind, value: number) => {
    const text = texts[kind].format(value);
    const space = text.indexOf(' ');
    return { number: text.slice(0, space), unit: text.slice(space + 1) };
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
        accessibilityLabel="Show"
        style={styles.choicesBar}
        contentContainerStyle={styles.choices}
      >
        {CHOICES.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityLabel={CHOICE_LABELS[choice]}
            accessibilityState={{ checked: choice === shown }}
            onPress={() => setShown(choice)}
            style={({ pressed }) => [pill.choice, styles.choice, choice === shown && pill.chosen, pressed && pill.pressed]}
          >
            <Text style={[pill.choiceText, choice === shown && pill.chosenText]}>{CHOICE_LABELS[choice]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {shown === 'all' ? (
          targetChanges(targets).map(({ day, changes }) => (
            <View key={day} style={styles.section}>
              <Text accessibilityRole="header" style={[styles.heading, day === today && styles.today]}>
                {day === today ? `${formatDay(day)} · today` : formatDay(day)}
              </Text>
              <View style={styles.card}>
                {changes.map((change, index) => {
                  const Icon = TARGET_ICONS[change.kind];
                  const to = parts(change.kind, change.to);
                  const from = change.from === null ? null : parts(change.kind, change.from);
                  const spoken = from ? `${from.number} to ${to.number} ${to.unit}` : `set to ${to.number} ${to.unit}`;
                  return (
                    <View
                      key={change.kind}
                      accessible
                      accessibilityLabel={`${texts[change.kind].label}: ${spoken}`}
                      style={[styles.row, index > 0 && styles.divided]}
                    >
                      <View style={styles.iconTile}>
                        <Icon size={20} color={colors.accent} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.label}>{texts[change.kind].label}</Text>
                        <View style={styles.change}>
                          {from ? (
                            <>
                              <Text style={styles.from}>{from.number}</Text>
                              <ArrowRight size={16} strokeWidth={2.5} color={colors.accent} />
                            </>
                          ) : (
                            <Text style={styles.setTo}>Set to</Text>
                          )}
                          <Text style={styles.to}>{to.number}</Text>
                          <Text style={styles.unit}>{to.unit}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <OneTarget kind={shown} targets={targets} today={today} parts={parts} onSet={() => router.back()} />
        )}
      </ScrollView>
    </View>
  );
}

/** One target: its value now and since when, its earlier values with their days, and before the first. */
function OneTarget({
  kind,
  targets,
  today,
  parts,
  onSet,
}: {
  kind: TargetKind;
  targets: readonly LocalTarget[];
  today: IstDay;
  parts(kind: TargetKind, value: number): { number: string; unit: string };
  onSet(): void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const texts = targetTexts(useBodyWeightUnit());
  const label = texts[kind].label;
  const history = targetPeriods(targets, kind);
  if (!history) {
    return (
      <View accessibilityLabel={`${label}: not set`} style={[styles.card, styles.summary]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.unset}>Not set</Text>
        <TextButton title="Set a target" outlined onPress={onSet} />
      </View>
    );
  }
  const current = parts(kind, history.now.value);
  const since = history.now.since >= today ? `From today, ${formatDay(today)}` : `Since ${formatDay(history.now.since)}`;
  return (
    <>
      <View accessible accessibilityLabel={`${label} now: ${current.number} ${current.unit}. ${since}, set by you`} style={[styles.card, styles.summary]}>
        <Text style={styles.label}>{label} · now</Text>
        <Text style={styles.now}>
          {current.number}
          <Text style={styles.nowUnit}> {current.unit}</Text>
        </Text>
        <View style={styles.sinceRow}>
          <Calendar size={16} color={colors.accent} />
          <Text style={styles.since}>{since} · set by you</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.heading, styles.earlier]}>
        Earlier
      </Text>
      <View style={styles.card}>
        {history.earlier.map((period, index) => {
          const value = parts(kind, period.value);
          const dates = `${formatDay(period.from)} – ${formatDay(period.to)}`;
          const days = period.days === 1 ? '1 day' : `${period.days} days`;
          return (
            <View
              key={period.from}
              accessible
              accessibilityLabel={`${dates}, ${days}: ${value.number} ${value.unit}`}
              style={[styles.row, styles.period, index > 0 && styles.divided]}
            >
              <View style={styles.rowText}>
                <Text style={styles.dates}>{dates}</Text>
                <Text style={styles.days}>{days}</Text>
              </View>
              <View style={styles.change}>
                <Text style={styles.to}>{value.number}</Text>
                <Text style={styles.unit}>{value.unit}</Text>
              </View>
            </View>
          );
        })}
        {/* The days before the first value had no target (the owner's answer, D-77). */}
        <View
          accessible
          accessibilityLabel={`Before ${formatDay(history.firstDay)}: no target`}
          style={[styles.row, styles.period, history.earlier.length > 0 && styles.divided]}
        >
          <Text style={[styles.dates, styles.muted]}>Before {formatDay(history.firstDay)}</Text>
          <Text style={styles.noTarget}>No target</Text>
        </View>
      </View>
      <Text style={styles.footnote}>Each value holds from its day until the next change.</Text>
    </>
  );
}

// The choices in one scrolling row under the header; each day's changes on one card, a row each,
// with the target's icon; one target's value now in big condensed figures.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  choicesBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border },
  choices: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  choice: { minHeight: 44 },
  content: { padding: 16, gap: 12 },
  section: { gap: 8, marginBottom: 6 },
  heading: { ...TYPE.label, fontSize: 15, lineHeight: 18, color: c.inkMuted },
  today: { color: c.accent },
  earlier: { marginTop: 10 },
  card: { borderRadius: 4, backgroundColor: c.surface },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  period: { justifyContent: 'space-between' },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  iconTile: { width: 36, height: 36, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  label: { ...TYPE.label, color: c.inkMuted },
  change: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  setTo: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  from: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 20, lineHeight: 22, fontVariant: ['tabular-nums'], color: c.inkMuted },
  to: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 22, lineHeight: 24, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: c.accent },
  summary: { padding: 16, gap: 8 },
  now: { ...TYPE.heroNumber, fontSize: 56, lineHeight: 58 },
  nowUnit: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', color: c.accent },
  sinceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  since: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  unset: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 22, lineHeight: 32, textTransform: 'uppercase', color: c.inkSubtle },
  dates: { fontSize: 15, lineHeight: 22 },
  days: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  muted: { color: c.inkMuted },
  noTarget: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase', color: c.inkSubtle },
  footnote: { ...TYPE.small, marginTop: 4, color: c.inkMuted },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 80, gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 24, lineHeight: 26, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6 },
  emptyText: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center', marginBottom: 10 },
}));
