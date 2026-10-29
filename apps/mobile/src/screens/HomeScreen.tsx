import { istToday, istWeekStart } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { ApiStatus } from '../components/ApiStatus';
import { EntrySheet } from '../components/EntrySheet';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { LocalDatabaseCheck } from '../components/LocalDatabaseCheck';
import { RejectedChanges } from '../components/RejectedChanges';
import { TodayIst } from '../components/TodayIst';
import { WeekStrip } from '../components/WeekStrip';
import { WeightTile } from '../components/WeightTile';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getWeighIn, rejectedChanges, type LocalWeighIn, type OutboxEntry } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { LogOut } from './LogOut';

type Sheet = { day: string; initialGrams: number | null };

export function HomeScreen({ now = () => new Date(), showDevTools = __DEV__ }: { now?: () => Date; showDevTools?: boolean }) {
  const { deps, email } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const today = istToday(now());
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState(() => istWeekStart(today));
  const [weighIn, setWeighIn] = useState<LocalWeighIn | null>(null);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void ensureAccount(deps).then((state) => {
      if (!active) return;
      if (state.kind === 'ready') setAccountEmail(state.me.user.email);
      else if (state.kind === 'needsAgeConfirmation') router.replace('/account-setup');
      else if (state.kind === 'signedOut') router.replace('/sign-in');
      // Offline or unavailable: stay on Home with the session's email.
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

  function backToToday() {
    setSelected(today);
    setWeekStart(istWeekStart(today));
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
      <WeekStrip today={today} selected={selected} weekStart={weekStart} onSelect={setSelected} onWeekChange={setWeekStart} />
      {selected !== today ? (
        <View style={styles.banner}>
          <Text>Showing {formatDay(selected)}</Text>
          <Button title="Back to today" onPress={backToToday} />
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
      <Button title="Weight history" onPress={() => router.push('/history')} />
      <Text>Signed in as {accountEmail ?? email}</Text>
      <LogOut />
      {showDevTools ? (
        <View style={styles.dev}>
          <TodayIst />
          <Text>Sync: {sync.status}</Text>
          <ApiStatus apiUrl={deps.apiUrl} check={checkApiHealth} />
          <LocalDatabaseCheck />
          <Button title="200-row list (development)" onPress={() => router.push('/dev-history')} />
          <ExpiredTokenTest deps={deps} />
        </View>
      ) : null}
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
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 16 },
});
