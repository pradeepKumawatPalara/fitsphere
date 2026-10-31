import {
  addDays,
  MAX_LIST_LIMIT,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type MeResponse,
  type Workout,
  type WorkoutsPage,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, FlatList, Pressable, View } from 'react-native';
import { callApi } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { RejectedChanges } from '../components/RejectedChanges';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries, rejectedChanges, type OutboxEntry, type SyncState } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';
import { workoutSummary } from '../workouts';

const CHUNK_DAYS = 90;

/** A row of the history: a workout on the phone, or an older one read from the server. */
type Row = { id: string; day: string; exercises: Workout['exercises']; syncState: SyncState | null };

// The Training tab (REQ-TRN-002…004). No one can send a training plan in the MVP, so it always
// shows "No training plan yet" (D-20), then "Start an empty workout" and the workouts the user has
// logged: the last 90 IST days from the phone, and older ones read from the server online, 90 days
// at a time, view-only (ADR-0007 rules 1 and 6; MVP default, D-29).
export function TrainingScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const { today, selected, firstDay } = useSelectedDay();
  const [recent, setRecent] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [older, setOlder] = useState<Row[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(firstDay);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([listEntries(db, 'workout', firstDay, today), rejectedChanges(db)]).then(([workouts, waiting]) => {
      if (!active) return;
      setRecent(workouts.map(({ id, day, exercises, syncState }) => ({ id, day, exercises, syncState })));
      setRejected(waiting.filter((change) => change.type === WORKOUT_SET || change.type === WORKOUT_DELETE));
    });
    return () => {
      active = false;
    };
  }, [local.state, firstDay, today, sync.version]);

  function open(id: string) {
    router.push(`/workout/${id}`);
  }

  /** A new workout on the selected date (as Q-011), saved at once; it counts already (Q-025). */
  async function start() {
    setBusy(true);
    const id = await sync.startWorkout(selected);
    setBusy(false);
    open(id);
  }

  async function loadOlder() {
    setBusy(true);
    setMessage(null);
    const to = addDays(oldestLoaded, -1);
    const from = addDays(to, -(CHUNK_DAYS - 1));
    const result = await fetchOlder(from, to);
    setBusy(false);
    if (result === 'offline') {
      setMessage(TEXTS.needsInternet('Loading older workouts'));
      return;
    }
    if (result === 'failed') {
      setMessage(TEXTS.tryLater);
      return;
    }
    setOlder((rows) => [...rows, ...result]);
    setOldestLoaded(from);
    if (result.length === 0) setMessage(`No workouts from ${formatDay(from)} to ${formatDay(to)}.`);
  }

  async function fetchOlder(from: string, to: string): Promise<Row[] | 'offline' | 'failed'> {
    const session = (await deps.client.getSession()).data.session;
    if (!session) return 'failed';
    const options = { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
    const me = await callApi<MeResponse>(deps.apiUrl, '/me', options);
    if (me.kind !== 'ok') return me.kind === 'offline' ? 'offline' : 'failed';
    const page = await callApi<WorkoutsPage>(
      deps.apiUrl,
      `/users/${me.body.user.id}/workouts?from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}`,
      options,
    );
    if (page.kind !== 'ok') return page.kind === 'offline' ? 'offline' : 'failed';
    // The server sends oldest first; the history shows newest first.
    return [...page.body.items].reverse().map(({ id, day, exercises }) => ({ id, day, exercises, syncState: null }));
  }

  return (
    <FlatList
      data={[...recent, ...older]}
      keyExtractor={(row) => row.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.plan}>
            <Text style={styles.planText}>No training plan yet.</Text>
          </View>
          <Button title="Start an empty workout" disabled={busy} onPress={() => void start()} />
          <RejectedChanges
            entries={rejected}
            onEdit={(entry) => open(String((entry.data as { id?: unknown }).id))}
            onDiscard={(changeId) => void sync.discard(changeId)}
          />
          <Text accessibilityRole="header" style={styles.heading}>
            Workouts you have logged
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const label = `${formatDay(item.day)}: ${workoutSummary(item.exercises)}`;
        const note = item.syncState === 'pending' ? 'waiting to sync' : item.syncState === 'rejected' ? 'not saved' : null;
        const content = (
          <>
            <Text style={styles.day}>{formatDay(item.day)}</Text>
            <Text>{workoutSummary(item.exercises)}</Text>
            {note ? <Text style={item.syncState === 'rejected' ? styles.problem : styles.note}>{note}</Text> : null}
          </>
        );
        // Older workouts are read from the server and only viewed (MVP default, D-29).
        return item.syncState === null ? (
          <View accessibilityLabel={label} style={styles.row}>
            {content}
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => open(item.id)} style={styles.row}>
            {content}
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={styles.note}>No workouts logged yet.</Text>}
      ListFooterComponent={
        <View style={styles.footer}>
          {message ? <Text accessibilityRole="alert">{message}</Text> : null}
          <Button title="Load older" disabled={busy} onPress={() => void loadOlder()} />
        </View>
      }
    />
  );
}

const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 8 },
  header: { gap: 12, paddingBottom: 4 },
  plan: { padding: 16, borderRadius: 12, backgroundColor: c.surface },
  planText: { fontSize: 16 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  row: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.border, gap: 2 },
  day: { fontWeight: '600' },
  note: { color: c.textMuted },
  problem: { color: c.error },
  footer: { paddingTop: 8, gap: 12 },
}));
