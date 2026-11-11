import {
  addDays,
  exerciseNameKey,
  fromGrams,
  type BodyWeightUnit,
  type ExerciseLogType,
  type ExerciseSet,
  type IstDay,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { formatDay, formatInteger } from './format';
import { exerciseLines, formatDuration, setRows } from './workouts';

// An exercise's progress and history (D-82; docs/plans/exercise-details-page.md): its workouts, read
// from the phone (the last 90 days) and from the server when older ones are loaded, matched by name;
// the records for its kind of effort, with the day each was made; the graph's points in a range; and
// each workout's card. Weights are in the lifting unit (REQ-TRN-005), stored in grams (invariant #6).

/** What an exercise's numbers measure, from how its sets or cardio are logged. */
export type EffortKind = 'weight_reps' | 'reps' | 'time' | 'weight_time' | 'distance' | 'speed' | 'level' | 'duration';

const KIND_OF_LOG_TYPE: Record<ExerciseLogType, EffortKind> = {
  weight_reps: 'weight_reps',
  reps: 'reps',
  time: 'time',
  weight_time: 'weight_time',
  distance_time: 'distance',
  treadmill: 'speed',
  cardio_machine: 'level',
  time_only: 'duration',
};

/** The kind of a list exercise's effort, from how the list logs it. */
export function effortKindOfLogType(logType: ExerciseLogType): EffortKind {
  return KIND_OF_LOG_TYPE[logType];
}

/** The kind of an exercise as it was saved: a name of the user's own has only this. */
export function effortKindOf(exercise: WorkoutExercise): EffortKind {
  if (exercise.kind === 'cardio') {
    return exercise.distanceMetres !== null ? 'distance' : exercise.speedMetresPerHour !== null ? 'speed' : exercise.level !== null ? 'level' : 'duration';
  }
  const weighed = exercise.sets.some((set) => set.weightGrams !== null);
  if (exercise.sets.some((set) => set.reps !== null)) return weighed ? 'weight_reps' : 'reps';
  return weighed ? 'weight_time' : 'time';
}

/** A workout as the page reads it: one on the phone, or an older one read from the server. */
export type ExerciseWorkout = { id: string; day: IstDay; recordedAt: string; exercises: readonly WorkoutExercise[] };

/** One time the exercise was done: an exercise of a workout with its name. */
export type Session = {
  workoutId: string;
  day: IstDay;
  /** "Workout 2" when its day has several workouts with an exercise (D-34, D-65), else null. */
  workoutNumber: number | null;
  exercise: WorkoutExercise;
};

/**
 * Every time the exercise was done, newest first: each exercise of `workouts` whose name, ignoring
 * case, hyphens, spaces and doubled letters, is one of `names` (a list exercise's name and other
 * names, so a workout saved under a name it had before counts; or the name the user typed).
 */
export function exerciseSessions(workouts: readonly ExerciseWorkout[], names: readonly string[]): Session[] {
  const keys = new Set(names.map(exerciseNameKey).filter((key) => key !== ''));
  const unique = [...new Map(workouts.filter((workout) => workout.exercises.length > 0).map((workout) => [workout.id, workout])).values()];
  const byDay = new Map<IstDay, ExerciseWorkout[]>();
  for (const workout of unique) byDay.set(workout.day, [...(byDay.get(workout.day) ?? []), workout]);
  const sessions: (Session & { recordedAt: string; position: number })[] = [];
  for (const [day, list] of byDay) {
    const ordered = [...list].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    ordered.forEach((workout, index) => {
      workout.exercises.forEach((exercise, position) => {
        if (!keys.has(exerciseNameKey(exercise.name))) return;
        const workoutNumber = ordered.length > 1 ? index + 1 : null;
        sessions.push({ workoutId: workout.id, day, workoutNumber, exercise, recordedAt: workout.recordedAt, position });
      });
    });
  }
  sessions.sort((a, b) => b.day.localeCompare(a.day) || b.recordedAt.localeCompare(a.recordedAt) || b.position - a.position);
  return sessions.map(({ workoutId, day, workoutNumber, exercise }) => ({ workoutId, day, workoutNumber, exercise }));
}

/** The heaviest reps an estimate counts: above 12 the Epley formula guesses too high. */
const ONE_RM_MAX_REPS = 12;

/**
 * A set's estimated one-rep max in grams (the Epley formula, weight × (1 + reps ÷ 30)): a set of 1 rep
 * is its own weight; null with no weight or no reps, or above 12 reps.
 */
export function oneRepMax(set: ExerciseSet): number | null {
  if (set.weightGrams === null || set.reps === null || set.reps > ONE_RM_MAX_REPS) return null;
  return set.reps === 1 ? set.weightGrams : set.weightGrams * (1 + set.reps / 30);
}

/** What one session measures; null where its sets or cardio have no such value. */
export type SessionMetrics = {
  /** The best estimated one-rep max of its sets, in grams. */
  oneRm: number | null;
  /** The set of its best effort for `kind`, by its position in the sets. */
  bestSetIndex: number | null;
  heaviest: number | null;
  /** Weight × reps of every set, added up, in grams. */
  volume: number | null;
  mostReps: number | null;
  totalReps: number | null;
  longest: number | null;
  totalSeconds: number | null;
  distance: number | null;
  /** Seconds per km. */
  pace: number | null;
  /** Metres an hour: as typed on a treadmill, or from the distance and the time. */
  speed: number | null;
  level: number | null;
  duration: number | null;
};

function max(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : Math.max(...known);
}

function sum(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
}

/** The position of the set with the highest score, the first on a tie; null when none has one. */
function bestIndex(sets: readonly ExerciseSet[], score: (set: ExerciseSet) => readonly number[] | null): number | null {
  let best: { index: number; score: readonly number[] } | null = null;
  for (const [index, set] of sets.entries()) {
    const value = score(set);
    if (value && (!best || greater(value, best.score))) best = { index, score: value };
  }
  return best?.index ?? null;
}

function greater(a: readonly number[], b: readonly number[]): boolean {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index]! !== b[index]!) return a[index]! > b[index]!;
  }
  return false;
}

