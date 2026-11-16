import { addDays, istToday, type IstDay, type WorkoutTimer } from '@fitsphere/shared';
import { ChevronRight, Pause } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { useNow } from '../clock';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, listEntries, setMeta } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { FLOATING_SHADOW, themedStyles, useTheme } from '../theme';
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

/** A corner the pill sits in (D-105): bottom right until moved. */
export type PillCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const PILL_CORNERS: readonly PillCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const DEFAULT_CORNER: PillCorner = 'bottom-right';
/** The pill's distance from the screen's sides. */
const SIDE = 16;
/** How far a finger moves before the pill is dragged rather than tapped. */
const DRAG_START = 6;

const CORNER_NAMES: Record<PillCorner, string> = {
  'top-left': 'the top left',
  'top-right': 'the top right',
  'bottom-left': 'the bottom left',
  'bottom-right': 'the bottom right',
};

/** The corner nearest a point: the screen's quarter it is in. */
export function nearestCorner(point: { x: number; y: number }, area: { width: number; height: number }): PillCorner {
  return `${point.y < area.height / 2 ? 'top' : 'bottom'}-${point.x < area.width / 2 ? 'left' : 'right'}`;
}

/** Where the pill's top left is in a corner, in its area: `top` and `bottom` keep it clear of the header and the tabs. */
export function cornerPoint(
  corner: PillCorner,
  area: { width: number; height: number },
  pill: { width: number; height: number },
  edges: { top: number; bottom: number },
): { x: number; y: number } {
  return {
    x: corner.endsWith('left') ? SIDE : area.width - SIDE - pill.width,
    y: corner.startsWith('top') ? edges.top : area.height - edges.bottom - pill.height,
  };
}

function cornerStyle(corner: PillCorner, edges: { top: number; bottom: number }) {
  return {
    ...(corner.startsWith('top') ? { top: edges.top } : { bottom: edges.bottom }),
    ...(corner.endsWith('left') ? { left: SIDE } : { right: SIDE }),
  };
}

const isCorner = (value: string | null): value is PillCorner => (PILL_CORNERS as readonly string[]).includes(value ?? '');

// The corner, shared by every pill on the screen (the tabs' and an exercise page's over them) and kept
// on this phone, as the measurements' cm or in is (D-23).
let sharedCorner: PillCorner | null = null;
const listeners = new Set<(corner: PillCorner) => void>();

/** Tests only: forget the corner read, as a new start of the app does. */
export function forgetPillCorner(): void {
  sharedCorner = null;
}

function usePillCorner(): [PillCorner, (corner: PillCorner) => void] {
  const local = useLocalDatabase();
  const [corner, setCorner] = useState<PillCorner>(sharedCorner ?? DEFAULT_CORNER);
  useEffect(() => {
    listeners.add(setCorner);
    return () => {
      listeners.delete(setCorner);
    };
  }, []);
  useEffect(() => {
    if (sharedCorner !== null || local.state.status !== 'ready') return;
    let active = true;
    void getMeta(local.state.db, 'workout_pill_corner').then((saved) => {
      if (!active || sharedCorner !== null) return;
      sharedCorner = isCorner(saved) ? saved : DEFAULT_CORNER;
      for (const listener of listeners) listener(sharedCorner);
    });
    return () => {
      active = false;
    };
  }, [local.state]);
  const move = (next: PillCorner) => {
    sharedCorner = next;
    for (const listener of listeners) listener(next);
    if (local.state.status === 'ready') void setMeta(local.state.db, 'workout_pill_corner', next);
  };
  return [corner, move];
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * The pill, in its corner: `top` keeps it below the header, `bottom` above the screen's foot (the tab
 * bar, or the page's edge); none with no workout going. It can be dragged (D-105, the owner's A, locked
 * 2026-11-16): let go, it settles in the nearest corner and stays there, on every page and after the app
 * is closed; a tap opens the workout. Screen readers move it with the actions "Move to the top left"…
 */
