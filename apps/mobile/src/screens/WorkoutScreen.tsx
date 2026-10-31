import { MAX_WORKOUT_EXERCISES, WORKOUT_DELETE, WORKOUT_SET, type WorkoutExercise } from '@fitsphere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, View } from 'react-native';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { RejectedChanges } from '../components/RejectedChanges';
import { Text } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, rejectedChanges, type LocalWorkout, type OutboxEntry } from '../local/store';
import { useLiftingWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { EMPTY_EXERCISE, formatSets, toExerciseText } from '../workouts';

/** The exercise being edited: its place in the list, or null for a new one. */
type Sheet = { index: number | null };

// One workout (REQ-TRN-003): its exercises as sets × reps × weight with an optional note (Q-042).
// Every change is saved on the phone at once and synced (ADR-0007); there is no draft and no
// "Finish" step (MVP default, D-29). The workout counts toward the week from the moment it is
// started, even with no exercises (Q-025).
export function WorkoutScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const local = useLocalDatabase();
  const sync = useSync();
  const unit = useLiftingWeightUnit();
  const { colors } = useTheme();
  const [workout, setWorkout] = useState<LocalWorkout | null | 'loading'>('loading');
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    const db = local.state.db;
    let active = true;
    void Promise.all([getEntry(db, 'workout', id), rejectedChanges(db)]).then(([entry, waiting]) => {
      if (!active) return;
      setWorkout(entry);
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
        <Text>This workout is not on this phone.</Text>
        <Button title="Done" onPress={() => router.back()} />
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
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Workout · {formatDay(workout.day)}
      </Text>
      {syncState === 'pending' ? <Text style={styles.note}>Waiting to sync</Text> : null}
      <RejectedChanges entries={rejected} onDiscard={(changeId) => void sync.discard(changeId)} />
      {workout.exercises.length === 0 ? <Text style={styles.note}>No exercises yet.</Text> : null}
      {workout.exercises.map((exercise, index) => (
        <Pressable
          key={index}
          accessibilityRole="button"
          accessibilityLabel={`${exercise.name}: ${formatSets(exercise, unit)}`}
          onPress={() => setSheet({ index })}
          style={styles.exercise}
        >
          <Text style={styles.name}>{exercise.name}</Text>
          <Text>{formatSets(exercise, unit)}</Text>
          {exercise.note ? <Text style={styles.note}>{exercise.note}</Text> : null}
        </Pressable>
      ))}
      {workout.exercises.length < MAX_WORKOUT_EXERCISES ? (
        <Button title="Add exercise" onPress={() => setSheet({ index: null })} />
      ) : (
        <Text style={styles.note}>A workout holds up to {MAX_WORKOUT_EXERCISES} exercises.</Text>
      )}
      <Button title="Done" onPress={() => router.back()} />
      {confirming ? (
        <View accessibilityRole="alert" style={styles.confirm}>
          <Text>Delete this workout? It leaves your history and your weekly count.</Text>
          <View style={styles.actions}>
            <Button title="Delete" color={colors.error} onPress={() => void deleteWorkout()} />
            <Button title="Keep" onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        <Button title="Delete workout" color={colors.error} onPress={() => setConfirming(true)} />
      )}
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
    </ScrollView>
  );
}

/** Whether a change in the outbox is for this workout: its save or its deletion. */
function isFor(change: OutboxEntry, id: string): boolean {
  return (
    (change.type === WORKOUT_SET || change.type === WORKOUT_DELETE) && (change.data as { id?: unknown }).id === id
  );
}

const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '600' },
  exercise: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  note: { color: c.textMuted },
  confirm: { padding: 12, gap: 8, borderRadius: 8, borderWidth: 1, borderColor: c.error },
  actions: { flexDirection: 'row', gap: 12 },
  gone: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
}));
