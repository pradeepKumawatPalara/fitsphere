import {
  EXERCISE_DISTANCE_METRES_MAX,
  EXERCISE_DISTANCE_METRES_MIN,
  EXERCISE_INCLINE_PERMILLE_MAX,
  EXERCISE_LEVEL_MAX,
  EXERCISE_NAME_MAX,
  EXERCISE_NOTE_MAX,
  EXERCISE_REPS_MAX,
  EXERCISE_SECONDS_MAX,
  EXERCISE_SPEED_METRES_PER_HOUR_MAX,
  EXERCISE_SPEED_METRES_PER_HOUR_MIN,
  formatWeight,
  fromGrams,
  isLiftWeightGramsInRange,
  LIFT_WEIGHT_GRAMS_MAX,
  LIFT_WEIGHT_GRAMS_MIN,
  toGrams,
  weightRangeIn,
  type BodyWeightUnit,
  type ExerciseGroup,
  type ExerciseLogType,
  type ExerciseSet,
  type ListedExercise,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { formatInteger, parseOneDecimal, parseTwoDecimals, parseWholeNumber } from './format';

// Workouts on screen (REQ-TRN-003…005; D-50): exercises from FitSphere's exercise list, or named by
// the user, done in sets (each with its own reps, weight and time) or as cardio (a time, with a
// distance, a treadmill's speed and incline or a machine's level), within the limits of the contracts.
// Weights are typed and shown in the lifting-weight unit setting (REQ-TRN-005, REQ-ACC-002) and stored
// in grams, so changing the setting converts the history shown; the limits are 0.1–500 kg in either
// unit, rounded inwards to one decimal (MVP default, D-31). Distances are in km and speeds in km/h.

/** The group shown beside an exercise's name. */
export const GROUP_LABELS: Record<ExerciseGroup, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  band: 'Band',
  cardio: 'Cardio',
  sport: 'Sport',
  yoga: 'Yoga and mobility',
  other: 'Other',
};

/** How a list exercise is logged, as the sheet names it under the exercise's name. */
export const LOG_TYPE_LABELS: Record<ExerciseLogType, string> = {
  weight_reps: 'Weight and reps',
  reps: 'Reps',
  time: 'Time',
  weight_time: 'Weight and time',
  distance_time: 'Distance and time',
  treadmill: 'Treadmill',
  cardio_machine: 'Cardio machine',
  time_only: 'Time only',
};

/** How a name of the user's own is logged: "Log as" (D-50). */
export const LOG_AS = ['sets', 'time', 'cardio'] as const;
export type LogAs = (typeof LOG_AS)[number];
export const LOG_AS_LABELS: Record<LogAs, string> = { sets: 'Sets and reps', time: 'Time', cardio: 'Cardio' };

export type SetColumn = 'reps' | 'weight' | 'seconds';
export type CardioField = 'distance' | 'speed' | 'incline' | 'level';

/**
 * The fields the sheet shows: a set's columns, each required or not; or cardio's time, always
 * required, and its other fields, all optional.
 */
export type Layout =
  | { kind: 'sets'; columns: { column: SetColumn; required: boolean }[] }
  | { kind: 'cardio'; fields: CardioField[] };

const REPS = { column: 'reps', required: true } as const;
const WEIGHT = { column: 'weight', required: true } as const;
const OPTIONAL_WEIGHT = { column: 'weight', required: false } as const;
const TIME = { column: 'seconds', required: true } as const;

/** Each type's fields: a weight where one is lifted, none for bodyweight (the owner, 2026-11-04). */
const LAYOUTS: Record<ExerciseLogType, Layout> = {
  weight_reps: { kind: 'sets', columns: [REPS, WEIGHT] },
  reps: { kind: 'sets', columns: [REPS] },
  time: { kind: 'sets', columns: [TIME] },
  weight_time: { kind: 'sets', columns: [WEIGHT, TIME] },
  distance_time: { kind: 'cardio', fields: ['distance'] },
  treadmill: { kind: 'cardio', fields: ['speed', 'incline', 'distance'] },
  cardio_machine: { kind: 'cardio', fields: ['distance', 'level'] },
  time_only: { kind: 'cardio', fields: [] },
};

