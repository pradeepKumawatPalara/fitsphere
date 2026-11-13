import { addDays, istToday, MAX_WORKOUT_EXERCISES, WORKOUT_DELETE, WORKOUT_SET, type WorkoutExercise, type WorkoutTimer } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, Dumbbell, Flame, Play, Plus, SquarePen, Trash, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useNow } from '../clock';
import { ExerciseDetailsPage } from '../components/ExerciseDetailsPage';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { ConfirmSheet } from '../components/MealSheets';
import { RejectedChanges } from '../components/RejectedChanges';
import { runningWorkout, type RunningWorkout } from '../components/WorkoutInProgress';
import { OtherTimerNote, WorkoutTimerBar, type OtherTimer } from '../components/WorkoutTimerBar';
import { Text, TextButton } from '../components/ui';
import { formatDay, formatInteger } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listEntries, rejectedChanges, type LocalWorkout, type OutboxEntry } from '../local/store';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import {
  caloriesBurned,
  deleteWorkoutEffects,
  exerciseLabel,
  exerciseLines,
  finishTimer,
  formatDuration,
  listedWorkouts,
  pauseTimer,
  resumeTimer,
  spokenDuration,
  startTimer,
  timerSeconds,
  timerState,
} from '../workouts';

/** The exercise being edited: its place in the list, or null for a new one. */
type Sheet = { index: number | null };

