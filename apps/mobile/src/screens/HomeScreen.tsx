import {
  MEAL_SET,
  MEASUREMENTS_SET,
  SAVED_MEAL_SET,
  PROFILE_SET,
  SETTING_SET,
  syncWindowStart,
  TARGET_SET,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type IstDay,
  type LengthUnit,
  type MealTotals,
  type TargetKind,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, CircleGauge, Footprints, Moon } from 'lucide-react-native';
import { LayoutAnimation, Platform, Pressable, ScrollView, UIManager, View } from 'react-native';
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
import { isWaiting, ShowingDayBanner } from '../components/ShowingDayBanner';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WeekStrip } from '../components/WeekStrip';
import { Text } from '../components/ui';
import { DAY_VALUE_ORDER, dayValues, type DayValueKind } from '../dayValues';
import { formatDay, formatInteger } from '../format';
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
import { useShownOlderDays } from '../navigation/useShownOlderDays';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useDataVersion, useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { targetValues } from '../targets';
import { TYPE } from '../typography';
import { useWeekActivity } from '../weekActivity';
import { LogOut } from './LogOut';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

const TILE_ICONS = {
  weighIn: CircleGauge,
  steps: Footprints,
  sleep: Moon,
} as const;

type Sheet = { kind: DayValueKind; day: IstDay; initial: number | null };
type DayValues = Partial<Record<DayValueKind, { value: number; syncState: SyncState; fromHealthConnect: boolean }>>;
type Targets = Partial<Record<TargetKind, number>>;

