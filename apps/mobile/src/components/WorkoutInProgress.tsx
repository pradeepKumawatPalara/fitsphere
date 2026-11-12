import { addDays, istToday, type IstDay, type WorkoutTimer } from '@fitsphere/shared';
import { ChevronRight, Pause } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNow } from '../clock';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listEntries } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { formatDuration, listedWorkouts, spokenDuration, timerSeconds, timerState } from '../workouts';
import { Text } from './ui';

// "Workout in progress" (D-83; backlog E-29; the owner's B, locked 2026-11-12): while a workout's
// timer runs or is paused (D-71), a pill floats above the tabs at the right, and over an exercise's
// page: a green dot (or the pause sign), the time counted and "Workout 2"; tapping it opens the
// workout. The workout's own page has the timer, so it shows none.

/** A workout whose timer runs or is paused, as the pill shows it. */
export type RunningWorkout = { id: string; day: IstDay; name: string; timer: WorkoutTimer };

type Candidate = { id: string; day: IstDay; recordedAt: string; exercises: readonly unknown[]; timer?: WorkoutTimer | null };

/**
 * The workout the pill shows (MVP defaults, D-83): of today's and yesterday's (a timer can run past
 * midnight, D-71), one whose timer runs, else one paused; the latest started. Older ones are left
 * out, so a timer never marked done does not stay for days. Null with none. Named "Workout 2" by its
 * place among its day's listed workouts, as everywhere else (D-65).
 */
export function runningWorkout(workouts: readonly Candidate[], today: IstDay): RunningWorkout | null {
  const days = new Set([today, addDays(today, -1)]);
  const listed = listedWorkouts(workouts.filter((workout) => days.has(workout.day)));
  const going = listed
    .filter((workout) => {
      const state = timerState(workout.timer ?? null);
      return state === 'running' || state === 'paused';
    })
    .sort(
      (a, b) =>
        Number(timerState(b.timer ?? null) === 'running') - Number(timerState(a.timer ?? null) === 'running') ||
        b.timer!.startedAt.localeCompare(a.timer!.startedAt),
    );
  const chosen = going[0];
  if (!chosen) return null;
  const place = listed
    .filter((workout) => workout.day === chosen.day)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .findIndex((workout) => workout.id === chosen.id);
  return { id: chosen.id, day: chosen.day, name: `Workout ${place + 1}`, timer: chosen.timer! };
}

/** The running or paused workout on this phone, read again after every change. */
function useRunningWorkout(now: () => Date): RunningWorkout | null {
  const local = useLocalDatabase();
  const sync = useSync();
  const [found, setFound] = useState<RunningWorkout | null>(null);
  const today = istToday(now());
  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listEntries(local.state.db, 'workout', addDays(today, -1), today).then((workouts) => {
      if (active) setFound(runningWorkout(workouts, today));
    });
    return () => {
      active = false;
    };
  }, [local.state, sync.version, today]);
  return found;
}

/** The pill, `bottom` points above the screen's foot (the tab bar, or the page's edge); none with no workout going. */
export function WorkoutInProgress({ bottom, onOpen, now = () => new Date() }: { bottom: number; onOpen(id: string): void; now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const workout = useRunningWorkout(now);
  const running = timerState(workout?.timer ?? null) === 'running';
  const clock = useNow(now, running);
  if (!workout) return null;
  const seconds = timerSeconds(workout.timer, clock);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${running ? 'running' : 'paused'}, ${spokenDuration(seconds)}`}
      accessibilityHint="Opens the workout"
      onPress={() => onOpen(workout.id)}
      style={({ pressed }) => [styles.pill, { bottom, borderColor: running ? colors.success : colors.warning }, pressed && styles.pressed]}
    >
      {running ? <View style={styles.dot} /> : <Pause size={14} color={colors.warning} fill={colors.warning} />}
      <Text style={styles.time}>{formatDuration(seconds)}</Text>
      <Text style={styles.name}>{workout.name}</Text>
      <ChevronRight size={16} strokeWidth={2.5} color={colors.accent} />
    </Pressable>
  );
}

const useStyles = themedStyles((c) => ({
  pill: {
    position: 'absolute',
    right: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: c.surfaceRaised,
    elevation: 6,
  },
  pressed: { opacity: 0.8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  time: { ...TYPE.metric, fontSize: 22, lineHeight: 24, color: c.ink },
  name: { fontSize: 14, color: c.inkMuted },
}));
