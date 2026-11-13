import {
  addDays,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type IstDay,
  type Workout,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClockArrowDown,
  Dumbbell,
  Flame,
  History,
  List,
  Pause,
  Plus,
  SquarePen,
  Trash,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNow } from '../clock';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { ConfirmSheet } from '../components/MealSheets';
import { RejectedChanges } from '../components/RejectedChanges';
import { WeekStrip } from '../components/WeekStrip';
import { Banner, IconButton, Text, TextButton, useChoiceStyles } from '../components/ui';
import { formatDay, formatInteger, formatMonth } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries, rejectedChanges, type OutboxEntry, type SyncState } from '../local/store';
import { useSelectedDay } from '../navigation/SelectedDayProvider';
import { fetchOlderWorkouts, OLDER_CHUNK_DAYS } from '../olderWorkouts';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { useWeekActivity } from '../weekActivity';
import { caloriesBurned, deleteWorkoutEffects, listedWorkouts, timerLine, timerState, workoutSummary } from '../workouts';

/** A workout of the history: one on the phone, or an older one read from the server. */
type Row = {
  id: string;
  day: string;
  exercises: Workout['exercises'];
  timer: Workout['timer'];
  recordedAt: string;
  syncState: SyncState | null;
};

/** What "Load older" says: that a range was empty (info), or why it could not load (error). */
type Message = { text: string; tone: 'info' | 'error'; offline?: boolean };

/** The two ways to see the workouts (D-65). */
type Shown = 'day' | 'all';
const SHOWN: { shown: Shown; label: string; icon: LucideIcon }[] = [
  { shown: 'day', label: 'By day', icon: CalendarDays },
  { shown: 'all', label: 'All workouts', icon: List },
];

/** The history's cards: one per date, newest first, holding that date's workouts in the order they were started (D-34). */
export function byDate(rows: readonly Row[]): { day: string; workouts: Row[] }[] {
  const days = new Map<string, Row[]>();
  for (const row of rows) days.set(row.day, [...(days.get(row.day) ?? []), row]);
  return [...days].map(([day, workouts]) => ({ day, workouts: [...workouts].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) }));
}

/** All workouts by month (D-65): newest first, each month (YYYY-MM) with its dates' cards. */
export function byMonth(rows: readonly Row[]): { month: string; days: { day: string; workouts: Row[] }[] }[] {
  const months = new Map<string, { day: string; workouts: Row[] }[]>();
  for (const group of byDate(rows)) {
    const month = group.day.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), group]);
  }
  return [...months].map(([month, days]) => ({ month, days }));
}

/** A folded month's line (D-65): "9 workouts on 8 days". */
export function monthSummary(days: readonly { workouts: readonly unknown[] }[]): string {
  const workouts = days.reduce((sum, day) => sum + day.workouts.length, 0);
  return `${workouts} ${workouts === 1 ? 'workout' : 'workouts'} on ${days.length} ${days.length === 1 ? 'day' : 'days'}`;
}

/**
 * What deleting a workout from its row asks (D-63): "Workout 2 on Tue 3 Nov will be deleted, with its
 * 2 exercises. It will no longer count in this week's workouts. You can't undo this."
 */
function deleteWorkoutMessage(workout: { day: string; name: string; exercises: number }, today: string): string {
  const { exercises, rest } = deleteWorkoutEffects(workout.exercises, workout.day, today);
  return `${workout.name} on ${formatDay(workout.day)} will be deleted${exercises ? `, with its ${exercises}` : ''}. ${rest}`;
}