/** The set a kind counts as the best: the highest 1RM (or the heaviest), the most reps, the longest. */
function bestSetOf(sets: readonly ExerciseSet[], kind: EffortKind): number | null {
  switch (kind) {
    case 'weight_reps': {
      const byOneRm = bestIndex(sets, (set) => {
        const estimate = oneRepMax(set);
        return estimate === null ? null : [estimate, set.weightGrams ?? 0];
      });
      return byOneRm ?? bestIndex(sets, (set) => (set.weightGrams === null || set.reps === null ? null : [set.weightGrams, set.reps]));
    }
    case 'reps':
      return bestIndex(sets, (set) => (set.reps === null ? null : [set.reps]));
    case 'time':
      return bestIndex(sets, (set) => (set.seconds === null ? null : [set.seconds]));
    case 'weight_time':
      return bestIndex(sets, (set) => (set.weightGrams === null ? null : [set.weightGrams, set.seconds ?? 0]));
    default:
      return null;
  }
}

export function sessionMetrics(exercise: WorkoutExercise, kind: EffortKind): SessionMetrics {
  if (exercise.kind === 'cardio') {
    const { durationSeconds, distanceMetres, speedMetresPerHour, level } = exercise;
    return {
      oneRm: null,
      bestSetIndex: null,
      heaviest: null,
      volume: null,
      mostReps: null,
      totalReps: null,
      longest: null,
      totalSeconds: null,
      distance: distanceMetres,
      pace: distanceMetres === null ? null : durationSeconds / (distanceMetres / 1000),
      speed: speedMetresPerHour ?? (distanceMetres === null ? null : (distanceMetres / durationSeconds) * 3600),
      level,
      duration: durationSeconds,
    };
  }
  const { sets } = exercise;
  const weighedReps = sets.filter((set) => set.weightGrams !== null && set.reps !== null);
  return {
    oneRm: max(sets.map(oneRepMax)),
    bestSetIndex: bestSetOf(sets, kind),
    heaviest: max(sets.map((set) => set.weightGrams)),
    volume: weighedReps.length === 0 ? null : weighedReps.reduce((total, set) => total + set.weightGrams! * set.reps!, 0),
    mostReps: max(sets.map((set) => set.reps)),
    totalReps: sum(sets.map((set) => set.reps)),
    longest: max(sets.map((set) => set.seconds)),
    totalSeconds: sum(sets.map((set) => set.seconds)),
    distance: null,
    pace: null,
    speed: null,
    level: null,
    duration: exercise.durationSeconds,
  };
}

/**
 * The session with the highest score, `score` giving its value and then what breaks a tie; on the
 * same score the earlier one, which made the record first. Null when no session has a score.
 */