const OWN_LAYOUTS: Record<LogAs, Layout> = {
  sets: { kind: 'sets', columns: [REPS, OPTIONAL_WEIGHT] },
  time: { kind: 'sets', columns: [OPTIONAL_WEIGHT, TIME] },
  cardio: { kind: 'cardio', fields: ['distance'] },
};

/** Whether a list exercise is done in sets or as cardio. */
export function logTypeKind(logType: ExerciseLogType): WorkoutExercise['kind'] {
  return LAYOUTS[logType].kind;
}

/** How an exercise already saved is logged, as "Log as" names it. */
export function logAsOf(exercise: WorkoutExercise): LogAs {
  if (exercise.kind === 'cardio') return 'cardio';
  return exercise.sets.some((set) => set.reps !== null) ? 'sets' : 'time';
}

function setValue(set: ExerciseSet, column: SetColumn): number | null {
  return column === 'reps' ? set.reps : column === 'weight' ? set.weightGrams : set.seconds;
}

function cardioValue(exercise: Extract<WorkoutExercise, { kind: 'cardio' }>, field: CardioField): number | null {
  return { distance: exercise.distanceMetres, speed: exercise.speedMetresPerHour, incline: exercise.inclinePermille, level: exercise.level }[field];
}

/**
 * The fields for a list exercise, or for a name of the user's own logged as `logAs`; with any field the
 * exercise being edited already has a value in, so editing it never drops a value (D-50).
 */
export function exerciseLayout(listed: ListedExercise | null, logAs: LogAs, kept: WorkoutExercise | null): Layout {
  const layout = listed ? LAYOUTS[listed.logType] : OWN_LAYOUTS[logAs];
  if (layout.kind === 'sets' && kept?.kind === 'sets') {
    const shown = layout.columns.map(({ column }) => column);
    const extra = (['reps', 'weight', 'seconds'] as const).filter(
      (column) => !shown.includes(column) && kept.sets.some((set) => setValue(set, column) !== null),
    );
    return { kind: 'sets', columns: [...layout.columns, ...extra.map((column) => ({ column, required: false }))] };
  }
  if (layout.kind === 'cardio' && kept?.kind === 'cardio') {
    const extra = (['distance', 'speed', 'incline', 'level'] as const).filter(
      (field) => !layout.fields.includes(field) && cardioValue(kept, field) !== null,
    );
    return { kind: 'cardio', fields: [...layout.fields, ...extra] };
  }
  return layout;
}

export function exerciseRules(unit: BodyWeightUnit) {
  const { min, max } = weightRangeIn(unit, LIFT_WEIGHT_GRAMS_MIN, LIFT_WEIGHT_GRAMS_MAX);
  const weights = `from ${min.toFixed(1)} to ${max.toFixed(1)} ${unit}`;
  return {
    name: `Enter a name of up to ${EXERCISE_NAME_MAX} characters.`,
    reps: `enter reps from 1 to ${EXERCISE_REPS_MAX}.`,
    weight: `enter the weight you lifted, ${weights}.`,
    optionalWeight: `enter a weight ${weights}, with at most one decimal, or leave it empty.`,
    seconds: `enter the time in seconds, from 1 to ${formatInteger(EXERCISE_SECONDS_MAX)}.`,
    time: 'Enter the time in minutes and seconds, up to 24 hours.',
    distance: 'Enter a distance from 0.01 to 500.00 km, with at most two decimals, or leave it empty.',
    speed: 'Enter a speed from 0.1 to 40.0 km/h, with at most one decimal, or leave it empty.',
    incline: 'Enter an incline from 0.0 to 40.0 %, with at most one decimal, or leave it empty.',
    level: `Enter a level from 1 to ${EXERCISE_LEVEL_MAX}, or leave it empty.`,
    note: `Notes can be up to ${EXERCISE_NOTE_MAX} characters.`,
  } as const;
}