// The Training tab (REQ-TRN-002…004). Since D-65 it opens on the date strip, as Home's and
// Nutrition's, with a green mark on each day with a workout, and two ways to see the workouts:
// "By day" (the first) shows only the selected date's workouts, under "Log workout for today" or
// "Log workout for Sat 31 Oct", which logs to that date; "All workouts" shows every workout the user
// has logged, a card per date as before (D-34, D-42), grouped by month: the newest month open, the
// others folded to one line ("October 2026 · 9 workouts on 8 days"). The last 90 IST days come from
// the phone, older ones from the server online, 90 days at a time, view-only (ADR-0007 rules 1 and
// 6; MVP default, D-29). A date picked on the strip or the header's calendar shows By day. Deleting a
// workout says what goes with it (D-63). A workout with no exercise is not listed, marked or counted,
// and the others are numbered without it (D-65). No "No training plan yet" card for now (D-65): no one
// can send a plan in the MVP (D-20). Each workout's row says its timer (D-71): "Running · 12:34",
// counting, "Paused · 31:08" or "Done · 52:40"; a workout whose timer has started is listed before
// its first exercise.
export function TrainingScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const { today, selected, firstDay, stripStart, select, showDays } = useSelectedDay();
  // The strip's week: an apple and a dumbbell under each day, as on Home (D-103; was a mark on workout days, D-65).
  const activity = useWeekActivity(stripStart);
  const [recent, setRecent] = useState<Row[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [older, setOlder] = useState<Row[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(firstDay);
  const [message, setMessage] = useState<Message | null>(null);
  const [shown, setShown] = useState<Shown>('day');
  // A date picked anywhere, the strip or the header's calendar, shows that date (D-65).
  const [dayShown, setDayShown] = useState(selected);
  if (dayShown !== selected) {
    setDayShown(selected);
    setShown('day');
  }
  // The months open in All workouts; until one is opened or folded, the newest (D-65).
  const [openMonths, setOpenMonths] = useState<ReadonlySet<string> | null>(null);
  // The workout being deleted, once asked (D-42).
  const [deleting, setDeleting] = useState<{ id: string; day: string; name: string; exercises: number } | null>(null);
  // Each button fades only while its own action runs.
  const [starting, setStarting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([listEntries(db, 'workout', firstDay, today), rejectedChanges(db)]).then(([workouts, waiting]) => {
      if (!active) return;
      setRecent(workouts.map(({ id, day, exercises, timer, recordedAt, syncState }) => ({ id, day, exercises, timer, recordedAt, syncState })));
      setRejected(waiting.filter((change) => change.type === WORKOUT_SET || change.type === WORKOUT_DELETE));
    });
    return () => {
      active = false;
    };
  }, [local.state, firstDay, today, sync.version]);

  // Workouts with no exercise are not listed, marked or counted (D-65).
  const listed = listedWorkouts(recent);
  const months = byMonth([...listed, ...listedWorkouts(older)]);
  const open = openMonths ?? new Set(months[0] ? [months[0].month] : []);
  const dayWorkouts = byDate(listed.filter((row) => row.day === selected))[0]?.workouts ?? [];
  // The rows draw again each second only while a timer runs (D-71).
  const clock = useNow(now, listed.some((row) => timerState(row.timer) === 'running'));

  function openWorkout(id: string) {
    router.push(`/workout/${id}`);
  }

  /** A new workout on `day`, saved at once; it counts once it has an exercise (D-41). */
  async function start(day: IstDay) {
    setStarting(true);
    const id = await sync.startWorkout(day);
    setStarting(false);
    openWorkout(id);
  }

  function pickDay(day: IstDay) {
    select(day);
    setShown('day');
  }

  function toggleMonth(month: string) {
    const next = new Set(open);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    setOpenMonths(next);
  }

  async function loadOlder() {
    setLoadingOlder(true);
    setMessage(null);
    const to = addDays(oldestLoaded, -1);
    const from = addDays(to, -(OLDER_CHUNK_DAYS - 1));
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
    // The newest month just loaded opens, so what came is in sight (D-65).
    const newest = result[0];
    if (newest) setOpenMonths(new Set([...open, newest.day.slice(0, 7)]));
    else setMessage({ text: `No workouts from ${formatDay(from)} to ${formatDay(to)}.`, tone: 'info' });
  }

  async function fetchOlder(from: IstDay, to: IstDay): Promise<Row[] | 'offline' | 'failed'> {
    const result = await fetchOlderWorkouts(deps, from, to);
    return typeof result === 'string' ? result : result.map((workout) => ({ ...workout, syncState: null }));
  }

  /**
   * A date's workouts, each on its own row with edit and delete (D-42), then the day's calories
   * burned, typed or estimated (D-50; Training only, not Home). Older workouts, read from the server,
   * are only viewed (MVP default, D-29).
   */
  function workoutRows(day: string, workouts: readonly Row[], viewOnly: boolean) {
    const burned = caloriesBurned(workouts.flatMap((workout) => workout.exercises));
    return (
      <>
        {workouts.map((workout, index) => {
          const name = `Workout ${index + 1}`;
          const summary = workoutSummary(workout.exercises);
          const notSaved = workout.syncState === 'rejected';
          const note = notSaved ? 'not saved' : workout.syncState === 'pending' ? 'waiting to sync' : null;
          const timed = timerLine(workout.timer, clock);
          const timedState = timerState(workout.timer);
          const text = (
            <>
              <Text style={styles.name}>{name}</Text>
              <Text numberOfLines={1} style={styles.summary}>
                {summary}
              </Text>
              {timed ? (
                <View style={styles.noteLine}>
                  {timedState === 'running' ? <View style={styles.runningDot} /> : null}
                  {timedState === 'paused' ? <Pause size={12} color={colors.warning} fill={colors.warning} /> : null}
                  {timedState === 'done' ? <CircleCheck size={14} color={colors.success} /> : null}
                  <Text style={[styles.timer, timedState === 'running' ? styles.running : timedState === 'paused' ? styles.paused : null]}>
                    {timed}
                  </Text>
                </View>
              ) : null}
              {note ? (
                <View style={styles.noteLine}>
                  <View style={[styles.dot, notSaved && styles.dotProblem]} />
                  <Text style={[styles.note, notSaved && styles.problem]}>{note}</Text>
                </View>
              ) : null}
            </>
          );
          return (
            <View key={workout.id} style={[styles.row, index > 0 && styles.ruled]}>
              {viewOnly ? (
                <View accessibilityLabel={`${formatDay(day)}, ${name}: ${summary}${timed ? `; ${timed}` : ''}`} style={styles.rowText}>
                  {text}
                </View>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDay(day)}, ${name}: ${summary}${timed ? `; ${timed}` : ''}`}
                    onPress={() => openWorkout(workout.id)}
                    style={({ pressed }) => [styles.rowText, pressed && styles.pressed]}
                  >
                    {text}
                  </Pressable>
                  <IconButton label={`Edit ${name} on ${formatDay(day)}`} onPress={() => openWorkout(workout.id)}>
                    <SquarePen size={20} color={colors.accent} />
                  </IconButton>
                  <IconButton label={`Delete ${name} on ${formatDay(day)}`} onPress={() => setDeleting({ id: workout.id, day, name, exercises: workout.exercises.length })}>
                    <Trash size={20} color={colors.danger} />
                  </IconButton>
                </>
              )}
            </View>
          );
        })}
        {burned ? (
          <View
            accessible
            accessibilityLabel={`${formatInteger(burned.kcal)} kcal burned${burned.estimated ? ', estimated' : ''}`}
            style={[styles.noteLine, styles.burnedLine]}
          >
            <Flame size={16} color={colors.accent} />
            <Text style={styles.burned}>
              <Text style={styles.burnedValue}>{formatInteger(burned.kcal)}</Text> kcal burned
              {burned.estimated ? <Text style={styles.summary}> · estimated</Text> : null}
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  /** A date's card in All workouts, as before D-65: its date block, its workouts and "Log another workout" (D-34, D-42). */
  function dateCard(day: string, workouts: readonly Row[]) {
    const viewOnly = workouts.every((workout) => workout.syncState === null);
    const [weekday, date, month] = formatDay(day).split(' ');
    return (
      <View
        key={day}
        accessibilityLabel={`${formatDay(day)}: ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`}
        style={[styles.card, viewOnly && styles.cardViewOnly]}
      >
        <View style={styles.dateBlock} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={styles.weekday}>{weekday}</Text>
          <Text style={styles.date}>{date}</Text>
          <Text style={styles.month}>{month}</Text>
        </View>
        <View style={styles.rows}>
          {workoutRows(day, workouts, viewOnly)}
          {viewOnly ? null : <TextButton title="Log another workout" icon={Plus} disabled={starting} onPress={() => void start(day)} />}
        </View>
      </View>
    );
  }

  const isToday = selected === today;
  const count = dayWorkouts.length;
  const dayHeading = `${isToday ? `Today, ${formatDay(selected)}` : formatDay(selected)}${count ? ` · ${count} ${count === 1 ? 'workout' : 'workouts'}` : ''}`;

  // By day (D-65): the selected date's workouts, under the button that logs to that date.
  const byDay = (
    <>
      {isToday ? null : (
        <View style={styles.banner}>
          <History size={20} color={colors.accent} />
          <Text style={styles.bannerText}>Showing {formatDay(selected)}</Text>
          <TextButton title="Back to today" onPress={() => select(today)} />
        </View>
      )}
      <TextButton
        title={isToday ? 'Log workout for today' : `Log workout for ${formatDay(selected)}`}
        filled
        icon={Plus}
        disabled={starting}
        onPress={() => void start(selected)}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        {dayHeading}
      </Text>
      {count ? (
        <View accessibilityLabel={`${formatDay(selected)}: ${count} ${count === 1 ? 'workout' : 'workouts'}`} style={styles.dayCard}>
          {workoutRows(selected, dayWorkouts, false)}
        </View>
      ) : (
        <View style={styles.none}>
          <Dumbbell size={22} color={colors.inkSubtle} />
          <Text style={styles.noneText}>No workouts on {formatDay(selected)}.</Text>
        </View>
      )}
    </>
  );

  return (
    <>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={shown === 'all' ? months : []}
        keyExtractor={(group) => group.month}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <WeekStrip
              today={today}
              firstDay={firstDay}
              selected={selected}
              start={stripStart}
              activity={activity}
              onSelect={pickDay}
              onShow={showDays}
            />
            <View accessibilityRole="tablist" style={styles.tabs}>
              {SHOWN.map(({ shown: value, label, icon: Icon }) => {
                const chosen = shown === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: chosen }}
                    onPress={() => setShown(value)}
                    style={({ pressed }) => [pill.choice, styles.tab, chosen && pill.chosen, pressed && pill.pressed]}
                  >
                    <Icon size={17} strokeWidth={2.25} color={chosen ? colors.onPrimary : colors.ink} />
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[pill.choiceText, chosen && pill.chosenText]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <RejectedChanges
              entries={rejected}
              onEdit={(entry) => openWorkout(String((entry.data as { id?: unknown }).id))}
              onDiscard={(changeId) => void sync.discard(changeId)}
            />
            {shown === 'day' ? byDay : null}
          </View>
        }
        renderItem={({ item: { month, days } }) => {
          // A month's line opens and folds it (D-65).
          const isOpen = open.has(month);
          const summary = monthSummary(days);
          return (
            <View style={styles.monthGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${formatMonth(month)}: ${summary}`}
                accessibilityState={{ expanded: isOpen }}
                onPress={() => toggleMonth(month)}
                style={({ pressed }) => [styles.monthLine, pressed && styles.pressed]}
              >
                <View style={styles.monthText}>
                  <Text style={styles.monthName}>{formatMonth(month)}</Text>
                  <Text style={styles.summary}>{summary}</Text>
                </View>
                <View style={styles.chevron}>
                  {isOpen ? <ChevronUp size={22} color={colors.accent} /> : <ChevronDown size={22} color={colors.accent} />}
                </View>
              </Pressable>
              {isOpen ? days.map(({ day, workouts }) => dateCard(day, workouts)) : null}
            </View>
          );
        }}
        ListEmptyComponent={shown === 'all' ? <Text style={styles.empty}>No workouts logged yet.</Text> : undefined}
        ListFooterComponent={
          shown === 'all' ? (
            <View style={styles.footer}>
              {message ? <Banner tone={message.tone} text={message.text} {...(message.offline ? { icon: WifiOff } : {})} /> : null}
              <TextButton title="Load older" outlined wide icon={ClockArrowDown} disabled={loadingOlder} onPress={() => void loadOlder()} />
            </View>
          ) : undefined
        }
      />
      {deleting ? (
        <ConfirmSheet
          title="Delete workout?"
          message={deleteWorkoutMessage(deleting, today)}
          cancelLabel="Keep"
          confirmLabel="Delete"
          onConfirm={() => void sync.remove('workout', deleting.id)}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

// The redesign's 4.1, as locked by the owner on 2026-11-10 (D-65): the date strip at the top, as
// Nutrition's; under it the two choice pills, each with its icon. By day: the past-date banner, as
// Nutrition's; the filled main action naming its date; the date as a label; its workouts in one raised
// card, ruled rows each its name in condensed capitals over its exercises, with a pencil and a red bin,
// then the calories burned; a day with none, a dashed outline with a dumbbell. All workouts: each month
// a panel, its name in condensed capitals over its total, with a chevron; under an open month its
// dates' raised cards as before (locked 2026-11-03 and 2026-11-04), older ones view-only on the plain
// card colour with no icons; Load older outlined across the screen, its message as a banner.
const useStyles = themedStyles((c) => ({
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 },
  header: { gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
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
  heading: { ...TYPE.label, marginTop: 12, color: c.inkMuted },
  dayCard: {
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  none: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
  },
  noneText: { flex: 1, fontSize: 15, lineHeight: 22, color: c.inkMuted },
  monthGroup: { gap: 10 },
  monthLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 4,
    backgroundColor: c.surface,
  },
  monthText: { flex: 1, minWidth: 0, gap: 2 },
  monthName: { ...TYPE.metric, fontSize: 22, lineHeight: 24, textTransform: 'uppercase' },
  chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  burnedLine: { paddingTop: 6, paddingBottom: 2, borderTopWidth: 1, borderTopColor: c.border },
  burned: { fontSize: 14, lineHeight: 20 },
  burnedValue: { ...TYPE.metric, fontSize: 17, lineHeight: 20 },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  // D-71: a workout's timer, in condensed capitals: green while it runs, gold paused, muted when done.
  timer: { ...TYPE.link, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'], color: c.inkMuted },
  running: { color: c.success },
  paused: { color: c.warning },
  runningDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.success },
  note: { ...TYPE.label, fontSize: 12, lineHeight: 14, letterSpacing: 1, color: c.inkMuted },
  problem: { color: c.danger },
  empty: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  footer: { paddingTop: 8, gap: 12 },
}));
