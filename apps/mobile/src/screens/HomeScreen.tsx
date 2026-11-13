import {
  istWeekStart,
  MEAL_SET,
  MEASUREMENTS_SET,
  SAVED_MEAL_SET,
  PROFILE_SET,
  SETTING_SET,
  TARGET_SET,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type IstDay,
  type LengthUnit,
  type MealTotals,
  type TargetKind,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { History } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { CutCorner } from '../components/CutCorner';
import { LogMealButton } from '../components/LogMealButton';
import { MeasurementsCard, measurementsSince } from '../components/MeasurementsCard';
import { MeasurementsSheet } from '../components/MeasurementsSheet';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { NutrientTargets } from '../components/NutrientTargets';
import { QuickTile } from '../components/QuickTile';
import { RejectedChanges } from '../components/RejectedChanges';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WeekStrip } from '../components/WeekStrip';
import { WeekWorkouts } from '../components/WeekWorkouts';
import { Text, TextButton } from '../components/ui';
import { DAY_VALUE_ORDER, dayValues, type DayValueKind } from '../dayValues';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  dayNutrition,
  getEntry,
  getMeta,
  latestMeasurementsDay,
  targetsOn,
  rejectedChanges,
  type LocalMeasurements,
  type OutboxEntry,
  type SyncState,
} from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { targetValues, weekTargetDay } from '../targets';
import { useWeekActivity } from '../weekActivity';
import { LogOut } from './LogOut';

type Sheet = { kind: DayValueKind; day: IstDay; initial: number | null };
type DayValues = Partial<Record<DayValueKind, { value: number; syncState: SyncState }>>;
type Targets = Partial<Record<TargetKind, number>>;