/** One set's fields as typed. */
export type SetText = Record<SetColumn, string>;

/** The exercise sheet's fields as typed; `timeMinutes` and `timeSeconds` are cardio's time. */
export type ExerciseText = {
  name: string;
  logAs: LogAs;
  sets: SetText[];
  timeMinutes: string;
  timeSeconds: string;
  distance: string;
  speed: string;
  incline: string;
  level: string;
  note: string;
};

export const EMPTY_SET: SetText = { reps: '', weight: '', seconds: '' };

export const EMPTY_EXERCISE: ExerciseText = {
  name: '',
  logAs: 'sets',
  sets: [EMPTY_SET],
  timeMinutes: '',
  timeSeconds: '',
  distance: '',
  speed: '',
  incline: '',
  level: '',
  note: '',
};

const typed = (value: number | null, show: (value: number) => string) => (value === null ? '' : show(value));

/** An exercise as the sheet shows it for editing, its weights in `unit`. */
export function toExerciseText(exercise: WorkoutExercise, unit: BodyWeightUnit): ExerciseText {
  const text: ExerciseText = { ...EMPTY_EXERCISE, name: exercise.name, logAs: logAsOf(exercise), note: exercise.note ?? '' };
  if (exercise.kind === 'sets') {
    return {
      ...text,
      sets: exercise.sets.map((set) => ({
        reps: typed(set.reps, String),
        weight: typed(set.weightGrams, (grams) => fromGrams(grams, unit).toFixed(1)),
        seconds: typed(set.seconds, String),
      })),
    };
  }
  return {
    ...text,
    timeMinutes: String(Math.floor(exercise.durationSeconds / 60)),
    timeSeconds: String(exercise.durationSeconds % 60).padStart(2, '0'),
    distance: typed(exercise.distanceMetres, (metres) => (metres / 1000).toFixed(2)),
    speed: typed(exercise.speedMetresPerHour, (metresPerHour) => (metresPerHour / 1000).toFixed(1)),
    incline: typed(exercise.inclinePermille, (permille) => (permille / 10).toFixed(1)),
    level: typed(exercise.level, String),
  };
}

/** A typed lifting weight in grams, or null when it is out of range or not a number. */
function liftWeightGrams(text: string, unit: BodyWeightUnit): number | null {
  const value = parseOneDecimal(text);
  const { min, max } = weightRangeIn(unit, LIFT_WEIGHT_GRAMS_MIN, LIFT_WEIGHT_GRAMS_MAX);
  const grams = value === null || value < min || value > max ? null : toGrams(value, unit);
  return grams !== null && isLiftWeightGramsInRange(grams) ? grams : null;
}

/** A typed value scaled to a whole number in `min`…`max`, or null. */
function scaled(value: number | null, factor: number, min: number, max: number): number | null {
  if (value === null) return null;
  const whole = Math.round(value * factor);
  return whole >= min && whole <= max ? whole : null;
}

/** The problems that keep an exercise from being saved, each shown under its field. */
export type ExerciseProblems = {
  name?: string;
  /** The first set's problem, e.g. "Set 3: enter the weight you lifted, from 0.1 to 500.0 kg." */
  sets?: string;
  /** Every refused set field, as "<set index>:<column>". */
  refused: string[];
  time?: string;
  distance?: string;
  speed?: string;
  incline?: string;
  level?: string;
  note?: string;
};

/**
 * Reads the sheet's fields for `layout`, weights typed in `unit`: the exercise, or every field's
 * problem. Fields the layout does not show are not saved. The calories burned and heart rate of the
 * exercise being edited are kept as they are.
 */