function bestSession(
  sessions: readonly Session[],
  kind: EffortKind,
  score: (metrics: SessionMetrics) => readonly number[] | null,
): { session: Session; metrics: SessionMetrics } | null {
  let best: { session: Session; metrics: SessionMetrics; score: readonly number[] } | null = null;
  // Oldest first, so a later equal score does not take the record.
  for (const session of [...sessions].reverse()) {
    const metrics = sessionMetrics(session.exercise, kind);
    const value = score(metrics);
    if (value && (!best || greater(value, best.score))) best = { session, metrics, score: value };
  }
  return best;
}

/** What makes a session the best of a kind, the BEST on its History card. */
function bestScore(kind: EffortKind): (metrics: SessionMetrics) => readonly number[] | null {
  switch (kind) {
    case 'weight_reps':
      return (m) => (m.oneRm !== null ? [1, m.oneRm, m.heaviest ?? 0] : m.heaviest !== null ? [0, m.heaviest, m.mostReps ?? 0] : null);
    case 'reps':
      return (m) => (m.mostReps === null ? null : [m.mostReps]);
    case 'time':
      return (m) => (m.longest === null ? null : [m.longest]);
    case 'weight_time':
      return (m) => (m.heaviest === null ? null : [m.heaviest, m.longest ?? 0]);
    case 'distance':
      return (m) => (m.distance === null ? null : [m.distance, -(m.pace ?? 0)]);
    case 'speed':
      return (m) => (m.duration === null ? null : [m.duration, m.speed ?? 0]);
    case 'level':
      return (m) => (m.duration === null ? null : [m.duration, m.level ?? 0]);
    case 'duration':
      return (m) => (m.duration === null ? null : [m.duration]);
  }
}

/** The session holding the best effort ever, or null. */
export function bestOfAll(sessions: readonly Session[], kind: EffortKind): Session | null {
  return bestSession(sessions, kind, bestScore(kind))?.session ?? null;
}

/** Grams in a pound, as the shared units convert. */
const GRAMS_PER_LB = 453.592_37;

/** An estimated 1RM as shown: to the nearest 0.5 kg or 1 lb, rounded once from the grams, with one decimal. */
export function oneRmText(grams: number, unit: BodyWeightUnit): string {
  return (unit === 'kg' ? Math.round(grams / 500) / 2 : Math.round(grams / GRAMS_PER_LB)).toFixed(1);
}

/** A weight in the lifting unit, with one decimal, without the unit: "70.0". */
function weightNumber(grams: number, unit: BodyWeightUnit): string {
  return fromGrams(grams, unit).toFixed(1);
}

/** Weight moved, a whole number in the lifting unit: "1,720". */
function volumeNumber(grams: number, unit: BodyWeightUnit): string {
  return formatInteger(Math.round(fromGrams(grams, unit)));
}

/** "5:24" a km. */
function paceText(secondsPerKm: number): string {
  return formatDuration(Math.round(secondsPerKm));
}

/** One of the three record cards. */
export type RecordCard = { label: string; value: string; unit: string; day: string };

