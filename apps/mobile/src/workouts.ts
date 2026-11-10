import {
  EXERCISE_DISTANCE_METRES_MAX,
  EXERCISE_DISTANCE_METRES_MIN,
  EXERCISE_INCLINE_PERMILLE_MAX,
  EXERCISE_KCAL_MAX,
  EXERCISE_LEVEL_MAX,
  EXERCISE_NAME_MAX,
  EXERCISE_NOTE_MAX,
  EXERCISE_REPS_MAX,
  EXERCISE_SECONDS_MAX,
  EXERCISE_SPEED_METRES_PER_HOUR_MAX,
  EXERCISE_SPEED_METRES_PER_HOUR_MIN,
  exerciseMet,
  formatWeight,
  fromGrams,
  HEART_RATE_BPM_MAX,
  HEART_RATE_BPM_MIN,
  isLiftWeightGramsInRange,
  istWeekStart,
  LIFT_WEIGHT_GRAMS_MAX,
  LIFT_WEIGHT_GRAMS_MIN,
  toGrams,
  weightRangeIn,
  type BodyWeightUnit,
  type ExerciseGroup,
  type ExerciseLogType,
  type ExerciseSet,
  type IstDay,
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
    spent: `Enter the time spent in minutes, from 1 to ${formatInteger(EXERCISE_SECONDS_MAX / 60)}, or leave it empty.`,
    kcal: `Enter calories from 1 to ${formatInteger(EXERCISE_KCAL_MAX)} kcal, or leave it empty.`,
    heartRate: `Enter a heart rate from ${HEART_RATE_BPM_MIN} to ${HEART_RATE_BPM_MAX} beats a minute, or leave it empty.`,
    heartRateOrder: "The highest heart rate can't be below the average.",
    note: `Notes can be up to ${EXERCISE_NOTE_MAX} characters.`,
  } as const;
}

/** One set's fields as typed. */
export type SetText = Record<SetColumn, string>;

/**
 * The exercise sheet's fields as typed; `timeMinutes` and `timeSeconds` are cardio's time,
 * `spentMinutes` the time spent on sets, and `kcal` the calories typed in place of the estimate, null
 * while the estimate is used (D-50).
 */
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
  spentMinutes: string;
  kcal: string | null;
  averageHeartRate: string;
  highestHeartRate: string;
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
  spentMinutes: '',
  kcal: null,
  averageHeartRate: '',
  highestHeartRate: '',
  note: '',
};

const typed = (value: number | null, show: (value: number) => string) => (value === null ? '' : show(value));