// Home (REQ-HOME-*): the selected day's data. The date, the calendar and the avatar are in the
// tabs' common header (REQ-NAV-002).
export function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  // Weight in the body-weight unit setting (Q-024, REQ-ACC-003).
  const bodyWeightUnit = useBodyWeightUnit();
  const texts = useMemo(() => dayValues(bodyWeightUnit), [bodyWeightUnit]);
  const router = useRouter();
  const { today, selected, firstDay, stripStart, select, showDays } = useSelectedDay();
  const [values, setValues] = useState<DayValues>({});
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [measurements, setMeasurements] = useState<LocalMeasurements | null>(null);
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('cm');
  // The latest day with measurements up to today, and the day the account was created, once read (D-85).
  const [lastMeasured, setLastMeasured] = useState<{ day: IstDay | null; accountDay: string | null } | null>(null);
  const [measurementsSheet, setMeasurementsSheet] = useState<{ mode: 'add' | 'edit'; day: IstDay } | null>(null);
  const measurementsOpen = measurementsSheet !== null;
  const [eaten, setEaten] = useState<MealTotals | null>(null);
  // The strip's week: an apple and a dumbbell under each day, and its workouts counted under it (D-103).
  const activity = useWeekActivity(stripStart);

  useEffect(() => {
    let active = true;
    void ensureAccount(deps).then((state) => {
      if (!active) return;
      if (state.kind === 'needsAgeConfirmation') router.replace('/account-setup');
      else if (state.kind === 'signedOut') router.replace('/sign-in');
      // Offline or unavailable: stay on Home.
    });
    return () => {
      active = false;
    };
  }, [deps, router]);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([
      Promise.all(DAY_VALUE_ORDER.map((kind) => getEntry(db, kind, selected))),
      rejectedChanges(db),
      targetsOn(db, selected),
      // The strip's week's workout target is its Sunday's: this week's is today's (D-77).
      targetsOn(db, weekTargetDay(stripStart)),
      getEntry(db, 'measurements', selected),
      getMeta(db, 'measurement_unit'),
      dayNutrition(db, selected),
      latestMeasurementsDay(db, today),
      getMeta(db, 'account_created_day'),
    ]).then(([entries, waiting, onDay, onSunday, dayMeasurements, unit, nutrition, lastDay, accountDay]) => {
      if (!active) return;
      setValues(
        Object.fromEntries(
          DAY_VALUE_ORDER.flatMap((kind, index) => {
            const entry = entries[index] as (Record<string, unknown> & { syncState: SyncState }) | null | undefined;
            return entry ? [[kind, { value: Number(entry[texts[kind].field]), syncState: entry.syncState }]] : [];
          }),
        ),
      );
      setRejected(waiting);
      // Each date shows the targets it had (D-77); the strip's week's workouts, its Sunday's.
      setTargets({ ...targetValues(onDay), ...targetValues(onSunday.filter((target) => target.kind === 'weekly_workouts')) });
      setMeasurements(dayMeasurements);
      setLastMeasured({ day: lastDay, accountDay });
      setLengthUnit(unit === 'in' ? 'in' : 'cm');
      setEaten(nutrition);
    });
    return () => {
      active = false;
    };
    // Read again when the measurements sheet closes: its cm/in choice may have changed.
  }, [local.state, selected, today, stripStart, sync.version, measurementsOpen, texts]);

  // Today's card says when measurements were last logged, and whether they are due (D-85). All the
  // account's days are on the phone when it was created within the 90 days.
  const since =
    selected === today && lastMeasured
      ? measurementsSince(lastMeasured.day, today, lastMeasured.accountDay !== null && lastMeasured.accountDay >= firstDay)
      : null;

  function openTargets() {
    router.push('/targets');
  }

  function saveDayValue(kind: DayValueKind, day: IstDay, value: number) {
    if (kind === 'weighIn') return sync.save('weighIn', { day, weightGrams: value });
    if (kind === 'steps') return sync.save('steps', { day, steps: value });
    return sync.save('sleep', { day, sleepMinutes: value });
  }

  /** Edit opens the rejected change's own sheet, with its value, to fix it (ADR-0007 rule 2). */
  function editRejected(entry: OutboxEntry) {
    const data = entry.data as Record<string, unknown>;
    const kind = DAY_VALUE_ORDER.find((candidate) => texts[candidate].changeType === entry.type);
    if (kind) setSheet({ kind, day: String(data.day), initial: Number(data[texts[kind].field]) });
    else if (entry.type === MEASUREMENTS_SET) setMeasurementsSheet({ mode: 'edit', day: String(data.day) });
    else if (entry.type === TARGET_SET) openTargets();
    else if (entry.type === MEAL_SET) router.push({ pathname: '/log-meal', params: { mealId: String(data.id) } });
    else if (entry.type === SAVED_MEAL_SET) router.push({ pathname: '/nutrition', params: { tab: 'saved' } });
    else if (entry.type === WORKOUT_SET || entry.type === WORKOUT_DELETE) router.push(`/workout/${String(data.id)}`);
    else if (entry.type === SETTING_SET) router.push('/account');
    else if (entry.type === PROFILE_SET) router.push('/profile');
  }

  // Never run unencrypted (ADR-0007 rule 5): stop, and leave only Log out.
  if (local.state.status === 'failed') {
    return (
      <View style={styles.stopped}>
        <Text accessibilityRole="alert" style={styles.body}>
          {local.state.reason === 'sqlcipherMissing'
            ? 'FitSphere stopped: this phone’s database cannot be encrypted.'
            : 'FitSphere stopped: this phone’s database could not be opened.'}
        </Text>
        <LogOut />
      </View>
    );
  }

  const sheetText = sheet ? texts[sheet.kind] : null;
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.week}>
          <WeekStrip
            today={today}
            firstDay={firstDay}
            selected={selected}
            start={stripStart}
            activity={activity}
            onSelect={select}
            onShow={showDays}
          />
          <WeekWorkouts
            count={activity?.counted ?? null}
            target={targets.weekly_workouts ?? null}
            thisWeek={stripStart === istWeekStart(today)}
          />
        </View>
        {selected !== today ? (
          <View style={styles.banner}>
            <History size={20} color={colors.accent} />
            <Text style={styles.bannerText}>Showing {formatDay(selected)}</Text>
            <TextButton title="Back to today" onPress={() => select(today)} />
          </View>
        ) : null}
        <RejectedChanges entries={rejected} onEdit={editRejected} onDiscard={(changeId) => void sync.discard(changeId)} />
        {/* The day's food against its targets: the panel Home leads with; protein, carbs, fat and fibre
            under the calories since D-103. */}
        <View style={styles.panel}>
          <CutCorner />
          <TargetProgressCard
            title="Calories"
            unit="kcal"
            eaten={Math.round(eaten?.kcal ?? 0)}
            target={targets.calories ?? null}
            onSetTarget={selected === today ? openTargets : null}
          />
          <View style={styles.rule} />
          <NutrientTargets totals={eaten} targets={targets} />
          <View style={styles.panelFoot}>
            <TextButton title="By meal" arrow end onPress={() => router.push({ pathname: '/nutrition', params: { tab: 'consumed' } })} />
          </View>
        </View>
        <View style={styles.tiles}>
          {DAY_VALUE_ORDER.map((kind, index) => {
            const entry = values[kind];
            return (
              <QuickTile
                key={kind}
                divider={index > 0}
                label={texts[kind].label}
                value={entry ? texts[kind].format(entry.value) : null}
                syncState={entry?.syncState ?? null}
                onPress={() => setSheet({ kind, day: selected, initial: entry?.value ?? null })}
              />
            );
          })}
        </View>
        <MeasurementsCard
          day={selected}
          entry={measurements}
          unit={lengthUnit}
          since={since}
          onAdd={() => setMeasurementsSheet({ mode: 'add', day: selected })}
          onEdit={() => setMeasurementsSheet({ mode: 'edit', day: selected })}
        />
        {measurementsSheet ? (
          <MeasurementsSheet
            mode={measurementsSheet.mode}
            initialDay={measurementsSheet.day}
            today={today}
            firstDay={firstDay}
            onSave={(input) => sync.save('measurements', input)}
            onClose={() => setMeasurementsSheet(null)}
          />
        ) : null}
        {sheet && sheetText ? (
          <NumberEntrySheet
            title={`${sheetText.label} · ${formatDay(sheet.day)}`}
            label={sheetText.inputLabel}
            unit={sheetText.unit}
            initialText={sheet.initial === null ? '' : sheetText.toText(sheet.initial)}
            parse={sheetText.parse}
            rule={sheetText.rule}
            decimal={sheetText.decimal}
            onSave={(value) => saveDayValue(sheet.kind, sheet.day, value)}
            onClose={() => setSheet(null)}
          />
        ) : null}
      </ScrollView>
      <LogMealButton day={selected} />
    </View>
  );
}

// The redesign's 2.3 (locked by the owner, 2026-11-03): cards 12 apart in the 16 gutter, radius 4; the
// food card with the cut corner; the three tiles one strip; room at the foot for + LOG. Since D-103 (B
// locked 2026-11-13): the week's workouts line 6 under the strip, and no workouts card.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100, gap: 12 },
  week: { gap: 6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: c.accentTint,
  },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15 },
  panel: { padding: 16, borderRadius: 4, backgroundColor: c.surface },
  rule: { height: 1, marginVertical: 16, backgroundColor: c.border },
  panelFoot: { marginTop: 4 },
  tiles: { flexDirection: 'row', borderRadius: 4, overflow: 'hidden', backgroundColor: c.surface },
  // As the centred message screens: 24 between the message and Log out.
  stopped: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
}));