/** The three record cards for a kind (the plan's table), each with the day it was made. */
export function exerciseRecords(sessions: readonly Session[], kind: EffortKind, unit: BodyWeightUnit): RecordCard[] {
  const workouts = new Set(sessions.map((session) => session.workoutId)).size;
  const first = sessions.at(-1);
  const count: RecordCard = { label: 'Workouts', value: String(workouts), unit: '', day: first ? `since ${formatDay(first.day)}` : '' };
  const card = (label: string, recordUnit: string, score: (m: SessionMetrics) => number | null, text: (value: number, m: SessionMetrics) => string, lowest = false): RecordCard => {
    const found = bestSession(sessions, kind, (m) => {
      const value = score(m);
      return value === null ? null : [lowest ? -value : value];
    });
    if (!found) return { label, value: '–', unit: recordUnit, day: '' };
    return { label, value: text(score(found.metrics)!, found.metrics), unit: recordUnit, day: formatDay(found.session.day) };
  };
  switch (kind) {
    case 'weight_reps': {
      const top = bestSession(sessions, kind, bestScore(kind));
      const set = top && top.metrics.bestSetIndex !== null && top.session.exercise.kind === 'sets' ? top.session.exercise.sets[top.metrics.bestSetIndex] : undefined;
      return [
        card('Estimated 1RM', unit, (m) => m.oneRm, (value) => oneRmText(value, unit)),
        {
          label: 'Best set',
          value: set && set.weightGrams !== null && set.reps !== null ? `${weightNumber(set.weightGrams, unit)} × ${set.reps}` : '–',
          unit,
          day: top ? formatDay(top.session.day) : '',
        },
        card('Best session', unit, (m) => m.volume, (value) => volumeNumber(value, unit)),
      ];
    }
    case 'reps':
      return [
        card('Most reps', 'reps', (m) => m.mostReps, String),
        card('Best session', 'reps', (m) => m.totalReps, String),
        count,
      ];
    case 'time':
      return [card('Longest', '', (m) => m.longest, formatDuration), card('Best session', '', (m) => m.totalSeconds, formatDuration), count];
    case 'weight_time':
      return [card('Heaviest', unit, (m) => m.heaviest, (value) => weightNumber(value, unit)), card('Longest', '', (m) => m.longest, formatDuration), count];
    case 'distance': {
      const longest = bestSession(sessions, kind, bestScore(kind));
      return [
        {
          label: 'Longest distance',
          value: longest?.metrics.distance != null ? (longest.metrics.distance / 1000).toFixed(2) : '–',
          unit: 'km',
          day: longest ? formatDay(longest.session.day) : '',
        },
        card('Fastest pace', '/km', (m) => m.pace, paceText, true),
        count,
      ];
    }
    case 'speed':
      return [
        card('Longest time', '', (m) => m.duration, formatDuration),
        card('Fastest speed', 'km/h', (m) => m.speed, (value) => (value / 1000).toFixed(1)),
        count,
      ];
    case 'level':
      return [card('Longest time', '', (m) => m.duration, formatDuration), card('Highest level', '', (m) => m.level, String), count];
    case 'duration': {
      const total = sum(sessions.map((session) => sessionMetrics(session.exercise, kind).duration));
      return [
        card('Longest', '', (m) => m.duration, formatDuration),
        { label: 'Total time', value: total === null ? '–' : formatDuration(total), unit: '', day: first ? `since ${formatDay(first.day)}` : '' },
        count,
      ];
    }
  }
}

/** "6 workouts · first on Mon 14 Sep · last on Fri 30 Oct", or "1 workout · Fri 30 Oct". */
export function sessionsSummary(sessions: readonly Session[]): string {
  const workouts = new Set(sessions.map((session) => session.workoutId)).size;
  const newest = sessions[0];
  const oldest = sessions.at(-1);
  if (!newest || !oldest) return '';
  if (workouts === 1) return `1 workout · ${formatDay(newest.day)}`;
  return `${workouts} workouts · first on ${formatDay(oldest.day)} · last on ${formatDay(newest.day)}`;
}

/** What the graph can show. */
export type GraphMetric = 'oneRm' | 'heaviest' | 'volume' | 'mostReps' | 'longest' | 'distance' | 'duration';

/** The graph's choices for a kind: three for a lift, one for the others. */
export const GRAPH_METRICS: Record<EffortKind, readonly GraphMetric[]> = {
  weight_reps: ['oneRm', 'heaviest', 'volume'],
  reps: ['mostReps'],
  time: ['longest'],
  weight_time: ['heaviest'],
  distance: ['distance'],
  speed: ['duration'],
  level: ['duration'],
  duration: ['duration'],
};

export const GRAPH_METRIC_LABELS: Record<GraphMetric, string> = {
  oneRm: 'Est. 1RM',
  heaviest: 'Heaviest',
  volume: 'Volume',
  mostReps: 'Most reps',
  longest: 'Longest',
  distance: 'Distance',
  duration: 'Time',
};

/** The graph's ranges (D-82): the last 4 or 12 weeks, or all the workouts known. */
export const GRAPH_RANGES = ['4W', '12W', 'All'] as const;
export type GraphRange = (typeof GRAPH_RANGES)[number];

/** The first day a range holds, or null for All. */
export function rangeStart(range: GraphRange, today: IstDay): IstDay | null {
  return range === '4W' ? addDays(today, -27) : range === '12W' ? addDays(today, -83) : null;
}

/** A point of the graph, in the unit shown (kg or lb, reps, seconds, km). */
export type GraphPoint = { day: IstDay; value: number };

