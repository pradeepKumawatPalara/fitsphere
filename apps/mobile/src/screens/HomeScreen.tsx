import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { EntrySheet } from '../components/EntrySheet';
import { RejectedChanges } from '../components/RejectedChanges';
import { WeekStrip } from '../components/WeekStrip';
import { WeightTile } from '../components/WeightTile';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getWeighIn, rejectedChanges, type LocalWeighIn, type OutboxEntry } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { LogOut } from './LogOut';

type Sheet = { day: string; initialGrams: number | null };

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
    void Promise.all([getWeighIn(db, selected), rejectedChanges(db)]).then(([day, waiting]) => {
      if (!active) return;
      setWeighIn(day);
      setRejected(waiting);
    });
    return () => {
      active = false;
    };
  }, [local.state, selected, sync.version]);

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
      <WeightTile
        weighIn={weighIn}
        onPress={() => setSheet({ day: selected, initialGrams: weighIn?.weightGrams ?? null })}
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