// One workout (REQ-TRN-003): its exercises, each as its sets, a row per set (D-63), or its cardio
// (D-50), with an optional note (Q-042).
// Every change is saved on the phone at once and synced (ADR-0007); there is no draft and no
// "Finish" step (MVP default, D-29), and no Done: Save in the exercise sheet saves, and the header's
// back arrow leaves (D-42). Each exercise has a bar at its foot with Progress (its page: progress,
// history and how to, D-82), Edit and Remove; removing asks first. Named by its place among its day's workouts,
// "Workout 2 · Tue 3 Nov". The workout counts toward the week once it has an exercise (D-41);
// deleting it says what goes with it (D-63).
// The workout timer (D-71): a workout of today has "Start workout" in a bar at its foot; the bar
// then shows the time counted, with Pause or Resume and "Mark done". A timer already started can be
// paused, resumed and marked done whatever the date, so a workout that runs past midnight can be
// finished. Marked done, the bar goes and a panel under the title shows the total, with Resume on a
// workout of today, in case "Mark done" was tapped by mistake. Each step is saved and synced at once.
export function WorkoutScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const local = useLocalDatabase();
  const sync = useSync();
  const unit = useLiftingWeightUnit();
  const [workout, setWorkout] = useState<LocalWorkout | null | 'loading'>('loading');
  // Its place among its day's workouts, in the order they were started.
  const [place, setPlace] = useState(1);
  // Another workout's timer running or paused, which keeps this one from starting (D-83).
  const [other, setOther] = useState<RunningWorkout | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // The exercise whose page is open (D-82): its progress, history and how to.
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // A timer step being saved: the bar's buttons wait for it.
  const [stepping, setStepping] = useState(false);
  // The screen draws again each second only while the timer runs.
  const clock = useNow(now, typeof workout === 'object' && workout !== null && timerState(workout.timer) === 'running');

  // Today, for the other workouts whose timer may be going (D-83).
  const loadDay = istToday(now());

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([getEntry(db, 'workout', id), rejectedChanges(db), listEntries(db, 'workout', addDays(loadDay, -1), loadDay)]).then(async ([entry, waiting, recent]) => {
      const sameDay = entry ? await listEntries(db, 'workout', entry.day, entry.day) : [];
      if (!active) return;
      setOther(runningWorkout(recent.filter((each) => each.id !== id), loadDay));
      setWorkout(entry);
      // Numbered among the day's listed workouts, as Training and Home number them (D-65).
      setPlace(listedWorkouts(sameDay, id).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).findIndex((other) => other.id === id) + 1 || 1);
      setRejected(waiting.filter((change) => isFor(change, id)));
    });
    return () => {
      active = false;
    };
  }, [local.state, id, sync.version, loadDay]);

  if (workout === 'loading') return null;
  if (workout === null) {
    // Deleted, or no longer on this phone.
    return (
      <View style={styles.gone}>
        <View style={styles.goneTile}>
          <Dumbbell size={26} color={colors.accent} />
        </View>
        <Text style={styles.goneText}>This workout is not on this phone.</Text>
        <TextButton title="Done" filled onPress={() => router.back()} />
      </View>
    );
  }

  const { syncState, ...saved } = workout;
  const saveExercises = (exercises: WorkoutExercise[]) => sync.save('workout', { ...saved, exercises });
  const editing = sheet?.index === null || sheet?.index === undefined ? null : workout.exercises[sheet.index];
  const burned = caloriesBurned(workout.exercises);
  const today = istToday(clock);
  const otherTimer: OtherTimer | null = other ? { name: other.name, day: other.day, running: timerState(other.timer) === 'running' } : null;
  const deleted = deleteWorkoutEffects(workout.exercises.length, workout.day, today);
  const timer = timerState(workout.timer);
  const seconds = timerSeconds(workout.timer, clock);
  // Starting, and resuming after "Mark done", are for today's workouts only (D-71).
  const isToday = workout.day === today;

  /** Saves a timer step; the screen shows it at once, before the phone's copy is read again. */
  async function step(next: (current: WorkoutTimer | null, at: Date) => WorkoutTimer) {
    const timerNow = next(saved.timer, now());
    setStepping(true);
    setWorkout({ ...saved, timer: timerNow, syncState: 'pending' });
    try {
      await sync.save('workout', { ...saved, timer: timerNow });
    } finally {
      setStepping(false);
    }
  }

  async function deleteWorkout() {
    await sync.remove('workout', id);
    router.back();
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleGroup}>
          <Text accessibilityRole="header" style={styles.title}>
            Workout {place} · <Text style={styles.titleDay}>{formatDay(workout.day)}</Text>
          </Text>
          {syncState === 'pending' ? (
            <View style={styles.noteLine}>
              <View style={styles.dot} />
              <Text style={styles.syncNote}>Waiting to sync</Text>
            </View>
          ) : null}
          {burned ? (
            <View accessible accessibilityLabel={`${formatInteger(burned.kcal)} kcal burned${burned.estimated ? ', estimated' : ''}`} style={styles.noteLine}>
              <Flame size={18} color={colors.accent} />
              <Text style={styles.burned}>
                <Text style={styles.burnedValue}>{formatInteger(burned.kcal)}</Text> kcal burned
                {burned.estimated ? <Text style={styles.muted}> · estimated</Text> : null}
              </Text>
            </View>
          ) : null}
        </View>
        {workout.timer && timer === 'done' ? (
          <View style={styles.done}>
            <CircleCheck size={22} color={colors.success} />
            <View accessible accessibilityLabel={`Done, total time ${spokenDuration(seconds)}`} style={styles.doneText}>
              <Text style={styles.doneLabel}>Done · total time</Text>
              <Text style={styles.doneTime}>{formatDuration(seconds)}</Text>
            </View>
            {isToday ? (
              <TextButton
                title="Resume"
                icon={Play}
                disabled={stepping || otherTimer !== null}
                onPress={() => void step((current, at) => resumeTimer(current!, at))}
              />
            ) : null}
          </View>
        ) : null}
        {workout.timer && timer === 'done' && isToday && otherTimer ? (
          <OtherTimerNote other={otherTimer} onOpen={() => router.push(`/workout/${other!.id}`)} />
        ) : null}
        <RejectedChanges entries={rejected} onDiscard={(changeId) => void sync.discard(changeId)} />
        {workout.exercises.length === 0 ? <Text style={styles.empty}>No exercises yet.</Text> : null}
        {workout.exercises.map((exercise, index) => {
          const { main, rows, detail } = exerciseLines(exercise, unit);
          return (
            <View key={index} style={styles.exercise}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={exerciseLabel(exercise, unit)}
                onPress={() => setSheet({ index })}
                style={({ pressed }) => [styles.exerciseMain, pressed && styles.pressed]}
              >
                <View style={styles.number}>
                  <Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.exerciseText}>
                  <Text style={styles.name}>{exercise.name}</Text>
                  {exercise.kind === 'sets' ? (
                    <View style={styles.setRows}>
                      {rows.map((row) => (
                        <View key={row.label} style={styles.setRow}>
                          <Text style={styles.setLabel}>{row.label}</Text>
                          <Text style={styles.setValue}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.sets}>{main}</Text>
                  )}
                  {detail ? <Text style={styles.note}>{detail}</Text> : null}
                  {exercise.note ? <Text style={styles.note}>{exercise.note}</Text> : null}
                </View>
              </Pressable>
              <View style={styles.exerciseActions}>
                <ExerciseAction
                  icon={TrendingUp}
                  title="Progress"
                  label={`${exercise.name}: progress, history and how to`}
                  color={colors.accent}
                  onPress={() => setDetailsFor(exercise.name)}
                />
                <ExerciseAction
                  icon={SquarePen}
                  title="Edit"
                  label={`Edit ${exercise.name}`}
                  color={colors.accent}
                  middle
                  onPress={() => setSheet({ index })}
                />
                <ExerciseAction icon={Trash} title="Remove" label={`Remove ${exercise.name}`} color={colors.danger} onPress={() => setRemoving(index)} />
              </View>
            </View>
          );
        })}
        {workout.exercises.length < MAX_WORKOUT_EXERCISES ? (
          <TextButton title="Add exercise" outlined wide icon={Plus} onPress={() => setSheet({ index: null })} />
        ) : (
          <Text style={styles.note}>A workout holds up to {MAX_WORKOUT_EXERCISES} exercises.</Text>
        )}
        <View style={styles.danger}>
          {confirming ? (
            <View accessibilityRole="alert" style={styles.confirm}>
              <View style={styles.confirmText}>
                <Trash size={20} color={colors.danger} />
                <View style={styles.confirmWords}>
                  <Text style={styles.confirmTitle}>{`Delete Workout ${place} on ${formatDay(workout.day)}?`}</Text>
                  <Text style={styles.body}>{`${deleted.exercises ? `Its ${deleted.exercises} will be deleted too. ` : ''}${deleted.rest}`}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <View style={styles.half}>
                  <TextButton title="Keep" outlined wide onPress={() => setConfirming(false)} />
                </View>
                <View style={styles.half}>
                  <TextButton title="Delete" outlined wide destructive onPress={() => void deleteWorkout()} />
                </View>
              </View>
            </View>
          ) : (
            <TextButton title="Delete workout" destructive icon={Trash} onPress={() => setConfirming(true)} />
          )}
        </View>
      </ScrollView>
      {timer === 'running' || timer === 'paused' || (timer === 'none' && isToday) ? (
        <WorkoutTimerBar
          other={otherTimer}
          onOpenOther={() => other && router.push(`/workout/${other.id}`)}
          state={timer}
          seconds={seconds}
          busy={stepping}
          onStart={() => void step((_, at) => startTimer(at))}
          onPause={() => void step((current, at) => pauseTimer(current!, at))}
          onResume={() => void step((current, at) => resumeTimer(current!, at))}
          onDone={() => void step((current, at) => finishTimer(current!, at))}
        />
      ) : null}
      {removing !== null && workout.exercises[removing] ? (
        <ConfirmSheet
          title="Remove exercise?"
          message={`Remove ${workout.exercises[removing]!.name} from this workout?`}
          cancelLabel="Keep"
          confirmLabel="Remove"
          onConfirm={() => void saveExercises(workout.exercises.filter((_, index) => index !== removing))}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {detailsFor !== null ? (
        <ExerciseDetailsPage
          name={detailsFor}
          now={now}
          onClose={() => setDetailsFor(null)}
          onOpenWorkout={(other) => {
            setDetailsFor(null);
            if (other !== workout.id) router.push(`/workout/${other}`);
          }}
        />
      ) : null}
      {sheet ? (
        <ExerciseSheet
          title={editing ? 'Edit exercise' : 'Add exercise'}
          day={workout.day}
          editing={editing ?? null}
          onSave={(exercise) =>
            saveExercises(
              sheet.index === null
                ? [...workout.exercises, exercise]
                : workout.exercises.map((current, index) => (index === sheet.index ? exercise : current)),
            )
          }
          {...(sheet.index === null
            ? {}
            : { onRemove: () => saveExercises(workout.exercises.filter((_, index) => index !== sheet.index)) })}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * One of an exercise's actions in the bar at its card's foot (D-82, the owner's C on the canvas's 4.2
 * "The exercise icons"): an icon and a word, a third of the card's width.
 */
function ExerciseAction({
  icon: Icon,
  title,
  label,
  color,
  middle = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  label: string;
  color: string;
  middle?: boolean;
  onPress(): void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.exerciseAction, middle && styles.exerciseActionMiddle, pressed && styles.pressed]}
    >
      <Icon size={17} strokeWidth={2.25} color={color} />
      <Text style={[styles.exerciseActionText, { color }]}>{title}</Text>
    </Pressable>
  );
}

/** Whether a change in the outbox is for this workout: its save or its deletion. */
function isFor(change: OutboxEntry, id: string): boolean {
  return (
    (change.type === WORKOUT_SET || change.type === WORKOUT_DELETE) && (change.data as { id?: unknown }).id === id
  );
}

// The redesign's 4.2 (locked by the owner, 2026-11-03; the icons and no Done locked 2026-11-04): the
// workout's number and the date in caramel in a condensed title; each exercise on a card with its
// number, a pencil and a red bin, its sets in condensed figures; Add exercise outlined across the
// screen; Delete workout a red link at the end, its confirmation on a red tint (Keep on the left,
// Delete in red on the right, the same size).
const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  titleGroup: { gap: 6 },
  title: { ...TYPE.heading, fontSize: 30, lineHeight: 32, fontVariant: ['tabular-nums'] },
  titleDay: { color: c.accent },
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  syncNote: { ...TYPE.label, letterSpacing: 1, color: c.inkMuted },
  burned: { fontSize: 15, lineHeight: 22 },
  burnedValue: { ...TYPE.metric, fontSize: 20 },
  muted: { color: c.inkMuted },
  empty: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
    fontSize: 15,
    lineHeight: 22,
    color: c.inkMuted,
    textAlign: 'center',
  },
  exercise: { borderRadius: 4, backgroundColor: c.surface, overflow: 'hidden' },
  exerciseMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  // D-82: Progress, Edit and Remove in a bar at the card's foot, each a third of its width.
  exerciseActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border },
  exerciseAction: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  exerciseActionMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border },
  exerciseActionText: { ...TYPE.link },
  pressed: { opacity: 0.6 },
  number: { width: 36, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  numberText: { ...TYPE.metric, fontSize: 16, lineHeight: 18, color: c.accent },
  exerciseText: { flex: 1, gap: 2 },
  // D-93: the exercise's name stands out in bold; its sets and cardio line are plain running text.
  name: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  sets: { fontSize: 15, lineHeight: 22, fontVariant: ['tabular-nums'] },
  // D-63: a row per set, its label ("Set 2", "3 sets") muted in a column of its own.
  setRows: { gap: 2 },
  setRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  setLabel: { fontSize: 15, lineHeight: 22, minWidth: 54, color: c.inkMuted },
  setValue: { flexShrink: 1, fontSize: 15, lineHeight: 22, fontVariant: ['tabular-nums'] },
  body: { flexShrink: 1, fontSize: 15, lineHeight: 22 },
  confirmWords: { flex: 1, gap: 6 },
  confirmTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  note: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  danger: { paddingTop: 8 },
  confirm: { padding: 16, gap: 14, borderRadius: 4, borderWidth: 1.5, borderColor: c.danger, backgroundColor: c.dangerTint },
  confirmText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  // D-71: the timer's total once marked done, on a green tint with a green edge.
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.success,
    backgroundColor: c.successTint,
  },
  doneText: { flex: 1 },
  doneLabel: { ...TYPE.label, color: c.inkMuted },
  doneTime: { ...TYPE.metric, fontSize: 28, lineHeight: 30 },
  gone: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  goneTile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  goneText: { fontSize: 17, lineHeight: 26 },
}));