export function parseExercise(
  text: ExerciseText,
  layout: Layout,
  unit: BodyWeightUnit,
  kept: WorkoutExercise | null,
): { exercise: WorkoutExercise } | { problems: ExerciseProblems } {
  const rules = exerciseRules(unit);
  const problems: ExerciseProblems = { refused: [] };
  const name = text.name.trim();
  if (name.length === 0 || name.length > EXERCISE_NAME_MAX) problems.name = rules.name;
  const note = text.note.trim();
  if (note.length > EXERCISE_NOTE_MAX) problems.note = rules.note;
  const common = {
    name,
    calories: kept?.calories ?? null,
    averageHeartRateBpm: kept?.averageHeartRateBpm ?? null,
    highestHeartRateBpm: kept?.highestHeartRateBpm ?? null,
    note: note === '' ? null : note,
  };

  if (layout.kind === 'sets') {
    const sets = text.sets.map((set, index): ExerciseSet => {
      const values: Record<SetColumn, number | null> = { reps: null, weight: null, seconds: null };
      for (const { column, required } of layout.columns) {
        const typedText = set[column].trim();
        const value =
          typedText === ''
            ? null
            : column === 'reps'
              ? parseWholeNumber(typedText, 1, EXERCISE_REPS_MAX)
              : column === 'weight'
                ? liftWeightGrams(typedText, unit)
                : parseWholeNumber(typedText, 1, EXERCISE_SECONDS_MAX);
        if (value === null && (typedText !== '' || required)) {
          problems.refused.push(`${index}:${column}`);
          const rule = column === 'weight' ? (required ? rules.weight : rules.optionalWeight) : rules[column];
          problems.sets ??= `Set ${index + 1}: ${rule}`;
        }
        values[column] = value;
      }
      return { reps: values.reps, weightGrams: values.weight, seconds: values.seconds };
    });
    if (hasProblems(problems)) return { problems };
    return { exercise: { kind: 'sets', ...common, sets, durationSeconds: kept?.kind === 'sets' ? kept.durationSeconds : null } };
  }

  const minutes = parseWholeNumber(text.timeMinutes.trim() || '0', 0, EXERCISE_SECONDS_MAX / 60);
  const seconds = parseWholeNumber(text.timeSeconds.trim() || '0', 0, 59);
  const durationSeconds = minutes === null || seconds === null ? 0 : minutes * 60 + seconds;
  if (durationSeconds < 1 || durationSeconds > EXERCISE_SECONDS_MAX) problems.time = rules.time;
  const field = (key: CardioField, read: (text: string) => number | null): number | null => {
    if (!layout.fields.includes(key) || text[key].trim() === '') return null;
    const value = read(text[key].trim());
    if (value === null) problems[key] = rules[key];
    return value;
  };
  const distanceMetres = field('distance', (typedText) =>
    scaled(parseTwoDecimals(typedText), 1000, EXERCISE_DISTANCE_METRES_MIN, EXERCISE_DISTANCE_METRES_MAX),
  );
  const speedMetresPerHour = field('speed', (typedText) =>
    scaled(parseOneDecimal(typedText), 1000, EXERCISE_SPEED_METRES_PER_HOUR_MIN, EXERCISE_SPEED_METRES_PER_HOUR_MAX),
  );
  const inclinePermille = field('incline', (typedText) => scaled(parseOneDecimal(typedText), 10, 0, EXERCISE_INCLINE_PERMILLE_MAX));
  const level = field('level', (typedText) => parseWholeNumber(typedText, 1, EXERCISE_LEVEL_MAX));
  if (hasProblems(problems)) return { problems };
  return { exercise: { kind: 'cardio', ...common, durationSeconds, distanceMetres, speedMetresPerHour, inclinePermille, level } };
}

function hasProblems(problems: ExerciseProblems): boolean {
  return Object.entries(problems).some(([key, value]) => (key === 'refused' ? (value as string[]).length > 0 : value !== undefined));
}

/** e.g. "30:00", "0:45", "1:05:00". */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** e.g. "5.00 km". */
export function formatDistance(metres: number): string {
  return `${(metres / 1000).toFixed(2)} km`;
}

/** e.g. "10.0 km/h". */
export function formatSpeed(metresPerHour: number): string {
  return `${(metresPerHour / 1000).toFixed(1)} km/h`;
}

