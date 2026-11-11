// Schemas shared by the app and the API (api-conventions, "Strict input"; error-model).
// Request schemas are strict: unknown fields are refused. Response schemas accept added fields,
// because adding a field does not change the API version.
import { z } from 'zod';
import { addDays, isIstDay, yearsBetween, type IstDay } from './dates.ts';
import {
  HEIGHT_MM_MAX,
  HEIGHT_MM_MIN,
  LIFT_WEIGHT_GRAMS_MAX,
  LIFT_WEIGHT_GRAMS_MIN,
  MEASUREMENT_MM_MAX,
  MEASUREMENT_MM_MIN,
  SLEEP_MINUTES_MAX,
  SLEEP_MINUTES_MIN,
  STEPS_MAX,
  STEPS_MIN,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
  WEIGHT_UNITS,
} from './units.ts';

// --- Error codes (error-model, "Codes") ---

export const REQUEST_ERROR_CODES = [
  'VALIDATION_FAILED',
  'AGE_CONFIRMATION_REQUIRED',
  'AUTH_REQUIRED',
  'ACCOUNT_SETUP_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  'ROLE_NOT_ENABLED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;
export type RequestErrorCode = (typeof REQUEST_ERROR_CODES)[number];

export const CHANGE_ERROR_CODES = [
  'VALIDATION_FAILED',
  'DAY_IN_FUTURE',
  'ROLE_NOT_ENABLED',
  'NOT_ALLOWED',
  'UNKNOWN_CHANGE_TYPE',
] as const;
export type ChangeErrorCode = (typeof CHANGE_ERROR_CODES)[number];

export const VALIDATION_ISSUES = [
  'required',
  'invalid_format',
  'out_of_range',
  'unknown_field',
  'too_many',
] as const;
export type ValidationIssue = (typeof VALIDATION_ISSUES)[number];

// --- Field types (api-conventions, "Types") ---

export const istDaySchema = z.string().refine(isIstDay);
/** ISO 8601 in UTC with `Z`. */
export const instantSchema = z.iso.datetime();
export const idSchema = z.uuid();
export const weightGramsSchema = z.int().min(WEIGHT_GRAMS_MIN).max(WEIGHT_GRAMS_MAX);

// --- Errors (error-model, "Error shape") ---

export const validationDetailSchema = z.strictObject({
  field: z.string(),
  issue: z.enum(VALIDATION_ISSUES),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(REQUEST_ERROR_CODES),
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
    details: z.array(validationDetailSchema).nullable(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

// --- Account: GET and POST /v1/me ---

/** Version of the "I am 18 or older" text the app shows (MVP default). */
export const AGE_CONFIRMATION_TEXT_VERSION = '2026-10-27';

export const meSetupRequestSchema = z.strictObject({
  ageConfirmed: z.boolean(),
  ageConfirmationTextVersion: z.string().min(1).max(32),
});
export type MeSetupRequest = z.infer<typeof meSetupRequestSchema>;

export const ROLES = ['personal', 'coach', 'head_coach'] as const;
export type Role = (typeof ROLES)[number];

export const meResponseSchema = z.object({
  user: z.object({ id: idSchema, email: z.string(), createdAt: instantSchema }),
  roles: z.array(z.enum(ROLES)),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// --- AI meal-reading consent: GET and PUT /v1/me/ai-consent (REQ-ACC-004) ---

/**
 * The consent text the app shows beside the "AI meal reading" switch, and its version (MVP default,
 * D-31; Legal reviews it, Q-049). Each change of consent records the version shown. A new text gets
 * a new version, and the request schema then accepts both while older apps are in use.
 */
export const AI_CONSENT_TEXT_VERSION = '2026-10-30';
export const AI_CONSENT_TEXT =
  'When it is on, the meal text you type or speak, and the meal and label photos you choose to read, ' +
  "are sent to Google's Gemini AI service to estimate what you ate. They may be processed outside " +
  'India. You check the result before it is saved. Voice is turned into text on your phone; ' +
  'recordings are not sent. Off by default; you can turn it off at any time.';

export const aiConsentRequestSchema = z.strictObject({
  consented: z.boolean(),
  textVersion: z.literal(AI_CONSENT_TEXT_VERSION),
});
export type AiConsentRequest = z.infer<typeof aiConsentRequestSchema>;

/** The latest consent record, or null when the user has never chosen (AI is then off, A-007). */
export const aiConsentResponseSchema = z.object({
  aiConsent: z
    .object({ consented: z.boolean(), textVersion: z.string(), recordedAt: instantSchema })
    .nullable(),
});
export type AiConsentResponse = z.infer<typeof aiConsentResponseSchema>;

// --- Sync: POST /v1/sync (ADR-0007) ---

export const MAX_SYNC_CHANGES = 100;
export const SYNC_PAGE_SIZE = 500;
/** The phone keeps, and the pull returns, the last 90 IST days of day data (ADR-0007 rule 1).
 * Targets are not day data: the pull returns every target value, with the day it starts (D-77). */
export const SYNC_WINDOW_DAYS = 90;

/** The first IST day of the window that ends today: 90 days including today. */
export function syncWindowStart(today: IstDay): IstDay {
  return addDays(today, -(SYNC_WINDOW_DAYS - 1));
}

export const WEIGH_IN_SET = 'weighIn.set';

export const weighInSetDataSchema = z.strictObject({
  day: istDaySchema,
  weightGrams: weightGramsSchema,
  recordedAt: instantSchema,
});
export type WeighInSetData = z.infer<typeof weighInSetDataSchema>;

// Steps, sleep and measurements work like weigh-ins: one value per user per IST day, and a new
// value replaces the day's value (Q-030).

export const STEPS_SET = 'steps.set';

export const stepsSetDataSchema = z.strictObject({
  day: istDaySchema,
  steps: z.int().min(STEPS_MIN).max(STEPS_MAX),
  recordedAt: instantSchema,
});
export type StepsSetData = z.infer<typeof stepsSetDataSchema>;

export const SLEEP_SET = 'sleep.set';

export const sleepSetDataSchema = z.strictObject({
  day: istDaySchema,
  sleepMinutes: z.int().min(SLEEP_MINUTES_MIN).max(SLEEP_MINUTES_MAX),
  recordedAt: instantSchema,
});
export type SleepSetData = z.infer<typeof sleepSetDataSchema>;

export const MEASUREMENTS_SET = 'measurements.set';
/** Notes on a measurements entry (MVP default, D-23). */
export const MEASUREMENT_NOTES_MAX = 500;

const measurementMmSchema = z.int().min(MEASUREMENT_MM_MIN).max(MEASUREMENT_MM_MAX);

/** Upper and lower waist are required (REQ-MEAS-004); the others are optional (REQ-MEAS-005). */
export const measurementsSetDataSchema = z.strictObject({
  day: istDaySchema,
  upperWaistMm: measurementMmSchema,
  lowerWaistMm: measurementMmSchema,
  chestMm: measurementMmSchema.nullable(),
  hipsMm: measurementMmSchema.nullable(),
  armMm: measurementMmSchema.nullable(),
  thighMm: measurementMmSchema.nullable(),
  notes: z.string().min(1).max(MEASUREMENT_NOTES_MAX).nullable(),
  recordedAt: instantSchema,
});
export type MeasurementsSetData = z.infer<typeof measurementsSetDataSchema>;

// Workouts (REQ-TRN-003, REQ-TRN-004): workouts the user logs themselves (D-20). A workout's ID is
// made on the phone, so it can be started, edited and deleted offline; IDs are per user, so a
// change never reaches another user's workout (invariant #1). A day may hold several workouts; one
// counts toward the weekly target once it has an exercise (D-41, REQ-HOME-007).

export const WORKOUT_SET = 'workout.set';
export const WORKOUT_DELETE = 'workout.delete';
/** Limits per workout and per exercise (MVP defaults, D-29; D-50). */
export const MAX_WORKOUT_EXERCISES = 30;
export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_SETS_MAX = 20;
export const EXERCISE_REPS_MAX = 200;
export const EXERCISE_NOTE_MAX = 500;
/** A set's time, or an exercise's: up to 24 hours, in seconds. */
export const EXERCISE_SECONDS_MAX = 24 * 60 * 60;
/** 0.01–500 km, in metres. */
export const EXERCISE_DISTANCE_METRES_MIN = 10;
export const EXERCISE_DISTANCE_METRES_MAX = 500_000;
/** 0.1–40 km/h, in metres per hour. */
export const EXERCISE_SPEED_METRES_PER_HOUR_MIN = 100;
export const EXERCISE_SPEED_METRES_PER_HOUR_MAX = 40_000;
/** 0–40 %, in tenths of a percent. */
export const EXERCISE_INCLINE_PERMILLE_MAX = 400;
export const EXERCISE_LEVEL_MAX = 40;
export const EXERCISE_KCAL_MAX = 5_000;
export const HEART_RATE_BPM_MIN = 30;
export const HEART_RATE_BPM_MAX = 250;

/** One set (D-50): its reps, its time, or both, with the weight lifted or carried, null for none. */
export const exerciseSetSchema = z
  .strictObject({
    reps: z.int().min(1).max(EXERCISE_REPS_MAX).nullable(),
    weightGrams: z.int().min(LIFT_WEIGHT_GRAMS_MIN).max(LIFT_WEIGHT_GRAMS_MAX).nullable(),
    seconds: z.int().min(1).max(EXERCISE_SECONDS_MAX).nullable(),
  })
  .refine((set) => set.reps !== null || set.seconds !== null);
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;

const heartRateSchema = z.int().min(HEART_RATE_BPM_MIN).max(HEART_RATE_BPM_MAX).nullable();

/** What every exercise has, whatever its kind. */
const exerciseFields = {
  name: z.string().trim().min(1).max(EXERCISE_NAME_MAX),
  /** Calories burned: typed from a machine or a watch, or estimated on the phone from the list's MET (D-50). */
  calories: z.strictObject({ kcal: z.int().min(1).max(EXERCISE_KCAL_MAX), estimated: z.boolean() }).nullable(),
  averageHeartRateBpm: heartRateSchema,
  highestHeartRateBpm: heartRateSchema,
  note: z.string().min(1).max(EXERCISE_NOTE_MAX).nullable(),
};

/** The highest heart rate is not below the average. */
function heartRatesInOrder(exercise: { averageHeartRateBpm: number | null; highestHeartRateBpm: number | null }): boolean {
  const { averageHeartRateBpm: average, highestHeartRateBpm: highest } = exercise;
  return average === null || highest === null || highest >= average;
}

/** An exercise done in sets (D-50), each with its own reps, weight and time, with an optional note (Q-042). */
export const setsExerciseSchema = z
  .strictObject({
    kind: z.literal('sets'),
    ...exerciseFields,
    sets: z.array(exerciseSetSchema).min(1).max(EXERCISE_SETS_MAX),
    /** Time spent on it, used only to estimate the calories burned. */
    durationSeconds: z.int().min(1).max(EXERCISE_SECONDS_MAX).nullable(),
  })
  .refine(heartRatesInOrder, { path: ['highestHeartRateBpm'] });
export type SetsExercise = z.infer<typeof setsExerciseSchema>;

/** Cardio (D-50): a time, with what was covered: a distance, a treadmill's speed and incline, a machine's level. */
export const cardioExerciseSchema = z
  .strictObject({
    kind: z.literal('cardio'),
    ...exerciseFields,
    durationSeconds: z.int().min(1).max(EXERCISE_SECONDS_MAX),
    distanceMetres: z.int().min(EXERCISE_DISTANCE_METRES_MIN).max(EXERCISE_DISTANCE_METRES_MAX).nullable(),
    /** The speed typed on a treadmill; outdoors the speed comes from the distance and the time. */
    speedMetresPerHour: z.int().min(EXERCISE_SPEED_METRES_PER_HOUR_MIN).max(EXERCISE_SPEED_METRES_PER_HOUR_MAX).nullable(),
    /** Tenths of a percent: 8.5 % is 85. */
    inclinePermille: z.int().min(0).max(EXERCISE_INCLINE_PERMILLE_MAX).nullable(),
    level: z.int().min(1).max(EXERCISE_LEVEL_MAX).nullable(),
  })
  .refine(heartRatesInOrder, { path: ['highestHeartRateBpm'] });
export type CardioExercise = z.infer<typeof cardioExerciseSchema>;

/**
 * An exercise saved before D-50, `{ name, sets, reps, weightGrams, note }` with the same reps and
 * weight for every set, as that many identical sets; anything else as it is. Changes queued on an
 * older app, and workouts stored before, keep working.
 */
export function fromEarlierExercise(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || 'kind' in value) return value;
  const earlier = value as Record<string, unknown>;
  const count = earlier.sets;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > EXERCISE_SETS_MAX) return value;
  return {
    kind: 'sets',
    name: earlier.name,
    sets: Array.from({ length: count }, () => ({ reps: earlier.reps, weightGrams: earlier.weightGrams ?? null, seconds: null })),
    durationSeconds: null,
    calories: null,
    averageHeartRateBpm: null,
    highestHeartRateBpm: null,
    note: earlier.note ?? null,
  };
}

/** One exercise of a workout: done in sets, or cardio (D-50). */
export const workoutExerciseSchema = z.preprocess(fromEarlierExercise, z.discriminatedUnion('kind', [setsExerciseSchema, cardioExerciseSchema]));
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

/** A workout's exercises as stored, served or kept on the phone: one saved before D-50 as identical sets. */
export function currentExercises(stored: readonly unknown[]): WorkoutExercise[] {
  return stored.map(fromEarlierExercise) as WorkoutExercise[];
}

/** The longest a workout's timer counts (D-71): 24 hours, as an exercise's time. */
export const WORKOUT_TIMER_SECONDS_MAX = EXERCISE_SECONDS_MAX;

/**
 * A workout's timer (D-71), started with "Start workout". `countedSeconds` is the time counted
 * before the current run; `runningSince` is set while it runs, and `doneAt` once it is marked done.
 * It runs, is paused (neither set) or is done, never running and done at once.
 */
export const workoutTimerSchema = z
  .strictObject({
    startedAt: instantSchema,
    countedSeconds: z.int().min(0).max(WORKOUT_TIMER_SECONDS_MAX),
    runningSince: instantSchema.nullable(),
    doneAt: instantSchema.nullable(),
  })
  .refine((timer) => timer.runningSince === null || timer.doneAt === null, { path: ['doneAt'] });
export type WorkoutTimer = z.infer<typeof workoutTimerSchema>;

/** Creates a workout, or replaces the whole workout with this ID. `recordedAt` is when it was
 * started; editing the exercises keeps it. `timer` is null until "Start workout" (D-71); a change
 * without it, from an app before D-71, keeps the timer the server has. */
export const workoutSetDataSchema = z.strictObject({
  id: idSchema,
  day: istDaySchema,
  exercises: z.array(workoutExerciseSchema).max(MAX_WORKOUT_EXERCISES),
  recordedAt: instantSchema,
  timer: workoutTimerSchema.nullable().optional(),
});
export type WorkoutSetData = z.infer<typeof workoutSetDataSchema>;

export const workoutDeleteDataSchema = z.strictObject({
  id: idSchema,
  deletedAt: instantSchema,
});
export type WorkoutDeleteData = z.infer<typeof workoutDeleteDataSchema>;

// Targets (REQ-ROLE-007): the user's own. Each value holds from its IST day on, until the next
// value of that kind; earlier days keep theirs (D-77, answering Q-014; REQ-ROLE-018). Who set a
// target comes from the sign-in token, never from the change, so it is not a field here. Daily
// carbs, fat and fibre joined them for the Insight page (D-70).

export const TARGET_SET = 'target.set';
export const TARGET_KINDS = ['calories', 'protein', 'carbs', 'fat', 'fibre', 'steps', 'weekly_workouts', 'body_weight'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Whole kcal, whole grams of protein, carbs, fat and fibre, steps, workouts a week, and body
 * weight in grams (D-23, D-70). */
export const TARGET_RANGES: Record<TargetKind, { min: number; max: number }> = {
  calories: { min: 500, max: 10_000 },
  protein: { min: 10, max: 500 },
  carbs: { min: 10, max: 1_000 },
  fat: { min: 5, max: 500 },
  fibre: { min: 5, max: 100 },
  steps: { min: 1, max: STEPS_MAX },
  weekly_workouts: { min: 1, max: 14 },
  body_weight: { min: WEIGHT_GRAMS_MIN, max: WEIGHT_GRAMS_MAX },
};

function targetSchemaFor<K extends TargetKind>(kind: K) {
  return z.strictObject({
    kind: z.literal(kind),
    value: z.int().min(TARGET_RANGES[kind].min).max(TARGET_RANGES[kind].max),
    /** The IST day the value starts: the day it was set on the phone (D-77), kept as its own field
     * (invariant 5); not later than today. */
    day: istDaySchema,
    setAt: instantSchema,
  });
}

export const targetSetDataSchema = z.discriminatedUnion('kind', [
  targetSchemaFor('calories'),
  targetSchemaFor('protein'),
  targetSchemaFor('carbs'),
  targetSchemaFor('fat'),
  targetSchemaFor('fibre'),
  targetSchemaFor('steps'),
  targetSchemaFor('weekly_workouts'),
  targetSchemaFor('body_weight'),
]);
export type TargetSetData = z.infer<typeof targetSetDataSchema>;

// Settings (REQ-ACC-001…003): the user's own, one current value per name, synced like targets so
// they work offline and follow the account to another phone (MVP default, D-31). The units are
// display settings: weights stay stored in grams (invariant #6).

export const SETTING_SET = 'setting.set';
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const SETTING_NAMES = ['theme', 'body_weight_unit', 'lifting_weight_unit'] as const;
export type SettingName = (typeof SETTING_NAMES)[number];
export const SETTING_VALUES = {
  theme: THEME_PREFERENCES,
  body_weight_unit: WEIGHT_UNITS,
  lifting_weight_unit: WEIGHT_UNITS,
} as const satisfies Record<SettingName, readonly string[]>;
export type Settings = { [N in SettingName]: (typeof SETTING_VALUES)[N][number] };
/** Before the user chooses: the phone's theme, and kg as the BRD's "Weight (kg)". */
export const DEFAULT_SETTINGS: Settings = { theme: 'system', body_weight_unit: 'kg', lifting_weight_unit: 'kg' };

function settingSchemaFor<N extends SettingName>(name: N) {
  return z.strictObject({ name: z.literal(name), value: z.enum(SETTING_VALUES[name]), setAt: instantSchema });
}

export const settingSetDataSchema = z.discriminatedUnion('name', [
  settingSchemaFor('theme'),
  settingSchemaFor('body_weight_unit'),
  settingSchemaFor('lifting_weight_unit'),
]);
export type SettingSetData = z.infer<typeof settingSetDataSchema>;

// The profile (REQ-ACC-011; docs/plans/user-profile.md): the user's own basic details, one per user,
// synced like settings so it can be edited offline; the change received last wins (ADR-0007 rule 2).
// Every field is optional. The height is stored in millimetres (invariant #6); the weight is not
// here, being the latest weigh-in. Private to the user (D-20) and never logged (invariant #7).

export const PROFILE_SET = 'profile.set';
export const PROFILE_NAME_MAX = 60;
/** The ages a date of birth may give: 18 or older, as at sign-up (REQ-ACC-010). */
export const PROFILE_AGE_MIN = 18;
export const PROFILE_AGE_MAX = 120;
export const SEXES = ['female', 'male', 'other', 'prefer_not_to_say'] as const;
export type Sex = (typeof SEXES)[number];
export const ADDRESS_LINE_MAX = 100;
/** A city's or a state's name. */
export const ADDRESS_PLACE_MAX = 60;
/** +91 and a 10-digit Indian mobile number (phase 1 serves India only, invariant #5); not verified. */
export const PHONE_PATTERN = /^\+91[6-9]\d{9}$/;
export const PIN_CODE_PATTERN = /^\d{6}$/;

function profileTextSchema(max: number) {
  return z.string().trim().min(1).max(max);
}

/** An address: empty (null), or line 1, the city, the state and the PIN code all given. */
export const addressSchema = z.strictObject({
  line1: profileTextSchema(ADDRESS_LINE_MAX),
  line2: profileTextSchema(ADDRESS_LINE_MAX).nullable(),
  city: profileTextSchema(ADDRESS_PLACE_MAX),
  state: profileTextSchema(ADDRESS_PLACE_MAX),
  pinCode: z.string().regex(PIN_CODE_PATTERN),
});
export type Address = z.infer<typeof addressSchema>;

/** Whether a date of birth gives an age from 18 to 120 on `today` (an IST day). */
export function isAcceptedDateOfBirth(dateOfBirth: IstDay, today: IstDay): boolean {
  const age = yearsBetween(dateOfBirth, today);
  return age >= PROFILE_AGE_MIN && age <= PROFILE_AGE_MAX;
}

/** The whole profile: a field left empty is null. */
export const profileSetDataSchema = z.strictObject({
  name: profileTextSchema(PROFILE_NAME_MAX).nullable(),
  /** A calendar date, `YYYY-MM-DD`; the server also checks the age it gives (isAcceptedDateOfBirth). */
  dateOfBirth: istDaySchema.nullable(),
  sex: z.enum(SEXES).nullable(),
  heightMm: z.int().min(HEIGHT_MM_MIN).max(HEIGHT_MM_MAX).nullable(),
  phone: z.string().regex(PHONE_PATTERN).nullable(),
  address: addressSchema.nullable(),
  /** The profile photo, named by an ID made on the phone, as a meal photo is; null for none. */
  photoMediaId: idSchema.nullable(),
  setAt: instantSchema,
});
export type ProfileSetData = z.infer<typeof profileSetDataSchema>;

// Meals (REQ-LOG-001…003, REQ-LOG-007, REQ-NUT-*) and saved meals (REQ-SAVED-*). A meal's ID is
// made on the phone, so it can be created, edited and deleted offline; IDs are per user, so a
// change never reaches another user's meal (invariant #1).

export const MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];
/** Optional tags on a meal, which keeps its meal type (REQ-LOG-003; Q-031). */
export const MEAL_TAGS = ['before_training', 'dessert'] as const;
export type MealTag = (typeof MEAL_TAGS)[number];
export const MAX_MEAL_ITEMS = 30;
/** Grams eaten of a listed food or your own food (MVP default, D-26). */
export const MEAL_ITEM_GRAMS_MAX = 2_000;
/** Portions of a dish, in halves (MVP default, D-26). */
export const MEAL_ITEM_PORTIONS_MAX = 10;
/**
 * Household units a listed food can be logged in, once the owner has measured the grams one holds
 * for that food (D-36): teaspoon 5 ml, tablespoon 15 ml, katori 200 ml, glass 250 ml, and piece.
 */
export const FOOD_MEASURES = ['teaspoon', 'tablespoon', 'katori', 'glass', 'piece'] as const;
export type FoodMeasure = (typeof FOOD_MEASURES)[number];
/** Units of a food, in halves, as a dish's portions (MVP default, D-36). */
export const MEAL_ITEM_MEASURES_MAX = 10;
/** The most one item can hold, whatever its amount. */
export const MEAL_ITEM_KCAL_MAX = 20_000;
export const MEAL_ITEM_NUTRIENT_MAX = 5_000;
export const MEAL_ITEM_SOURCES = ['ifct2017', 'usda_fndds', 'indb', 'brand_label', 'home', 'dish_estimate', 'dish', 'barcode', 'own'] as const;
export type MealItemSource = (typeof MEAL_ITEM_SOURCES)[number];
/** The servings of a USDA or INDB food, in halves, as household units (more-foods plan; D-46). */
export const MEAL_ITEM_SERVINGS_MAX = 10;
/**
 * oz, a weight, for every listed and packaged food (D-76): logged as a serving with this name, of
 * OZ_GRAMS each, counted in halves as other servings. No food's own serving may have this name.
 */
export const OZ_SERVING_LABEL = 'oz';
export const OZ_GRAMS = 28.35;
export const SERVING_LABEL_MAX = 80;
/**
 * The units of a food the user enters (more-foods plan, the owner's addition, 2026-11-04), besides
 * grams. Millilitres are counted as grams are; the others from 0.1 to 100, with one decimal.
 */
export const OWN_UNITS = ['ml', 'piece', 'slice', 'cup', 'katori', 'bowl', 'glass', 'tablespoon', 'teaspoon', 'serving'] as const;
export type OwnUnit = (typeof OWN_UNITS)[number];
export const OWN_UNIT_COUNT_MIN = 0.1;
export const OWN_UNIT_COUNT_MAX = 100;

/** Whether `value` is a quantity of `unit` a food the user entered can be logged in. */
export function isOwnQuantity(unit: 'g' | OwnUnit, value: number): boolean {
  if (unit === 'g' || unit === 'ml') return Number.isInteger(value) && value >= 1 && value <= MEAL_ITEM_GRAMS_MAX;
  const tenths = value * 10;
  return value >= OWN_UNIT_COUNT_MIN && value <= OWN_UNIT_COUNT_MAX && Math.abs(tenths - Math.round(tenths)) < 1e-9;
}

const nutrientSchema = z.number().min(0).max(MEAL_ITEM_NUTRIENT_MAX);

/** A count in halves, from 0.5 to `max`. */
function halvesSchema(max: number) {
  return z
    .number()
    .min(0.5)
    .max(max)
    .refine((value) => Number.isInteger(value * 2));
}

/**
 * One food in a meal, with its values for the amount eaten. The values are a snapshot taken when
 * the meal is saved, so a later change to the food list never changes a past meal. kcal and protein
 * are always known; carbs, fat and fibre are null when the source gives none.
 */
export const mealItemSchema = z
  .strictObject({
    source: z.enum(MEAL_ITEM_SOURCES),
    /** The IFCT or USDA code, dish code or barcode; for your own food, its My food's ID, or null. */
    ref: z.string().min(1).max(64).nullable(),
    name: z.string().trim().min(1).max(120),
    amount: z.discriminatedUnion('unit', [
      z.strictObject({ unit: z.literal('g'), value: z.int().min(1).max(MEAL_ITEM_GRAMS_MAX) }),
      z.strictObject({ unit: z.literal('portion'), value: halvesSchema(MEAL_ITEM_PORTIONS_MAX) }),
      // Units of a listed food (D-36), with the grams they came to, which the values are for.
      z.strictObject({
        unit: z.literal('measure'),
        measure: z.enum(FOOD_MEASURES),
        value: halvesSchema(MEAL_ITEM_MEASURES_MAX),
        grams: z.number().gt(0).max(MEAL_ITEM_GRAMS_MAX),
      }),
      // Servings of a USDA food, as USDA labels them, with the grams they came to.
      z.strictObject({
        unit: z.literal('serving'),
        label: z.string().min(1).max(SERVING_LABEL_MAX),
        value: halvesSchema(MEAL_ITEM_SERVINGS_MAX),
        grams: z.number().gt(0).max(MEAL_ITEM_GRAMS_MAX),
      }),
      // Your own food in one of its units other than grams; the values are for this quantity.
      z.strictObject({ unit: z.literal('own'), name: z.enum(OWN_UNITS), value: z.number() }),
    ]),
    kcal: z.number().min(0).max(MEAL_ITEM_KCAL_MAX),
    proteinG: nutrientSchema,
    carbsG: nutrientSchema.nullable(),
    fatG: nutrientSchema.nullable(),
    fibreG: nutrientSchema.nullable(),
    /** Any value is estimated rather than published (oils and fats, dishes). */
    estimated: z.boolean(),
  })
  // A dish is logged in portions, and everything else in grams (D-26 answer 3; D-28); an IFCT food
  // may also be logged in a household unit (D-36), a USDA food in its servings, and your own food in
  // its unit (more-foods plan); an INDB recipe in grams or its serving (D-46). Since D-76 every listed
  // and packaged food may also be logged in oz, as a serving named "oz".
  .refine((item) => ALLOWED_AMOUNTS[item.source].includes(item.amount.unit), { path: ['amount'] })
  // An IFCT food has no servings of its own: only oz (D-76).
  .refine((item) => item.source !== 'ifct2017' || item.amount.unit !== 'serving' || item.amount.label === OZ_SERVING_LABEL, { path: ['amount'] })
  // oz is a weight: 28.35 g each, allowing for rounding to two decimals (D-76).
  .refine((item) => item.amount.unit !== 'serving' || item.amount.label !== OZ_SERVING_LABEL || Math.abs(item.amount.grams - item.amount.value * OZ_GRAMS) <= 0.02, {
    path: ['amount', 'grams'],
  })
  .refine((item) => item.amount.unit !== 'own' || isOwnQuantity(item.amount.name, item.amount.value), { path: ['amount', 'value'] });

const ALLOWED_AMOUNTS: Record<MealItemSource, readonly string[]> = {
  // An IFCT food in grams, a household unit (D-36), or oz (D-76).
  ifct2017: ['g', 'measure', 'serving'],
  usda_fndds: ['g', 'serving'],
  indb: ['g', 'serving'],
  // A brand label in grams or its label's serving (D-49).
  brand_label: ['g', 'serving'],
  // A home-style food in grams or its serving (D-59).
  home: ['g', 'serving'],
  // An estimated dish in grams or its serving (D-62).
  dish_estimate: ['g', 'serving'],
  dish: ['portion'],
  // A packaged food by its barcode, also in the serving its label gives in grams (D-48).
  barcode: ['g', 'serving'],
  own: ['g', 'own'],
};
export type MealItem = z.infer<typeof mealItemSchema>;

const mealTagsSchema = z
  .array(z.enum(MEAL_TAGS))
  .max(MEAL_TAGS.length)
  .refine((tags) => new Set(tags).size === tags.length);

export const MEAL_SET = 'meal.set';
export const MEAL_DELETE = 'meal.delete';

/** The longest public image link accepted (REQ-LOG-010). */
export const PUBLIC_LINK_MAX = 2_000;

/**
 * A public link to an image the user keeps on another site (REQ-LOG-010): https only, with a host
 * name and no user name or password in it. FitSphere never fetches it (ADR-0002 rule 8).
 */
const publicLinkSchema = z
  .url({ protocol: /^https$/, hostname: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i })
  .max(PUBLIC_LINK_MAX)
  .refine((text) => !/^https:\/\/[^/?#]*@/i.test(text));

export function isPublicLink(text: string): boolean {
  return publicLinkSchema.safeParse(text).success;
}

/**
 * A meal's one photo or public image link (REQ-LOG-006, REQ-LOG-010; MVP default, D-26). A photo
 * is named by an ID made on the phone; its files are reached only through the media routes.
 */
export const mealPhotoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('photo'), mediaId: idSchema }),
  z.strictObject({ kind: z.literal('link'), url: publicLinkSchema }),
]);
export type MealPhoto = z.infer<typeof mealPhotoSchema>;

/** Creates a meal, or replaces the whole meal with this ID. */
export const mealSetDataSchema = z.strictObject({
  id: idSchema,
  day: istDaySchema,
  mealType: z.enum(MEAL_TYPES),
  tags: mealTagsSchema,
  items: z.array(mealItemSchema).min(1).max(MAX_MEAL_ITEMS),
  /** Null, or left out, for no photo; the meal's previous photo is then removed. */
  photo: mealPhotoSchema.nullable().optional(),
  recordedAt: instantSchema,
});
export type MealSetData = z.infer<typeof mealSetDataSchema>;

export const mealDeleteDataSchema = z.strictObject({
  id: idSchema,
  deletedAt: instantSchema,
});
export type MealDeleteData = z.infer<typeof mealDeleteDataSchema>;

// My foods (more-foods plan, proposed REQ-LOG-011): foods the user entered and saved, to log
// again. Each is the user's own (D-20), synced like saved meals so it works offline. Its values are
// per 100 g or 100 ml, or per one of its other unit.

export const MY_FOOD_SET = 'myFood.set';
export const MY_FOOD_DELETE = 'myFood.delete';
export const MY_FOOD_NAME_MAX = 120;
export const MY_FOOD_UNITS = ['g', ...OWN_UNITS] as const;
export type MyFoodUnit = (typeof MY_FOOD_UNITS)[number];

/** The most a value may be: per 100 g or ml as a label's, or per one unit (a slice, a bowl…). */
export function myFoodValueMax(unit: MyFoodUnit, nutrient: 'kcal' | 'grams'): number {
  const per100 = unit === 'g' || unit === 'ml';
  if (nutrient === 'kcal') return per100 ? 900 : 2_000;
  return per100 ? 100 : 200;
}

export const myFoodSetDataSchema = z
  .strictObject({
    id: idSchema,
    name: z.string().trim().min(1).max(MY_FOOD_NAME_MAX),
    unit: z.enum(MY_FOOD_UNITS),
    kcal: z.number().min(0),
    proteinG: z.number().min(0),
    carbsG: z.number().min(0),
    fatG: z.number().min(0),
    fibreG: z.number().min(0).nullable(),
    savedAt: instantSchema,
  })
  .refine(
    (food) =>
      food.kcal <= myFoodValueMax(food.unit, 'kcal') &&
      [food.proteinG, food.carbsG, food.fatG, food.fibreG ?? 0].every((value) => value <= myFoodValueMax(food.unit, 'grams')),
    { path: ['kcal'] },
  );
export type MyFoodSetData = z.infer<typeof myFoodSetDataSchema>;

export const myFoodDeleteDataSchema = z.strictObject({
  id: idSchema,
  deletedAt: instantSchema,
});
export type MyFoodDeleteData = z.infer<typeof myFoodDeleteDataSchema>;

export const SAVED_MEAL_SET = 'savedMeal.set';
export const SAVED_MEAL_DELETE = 'savedMeal.delete';
export const SAVED_MEAL_NAME_MAX = 60;

/**
 * Foods kept under the user's own name for logging again (REQ-SAVED-001, REQ-SAVED-003). It has no
 * day, no photo and, since D-69, no meal: it is logged to whichever meal the user chooses.
 */
export const savedMealSetDataSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(SAVED_MEAL_NAME_MAX),
  /** Sent by phones from before D-69, still waiting in their outbox; accepted and not kept. */
  mealType: z.enum(MEAL_TYPES).optional(),
  tags: mealTagsSchema,
  items: z.array(mealItemSchema).min(1).max(MAX_MEAL_ITEMS),
  savedAt: instantSchema,
});
export type SavedMealSetData = z.infer<typeof savedMealSetDataSchema>;

