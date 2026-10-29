import type { IstDay, TargetKind } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { EntrySheet } from '../components/EntrySheet';
import { RejectedChanges } from '../components/RejectedChanges';
import { TargetProgressCard } from '../components/TargetProgressCard';
import { WeekStrip } from '../components/WeekStrip';
import { WeightTile } from '../components/WeightTile';
import { WorkoutTracker } from '../components/WorkoutTracker';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getWeighIn, listTargets, rejectedChanges, type LocalWeighIn, type OutboxEntry } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { LogOut } from './LogOut';

type Sheet = { day: string; initialGrams: number | null };
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
  const [weighIn, setWeighIn] = useState<LocalWeighIn | null>(null);
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
    void Promise.all([getWeighIn(db, selected), rejectedChanges(db), listTargets(db)]).then(([day, waiting, current]) => {
      if (!active) return;
      setWeighIn(day);
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
      <RejectedChanges
        entries={rejected}
        onEdit={(day) => {
          const entry = rejected.find((item) => (item.data as { day: string }).day === day);
          setSheet({ day, initialGrams: (entry?.data as { weightGrams?: number } | undefined)?.weightGrams ?? null });
        }}
        onDiscard={(changeId) => void sync.discard(changeId)}
      />
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
      <WeightTile
        weighIn={weighIn}
        onPress={() => setSheet({ day: selected, initialGrams: weighIn?.weightGrams ?? null })}
      />
      <WorkoutTracker
        day={selected}
        workoutDays={NO_WORKOUT_DAYS}
        count={NO_WORKOUT_DAYS.length}
        target={targets.weekly_workouts ?? null}
        onSetTarget={openTargets}
      />
      {sheet ? (
        <EntrySheet
          day={sheet.day}
          initialGrams={sheet.initialGrams}
          onSave={(grams) => sync.saveWeight(sheet.day, grams)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 8, backgroundColor: '#fff4d6' },
  stopped: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
});
