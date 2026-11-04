import { MAX_WORKOUT_EXERCISES, WORKOUT_DELETE, WORKOUT_SET, type WorkoutExercise } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dumbbell, Plus, SquarePen, Trash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { ConfirmSheet } from '../components/MealSheets';
import { RejectedChanges } from '../components/RejectedChanges';
import { IconButton, Text, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, listEntries, rejectedChanges, type LocalWorkout, type OutboxEntry } from '../local/store';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { EMPTY_EXERCISE, formatSets, toExerciseText } from '../workouts';

/** The exercise being edited: its place in the list, or null for a new one. */
type Sheet = { index: number | null };

// One workout (REQ-TRN-003): its exercises as sets × reps × weight with an optional note (Q-042).
// Every change is saved on the phone at once and synced (ADR-0007); there is no draft and no
// "Finish" step (MVP default, D-29), and no Done: Save in the exercise sheet saves, and the header's
// back arrow leaves (D-42). Each exercise has edit and remove; removing asks first. Named by its
// place among its day's workouts, "Workout 2 · Tue 3 Nov". The workout counts toward the week once it
// has an exercise (D-41).
export function WorkoutScreen() {
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
  const [removing, setRemoving] = useState<number | null>(null);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([getEntry(db, 'workout', id), rejectedChanges(db)]).then(async ([entry, waiting]) => {
      const sameDay = entry ? await listEntries(db, 'workout', entry.day, entry.day) : [];
      if (!active) return;
      setWorkout(entry);
      setPlace(sameDay.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).findIndex((other) => other.id === id) + 1 || 1);
      setRejected(waiting.filter((change) => isFor(change, id)));
    });
    return () => {
      active = false;
    };
  }, [local.state, id, sync.version]);

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
        </View>
        <RejectedChanges entries={rejected} onDiscard={(changeId) => void sync.discard(changeId)} />
        {workout.exercises.length === 0 ? <Text style={styles.empty}>No exercises yet.</Text> : null}
        {workout.exercises.map((exercise, index) => (
          <View key={index} style={styles.exercise}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${exercise.name}: ${formatSets(exercise, unit)}`}
              onPress={() => setSheet({ index })}
              style={({ pressed }) => [styles.exerciseMain, pressed && styles.pressed]}
            >
              <View style={styles.number}>
                <Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={styles.exerciseText}>
                <Text style={styles.name}>{exercise.name}</Text>
                <Text style={styles.sets}>{formatSets(exercise, unit)}</Text>
                {exercise.note ? <Text style={styles.note}>{exercise.note}</Text> : null}
              </View>
            </Pressable>
            <IconButton label={`Edit ${exercise.name}`} onPress={() => setSheet({ index })}>
              <SquarePen size={20} color={colors.accent} />
            </IconButton>
            <IconButton label={`Remove ${exercise.name}`} onPress={() => setRemoving(index)}>
              <Trash size={20} color={colors.danger} />
            </IconButton>
          </View>
        ))}
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
                <Text style={styles.body}>Delete this workout? It leaves your history and your weekly count.</Text>
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
      {sheet ? (
        <ExerciseSheet
          title={editing ? 'Edit exercise' : 'Add exercise'}
          initial={editing ? toExerciseText(editing, unit) : EMPTY_EXERCISE}
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
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 2,
    borderRadius: 4,
    backgroundColor: c.surface,
  },
  exerciseMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.6 },
  number: { width: 36, height: 36, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  numberText: { ...TYPE.metric, fontSize: 16, lineHeight: 18, color: c.accent },
  exerciseText: { flex: 1, gap: 2 },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  sets: { ...TYPE.metric },
  body: { flexShrink: 1, fontSize: 15, lineHeight: 22 },
  note: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  danger: { paddingTop: 8 },
  confirm: { padding: 16, gap: 14, borderRadius: 4, borderWidth: 1.5, borderColor: c.danger, backgroundColor: c.dangerTint },
  confirmText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  gone: { flex: 1, padding: 24, gap: 24, justifyContent: 'center' },
  goneTile: { width: 56, height: 56, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  goneText: { fontSize: 17, lineHeight: 26 },
}));