// Home (REQ-HOME-*): the selected day's data. The date, the calendar and the avatar are in the
// tabs' common header (REQ-NAV-002).
export function HomeScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const version = useDataVersion();
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
  const [lastMeasured, setLastMeasured] = useState<{
    day: IstDay | null;
    accountDay: string | null;
  } | null>(null);
  const [measurementsSheet, setMeasurementsSheet] = useState<{
    mode: 'add' | 'edit';
    day: IstDay;
  } | null>(null);
  const measurementsOpen = measurementsSheet !== null;
  const [eaten, setEaten] = useState<MealTotals | null>(null);
  // The strip's week: an apple and a dumbbell under each day (D-103); no line counting its workouts (D-110).
  const activity = useWeekActivity(stripStart);
  // A day before the phone's 90 is read from the server when shown; till then its cards show dashes (D-106).
  const older = useShownOlderDays();
  const waiting = isWaiting(older.day.status);
  const { colors } = useTheme();
  const [weekOpen, setWeekOpen] = useState(true);
  function toggleWeek() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWeekOpen((open) => !open);
  }

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
      getEntry(db, 'measurements', selected),
      getMeta(db, 'measurement_unit'),
      dayNutrition(db, selected),
      latestMeasurementsDay(db, today),
      getMeta(db, 'account_created_day'),
    ]).then(([entries, waiting, onDay, dayMeasurements, unit, nutrition, lastDay, accountDay]) => {
      if (!active) return;
      setValues(
        Object.fromEntries(
          DAY_VALUE_ORDER.flatMap((kind, index) => {
            const entry = entries[index] as (Record<string, unknown> & { syncState: SyncState }) | null | undefined;
            return entry
              ? [
                  [
                    kind,
                    {
                      value: Number(entry[texts[kind].field]),
                      syncState: entry.syncState,
                      // Steps and weight read from Health Connect carry a tag (D-121).
                      fromHealthConnect: entry.source === 'health_connect',
                    },
                  ],
                ]
              : [];
          }),
        ),
      );
      setRejected(waiting);
      // Each date shows the targets it had (D-77).
      setTargets(targetValues(onDay));
      setMeasurements(dayMeasurements);
      setLastMeasured({ day: lastDay, accountDay });
      setLengthUnit(unit === 'in' ? 'in' : 'cm');
      setEaten(nutrition);
    });
    return () => {
      active = false;
    };
    // Read again when the measurements sheet closes: its cm/in choice may have changed.
  }, [local.state, selected, today, version, measurementsOpen, texts]);

  // Today's card says when measurements were last logged, and whether they are due (D-85). All the
  // account's days are on the phone when it was created within the 90 days.
  const since =
    selected === today && lastMeasured
      ? measurementsSince(lastMeasured.day, today, lastMeasured.accountDay !== null && lastMeasured.accountDay >= syncWindowStart(today))
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
    if (kind)
      setSheet({
        kind,
        day: String(data.day),
        initial: Number(data[texts[kind].field]),
      });
    else if (entry.type === MEASUREMENTS_SET) setMeasurementsSheet({ mode: 'edit', day: String(data.day) });
    else if (entry.type === TARGET_SET) openTargets();
    else if (entry.type === MEAL_SET)
      router.push({
        pathname: '/log-meal',
        params: { mealId: String(data.id) },
      });
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
          {/* A sliding panel: the handle shows the date and folds the week away. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={weekOpen ? 'Hide the week' : 'Show the week'}
            accessibilityState={{ expanded: weekOpen }}
            onPress={toggleWeek}
            style={styles.handle}
          >
            <Text style={styles.handleText}>{formatDay(selected, today)}</Text>
            {weekOpen ? (
              <ChevronUp size={20} strokeWidth={2.25} color={colors.accent} />
            ) : (
              <ChevronDown size={20} strokeWidth={2.25} color={colors.accent} />
            )}
          </Pressable>
          {/* No line counting the week's workouts under the strip (D-110). */}
          {weekOpen ? (
            <WeekStrip
              today={today}
              firstDay={firstDay}
              selected={selected}
              start={stripStart}
              activity={activity}
              onSelect={select}
              onShow={showDays}
            />
          ) : null}
        </View>
        {selected !== today ? (
          <ShowingDayBanner day={selected} today={today} status={older.day.status} onBack={() => select(today)} onRetry={older.day.retry} />
        ) : null}
        <RejectedChanges entries={rejected} onEdit={editRejected} onDiscard={(changeId) => void sync.discard(changeId)} />
        {/* The day's food against its targets: the panel Home leads with; protein, carbs, fat and fibre
            under the calories since D-103. */}
        <View style={styles.panel}>
          <CutCorner />
          <TargetProgressCard
            title="Calories"
            unit="kcal"
            eaten={waiting ? null : Math.round(eaten?.kcal ?? 0)}
            target={targets.calories ?? null}
            onSetTarget={selected === today ? openTargets : null}
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="By meal"
                hitSlop={8}
                onPress={() =>
                  router.push({
                    pathname: '/nutrition',
                    params: { tab: 'consumed' },
                  })
                }
                style={({ pressed }) => [styles.byMeal, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.byMealText}>By meal</Text>
                <ChevronRight size={16} strokeWidth={2.25} color={colors.accent} />
              </Pressable>
            }
          />
          <View style={styles.rule} />
          <NutrientTargets totals={waiting ? null : eaten} targets={targets} />
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
                icon={(() => {
                  const Icon = TILE_ICONS[kind];
                  return <Icon size={16} strokeWidth={2.25} color={colors.accent} />;
                })()}
                shownValue={kind === 'steps' && entry ? formatInteger(entry.value) : undefined}
                syncState={entry?.syncState ?? null}
                tag={entry?.fromHealthConnect ? 'Health Connect' : null}
                waiting={waiting && !entry}
                onPress={() =>
                  setSheet({
                    kind,
                    day: selected,
                    initial: entry?.value ?? null,
                  })
                }
              />
            );
          })}
        </View>
        <MeasurementsCard
          day={selected}
          entry={measurements}
          unit={lengthUnit}
          since={since}
          waiting={waiting}
          groupMore
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
            title={`${sheetText.label} · ${formatDay(sheet.day, today)}`}
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
// locked 2026-11-13): no workouts card; since D-110 no line counting the week's workouts under the strip.
const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 72, gap: 12 },
  week: { gap: 6 },
  handle: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  handleText: { ...TYPE.label, color: c.inkMuted },
  body: { fontSize: 15 },
  panel: { padding: 16, borderRadius: 4, backgroundColor: c.surface },
  rule: { height: 1, marginVertical: 16, backgroundColor: c.border },
  byMeal: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  byMealText: { ...TYPE.label, color: c.accent },
  tiles: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  // As the centred message screens: 24 between the message and Log out.
  stopped: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
}));
