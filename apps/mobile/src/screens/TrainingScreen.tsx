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
import { Calendar, ChevronDown, ClipboardList, ClockArrowDown, Plus, SquarePen, Trash, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { callApi } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { CalendarSheet } from '../components/CalendarSheet';
import { ConfirmSheet } from '../components/MealSheets';
import { RejectedChanges } from '../components/RejectedChanges';
import { Banner, IconButton, Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries, rejectedChanges, type OutboxEntry, type SyncState } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { workoutSummary } from '../workouts';

const CHUNK_DAYS = 90;

/** A workout of the history: one on the phone, or an older one read from the server. */
type Row = { id: string; day: string; exercises: Workout['exercises']; recordedAt: string; syncState: SyncState | null };

/** What "Load older" says: that a range was empty (info), or why it could not load (error). */
type Message = { text: string; tone: 'info' | 'error'; offline?: boolean };

/** The history's cards: one per date, newest first, holding that date's workouts in the order they were started (D-34). */
export function byDate(rows: readonly Row[]): { day: string; workouts: Row[] }[] {
  const days = new Map<string, Row[]>();
  for (const row of rows) days.set(row.day, [...(days.get(row.day) ?? []), row]);
  return [...days].map(([day, workouts]) => ({ day, workouts: [...workouts].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) }));
}