/** A metric's value as the graph shows it: a 1RM to its step, other weights to 0.1, km to 0.01. */
function shownValue(metric: GraphMetric, metrics: SessionMetrics, unit: BodyWeightUnit): number | null {
  switch (metric) {
    case 'oneRm':
      return metrics.oneRm === null ? null : Number(oneRmText(metrics.oneRm, unit));
    case 'heaviest':
      return metrics.heaviest === null ? null : fromGrams(metrics.heaviest, unit);
    case 'volume':
      return metrics.volume === null ? null : Math.round(fromGrams(metrics.volume, unit));
    case 'mostReps':
      return metrics.mostReps;
    case 'longest':
      return metrics.longest;
    case 'distance':
      return metrics.distance === null ? null : Math.round(metrics.distance / 10) / 100;
    case 'duration':
      return metrics.duration;
  }
}

/** The graph's points, oldest first: a point per session in the range that has the metric. */
export function graphPoints(sessions: readonly Session[], kind: EffortKind, metric: GraphMetric, from: IstDay | null, unit: BodyWeightUnit): GraphPoint[] {
  return [...sessions]
    .reverse()
    .filter((session) => from === null || session.day >= from)
    .flatMap((session) => {
      const value = shownValue(metric, sessionMetrics(session.exercise, kind), unit);
      return value === null ? [] : [{ day: session.day, value }];
    });
}

/** A graph value as text, with its unit: "88.5 kg", "1,720 kg", "15 reps", "1:00", "8.00 km". */
export function graphValueText(metric: GraphMetric, value: number, unit: BodyWeightUnit): string {
  switch (metric) {
    case 'oneRm':
    case 'heaviest':
      return `${value.toFixed(1)} ${unit}`;
    case 'volume':
      return `${formatInteger(value)} ${unit}`;
    case 'mostReps':
      return `${value} ${value === 1 ? 'rep' : 'reps'}`;
    case 'longest':
    case 'duration':
      return formatDuration(value);
    case 'distance':
      return `${value.toFixed(2)} km`;
  }
}

/** "up 22.0 kg since Mon 14 Sep", "down 1:00 since…", or "the same as on…": from the range's first point to its last. */
export function graphChange(points: readonly GraphPoint[], metric: GraphMetric, unit: BodyWeightUnit): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return '';
  const difference = Math.round((last.value - first.value) * 100) / 100;
  if (difference === 0) return `the same as on ${formatDay(first.day)}`;
  return `${difference > 0 ? 'up' : 'down'} ${graphValueText(metric, Math.abs(difference), unit)} since ${formatDay(first.day)}`;
}

/** One row of a History card: a set, and whether it is the workout's best. */
export type HistoryRow = { label: string; value: string; best: boolean };

/** A History card: its title, its sets (or cardio's line), a line under them, and what a screen reader hears. */
export type HistoryCard = { title: string; rows: HistoryRow[]; main: string; footer: string; aria: string };

/** A session's card on the History tab. */
export function historyCard(session: Session, kind: EffortKind, unit: BodyWeightUnit, best: boolean): HistoryCard {
  const title = formatDay(session.day) + (session.workoutNumber === null ? '' : ` · Workout ${session.workoutNumber}`);
  const { exercise } = session;
  const metrics = sessionMetrics(exercise, kind);
  const lines = exerciseLines(exercise, unit);
  let rows: HistoryRow[] = [];
  let footer = '';
  if (exercise.kind === 'sets') {
    const shown = setRows(exercise.sets, unit);
    rows = shown.map((row, index) => ({ ...row, best: shown.length === 1 || index === metrics.bestSetIndex }));
    if (kind === 'weight_reps') {
      footer = [
        ...(metrics.volume === null ? [] : [`Volume ${volumeNumber(metrics.volume, unit)} ${unit}`]),
        ...(metrics.oneRm === null ? [] : [`Est. 1RM ${oneRmText(metrics.oneRm, unit)} ${unit}`]),
      ].join(' · ');
    } else if (kind === 'reps' && metrics.totalReps !== null) {
      footer = `Total ${metrics.totalReps} ${metrics.totalReps === 1 ? 'rep' : 'reps'}`;
    } else if (kind === 'time' && metrics.totalSeconds !== null) {
      footer = `Total ${formatDuration(metrics.totalSeconds)}`;
    }
  } else {
    footer = lines.detail;
  }
  const what = exercise.kind === 'sets' ? rows.map((row) => `${row.label}, ${row.value}`).join('; ') : lines.main;
  return { title, rows, main: exercise.kind === 'cardio' ? lines.main : '', footer, aria: `${title}: ${what}${best ? ', your best' : ''}` };
}
