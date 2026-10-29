import { TARGET_SET, type IstDay, type TargetKind } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { QuickTile } from '../components/QuickTile';
import { RejectedChanges } from '../components/RejectedChanges';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WeekStrip } from '../components/WeekStrip';
import { WorkoutTracker } from '../components/WorkoutTracker';
import { DAY_VALUE_ORDER, DAY_VALUES, type DayValueKind } from '../dayValues';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listTargets, rejectedChanges, type OutboxEntry, type SyncState } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { LogOut } from './LogOut';

type Sheet = { kind: DayValueKind; day: IstDay; initial: number | null };
type DayValues = Partial<Record<DayValueKind, { value: number; syncState: SyncState }>>;
type Targets = Partial<Record<TargetKind, number>>;

// Meals come with slice 3 and workouts with slice 4 (D-23): until then nothing is eaten and no
// workout is logged.
const NOTHING_EATEN = { kcal: 0, proteinGrams: 0 };
const NO_WORKOUT_DAYS: readonly IstDay[] = [];

// Home (REQ-HOME-*): the selected day's data. The date, the calendar and the avatar are in the
// tabs' common header (REQ-NAV-002).
export function HomeScreen() {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const { today, selected, firstDay, weekStart, select, showWeek } = useSelectedDay();
  const [values, setValues] = useState<DayValues>({});
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [targets, setTargets] = useState<Targets>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);

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
      listTargets(db),
    ]).then(([entries, waiting, current]) => {
      if (!active) return;
      setValues(
        Object.fromEntries(
          DAY_VALUE_ORDER.flatMap((kind, index) => {
            const entry = entries[index] as (Record<string, unknown> & { syncState: SyncState }) | null | undefined;
            return entry ? [[kind, { value: Number(entry[DAY_VALUES[kind].field]), syncState: entry.syncState }]] : [];
          }),
        ),
      );
      setRejected(waiting);
      // A target applies to every day shown, past days included (Q-014 MVP default, D-23).
      setTargets(Object.fromEntries(current.map((target) => [target.kind, target.value])));
    });
    return () => {
      active = false;
    };
  }, [local.state, selected, sync.version]);

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
    const kind = DAY_VALUE_ORDER.find((candidate) => DAY_VALUES[candidate].changeType === entry.type);
    if (kind) setSheet({ kind, day: String(data.day), initial: Number(data[DAY_VALUES[kind].field]) });
    else if (entry.type === TARGET_SET) openTargets();
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

  const sheetText = sheet ? DAY_VALUES[sheet.kind] : null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <WeekStrip
        today={today}
        firstDay={firstDay}
        selected={selected}
        weekStart={weekStart}
        onSelect={select}
        onWeekChange={showWeek}
      />
      {selected !== today ? (
        <View style={styles.banner}>
          <Text>Showing {formatDay(selected)}</Text>
          <Button title="Back to today" onPress={() => select(today)} />
        </View>
      ) : null}
      <RejectedChanges entries={rejected} onEdit={editRejected} onDiscard={(changeId) => void sync.discard(changeId)} />
      <TargetProgressCard
        title="Calories"
        unit="kcal"
        eaten={NOTHING_EATEN.kcal}
        target={targets.calories ?? null}
        onSetTarget={openTargets}
      />
      <TargetProgressCard
        title="Protein"
        unit="g"
        eaten={NOTHING_EATEN.proteinGrams}
        target={targets.protein ?? null}
        onSetTarget={openTargets}
      />
      <View style={styles.tiles}>
        {DAY_VALUE_ORDER.map((kind) => {
          const entry = values[kind];
          return (
            <QuickTile
              key={kind}
              label={DAY_VALUES[kind].label}
              value={entry ? DAY_VALUES[kind].format(entry.value) : null}
              syncState={entry?.syncState ?? null}
              onPress={() => setSheet({ kind, day: selected, initial: entry?.value ?? null })}
            />
          );
        })}
      </View>
      <WorkoutTracker
        day={selected}
        workoutDays={NO_WORKOUT_DAYS}
        count={NO_WORKOUT_DAYS.length}
        target={targets.weekly_workouts ?? null}
        onSetTarget={openTargets}
      />
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
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, backgroundColor: '#fff4d6' },
  tiles: { flexDirection: 'row', gap: 8 },
  stopped: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
});
