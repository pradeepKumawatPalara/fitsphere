import {
  addDays,
  exerciseNameKey,
  fromGrams,
  type BodyWeightUnit,
  type CardioExercise,
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

/**
 * One day's doing of the exercise: every time it was logged that day as one (the owner, 2026-11-12:
 * "I add it twice on the 12 nov so it shows twice ... merge these twice into one. the sets added to as
 * a next set"), in one workout or several.
 */
export type Session = {
  /** The first workout holding it that day, which its History card opens. */
  workoutId: string;
  /** Every workout holding it that day, in the order started. */
  workoutIds: string[];
  day: IstDay;
  /** "Workout 2" when it is in one workout and its day has several with an exercise (D-34, D-65), else null. */
  workoutNumber: number | null;
  /** The day's entries as one: the sets one after another; cardio's times and distances added up. */
  exercise: WorkoutExercise;
};

/**
 * The day's entries of one kind as one exercise: a set exercise's sets in the order logged; cardio's
 * time and distance added up, a treadmill's speed, its incline and a machine's level the highest;
 * calories added up; the highest heart rate the highest, the average left out.
 */
function mergedEntries(entries: readonly WorkoutExercise[]): WorkoutExercise {
  const [first, ...rest] = entries as [WorkoutExercise, ...WorkoutExercise[]];
  if (rest.length === 0) return first;
  const kcal = sum(entries.map((entry) => entry.calories?.kcal ?? null));
  const shared = {
    calories: kcal === null ? null : { kcal, estimated: entries.some((entry) => entry.calories?.estimated === true) },
    averageHeartRateBpm: null,
    highestHeartRateBpm: max(entries.map((entry) => entry.highestHeartRateBpm)),
    note: null,
  };
  if (first.kind === 'sets') {
    const sets = entries.flatMap((entry) => (entry.kind === 'sets' ? entry.sets : []));
    return { ...first, ...shared, sets, durationSeconds: sum(entries.map((entry) => (entry.kind === 'sets' ? entry.durationSeconds : null))) };
  }
  const cardio = entries.filter((entry): entry is CardioExercise => entry.kind === 'cardio');
  const distance = sum(cardio.map((entry) => entry.distanceMetres));
  return {
    ...first,
    ...shared,
    durationSeconds: cardio.reduce((total, entry) => total + entry.durationSeconds, 0),
    distanceMetres: distance,
    speedMetresPerHour: distance === null ? max(cardio.map((entry) => entry.speedMetresPerHour)) : null,
    inclinePermille: max(cardio.map((entry) => entry.inclinePermille)),
    level: max(cardio.map((entry) => entry.level)),
  };
}

/**
 * Every day the exercise was done, newest first, each as one session: the exercises of `workouts`
 * whose name, ignoring case, hyphens, spaces and doubled letters, is one of `names` (a list exercise's
 * name and other names, so a workout saved under a name it had before counts; or the name the user
 * typed). Logged twice on a day, in one workout or two, its sets follow one another (2026-11-12); done
 * once in sets and once as cardio, the two stay apart.
 */
export function exerciseSessions(workouts: readonly ExerciseWorkout[], names: readonly string[]): Session[] {
  const keys = new Set(names.map(exerciseNameKey).filter((key) => key !== ''));
  const unique = [...new Map(workouts.filter((workout) => workout.exercises.length > 0).map((workout) => [workout.id, workout])).values()];
  const byDay = new Map<IstDay, ExerciseWorkout[]>();
  for (const workout of unique) byDay.set(workout.day, [...(byDay.get(workout.day) ?? []), workout]);
  const sessions: Session[] = [];
  for (const [day, list] of byDay) {
    const ordered = [...list].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    for (const kind of ['sets', 'cardio'] as const) {
      const found = ordered.flatMap((workout, index) =>
        workout.exercises
          .filter((exercise) => exercise.kind === kind && keys.has(exerciseNameKey(exercise.name)))
          .map((exercise) => ({ workout, index, exercise })),
      );
      const firstFound = found[0];
      if (!firstFound) continue;
      const workoutIds = [...new Set(found.map((entry) => entry.workout.id))];
      sessions.push({
        workoutId: firstFound.workout.id,
        workoutIds,
        day,
        workoutNumber: workoutIds.length === 1 && ordered.length > 1 ? firstFound.index + 1 : null,
        exercise: mergedEntries(found.map((entry) => entry.exercise)),
      });
    }
  }
  return sessions.sort((a, b) => b.day.localeCompare(a.day));
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

/** One of an exercise's bests (D-82): a lift's three, the owner's 1RM, Heaviest and Volume; one or two for the other kinds. */
export type BestKey = 'oneRm' | 'heaviest' | 'volume' | 'mostReps' | 'repsSession' | 'longest' | 'timeSession' | 'fastest' | 'level';

/**
 * A best: its name in full (History's tiles) and short (a card's tag, in the owner's words), its value
 * as shown, the day it was made and the session holding it.
 */
export type ExerciseBest = { key: BestKey; label: string; short: string; value: string; unit: string; day: string; session: Session };

type BestSpec = {
  key: BestKey;
  label: string;
  short: string;
  /** Its value, then what breaks a tie; the higher wins, and on the same score the earlier. */
  score(metrics: SessionMetrics): readonly number[] | null;
  text(metrics: SessionMetrics, unit: BodyWeightUnit): { value: string; unit: string };
};

/** A time held longest: a hold's longest set, cardio's longest time. */
function longestSpec(value: (metrics: SessionMetrics) => number | null, tie: (metrics: SessionMetrics) => number = () => 0): BestSpec {
  return {
    key: 'longest',
    label: 'Longest',
    short: 'Longest',
    score: (m) => (value(m) === null ? null : [value(m)!, tie(m)]),
    text: (m) => ({ value: formatDuration(value(m)!), unit: '' }),
  };
}

const HEAVIEST: BestSpec = {
  key: 'heaviest',
  label: 'Heaviest',
  short: 'Heaviest',
  score: (m) => (m.heaviest === null ? null : [m.heaviest, m.mostReps ?? m.longest ?? 0]),
  text: (m, unit) => ({ value: weightNumber(m.heaviest!, unit), unit }),
};

/** The bests each kind keeps, in the order History's tiles show them. */
function bestSpecs(kind: EffortKind): BestSpec[] {
  switch (kind) {
    case 'weight_reps':
      return [
        {
          key: 'oneRm',
          label: 'Best 1RM',
          short: '1RM',
          score: (m) => (m.oneRm === null ? null : [m.oneRm, m.heaviest ?? 0]),
          text: (m, unit) => ({ value: oneRmText(m.oneRm!, unit), unit }),
        },
        HEAVIEST,
        {
          key: 'volume',
          label: 'Best volume',
          short: 'Volume',
          score: (m) => (m.volume === null ? null : [m.volume]),
          text: (m, unit) => ({ value: volumeNumber(m.volume!, unit), unit }),
        },
      ];
    case 'reps':
      return [
        { key: 'mostReps', label: 'Most reps', short: 'Most reps', score: (m) => (m.mostReps === null ? null : [m.mostReps]), text: (m) => ({ value: String(m.mostReps), unit: 'reps' }) },
        { key: 'repsSession', label: 'Best session', short: 'Session', score: (m) => (m.totalReps === null ? null : [m.totalReps]), text: (m) => ({ value: String(m.totalReps), unit: 'reps' }) },
      ];
    case 'time':
      return [
        longestSpec((m) => m.longest),
        { key: 'timeSession', label: 'Best session', short: 'Session', score: (m) => (m.totalSeconds === null ? null : [m.totalSeconds]), text: (m) => ({ value: formatDuration(m.totalSeconds!), unit: '' }) },
      ];
    case 'weight_time':
      return [HEAVIEST, longestSpec((m) => m.longest)];
    case 'distance':
      return [
        {
          key: 'longest',
          label: 'Longest',
          short: 'Longest',
          score: (m) => (m.distance === null ? null : [m.distance, -(m.pace ?? 0)]),
          text: (m) => ({ value: (m.distance! / 1000).toFixed(2), unit: 'km' }),
        },
        { key: 'fastest', label: 'Fastest', short: 'Fastest', score: (m) => (m.pace === null ? null : [-m.pace]), text: (m) => ({ value: paceText(m.pace!), unit: '/km' }) },
      ];
    case 'speed':
      return [
        longestSpec((m) => m.duration, (m) => m.speed ?? 0),
        { key: 'fastest', label: 'Fastest', short: 'Fastest', score: (m) => (m.speed === null ? null : [m.speed]), text: (m) => ({ value: (m.speed! / 1000).toFixed(1), unit: 'km/h' }) },
      ];
    case 'level':
      return [
        longestSpec((m) => m.duration, (m) => m.level ?? 0),
        { key: 'level', label: 'Highest level', short: 'Level', score: (m) => (m.level === null ? null : [m.level]), text: (m) => ({ value: String(m.level), unit: '' }) },
      ];
    case 'duration':
      return [longestSpec((m) => m.duration)];
  }
}

/** An exercise's bests ever (D-82): each with the session holding it, the earlier on a tie; none it has no value for. */
export function exerciseBests(sessions: readonly Session[], kind: EffortKind, unit: BodyWeightUnit): ExerciseBest[] {
  return bestSpecs(kind).flatMap((spec) => {
    const found = bestSession(sessions, kind, spec.score);
    if (!found) return [];
    const { value, unit: shownUnit } = spec.text(found.metrics, unit);
    return [{ key: spec.key, label: spec.label, short: spec.short, value, unit: shownUnit, day: formatDay(found.session.day), session: found.session }];
  });
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

/**
 * The three record cards for a kind (the plan's table), each with the day it was made: a lift's are
 * History's three bests (the owner, 2026-11-12), Estimated 1RM, Heaviest and Best volume.
 */
export function exerciseRecords(sessions: readonly Session[], kind: EffortKind, unit: BodyWeightUnit): RecordCard[] {
  const workouts = new Set(sessions.flatMap((session) => session.workoutIds)).size;
  const first = sessions.at(-1);
  const count: RecordCard = { label: 'Workouts', value: String(workouts), unit: '', day: first ? `since ${formatDay(first.day)}` : '' };
  const bests = exerciseBests(sessions, kind, unit);
  const card = (key: BestKey, label: string, emptyUnit: string): RecordCard => {
    const best = bests.find((each) => each.key === key);
    return best ? { label, value: best.value, unit: best.unit, day: best.day } : { label, value: '–', unit: emptyUnit, day: '' };
  };
  switch (kind) {
    case 'weight_reps':
      return [card('oneRm', 'Estimated 1RM', unit), card('heaviest', 'Heaviest', unit), card('volume', 'Best volume', unit)];
    case 'reps':
      return [card('mostReps', 'Most reps', 'reps'), card('repsSession', 'Best session', 'reps'), count];
    case 'time':
      return [card('longest', 'Longest', ''), card('timeSession', 'Best session', ''), count];
    case 'weight_time':
      return [card('heaviest', 'Heaviest', unit), card('longest', 'Longest', ''), count];
    case 'distance':
      return [card('longest', 'Longest distance', 'km'), card('fastest', 'Fastest pace', '/km'), count];
    case 'speed':
      return [card('longest', 'Longest time', ''), card('fastest', 'Fastest speed', 'km/h'), count];
    case 'level':
      return [card('longest', 'Longest time', ''), card('level', 'Highest level', ''), count];
    case 'duration': {
      const total = sum(sessions.map((session) => sessionMetrics(session.exercise, kind).duration));
      return [
        card('longest', 'Longest', ''),
        { label: 'Total time', value: total === null ? '–' : formatDuration(total), unit: '', day: first ? `since ${formatDay(first.day)}` : '' },
        count,
      ];
    }
  }
}

/** "6 workouts · first on Mon 14 Sep · last on Fri 30 Oct", or "1 workout · Fri 30 Oct". */
export function sessionsSummary(sessions: readonly Session[]): string {
  const workouts = new Set(sessions.flatMap((session) => session.workoutIds)).size;
  const newest = sessions[0];
  const oldest = sessions.at(-1);
  if (!newest || !oldest) return '';
  if (newest.day === oldest.day) return `${workouts === 1 ? '1 workout' : `${workouts} workouts`} · ${formatDay(newest.day)}`;
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
export type GraphPoint = { day: IstDay; value: number; session: Session };

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
      return value === null ? [] : [{ day: session.day, value, session }];
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
export function graphChange(points: readonly Pick<GraphPoint, 'day' | 'value'>[], metric: GraphMetric, unit: BodyWeightUnit): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return '';
  const difference = Math.round((last.value - first.value) * 100) / 100;
  if (difference === 0) return `the same as on ${formatDay(first.day)}`;
  return `${difference > 0 ? 'up' : 'down'} ${graphValueText(metric, Math.abs(difference), unit)} since ${formatDay(first.day)}`;
}

/** One row of a History card: a set, and whether it is the workout's best. */
export type HistoryRow = { label: string; value: string; best: boolean };

/**
 * A History card: its title, the bests it holds as tags at its top right (D-82, the owner's C), its
 * sets (or cardio's line), a line under them, and what a screen reader hears.
 */
export type HistoryCard = { title: string; tags: ExerciseBest[]; rows: HistoryRow[]; main: string; footer: string; aria: string };

/** A session's card on the History tab, with the bests of `bests` it holds. */
export function historyCard(session: Session, kind: EffortKind, unit: BodyWeightUnit, bests: readonly ExerciseBest[]): HistoryCard {
  const title =
    formatDay(session.day) +
    (session.workoutIds.length > 1 ? ` · ${session.workoutIds.length} workouts` : session.workoutNumber === null ? '' : ` · Workout ${session.workoutNumber}`);
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
  const tags = bests.filter((best) => best.session === session);
  const held = tags.length === 0 ? '' : `, ${tags.map((tag) => tag.label).join(', ')}`;
  return { title, tags, rows, main: exercise.kind === 'cardio' ? lines.main : '', footer, aria: `${title}: ${what}${held}` };
}

/** One of a workout's numbers under the graph (D-82, the owner's C), and the graph measure it is, if any. */
export type WorkoutNumber = { label: string; value: string; metric: GraphMetric | null };

/**
 * The numbers of the workout touched on the graph (the owner's C, 2026-11-12): a lift's Est. 1RM,
 * Heaviest and Volume; running's distance, time and pace; and so for the other kinds.
 */
export function workoutNumbers(session: Session, kind: EffortKind, unit: BodyWeightUnit): WorkoutNumber[] {
  const m = sessionMetrics(session.exercise, kind);
  const or = (value: number | null, text: (value: number) => string) => (value === null ? '–' : text(value));
  switch (kind) {
    case 'weight_reps':
      return [
        { label: 'Est. 1RM', value: or(m.oneRm, (v) => `${oneRmText(v, unit)} ${unit}`), metric: 'oneRm' },
        { label: 'Heaviest', value: or(m.heaviest, (v) => `${weightNumber(v, unit)} ${unit}`), metric: 'heaviest' },
        { label: 'Volume', value: or(m.volume, (v) => `${volumeNumber(v, unit)} ${unit}`), metric: 'volume' },
      ];
    case 'reps':
      return [
        { label: 'Most reps', value: or(m.mostReps, String), metric: 'mostReps' },
        { label: 'Total reps', value: or(m.totalReps, String), metric: null },
      ];
    case 'time':
      return [
        { label: 'Longest', value: or(m.longest, formatDuration), metric: 'longest' },
        { label: 'Total', value: or(m.totalSeconds, formatDuration), metric: null },
      ];
    case 'weight_time':
      return [
        { label: 'Heaviest', value: or(m.heaviest, (v) => `${weightNumber(v, unit)} ${unit}`), metric: 'heaviest' },
        { label: 'Longest', value: or(m.longest, formatDuration), metric: null },
      ];
    case 'distance':
      return [
        { label: 'Distance', value: or(m.distance, (v) => `${(v / 1000).toFixed(2)} km`), metric: 'distance' },
        { label: 'Time', value: or(m.duration, formatDuration), metric: null },
        { label: 'Pace', value: or(m.pace, (v) => `${paceText(v)} /km`), metric: null },
      ];
    case 'speed':
      return [
        { label: 'Time', value: or(m.duration, formatDuration), metric: 'duration' },
        { label: 'Speed', value: or(m.speed, (v) => `${(v / 1000).toFixed(1)} km/h`), metric: null },
      ];
    case 'level':
      return [
        { label: 'Time', value: or(m.duration, formatDuration), metric: 'duration' },
        { label: 'Level', value: or(m.level, String), metric: null },
      ];
    case 'duration':
      return [{ label: 'Time', value: or(m.duration, formatDuration), metric: 'duration' }];
  }
}