export const savedMealDeleteDataSchema = z.strictObject({
  id: idSchema,
  deletedAt: instantSchema,
});
export type SavedMealDeleteData = z.infer<typeof savedMealDeleteDataSchema>;

/** The envelope of one change. Its `data` is checked per change type, so one bad change does
 * not fail the others. */
export const syncChangeSchema = z.strictObject({
  changeId: idSchema,
  type: z.string().min(1).max(64),
  data: z.unknown(),
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncRequestSchema = z.strictObject({
  cursor: z.string().min(1).max(200).nullable(),
  changes: z.array(syncChangeSchema).max(MAX_SYNC_CHANGES),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const changeErrorSchema = z.object({
  code: z.enum(CHANGE_ERROR_CODES),
  message: z.string(),
  details: z.array(validationDetailSchema).nullable(),
});
export type ChangeError = z.infer<typeof changeErrorSchema>;

export const syncResultSchema = z.object({
  changeId: idSchema,
  status: z.enum(['accepted', 'rejected']),
  error: changeErrorSchema.nullable(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const weighInSchema = z.object({
  day: istDaySchema,
  weightGrams: z.int(),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type WeighIn = z.infer<typeof weighInSchema>;

export const stepCountSchema = z.object({
  day: istDaySchema,
  steps: z.int(),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type StepCount = z.infer<typeof stepCountSchema>;

export const sleepLogSchema = z.object({
  day: istDaySchema,
  sleepMinutes: z.int(),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type SleepLog = z.infer<typeof sleepLogSchema>;

export const measurementSchema = z.object({
  day: istDaySchema,
  upperWaistMm: z.int(),
  lowerWaistMm: z.int(),
  chestMm: z.int().nullable(),
  hipsMm: z.int().nullable(),
  armMm: z.int().nullable(),
  thighMm: z.int().nullable(),
  notes: z.string().nullable(),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type Measurement = z.infer<typeof measurementSchema>;

const servedExerciseFields = {
  name: z.string(),
  calories: z.object({ kcal: z.int(), estimated: z.boolean() }).nullable(),
  averageHeartRateBpm: z.int().nullable(),
  highestHeartRateBpm: z.int().nullable(),
  note: z.string().nullable(),
};

/** An exercise the server holds: one saved before D-50 reads as that many identical sets. */
export const servedExerciseSchema = z.preprocess(
  fromEarlierExercise,
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('sets'),
      ...servedExerciseFields,
      sets: z.array(z.object({ reps: z.int().nullable(), weightGrams: z.int().nullable(), seconds: z.int().nullable() })),
      durationSeconds: z.int().nullable(),
    }),
    z.object({
      kind: z.literal('cardio'),
      ...servedExerciseFields,
      durationSeconds: z.int(),
      distanceMetres: z.int().nullable(),
      speedMetresPerHour: z.int().nullable(),
      inclinePermille: z.int().nullable(),
      level: z.int().nullable(),
    }),
  ]),
);

/** A workout the server holds, in the pull and in the history. Its timer (D-71), or null: none, or
 * from a server before D-71. */
export const workoutSchema = z.object({
  id: idSchema,
  day: istDaySchema,
  exercises: z.array(servedExerciseSchema),
  timer: z
    .object({
      startedAt: instantSchema,
      countedSeconds: z.int(),
      runningSince: instantSchema.nullable(),
      doneAt: instantSchema.nullable(),
    })
    .nullable()
    .default(null),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type Workout = z.infer<typeof workoutSchema>;

/** A workout in the pull; a deleted workout comes back as `deleted: true` with no content. */
export const pulledWorkoutSchema = z.discriminatedUnion('deleted', [
  workoutSchema.extend({ deleted: z.literal(false) }),
  z.object({ deleted: z.literal(true), id: idSchema, day: istDaySchema, updatedAt: instantSchema }),
]);
export type PulledWorkout = z.infer<typeof pulledWorkoutSchema>;

export const targetSchema = z.object({
  kind: z.enum(TARGET_KINDS),
  /** The IST day the value starts (D-77). */
  day: istDaySchema,
  value: z.int(),
  /** Null only once the person who set it has deleted their account (backlog E-02). */
  setByUserId: idSchema.nullable(),
  setAt: instantSchema,
  updatedAt: instantSchema,
});
export type Target = z.infer<typeof targetSchema>;

export const settingSchema = z.object({
  name: z.enum(SETTING_NAMES),
  value: z.string(),
  setAt: instantSchema,
  updatedAt: instantSchema,
});
export type Setting = z.infer<typeof settingSchema>;

export const profileSchema = z.object({
  name: z.string().nullable(),
  dateOfBirth: istDaySchema.nullable(),
  sex: z.enum(SEXES).nullable(),
  heightMm: z.int().nullable(),
  phone: z.string().nullable(),
  address: z
    .object({ line1: z.string(), line2: z.string().nullable(), city: z.string(), state: z.string(), pinCode: z.string() })
    .nullable(),
  photoMediaId: idSchema.nullable(),
  setAt: instantSchema,
  updatedAt: instantSchema,
});
export type Profile = z.infer<typeof profileSchema>;

/** A meal's totals, computed by the server from its items: the sum of the known values, or null
 * when no item has that value (MVP default, D-26). */
export const mealTotalsSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  fibreG: z.number().nullable(),
});
export type MealTotals = z.infer<typeof mealTotalsSchema>;

const pulledItemSchema = z.object({
  source: z.enum(MEAL_ITEM_SOURCES),
  ref: z.string().nullable(),
  name: z.string(),
  amount: z.discriminatedUnion('unit', [
    z.object({ unit: z.literal('g'), value: z.number() }),
    z.object({ unit: z.literal('portion'), value: z.number() }),
    z.object({ unit: z.literal('measure'), measure: z.enum(FOOD_MEASURES), value: z.number(), grams: z.number() }),
    z.object({ unit: z.literal('serving'), label: z.string(), value: z.number(), grams: z.number() }),
    z.object({ unit: z.literal('own'), name: z.enum(OWN_UNITS), value: z.number() }),
  ]),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  fibreG: z.number().nullable(),
  estimated: z.boolean(),
});

/** A meal in the pull; a deleted meal comes back as `deleted: true` with no content. */
export const pulledMealSchema = z.discriminatedUnion('deleted', [
  z.object({
    deleted: z.literal(false),
    id: idSchema,
    day: istDaySchema,
    mealType: z.enum(MEAL_TYPES),
    tags: z.array(z.enum(MEAL_TAGS)),
    items: z.array(pulledItemSchema),
    totals: mealTotalsSchema,
    photo: mealPhotoSchema.nullable(),
    recordedAt: instantSchema,
    updatedAt: instantSchema,
  }),
  z.object({ deleted: z.literal(true), id: idSchema, day: istDaySchema, updatedAt: instantSchema }),
]);
export type PulledMeal = z.infer<typeof pulledMealSchema>;

export const pulledSavedMealSchema = z.discriminatedUnion('deleted', [
  z.object({
    deleted: z.literal(false),
    id: idSchema,
    name: z.string(),
    tags: z.array(z.enum(MEAL_TAGS)),
    items: z.array(pulledItemSchema),
    totals: mealTotalsSchema,
    savedAt: instantSchema,
    updatedAt: instantSchema,
  }),
  z.object({ deleted: z.literal(true), id: idSchema, updatedAt: instantSchema }),
]);
export type PulledSavedMeal = z.infer<typeof pulledSavedMealSchema>;

export const pulledMyFoodSchema = z.discriminatedUnion('deleted', [
  z.object({
    deleted: z.literal(false),
    id: idSchema,
    name: z.string(),
    unit: z.enum(MY_FOOD_UNITS),
    kcal: z.number(),
    proteinG: z.number(),
    carbsG: z.number(),
    fatG: z.number(),
    fibreG: z.number().nullable(),
    savedAt: instantSchema,
    updatedAt: instantSchema,
  }),
  z.object({ deleted: z.literal(true), id: idSchema, updatedAt: instantSchema }),
]);
export type PulledMyFood = z.infer<typeof pulledMyFoodSchema>;

export const syncResponseSchema = z.object({
  results: z.array(syncResultSchema),
  pull: z.object({
    weighIns: z.array(weighInSchema),
    steps: z.array(stepCountSchema),
    sleep: z.array(sleepLogSchema),
    measurements: z.array(measurementSchema),
    workouts: z.array(pulledWorkoutSchema),
    targets: z.array(targetSchema),
    settings: z.array(settingSchema),
    /** The profile, when it changed after the cursor: at most one, the user's own. */
    profiles: z.array(profileSchema).max(1),
    meals: z.array(pulledMealSchema),
    savedMeals: z.array(pulledSavedMealSchema),
    myFoods: z.array(pulledMyFoodSchema),
    // Always empty in the MVP (ADR-0007 rule 3; D-20).
    removals: z.array(z.never()),
  }),
  cursor: z.string(),
  hasMore: z.boolean(),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;

/** A meal's totals from its items: the sum of the known values, or null when none is known. */
export function mealTotals(items: readonly Pick<MealItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>[]): MealTotals {
  const sum = (values: (number | null)[]) => {
    const known = values.filter((value): value is number => value !== null);
    return known.length === 0 ? null : roundHundredths(known.reduce((total, value) => total + value, 0));
  };
  return {
    kcal: sum(items.map((item) => item.kcal)) ?? 0,
    proteinG: sum(items.map((item) => item.proteinG)) ?? 0,
    carbsG: sum(items.map((item) => item.carbsG)),
    fatG: sum(items.map((item) => item.fatG)),
    fibreG: sum(items.map((item) => item.fibreG)),
  };
}

function roundHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- Food list: GET /v1/foods (ADR-0006 rule 1; D-25, D-26) ---

/**
 * The citation the IFCT 2017 book asks for, shown wherever IFCT values are shown (D-25;
 * docs/data/food-list-sources.md).
 */
export const IFCT_ACKNOWLEDGEMENT =
  'Longvah, T., Ananthan, R., Bhaskarachary, K. and Venkaiah, K. (2017). Indian Food Composition Tables 2017, National Institute of Nutrition, Indian Council of Medical Research, Hyderabad, Telangana, India.';

/**
 * The credit for the Indian Nutrient Databank's recipes (D-46): the article that publishes INDB, and
 * where its data is. Shown with IFCT's and USDA's, behind Search foods' i.
 */
export const INDB_ACKNOWLEDGEMENT =
  'Vijayakumar, A., Dubasi, H. B., Awasthi, A. and Jaacks, L. M. (2024). Development of an Indian Food Composition Database. Current Developments in Nutrition, 8(7), 103790. Indian Nutrient Databank (INDB): github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-.';

/**
 * The food list's sources: Indian data only (D-47), since D-49 brands' own labels approved by the
 * owner, since D-59 home-style forms of daily foods (a bread slice, butter toast), and since D-62
 * estimated dishes: Indian dishes with the typical values of their type of dish. USDA's FNDDS foods
 * are archived on the server, not served; a meal logged with one keeps it (MEAL_ITEM_SOURCES).
 */
export const FOOD_SOURCES = ['ifct2017', 'indb', 'brand_label', 'home', 'dish_estimate'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** One food of the list, per 100 g edible portion. */
export const foodSchema = z.object({
  source: z.enum(FOOD_SOURCES),
  code: z.string(),
  name: z.string(),
  foodGroup: z.string(),
  /** Other spellings to search by. */
  aliases: z.array(z.string()),
  proteinG: z.number(),
  /** Null when the label gives none (a brand label, D-49), or a home-style food gives none (D-59). */
  fibreG: z.number().nullable(),
  fatG: z.number(),
  carbsG: z.number(),
  kcal: z.number(),
  /** The kcal value is estimated, not published (oils and fats: 9 kcal per g of fat, D-26). */
  kcalEstimated: z.boolean(),
  /** The household units the owner has measured for this food, and the grams one holds (D-36). */
  measures: z.array(z.object({ measure: z.enum(FOOD_MEASURES), grams: z.number() })),
  /** A USDA food's servings as USDA labels them ("Medium or regular slice"), and their grams. */
  portions: z.array(z.object({ label: z.string(), grams: z.number() })),
});
export type Food = z.infer<typeof foodSchema>;

/** How a dish's portion is counted: one piece, or one 200 ml katori (D-26 answer 3, amended). */
export const DISH_PORTION_UNITS = ['piece', 'katori'] as const;
export type DishPortionUnit = (typeof DISH_PORTION_UNITS)[number];

/**
 * One dish, with its values for one portion: IFCT values × the measured grams of FitSphere's
 * standard-recipe sheet, so always estimated (D-26 answer 3; D-28). Only approved recipes are
 * listed; their ingredients and grams stay on the server.
 */
export const dishSchema = z.object({
  code: z.string(),
  name: z.string(),
  portionUnit: z.enum(DISH_PORTION_UNITS),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fibreG: z.number(),
});
export type Dish = z.infer<typeof dishSchema>;

/** `version`: the list the phone already holds; the items are left out when it is current. */
export const foodsQuerySchema = z.strictObject({
  version: z.string().min(1).max(64).optional(),
});

/**
 * A packaged food sold in India, from Open Food Facts' data (D-48; ADR-0009): its values per 100 g as
 * its label gives them, kept apart from FitSphere's own food list (ADR-0006 rule 2).
 */
export const packagedFoodSchema = z.object({
  barcode: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fibreG: z.number().nullable(),
  /** One serving's grams, when its label gives the serving in grams. */
  servingGrams: z.number().nullable(),
});
export type PackagedFood = z.infer<typeof packagedFoodSchema>;

/** The name a packaged food's serving is logged under (D-48). */
export const PACKAGED_SERVING_LABEL = 'Serving';

export const foodsResponseSchema = z.object({
  version: z.string(),
  /** Null when the phone's `version` is already current. */
  items: z.array(foodSchema).nullable(),
  /** The dishes, per portion; null exactly when `items` is. */
  dishes: z.array(dishSchema).nullable(),
  /** The packaged foods sold in India, from Open Food Facts (D-48); null exactly when `items` is. */
  packaged: z.array(packagedFoodSchema).nullable(),
});
export type FoodsResponse = z.infer<typeof foodsResponseSchema>;

// --- The exercise list: GET /v1/exercises (D-50) ---

/** The group shown beside an exercise's name. */
export const EXERCISE_GROUPS = ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight', 'band', 'cardio', 'sport', 'yoga', 'other'] as const;
export type ExerciseGroup = (typeof EXERCISE_GROUPS)[number];

/**
 * How an exercise is logged: in sets of reps and weight, of reps, of time, or of weight and time; or
 * as one time, with a distance, with a treadmill's speed and incline, with a machine's level, or alone.
 */
export const EXERCISE_LOG_TYPES = ['weight_reps', 'reps', 'time', 'weight_time', 'distance_time', 'treadmill', 'cardio_machine', 'time_only'] as const;
export type ExerciseLogType = (typeof EXERCISE_LOG_TYPES)[number];

/**
 * The exercise library's categories, each with its sub-groups (D-67), in the order the owner's file
 * gives them. A category with none has an empty list: the phone shows "No sub-groups".
 */
export const EXERCISE_SUB_GROUPS = {
  'Barbell': ['Chest', 'Shoulders', 'Back', 'Legs', 'Glutes', 'Arms', 'Core', 'Full Body'],
  'Olympic Weightlifting': ['Snatch Family', 'Clean Family', 'Jerk Family', 'Combinations'],
  'Dumbbell': ['Chest', 'Shoulders', 'Back', 'Legs', 'Glutes', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Full Body'],
  'Kettlebell': ['Ballistic', 'Grinds', 'Core & Mobility', 'Carries', 'Arms', 'Complexes/Flows'],
  'Cable': ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs & Glutes', 'Core'],
  'Machine': ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Neck'],
  'Smith Machine': [],
  'Specialty Bars (EZ / Trap / SSB etc.)': ['EZ Bar', 'Trap / Hex Bar', 'Safety Squat Bar', 'Swiss / Football Bar', 'Other Bars'],
  'Landmine': [],
  'Weight Plate': [],
  'Bodyweight / Calisthenics': ['Push', 'Pull', 'Legs', 'Skills & Statics', 'Locomotion / Animal Flow'],
  'Core / Abs': ['Flexion', 'Leg Raises', 'Anti-Extension / Plank', 'Rotation / Anti-Rotation', 'Lower Back / Posterior Chain'],
  'Plyometrics / Jumps': ['Lower Body', 'Upper Body', 'Full Body'],
  'CrossFit / Functional Fitness': ['Gymnastics', 'Monostructural', 'Weightlifting & Loaded', 'Benchmark WOD Formats'],
  'HYROX Stations': [],
  'Medicine Ball / Slam Ball / Wall Ball': [],
  'Sandbag / Strongman': ['Sandbag', 'Strongman'],
  'Sled / Prowler': [],
  'Battle Rope': [],
  'Resistance Band': ['Upper', 'Lower', 'Core'],
  'Suspension Trainer (TRX)': [],
  'Gymnastic Rings': [],
  'Stability Ball / BOSU / Balance': ['Stability Ball', 'BOSU / Balance Board'],
  'Sliders / Core Discs / Ab Wheel': [],
  'Clubs / Mace / Steel Mace': [],
  'Grip / Forearm / Neck': [],
  'Isometrics': [],
  'Cardio Machines': [],
  'Aerobic / Floor Cardio': [],
  'Running / Walking / Outdoor Cardio': [],
  'Jump Rope': [],
  'Agility / Speed / SAQ': ['Ladder', 'Cones / Drills'],
  'Boxing / Combat / Martial Arts': ['Strikes & Drills'],
  'Mobility / Stretching': ['Dynamic', 'Static', 'Recovery / Soft Tissue'],
  'Yoga': ['Standing', 'Floor / Seated', 'Sequences & Pranayama'],
  'Pilates': ['Mat', 'Reformer / Equipment'],
  'Dance / Group Fitness Classes': [],
  'Aquatic / Swimming': [],
  'Rehab / Prehab / Corrective': [],
} as const satisfies Record<string, readonly string[]>;
export type ExerciseCategory = keyof typeof EXERCISE_SUB_GROUPS;
export const EXERCISE_CATEGORIES = Object.keys(EXERCISE_SUB_GROUPS) as ExerciseCategory[];

/** Where the library lists an exercise (D-67): a category, and one of its sub-groups or null when it has none. */
export const exercisePlaceSchema = z.object({ category: z.string(), subGroup: z.string().nullable() });
export type ExercisePlace = z.infer<typeof exercisePlaceSchema>;

/** One of an exercise's speed bands: the Compendium activity done from `fromKmh` up to the next band. */
export const speedMetSchema = z.object({ fromKmh: z.number(), compendiumCode: z.string(), met: z.number() });
export type SpeedMet = z.infer<typeof speedMetSchema>;

/**
 * How to do an exercise (D-81, D-82): the library's details from the exercise's first place, as the
 * owner's file writes them: the primary muscle, the muscles worked (the primary first), the
 * equipment, the tags for its card, one to three steps, what to watch for, and a video's address, or
 * null when its places give none.
 */
export const exerciseDetailsSchema = z.object({
  place: exercisePlaceSchema,
  primaryMuscle: z.string(),
  musclesWorked: z.array(z.string()),
  equipment: z.string(),
  tags: z.array(z.string()),
  howTo: z.array(z.string()),
  watchFor: z.string(),
  videoUrl: z.string().nullable(),
});
export type ExerciseDetails = z.infer<typeof exerciseDetailsSchema>;

/** The owner's video for every exercise of the list whose places give none (D-82, 2026-11-11). */
export const EXERCISE_DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=IT94xC35u6k';

/**
 * One exercise of FitSphere's list. `met` is the 2024 Adult Compendium of Physical Activities' value
 * for its activity `compendiumCode`, unchanged; both are null when the Compendium lists no such
 * activity, and then no calories are estimated. Running, walking and cycling also have `speedMets`,
 * the Compendium's activities by speed, slowest first: the faster, the more burned (D-50).
 */
export const listedExerciseSchema = z.object({
  code: z.string(),
  name: z.string(),
  group: z.enum(EXERCISE_GROUPS),
  logType: z.enum(EXERCISE_LOG_TYPES),
  /** Other names to search by. */
  aliases: z.array(z.string()),
  compendiumCode: z.string().nullable(),
  met: z.number().nullable(),
  speedMets: z.array(speedMetSchema).default([]),
  /** Every category and sub-group the library lists it under (D-67); none for most of FitSphere's own. */
  places: z.array(exercisePlaceSchema).default([]),
  /** How to do it (D-82), from its first place in the library; null when the library has none. */
  details: exerciseDetailsSchema.nullable().default(null),
});
export type ListedExercise = z.infer<typeof listedExerciseSchema>;

/** The video an exercise of the list opens (D-82): its own, or the owner's default. */
export function exerciseVideoUrl(exercise: Pick<ListedExercise, 'details'>): string {
  return exercise.details?.videoUrl ?? EXERCISE_DEFAULT_VIDEO_URL;
}

/**
 * The Compendium activity and MET an exercise is estimated with at `speedKmh` (D-50): the speed band
 * starting at the highest speed at or below it (the slowest band below them all), or the exercise's
 * own when its speed is not known or it has no bands; null when it has no MET.
 */
export function exerciseMet(
  exercise: Pick<ListedExercise, 'compendiumCode' | 'met' | 'speedMets'>,
  speedKmh: number | null,
): { compendiumCode: string; met: number; speedKmh: number | null } | null {
  const [slowest] = exercise.speedMets;
  if (speedKmh !== null && slowest) {
    const band = exercise.speedMets.filter((each) => each.fromKmh <= speedKmh).at(-1) ?? slowest;
    return { compendiumCode: band.compendiumCode, met: band.met, speedKmh };
  }
  if (exercise.compendiumCode === null || exercise.met === null) return null;
  return { compendiumCode: exercise.compendiumCode, met: exercise.met, speedKmh: null };
}

/** `version`: the list the phone already holds; the items are left out when it is current. */
export const exercisesQuerySchema = foodsQuerySchema;

export const exercisesResponseSchema = z.object({
  version: z.string(),
  /** Null when the phone's `version` is already current. */
  items: z.array(listedExerciseSchema).nullable(),
});
export type ExercisesResponse = z.infer<typeof exercisesResponseSchema>;

/**
 * The key an exercise's name is matched by: lower case, letters and digits only, and a doubled
 * letter once, so "Dumbell", "dumbbell" and "DUMB-BELL" are one key, as are "Push up" and "push-up".
 */
export function exerciseNameKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/([a-z])\1+/g, '$1');
}

// --- Barcode lookup: GET /v1/barcodes/{barcode} (ADR-0006 rule 2) ---

/** Open Food Facts' own wording for attributing its data (openfoodfacts.org/data, read 2026-10-29). */
export const OFF_ATTRIBUTION = 'Contains data from Open Food Facts, available under the Open Database License';

/** EAN-8, UPC-A, EAN-13 and GTIN-14 barcodes: 8 to 14 digits. */
export const barcodeSchema = z.string().regex(/^\d{8,14}$/);

/** A packaged product's values per 100 g, as Open Food Facts gives them; null when it gives none. */
export const barcodeProductSchema = z.object({
  name: z.string(),
  brand: z.string().nullable(),
  kcal: z.number().nullable(),
  proteinG: z.number().nullable(),
  carbsG: z.number().nullable(),
  fatG: z.number().nullable(),
  fibreG: z.number().nullable(),
  /** The product's page on Open Food Facts, for attribution. */
  sourceUrl: z.string(),
});
export type BarcodeProduct = z.infer<typeof barcodeProductSchema>;

export const barcodeLookupSchema = z.object({
  barcode: z.string(),
  found: z.boolean(),
  product: barcodeProductSchema.nullable(),
});
export type BarcodeLookup = z.infer<typeof barcodeLookupSchema>;

// --- Meal photo files: /v1/users/{userId}/media/{mediaId} (ADR-0002 rules 3 and 4) ---

/**
 * Links for one meal photo's viewing copy and thumbnail: to upload them (POST …/upload) or to view
 * them (GET). A viewing link works for at most 5 minutes (D-16). The app never stores or logs a
 * link; it asks again.
 */
export const mediaLinksSchema = z.object({
  photoUrl: z.string(),
  thumbnailUrl: z.string(),
  expiresAt: instantSchema,
});
export type MediaLinks = z.infer<typeof mediaLinksSchema>;

// --- Weigh-in history: GET /v1/users/{userId}/weigh-ins ---

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 500;

/** Query values arrive as text; `limit` is a whole number from 1 to 500. */
export const weighInsQuerySchema = z.strictObject({
  from: istDaySchema,
  to: istDaySchema,
  limit: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.int().min(1).max(MAX_LIST_LIMIT))
    .optional(),
  cursor: z.string().min(1).max(200).optional(),
});
export type WeighInsQuery = z.input<typeof weighInsQuerySchema>;

export const weighInsPageSchema = z.object({
  items: z.array(weighInSchema),
  nextCursor: z.string().nullable(),
});
export type WeighInsPage = z.infer<typeof weighInsPageSchema>;

// --- Workout history: GET /v1/users/{userId}/workouts ---

/** The same query as the weigh-in history; the cursor is the route's own. */
export const workoutsQuerySchema = weighInsQuerySchema;
export type WorkoutsQuery = z.input<typeof workoutsQuerySchema>;

/** Workouts that are not deleted. */
export const workoutsPageSchema = z.object({
  items: z.array(workoutSchema),
  nextCursor: z.string().nullable(),
});
export type WorkoutsPage = z.infer<typeof workoutsPageSchema>;

// --- Validation details ---

/**
 * Turns a schema failure into error-model details: the field path and an issue name, never the
 * submitted value (invariant #7).
 */
export function validationDetails(error: z.ZodError, input: unknown): ValidationDetail[] {
  return error.issues.flatMap((issue): ValidationDetail[] => {
    const field = formatPath(issue.path);
    switch (issue.code) {
      case 'unrecognized_keys':
        return issue.keys.map((key) => ({
          field: formatPath([...issue.path, key]),
          issue: 'unknown_field',
        }));
      case 'invalid_type':
        return [{ field, issue: isMissing(input, issue.path) ? 'required' : 'invalid_format' }];
      case 'too_big':
        return [{ field, issue: issue.origin === 'array' ? 'too_many' : 'out_of_range' }];
      case 'too_small':
        return [{ field, issue: 'out_of_range' }];
      default:
        return [{ field, issue: 'invalid_format' }];
    }
  });
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) =>
      typeof key === 'number' ? `[${key}]` : `${index === 0 ? '' : '.'}${String(key)}`,
    )
    .join('');
}

function isMissing(input: unknown, path: readonly PropertyKey[]): boolean {
  let current = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return true;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current === undefined || current === null;
}