/** An exercise as the sheet shows it for editing, its weights in `unit`. */
export function toExerciseText(exercise: WorkoutExercise, unit: BodyWeightUnit): ExerciseText {
  const text: ExerciseText = {
    ...EMPTY_EXERCISE,
    name: exercise.name,
    logAs: logAsOf(exercise),
    kcal: exercise.calories && !exercise.calories.estimated ? String(exercise.calories.kcal) : null,
    averageHeartRate: typed(exercise.averageHeartRateBpm, String),
    highestHeartRate: typed(exercise.highestHeartRateBpm, String),
    note: exercise.note ?? '',
  };
  if (exercise.kind === 'sets') {
    return {
      ...text,
      spentMinutes: typed(exercise.durationSeconds, (seconds) => String(Math.round(seconds / 60))),
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
  spent?: string;
  kcal?: string;
  averageHeartRate?: string;
  highestHeartRate?: string;
  note?: string;
};

/** What a calorie estimate needs from the sheet (D-50): the time, and the speed when it is known. */
export function effortOf(text: ExerciseText, layout: Layout): { seconds: number | null; speedKmh: number | null } {
  if (layout.kind === 'cardio') {
    const minutes = parseWholeNumber(text.timeMinutes.trim() || '0', 0, EXERCISE_SECONDS_MAX / 60);
    const rest = parseWholeNumber(text.timeSeconds.trim() || '0', 0, 59);
    const total = minutes === null || rest === null ? 0 : minutes * 60 + rest;
    const seconds = total >= 1 && total <= EXERCISE_SECONDS_MAX ? total : null;
    const speed = layout.fields.includes('speed') ? parseOneDecimal(text.speed) : null;
    const km = layout.fields.includes('distance') ? parseTwoDecimals(text.distance) : null;
    if (speed !== null && speed > 0) return { seconds, speedKmh: speed };
    return { seconds, speedKmh: km !== null && km > 0 && seconds !== null ? km / (seconds / 3600) : null };
  }
  const spent = text.spentMinutes.trim() === '' ? null : parseWholeNumber(text.spentMinutes, 1, EXERCISE_SECONDS_MAX / 60);
  if (spent !== null) return { seconds: spent * 60, speedKmh: null };
  if (!layout.columns.some(({ column }) => column === 'seconds')) return { seconds: null, speedKmh: null };
  const times = text.sets.map((set) => parseWholeNumber(set.seconds, 1, EXERCISE_SECONDS_MAX));
  const total = times.reduce<number | null>((sum, time) => (sum === null || time === null ? null : sum + time), 0);
  return { seconds: total !== null && total <= EXERCISE_SECONDS_MAX ? total : null, speedKmh: null };
}

/** A calorie estimate (D-50): the Compendium activity it used, the weight and the time, and the result. */
export type CaloriesEstimate = { kcal: number; met: number; compendiumCode: string; speedKmh: number | null; weightGrams: number; seconds: number };

/** Why an exercise has no estimate: a name of the user's own, no MET, no time, or no weigh-in. */
export type NoEstimate = 'own' | 'no_met' | 'no_time' | 'no_weight';

/**
 * Calories burned, estimated (D-50): the Compendium's MET for the exercise at its speed × the weight in
 * kg × the time in hours, rounded to a whole kcal, from 1 to 5,000.
 */
export function estimateCalories(
  listed: ListedExercise | null,
  effort: { seconds: number | null; speedKmh: number | null },
  weightGrams: number | null,
): { estimate: CaloriesEstimate } | { missing: NoEstimate } {
  if (listed === null) return { missing: 'own' };
  const activity = exerciseMet(listed, effort.speedKmh);
  if (activity === null) return { missing: 'no_met' };
  if (effort.seconds === null) return { missing: 'no_time' };
  if (weightGrams === null) return { missing: 'no_weight' };
  const kcal = Math.min(EXERCISE_KCAL_MAX, Math.max(1, Math.round((activity.met * (weightGrams / 1000) * effort.seconds) / 3600)));
  return { estimate: { kcal, ...activity, weightGrams, seconds: effort.seconds } };
}

/**
 * Reads the sheet's fields for `layout`, weights typed in `unit`: the exercise, or every field's
 * problem. Fields the layout does not show are not saved. Calories typed replace the estimate; with
 * none typed the estimate is saved, or, with no weigh-in on the phone, the estimate the exercise being
 * edited already has.
 */
export function parseExercise(
  text: ExerciseText,
  layout: Layout,
  unit: BodyWeightUnit,
  estimated: { estimate: CaloriesEstimate } | { missing: NoEstimate },
  kept: WorkoutExercise | null,
): { exercise: WorkoutExercise } | { problems: ExerciseProblems } {
  const rules = exerciseRules(unit);
  const problems: ExerciseProblems = { refused: [] };
  const name = text.name.trim();
  if (name.length === 0 || name.length > EXERCISE_NAME_MAX) problems.name = rules.name;
  const note = text.note.trim();
  if (note.length > EXERCISE_NOTE_MAX) problems.note = rules.note;
  let calories: WorkoutExercise['calories'] = null;
  if (text.kcal === null) {
    if ('estimate' in estimated) calories = { kcal: estimated.estimate.kcal, estimated: true };
    else if (estimated.missing === 'no_weight' && kept?.calories?.estimated) calories = kept.calories;
  } else if (text.kcal.trim() !== '') {
    const kcal = parseWholeNumber(text.kcal, 1, EXERCISE_KCAL_MAX);
    if (kcal === null) problems.kcal = rules.kcal;
    else calories = { kcal, estimated: false };
  }
  const heartRate = (key: 'averageHeartRate' | 'highestHeartRate'): number | null => {
    if (text[key].trim() === '') return null;
    const value = parseWholeNumber(text[key], HEART_RATE_BPM_MIN, HEART_RATE_BPM_MAX);
    if (value === null) problems[key] = rules.heartRate;
    return value;
  };
  const averageHeartRateBpm = heartRate('averageHeartRate');
  const highestHeartRateBpm = heartRate('highestHeartRate');
  if (averageHeartRateBpm !== null && highestHeartRateBpm !== null && highestHeartRateBpm < averageHeartRateBpm) {
    problems.highestHeartRate = rules.heartRateOrder;
  }
  const common = { name, calories, averageHeartRateBpm, highestHeartRateBpm, note: note === '' ? null : note };

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
    const spent = text.spentMinutes.trim() === '' ? null : parseWholeNumber(text.spentMinutes, 1, EXERCISE_SECONDS_MAX / 60);
    if (spent === null && text.spentMinutes.trim() !== '') problems.spent = rules.spent;
    if (hasProblems(problems)) return { problems };
    return { exercise: { kind: 'sets', ...common, sets, durationSeconds: spent === null ? null : spent * 60 } };
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

/** One row of an exercise's sets on the workout screen: "Set 2" and "8 × 22.5 kg" (D-63). */
export type SetRow = { label: string; value: string };

/** A set as its row reads it: "10 × 40.0 kg", "0:45 × 24.0 kg", "1:00", or reps alone as "15 reps". */
function setRowValue(set: ExerciseSet, unit: BodyWeightUnit): string {
  const text = [
    ...(set.reps === null ? [] : [String(set.reps)]),
    ...(set.seconds === null ? [] : [formatDuration(set.seconds)]),
    ...(set.weightGrams === null ? [] : [formatWeight(set.weightGrams, unit)]),
  ].join(' × ');
  if (set.reps === null || set.weightGrams !== null || set.seconds !== null) return text;
  return `${text} ${set.reps === 1 ? 'rep' : 'reps'}`;
}

/**
 * An exercise's sets, a row each (D-63): "Set 1 · 10 × 20.0 kg", "Set 2 · 8 × 22.5 kg"; sets all the
 * same in one row, "3 sets · 10 × 40.0 kg", and a single set as "1 set · 12 reps".
 */
export function setRows(sets: readonly ExerciseSet[], unit: BodyWeightUnit): SetRow[] {
  const [first] = sets;
  if (!first) return [];
  const same = sets.every((set) => set.reps === first.reps && set.seconds === first.seconds && set.weightGrams === first.weightGrams);
  if (same) return [{ label: sets.length === 1 ? '1 set' : `${sets.length} sets`, value: setRowValue(first, unit) }];
  return sets.map((set, index) => ({ label: `Set ${index + 1}`, value: setRowValue(set, unit) }));
}

/** e.g. "368 kcal · estimated", as Log meal marks an estimated value, or "360 kcal" as typed (D-50). */
export function formatCalories(calories: { kcal: number; estimated: boolean }): string {
  return `${formatInteger(calories.kcal)} kcal${calories.estimated ? ' · estimated' : ''}`;
}

/** e.g. "heart rate 148 average, 172 highest", or "" with neither. */
export function formatHeartRate(average: number | null, highest: number | null): string {
  const parts = [...(average === null ? [] : [`${average} average`]), ...(highest === null ? [] : [`${highest} highest`])];
  return parts.length === 0 ? '' : `heart rate ${parts.join(', ')}`;
}

/**
 * An exercise's lines on the workout screen (D-50): its sets, a row each (D-63), or its time with the
 * distance or the speed; and under them a cardio exercise's speed and pace, incline and level, then
 * its calories burned and heart rate.
 */
export function exerciseLines(exercise: WorkoutExercise, unit: BodyWeightUnit): { main: string; rows: SetRow[]; detail: string } {
  const main: string[] = [];
  const detail: string[] = [];
  const rows = exercise.kind === 'sets' ? setRows(exercise.sets, unit) : [];
  if (exercise.kind === 'cardio') {
    const { durationSeconds, distanceMetres, speedMetresPerHour, inclinePermille, level } = exercise;
    main.push(formatDuration(durationSeconds));
    if (distanceMetres !== null) {
      main.push(formatDistance(distanceMetres));
      detail.push(speedMetresPerHour === null ? speedAndPace(distanceMetres, durationSeconds) : formatSpeed(speedMetresPerHour));
    } else if (speedMetresPerHour !== null) {
      main.push(formatSpeed(speedMetresPerHour));
    }
    if (inclinePermille !== null) detail.push(`${(inclinePermille / 10).toFixed(1)} % incline`);
    if (level !== null) detail.push(`Level ${level}`);
  }
  if (exercise.calories) detail.push(formatCalories(exercise.calories));
  const heartRate = formatHeartRate(exercise.averageHeartRateBpm, exercise.highestHeartRateBpm);
  if (heartRate) detail.push(heartRate);
  return { main: main.join(' · '), rows, detail: detail.join(' · ') };
}

/**
 * An exercise as a screen reader reads its card: "Squat: Set 1, 10 × 40.0 kg; Set 2, 8 × 45.0 kg",
 * "Push-up: 3 sets, 15 reps", "Running: 30:00 · 5.00 km, 10.0 km/h · 6:00 /km".
 */
export function exerciseLabel(exercise: WorkoutExercise, unit: BodyWeightUnit): string {
  const { main, rows, detail } = exerciseLines(exercise, unit);
  const lines = exercise.kind === 'sets' ? rows.map((row) => `${row.label}, ${row.value}`).join('; ') : main;
  return `${exercise.name}: ${lines}${detail ? `, ${detail}` : ''}`;
}

/**
 * What deleting a workout takes with it (D-63): its exercises ("2 exercises", or "" with none) and,
 * once it has one, its place in its week's workouts (only a workout with an exercise counts, D-41),
 * "this week's" or "that week's" as Home's workouts card names the week; and that it can't be undone.
 */
export function deleteWorkoutEffects(exerciseCount: number, day: IstDay, today: IstDay): { exercises: string; rest: string } {
  if (exerciseCount === 0) return { exercises: '', rest: "You can't undo this." };
  const week = istWeekStart(day) === istWeekStart(today) ? 'this' : 'that';
  return {
    exercises: `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`,
    rest: `It will no longer count in ${week} week's workouts. You can't undo this.`,
  };
}

/**
 * The calories burned in some exercises (a workout's, or a day's), and whether any of it is estimated;
 * null when none has calories (D-50).
 */
export function caloriesBurned(exercises: readonly Pick<WorkoutExercise, 'calories'>[]): { kcal: number; estimated: boolean } | null {
  const counted = exercises.flatMap((exercise) => (exercise.calories ? [exercise.calories] : []));
  if (counted.length === 0) return null;
  return { kcal: counted.reduce((sum, calories) => sum + calories.kcal, 0), estimated: counted.some((calories) => calories.estimated) };
}

/** An estimate's time as its help reads it: "30 min", or "2:15". */
export function estimateTime(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : formatDuration(seconds);
}

/**
 * What the calories field says under it (D-50): how the estimate was made, or why there is none, or
 * that the number was typed.
 */
export function caloriesHelp(
  kcal: string | null,
  estimated: { estimate: CaloriesEstimate } | { missing: NoEstimate },
  kind: WorkoutExercise['kind'],
): string {
  if (kcal !== null) return kcal.trim() === '' ? 'Type the number from your machine or watch, or leave it empty.' : 'As you typed it, from your machine or watch.';
  if ('estimate' in estimated) {
    const { met, speedKmh, weightGrams, seconds } = estimated.estimate;
    const speed = speedKmh === null ? '' : ` for ${speedKmh.toFixed(1)} km/h`;
    return `Estimated: ${met.toFixed(1)} MET${speed} × ${(weightGrams / 1000).toFixed(1)} kg × ${estimateTime(seconds)}. Type the number from your machine or watch to replace it.`;
  }
  return {
    own: 'Your own exercises have no estimate: type the number from your machine or watch.',
    no_met: 'This exercise has no estimate: type the number from your machine or watch.',
    no_time: kind === 'sets' ? 'Add the time spent to see an estimate.' : 'Add the time to see an estimate.',
    no_weight: 'Log your weight to see an estimate.',
  }[estimated.missing];
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

/**
 * The workouts listed and numbered (D-65): those with an exercise, as they count toward the week
 * (D-41). One with none is still stored, and opens from its own screen, but no list shows it, so
 * "Workout 2" is the same workout on Training, Home and its own screen. `keep` is listed anyway: the
 * workout open on its own screen, while it has no exercise yet.
 */
export function listedWorkouts<T extends { id: string; exercises: readonly unknown[] }>(workouts: readonly T[], keep?: string): T[] {
  return workouts.filter((workout) => workout.exercises.length > 0 || workout.id === keep);
}
