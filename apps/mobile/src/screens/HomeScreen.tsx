import {
  addDays,
  istWeekStart,
  MEAL_SET,
  MEASUREMENTS_SET,
  SAVED_MEAL_SET,
  SETTING_SET,
  TARGET_SET,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type IstDay,
  type LengthUnit,
  type MealTotals,
  type TargetKind,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { LogMealButton } from '../components/LogMealButton';
import { MeasurementsCard } from '../components/MeasurementsCard';
import { MeasurementsSheet } from '../components/MeasurementsSheet';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { QuickTile } from '../components/QuickTile';
import { RejectedChanges } from '../components/RejectedChanges';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WeekStrip } from '../components/WeekStrip';
import { WorkoutDaySheet } from '../components/WorkoutDaySheet';
import { WorkoutTracker } from '../components/WorkoutTracker';
import { Text, TextButton } from '../components/ui';
import { DAY_VALUE_ORDER, dayValues, type DayValueKind } from '../dayValues';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import {
  dayNutrition,
  getEntry,
  getMeta,
  listEntries,
  listTargets,
  mealCounts,
  rejectedChanges,
  type LocalMeasurements,
  type OutboxEntry,
  type SyncState,
} from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';
import { LogOut } from './LogOut';

type Sheet = { kind: DayValueKind; day: IstDay; initial: number | null };
type DayValues = Partial<Record<DayValueKind, { value: number; syncState: SyncState }>>;
type Targets = Partial<Record<TargetKind, number>>;

// Home (REQ-HOME-*): the selected day's data. The date, the calendar and the avatar are in the
// tabs' common header (REQ-NAV-002).
export function HomeScreen() {
  const styles = useStyles();
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
  const [measurementsSheet, setMeasurementsSheet] = useState<{ mode: 'add' | 'edit'; day: IstDay } | null>(null);
  const measurementsOpen = measurementsSheet !== null;
  const [eaten, setEaten] = useState<MealTotals | null>(null);
  const [mealDays, setMealDays] = useState<ReadonlySet<IstDay>>(new Set());
  const [weekWorkouts, setWeekWorkouts] = useState<{ id: string; day: IstDay; exercises: WorkoutExercise[] }[]>([]);
  // The tracker's day whose workouts are being chosen from, or started (D-34).
  const [workoutDay, setWorkoutDay] = useState<IstDay | null>(null);

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
    const monday = istWeekStart(selected);
    void Promise.all([
      Promise.all(DAY_VALUE_ORDER.map((kind) => getEntry(db, kind, selected))),
      rejectedChanges(db),
      listTargets(db),
      getEntry(db, 'measurements', selected),
      getMeta(db, 'measurement_unit'),
      dayNutrition(db, selected),
      mealCounts(db, stripStart, addDays(stripStart, 6)),
      listEntries(db, 'workout', monday, addDays(monday, 6)),
    ]).then(([entries, waiting, current, dayMeasurements, unit, nutrition, counts, workouts]) => {
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
      // A target applies to every day shown, past days included (Q-014 MVP default, D-23).
      setTargets(Object.fromEntries(current.map((target) => [target.kind, target.value])));
      setMeasurements(dayMeasurements);
      setLengthUnit(unit === 'in' ? 'in' : 'cm');
      setEaten(nutrition);
      setMealDays(new Set(Object.keys(counts)));
      // Every workout on the phone in the selected date's week counts, an empty one too (Q-025), and
      // a day's dot shows once it has any (REQ-HOME-007; MVP default, D-29).
      setWeekWorkouts(workouts.map(({ id, day, exercises }) => ({ id, day, exercises })));
    });
    return () => {
      active = false;
    };
    // Read again when the measurements sheet closes: its cm/in choice may have changed.
  }, [local.state, selected, stripStart, sync.version, measurementsOpen, texts]);

  const workoutCounts: Record<IstDay, number> = {};
  for (const workout of weekWorkouts) workoutCounts[workout.day] = (workoutCounts[workout.day] ?? 0) + 1;

  /** A tracker day: its one workout opens; with several, or none, the day's sheet (D-34). */
  function openWorkoutDay(day: IstDay) {
    const onDay = weekWorkouts.filter((workout) => workout.day === day);
    if (onDay.length === 1) router.push(`/workout/${onDay[0]!.id}`);
    else setWorkoutDay(day);
  }

  /** A new workout on that day, saved at once and opened, as Training's "Start an empty workout". */
  async function startWorkout(day: IstDay) {
    const id = await sync.startWorkout(day);
    router.push(`/workout/${id}`);
  }

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
  }

  // Never run unencrypted (ADR-0007 rule 5): stop, and leave only Log out.
  if (local.state.status === 'failed') {
    return (
      <View style={styles.stopped}>
        <Text accessibilityRole="alert">
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
      <ScrollView contentContainerStyle={styles.content}>
        <WeekStrip
          today={today}
          firstDay={firstDay}
          selected={selected}
          start={stripStart}
          mealDays={mealDays}
          onSelect={select}
          onShow={showDays}
        />
        {selected !== today ? (
          <View style={styles.banner}>
            <Text style={styles.body}>Showing {formatDay(selected)}</Text>
            <TextButton title="Back to today" onPress={() => select(today)} />
          </View>
        ) : null}
        <RejectedChanges entries={rejected} onEdit={editRejected} onDiscard={(changeId) => void sync.discard(changeId)} />
        {/* The day's food against its targets: the panel Home leads with. */}
        <View style={styles.panel}>
          <TargetProgressCard
            title="Calories"
            unit="kcal"
            eaten={Math.round(eaten?.kcal ?? 0)}
            target={targets.calories ?? null}
            onSetTarget={openTargets}
          />
          <TargetProgressCard
            title="Protein"
            unit="g"
            eaten={Math.round(eaten?.proteinG ?? 0)}
            target={targets.protein ?? null}
            onSetTarget={openTargets}
          />
          <View style={styles.panelFoot}>
            <TextButton title="By meal" onPress={() => router.push({ pathname: '/nutrition', params: { tab: 'consumed' } })} />
          </View>
        </View>
        <View style={styles.tiles}>
          {DAY_VALUE_ORDER.map((kind) => {
            const entry = values[kind];
            return (
              <QuickTile
                key={kind}
                label={texts[kind].label}
                value={entry ? texts[kind].format(entry.value) : null}
                syncState={entry?.syncState ?? null}
                onPress={() => setSheet({ kind, day: selected, initial: entry?.value ?? null })}
              />
            );
          })}
        </View>
        <WorkoutTracker
          day={selected}
          today={today}
          dayCounts={workoutCounts}
          count={weekWorkouts.length}
          target={targets.weekly_workouts ?? null}
          onSetTarget={openTargets}
          onDay={openWorkoutDay}
        />
        <MeasurementsCard
          day={selected}
          entry={measurements}
          unit={lengthUnit}
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
        {workoutDay ? (
          <WorkoutDaySheet
            day={workoutDay}
            workouts={weekWorkouts.filter((workout) => workout.day === workoutDay)}
            onOpen={(id) => router.push(`/workout/${id}`)}
            onStart={() => void startWorkout(workoutDay)}
            onClose={() => setWorkoutDay(null)}
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

const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  // 24 between groups, 12 within one.
  content: { padding: 16, gap: 24, paddingBottom: 96 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.warningSurface,
  },
  body: { fontSize: 15 },
  panel: { padding: 20, borderRadius: 16, backgroundColor: c.surface, gap: 12 },
  panelFoot: { paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  tiles: { flexDirection: 'row', gap: 12 },
  stopped: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
}));