// The Training tab (REQ-TRN-002…004). No one can send a training plan in the MVP, so it always
// shows "No training plan yet" (D-20), then "Log workout" (D-37) and the workouts the user has
// logged: the last 90 IST days from the phone, and older ones read from the server online, 90 days
// at a time, view-only (ADR-0007 rules 1 and 6; MVP default, D-29). Each date's card lists its
// workouts ("Workout 1", "Workout 2"…), each with edit and delete, and "Log another workout" on that
// date (D-42). A date chip above Log workout, as Log meal's, picks the day it logs to: it sets the
// app's selected date, so the header shows the same day (D-43).
export function TrainingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const { today, selected, firstDay, select } = useSelectedDay();
  const [recent, setRecent] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [older, setOlder] = useState<Row[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(firstDay);
  const [message, setMessage] = useState<Message | null>(null);
  // The workout being deleted, once asked (D-42).
  const [deleting, setDeleting] = useState<{ id: string; day: string; name: string } | null>(null);
  // The calendar of the date chip (D-43).
  const [choosingDay, setChoosingDay] = useState(false);
  // Each button fades only while its own action runs.
  const [starting, setStarting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([listEntries(db, 'workout', firstDay, today), rejectedChanges(db)]).then(([workouts, waiting]) => {
      if (!active) return;
      setRecent(workouts.map(({ id, day, exercises, recordedAt, syncState }) => ({ id, day, exercises, recordedAt, syncState })));
      setRejected(waiting.filter((change) => change.type === WORKOUT_SET || change.type === WORKOUT_DELETE));
    });
    return () => {
      active = false;
    };
  }, [local.state, firstDay, today, sync.version]);

  function open(id: string) {
    router.push(`/workout/${id}`);
  }

  /** A new workout on `day`, by default the selected date (as Q-011), saved at once; it counts once it has an exercise (D-41). */
  async function start(day: string = selected) {
    setStarting(true);
    const id = await sync.startWorkout(day);
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
    return [...page.body.items].reverse().map(({ id, day, exercises, recordedAt }) => ({ id, day, exercises, recordedAt, syncState: null }));
  }

  const days = byDate([...recent, ...older]);

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Date: ${formatDay(selected)}`}
              onPress={() => setChoosingDay(true)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Calendar size={18} color={colors.accent} />
              <Text style={styles.chipText}>{selected === today ? `Today, ${formatDay(selected)}` : formatDay(selected)}</Text>
              <ChevronDown size={18} strokeWidth={2.25} color={colors.accent} />
            </Pressable>
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
          // One card per date (D-34), each workout on its own row with edit and delete (D-42).
          // Older workouts are read from the server and only viewed (MVP default, D-29).
          const viewOnly = workouts.every((workout) => workout.syncState === null);
          const [weekday, date, month] = formatDay(day).split(' ');
          return (
            <View
              accessibilityLabel={`${formatDay(day)}: ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`}
              style={[styles.card, viewOnly && styles.cardViewOnly]}
            >
              <View style={styles.dateBlock} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                <Text style={styles.weekday}>{weekday}</Text>
                <Text style={styles.date}>{date}</Text>
                <Text style={styles.month}>{month}</Text>
              </View>
              <View style={styles.rows}>
                {workouts.map((workout, index) => {
                  const name = `Workout ${index + 1}`;
                  const summary = workoutSummary(workout.exercises);
                  const rejected = workout.syncState === 'rejected';
                  const note = rejected ? 'not saved' : workout.syncState === 'pending' ? 'waiting to sync' : null;
                  const text = (
                    <>
                      <Text style={styles.name}>{name}</Text>
                      <Text numberOfLines={1} style={styles.summary}>
                        {summary}
                      </Text>
                      {note ? (
                        <View style={styles.noteLine}>
                          <View style={[styles.dot, rejected && styles.dotProblem]} />
                          <Text style={[styles.note, rejected && styles.problem]}>{note}</Text>
                        </View>
                      ) : null}
                    </>
                  );
                  return (
                    <View key={workout.id} style={[styles.row, index > 0 && styles.ruled]}>
                      {viewOnly ? (
                        <View accessibilityLabel={`${formatDay(day)}, ${name}: ${summary}`} style={styles.rowText}>
                          {text}
                        </View>
                      ) : (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${formatDay(day)}, ${name}: ${summary}`}
                            onPress={() => open(workout.id)}
                            style={({ pressed }) => [styles.rowText, pressed && styles.pressed]}
                          >
                            {text}
                          </Pressable>
                          <IconButton label={`Edit ${name} on ${formatDay(day)}`} onPress={() => open(workout.id)}>
                            <SquarePen size={20} color={colors.accent} />
                          </IconButton>
                          <IconButton label={`Delete ${name} on ${formatDay(day)}`} onPress={() => setDeleting({ id: workout.id, day, name })}>
                            <Trash size={20} color={colors.danger} />
                          </IconButton>
                        </>
                      )}
                    </View>
                  );
                })}
                {viewOnly ? null : (
                  <TextButton title="Log another workout" icon={Plus} disabled={starting} onPress={() => void start(day)} />
                )}
              </View>
            </View>
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
      {choosingDay ? (
        <CalendarSheet
          title="Log this workout to"
          today={today}
          firstDay={firstDay}
          selected={selected}
          onSelect={select}
          onClose={() => setChoosingDay(false)}
        />
      ) : null}
      {deleting ? (
        <ConfirmSheet
          title="Delete workout?"
          message={`Delete ${deleting.name} on ${formatDay(deleting.day)}? It leaves your history and your weekly count.`}
          cancelLabel="Keep"
          confirmLabel="Delete"
          onConfirm={() => void sync.remove('workout', deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

// The redesign's 4.1 (locked by the owner, 2026-11-03; each workout's row locked 2026-11-04): the
// plan's message in a card with its tile, as Nutrition's diet plan (3.4); the date a raised chip, as
// Log meal's (D-43); Log workout the filled main action; each date a raised card with a date block and its workouts as ruled rows, each its name in
// condensed capitals over its exercises, with a pencil and a red bin, and "Log another workout"
// under them; older workouts, view-only, on the plain card colour with no icons; Load older outlined
// across the screen, its message as a banner.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 12 },
  header: { gap: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 4, backgroundColor: c.surface },
  planTile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  planText: { flexShrink: 1, fontSize: 15, lineHeight: 22 },
  heading: { ...TYPE.label, marginTop: 12, color: c.inkMuted },
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  chipText: { ...TYPE.buttonSecondary, fontSize: 16, letterSpacing: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 4,
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
  rows: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...TYPE.metric, fontSize: 17, lineHeight: 20, letterSpacing: 0.5, textTransform: 'uppercase' },
  summary: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  note: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  problem: { color: c.danger },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  footer: { paddingTop: 8, gap: 12 },
}));