/** Running's average speed and pace from its distance and time: "10.0 km/h · 6:00 /km". */
export function speedAndPace(metres: number, seconds: number): string {
  return `${formatSpeed(Math.round((metres / seconds) * 3600))} · ${formatDuration(Math.round(seconds / (metres / 1000)))} /km`;
}

/** A set's reps, time and weight: "10 × 40.0 kg", "0:45 × 24.0 kg", "15"; the weight's unit only if asked. */
function setText(set: ExerciseSet, unit: BodyWeightUnit, withUnit: boolean): string {
  const parts = [
    ...(set.reps === null ? [] : [String(set.reps)]),
    ...(set.seconds === null ? [] : [formatDuration(set.seconds)]),
    ...(set.weightGrams === null ? [] : [withUnit ? formatWeight(set.weightGrams, unit) : fromGrams(set.weightGrams, unit).toFixed(1)]),
  ];
  return parts.join(' × ');
}

/**
 * Sets the same each time as "3 × 10 × 40.0 kg", "3 × 15" or "3 × 1:00"; sets that differ one by one,
 * "10 × 20.0 · 8 × 22.5 · 6 × 25.0 kg", or "15 · 12 · 10 reps".
 */
export function formatSets(sets: readonly ExerciseSet[], unit: BodyWeightUnit): string {
  const [first] = sets;
  if (!first) return '';
  const same = sets.every((set) => set.reps === first.reps && set.seconds === first.seconds && set.weightGrams === first.weightGrams);
  if (same) return `${sets.length} × ${setText(first, unit, true)}`;
  const weighted = sets.some((set) => set.weightGrams !== null);
  const repsOnly = !weighted && sets.every((set) => set.seconds === null);
  const list = sets.map((set) => setText(set, unit, false)).join(' · ');
  return weighted ? `${list} ${unit}` : repsOnly ? `${list} reps` : list;
}

/**
 * An exercise's lines on the workout screen (D-50): its sets, or its time with the distance or the
 * speed; and under it a cardio exercise's speed and pace, incline and level.
 */
export function exerciseLines(exercise: WorkoutExercise, unit: BodyWeightUnit): { main: string; detail: string } {
  if (exercise.kind === 'sets') return { main: formatSets(exercise.sets, unit), detail: '' };
  const { durationSeconds, distanceMetres, speedMetresPerHour, inclinePermille, level } = exercise;
  const main = [formatDuration(durationSeconds)];
  const detail: string[] = [];
  if (distanceMetres !== null) {
    main.push(formatDistance(distanceMetres));
    detail.push(speedMetresPerHour === null ? speedAndPace(distanceMetres, durationSeconds) : formatSpeed(speedMetresPerHour));
  } else if (speedMetresPerHour !== null) {
    main.push(formatSpeed(speedMetresPerHour));
  }
  if (inclinePermille !== null) detail.push(`${(inclinePermille / 10).toFixed(1)} % incline`);
  if (level !== null) detail.push(`Level ${level}`);
  return { main: main.join(' · '), detail: detail.join(' · ') };
}

/** e.g. "3 exercises" and "Squat, Bench press, Row", or "No exercises" and no names. */
export function workoutParts(exercises: readonly Pick<WorkoutExercise, 'name'>[]): { count: string; names: string } {
  if (exercises.length === 0) return { count: 'No exercises', names: '' };
  const count = `${exercises.length} ${exercises.length === 1 ? 'exercise' : 'exercises'}`;
  const names = exercises
    .slice(0, 3)
    .map((exercise) => exercise.name)
    .join(', ');
  return { count, names: `${names}${exercises.length > 3 ? ', …' : ''}` };
}

/** e.g. "3 exercises · Squat, Bench press, Row", or "No exercises". */
export function workoutSummary(exercises: readonly Pick<WorkoutExercise, 'name'>[]): string {
  const { count, names } = workoutParts(exercises);
  return names ? `${count} · ${names}` : count;
}
