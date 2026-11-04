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
import { ChevronRight, ClipboardList, ClockArrowDown, Plus, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { callApi } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { RejectedChanges } from '../components/RejectedChanges';
import { WorkoutDaySheet } from '../components/WorkoutDaySheet';
import { Banner, Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries, rejectedChanges, type OutboxEntry, type SyncState } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { workoutParts, workoutSummary } from '../workouts';

const CHUNK_DAYS = 90;

/** A workout of the history: one on the phone, or an older one read from the server. */
type Row = { id: string; day: string; exercises: Workout['exercises']; syncState: SyncState | null };

/** What "Load older" says: that a range was empty (info), or why it could not load (error). */
type Message = { text: string; tone: 'info' | 'error'; offline?: boolean };

/** The history's cards: one per date, holding that date's workouts in order (D-34). */
export function byDate(rows: readonly Row[]): { day: string; workouts: Row[] }[] {
  const days = new Map<string, Row[]>();
  for (const row of rows) days.set(row.day, [...(days.get(row.day) ?? []), row]);
  return [...days].map(([day, workouts]) => ({ day, workouts }));
}

// The Training tab (REQ-TRN-002…004). No one can send a training plan in the MVP, so it always
// shows "No training plan yet" (D-20), then "Log workout" (D-37) and the workouts the user has
// logged: the last 90 IST days from the phone, and older ones read from the server online, 90 days
// at a time, view-only (ADR-0007 rules 1 and 6; MVP default, D-29).
export function TrainingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const { today, selected, firstDay } = useSelectedDay();
  const [recent, setRecent] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [older, setOlder] = useState<Row[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(firstDay);
  const [message, setMessage] = useState<Message | null>(null);
  // The date whose workouts are being chosen from, when it has more than one (D-34).
  const [chooser, setChooser] = useState<string | null>(null);
  // Each button fades only while its own action runs.
  const [starting, setStarting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

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

  /** A new workout on the selected date (as Q-011), saved at once; it counts once it has an exercise (D-41). */
  async function start() {
    setStarting(true);
    const id = await sync.startWorkout(selected);
    setStarting(false);
    open(id);
  }

  async function loadOlder() {
    setLoadingOlder(true);
    setMessage(null);
    const to = addDays(oldestLoaded, -1);
    const from = addDays(to, -(CHUNK_DAYS - 1));
    const result = await fetchOlder(from, to);
    setLoadingOlder(false);
    if (result === 'offline') {
      setMessage({ text: TEXTS.needsInternet('Loading older workouts'), tone: 'error', offline: true });
      return;
    }
    if (result === 'failed') {
      setMessage({ text: TEXTS.tryLater, tone: 'error' });
      return;
    }
    setOlder((rows) => [...rows, ...result]);
    setOldestLoaded(from);
    if (result.length === 0) setMessage({ text: `No workouts from ${formatDay(from)} to ${formatDay(to)}.`, tone: 'info' });
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

  const days = byDate([...recent, ...older]);
  const chosen = days.find((group) => group.day === chooser);

  return (
    <>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={days}
        keyExtractor={(group) => group.day}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.plan}>
              <View style={styles.planTile}>
                <ClipboardList size={24} color={colors.accent} />
              </View>
              <Text style={styles.planText}>No training plan yet.</Text>
            </View>
            <TextButton title="Log workout" filled icon={Plus} disabled={starting} onPress={() => void start()} />
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
        renderItem={({ item: { day, workouts } }) => {
          // One card per date: every exercise of the date's workouts together (D-34).
          const exercises = workouts.flatMap((workout) => workout.exercises);
          const summary = workoutSummary(exercises);
          const { count: exerciseCount, names } = workoutParts(exercises);
          const count = workouts.length > 1 ? `${workouts.length} workouts` : null;
          const label = `${formatDay(day)}: ${count ? `${count} · ` : ''}${summary}`;
          const rejected = workouts.some((workout) => workout.syncState === 'rejected');
          const note = rejected ? 'not saved' : workouts.some((workout) => workout.syncState === 'pending') ? 'waiting to sync' : null;
          // Older workouts are read from the server and only viewed (MVP default, D-29).
          const viewOnly = workouts.every((workout) => workout.syncState === null);
          const [weekday, date, month] = formatDay(day).split(' ');
          const content = (
            <>
              <View style={styles.dateBlock}>
                <Text style={styles.weekday}>{weekday}</Text>
                <Text style={styles.date}>{date}</Text>
                <Text style={styles.month}>{month}</Text>
              </View>
              <View style={styles.text}>
                <View style={styles.countLine}>
                  <Text style={styles.count}>{exerciseCount}</Text>
                  {count ? <Text style={styles.tag}>{count}</Text> : null}
                </View>
                {names ? (
                  <Text numberOfLines={1} style={styles.names}>
                    {names}
                  </Text>
                ) : null}
                {note ? (
                  <View style={styles.noteLine}>
                    <View style={[styles.dot, rejected && styles.dotProblem]} />
                    <Text style={[styles.note, rejected && styles.problem]}>{note}</Text>
                  </View>
                ) : null}
              </View>
              {viewOnly ? null : <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} />}
            </>
          );
          return viewOnly ? (
            <View accessibilityLabel={label} style={[styles.card, styles.cardViewOnly]}>
              {content}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => (workouts.length === 1 ? open(workouts[0]!.id) : setChooser(day))}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {content}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No workouts logged yet.</Text>}
        ListFooterComponent={
          <View style={styles.footer}>
            {message ? <Banner tone={message.tone} text={message.text} {...(message.offline ? { icon: WifiOff } : {})} /> : null}
            <TextButton title="Load older" outlined wide icon={ClockArrowDown} disabled={loadingOlder} onPress={() => void loadOlder()} />
          </View>
        }
      />
      {chosen ? <WorkoutDaySheet day={chosen.day} workouts={chosen.workouts} onOpen={open} onClose={() => setChooser(null)} /> : null}
    </>
  );
}

// The redesign's 4.1 (locked by the owner, 2026-11-03): the plan's message in a card with its tile,
// as Nutrition's diet plan (3.4); Log workout the filled main action; each date a raised card with a
// date block, the exercises in condensed capitals and their names under them, and a chevron when it
// opens; older workouts, view-only, on the plain card colour with no chevron; Load older outlined
// across the screen, its message as a banner.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 12 },
  header: { gap: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 4, backgroundColor: c.surface },
  planTile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  planText: { flexShrink: 1, fontSize: 15, lineHeight: 22 },
  heading: { ...TYPE.label, marginTop: 12, color: c.inkMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  cardViewOnly: { backgroundColor: c.surface },
  pressed: { opacity: 0.6 },
  dateBlock: { width: 54, height: 62, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  weekday: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1, color: c.inkMuted },
  date: { ...TYPE.metric, fontSize: 26, lineHeight: 28 },
  month: { ...TYPE.label, fontSize: 11, lineHeight: 13, letterSpacing: 1, color: c.accent },
  text: { flex: 1, gap: 3 },
  countLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  count: { ...TYPE.metric, fontSize: 18, lineHeight: 20, textTransform: 'uppercase' },
  tag: {
    ...TYPE.label,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: c.accentTint,
    color: c.accent,
  },
  names: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  note: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  problem: { color: c.danger },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  footer: { paddingTop: 8, gap: 12 },
}));