export function WorkoutInProgress({
  top,
  bottom,
  onOpen,
  now = () => new Date(),
}: {
  top: number;
  bottom: number;
  onOpen(id: string): void;
  now?: () => Date;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const workout = useRunningWorkout(now);
  const running = timerState(workout?.timer ?? null) === 'running';
  const clock = useNow(now, running);
  const [corner, moveTo] = usePillCorner();
  const [dragging, setDragging] = useState(false);
  // The drag's offset, made once (state: React reads no ref while drawing).
  const [pan] = useState(() => new Animated.ValueXY());
  const area = useRef<Box | null>(null);
  const pill = useRef<Box | null>(null);
  // Where the finger came down on the pill, on the screen.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const moved = (event: GestureResponderEvent) => {
    const from = touch.current;
    return from ? { dx: event.nativeEvent.pageX - from.x, dy: event.nativeEvent.pageY - from.y } : { dx: 0, dy: 0 };
  };
  /** Let go: the pill slides from where it is into the corner nearest it. */
  const settle = (event: GestureResponderEvent) => {
    const { dx, dy } = moved(event);
    touch.current = null;
    setDragging(false);
    const box = pill.current;
    const space = area.current;
    if (!box || !space) {
      pan.setValue({ x: 0, y: 0 });
      return;
    }
    const dropped = { x: box.x + dx, y: box.y + dy };
    const next = nearestCorner({ x: dropped.x + box.width / 2, y: dropped.y + box.height / 2 }, space);
    const target = cornerPoint(next, space, box, { top, bottom });
    if (next !== corner) moveTo(next);
    pan.setValue({ x: dropped.x - target.x, y: dropped.y - target.y });
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 4 }).start();
  };
  const edges = { top, bottom };

  if (!workout) return null;
  const seconds = timerSeconds(workout.timer, clock);
  const others = PILL_CORNERS.filter((other) => other !== corner);
  return (
    <View
      testID="workout-in-progress-area"
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        area.current = event.nativeEvent.layout;
      }}
    >
      <Animated.View
        testID="workout-in-progress"
        // The touch system's own handlers, as React Native's PanResponder uses them: a tap stays the
        // Pressable's; a finger that moves past DRAG_START takes the pill, and keeps it till let go.
        onTouchStart={(event) => {
          touch.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        }}
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={(event) => {
          const { dx, dy } = moved(event);
          return Math.abs(dx) > DRAG_START || Math.abs(dy) > DRAG_START;
        }}
        onResponderTerminationRequest={() => false}
        onResponderGrant={() => {
          pan.stopAnimation();
          setDragging(true);
        }}
        onResponderMove={(event) => pan.setValue({ x: moved(event).dx, y: moved(event).dy })}
        onResponderRelease={settle}
        onResponderTerminate={settle}
        onLayout={(event) => {
          pill.current = event.nativeEvent.layout;
        }}
        style={[styles.place, cornerStyle(corner, edges), { transform: [...pan.getTranslateTransform(), { scale: dragging ? 1.06 : 1 }] }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${workout.name}, ${running ? 'running' : 'paused'}, ${spokenDuration(seconds)}`}
          accessibilityHint="Opens the workout. Drag it to move it to another corner."
          accessibilityActions={others.map((other) => ({ name: other, label: `Move to ${CORNER_NAMES[other]}` }))}
          onAccessibilityAction={(event) => {
            const name = event.nativeEvent.actionName;
            if (isCorner(name)) moveTo(name);
          }}
          onPress={() => onOpen(workout.id)}
          style={({ pressed }) => [styles.pill, { borderColor: running ? colors.success : colors.warning }, dragging && styles.lifted, pressed && styles.pressed]}
        >
          {running ? <View style={styles.dot} /> : <Pause size={14} color={colors.warning} fill={colors.warning} />}
          <Text style={styles.time}>{formatDuration(seconds)}</Text>
          <Text style={styles.name}>{workout.name}</Text>
          <ChevronRight size={16} strokeWidth={2.5} color={colors.accent} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  place: { position: 'absolute' },
  // Lifted while dragged: the shadow deeper, as the locked design's. On the pill, which has the
  // background: Android draws `elevation` only on a view with one.
  lifted: Platform.select<ViewStyle>({ ios: { shadowOpacity: 0.4, shadowRadius: 12 }, default: { elevation: 12 } }),
  pill: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: c.surfaceRaised,
    ...FLOATING_SHADOW,
  },
  pressed: { opacity: 0.8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  time: { ...TYPE.metric, fontSize: 22, lineHeight: 24, color: c.ink },
  name: { fontSize: 14, color: c.inkMuted },
}));
