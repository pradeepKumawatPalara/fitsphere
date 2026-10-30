// Schemas shared by the app and the API (api-conventions, "Strict input"; error-model).
// Request schemas are strict: unknown fields are refused. Response schemas accept added fields,
// because adding a field does not change the API version.
import { z } from 'zod';
import { addDays, isIstDay, type IstDay } from './dates.ts';
import {
  MEASUREMENT_MM_MAX,
  MEASUREMENT_MM_MIN,
  SLEEP_MINUTES_MAX,
  SLEEP_MINUTES_MIN,
  STEPS_MAX,
  STEPS_MIN,
  WEIGHT_GRAMS_MAX,
  WEIGHT_GRAMS_MIN,
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

// --- Sync: POST /v1/sync (ADR-0007) ---

export const MAX_SYNC_CHANGES = 100;
export const SYNC_PAGE_SIZE = 500;
/** The phone keeps, and the pull returns, the last 90 IST days of day data (ADR-0007 rule 1).
 * Targets are not day data: the pull always returns the current ones. */
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

// Targets (REQ-ROLE-007): the user's own, one current value per kind (Q-014 MVP default, D-23).
// Who set a target comes from the sign-in token, never from the change, so it is not a field here.

export const TARGET_SET = 'target.set';
export const TARGET_KINDS = ['calories', 'protein', 'steps', 'weekly_workouts', 'body_weight'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** Whole kcal, whole grams of protein, steps, workouts a week, and body weight in grams (D-23). */
export const TARGET_RANGES: Record<TargetKind, { min: number; max: number }> = {
  calories: { min: 500, max: 10_000 },
  protein: { min: 10, max: 500 },
  steps: { min: 1, max: STEPS_MAX },
  weekly_workouts: { min: 1, max: 14 },
  body_weight: { min: WEIGHT_GRAMS_MIN, max: WEIGHT_GRAMS_MAX },
};

function targetSchemaFor<K extends TargetKind>(kind: K) {
  return z.strictObject({
    kind: z.literal(kind),
    value: z.int().min(TARGET_RANGES[kind].min).max(TARGET_RANGES[kind].max),
    setAt: instantSchema,
  });
}

export const targetSetDataSchema = z.discriminatedUnion('kind', [
  targetSchemaFor('calories'),
  targetSchemaFor('protein'),
  targetSchemaFor('steps'),
  targetSchemaFor('weekly_workouts'),
  targetSchemaFor('body_weight'),
]);
export type TargetSetData = z.infer<typeof targetSetDataSchema>;

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
/** The most one item can hold, whatever its amount. */
export const MEAL_ITEM_KCAL_MAX = 20_000;
export const MEAL_ITEM_NUTRIENT_MAX = 5_000;
export const MEAL_ITEM_SOURCES = ['ifct2017', 'dish', 'barcode', 'own'] as const;
export type MealItemSource = (typeof MEAL_ITEM_SOURCES)[number];

const nutrientSchema = z.number().min(0).max(MEAL_ITEM_NUTRIENT_MAX);

/**
 * One food in a meal, with its values for the amount eaten. The values are a snapshot taken when
 * the meal is saved, so a later change to the food list never changes a past meal. kcal and protein
 * are always known; carbs, fat and fibre are null when the source gives none.
 */
export const mealItemSchema = z
  .strictObject({
    source: z.enum(MEAL_ITEM_SOURCES),
    /** The IFCT code, dish code or barcode; null for your own food. */
    ref: z.string().min(1).max(64).nullable(),
    name: z.string().trim().min(1).max(120),
    amount: z.discriminatedUnion('unit', [
      z.strictObject({ unit: z.literal('g'), value: z.int().min(1).max(MEAL_ITEM_GRAMS_MAX) }),
      z.strictObject({
        unit: z.literal('portion'),
        value: z
          .number()
          .min(0.5)
          .max(MEAL_ITEM_PORTIONS_MAX)
          .refine((value) => Number.isInteger(value * 2)),
      }),
    ]),
    kcal: z.number().min(0).max(MEAL_ITEM_KCAL_MAX),
    proteinG: nutrientSchema,
    carbsG: nutrientSchema.nullable(),
    fatG: nutrientSchema.nullable(),
    fibreG: nutrientSchema.nullable(),
    /** Any value is estimated rather than published (oils and fats, dishes). */
    estimated: z.boolean(),
  })
  // A dish is logged in portions, and everything else in grams (D-26 answer 3; D-28).
  .refine((item) => (item.source === 'dish') === (item.amount.unit === 'portion'), { path: ['amount'] });
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

export const SAVED_MEAL_SET = 'savedMeal.set';
export const SAVED_MEAL_DELETE = 'savedMeal.delete';
export const SAVED_MEAL_NAME_MAX = 60;

/** A copy of a meal kept for re-logging (REQ-SAVED-001). It has no day and no photo. */
export const savedMealSetDataSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(SAVED_MEAL_NAME_MAX),
  mealType: z.enum(MEAL_TYPES),
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

export const targetSchema = z.object({
  kind: z.enum(TARGET_KINDS),
  value: z.int(),
  /** Null only once the person who set it has deleted their account (backlog E-02). */
  setByUserId: idSchema.nullable(),
  setAt: instantSchema,
  updatedAt: instantSchema,
});
export type Target = z.infer<typeof targetSchema>;

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
  amount: z.object({ unit: z.enum(['g', 'portion']), value: z.number() }),
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
    mealType: z.enum(MEAL_TYPES),
    tags: z.array(z.enum(MEAL_TAGS)),
    items: z.array(pulledItemSchema),
    totals: mealTotalsSchema,
    savedAt: instantSchema,
    updatedAt: instantSchema,
  }),
  z.object({ deleted: z.literal(true), id: idSchema, updatedAt: instantSchema }),
]);
export type PulledSavedMeal = z.infer<typeof pulledSavedMealSchema>;

export const syncResponseSchema = z.object({
  results: z.array(syncResultSchema),
  pull: z.object({
    weighIns: z.array(weighInSchema),
    steps: z.array(stepCountSchema),
    sleep: z.array(sleepLogSchema),
    measurements: z.array(measurementSchema),
    targets: z.array(targetSchema),
    meals: z.array(pulledMealSchema),
    savedMeals: z.array(pulledSavedMealSchema),
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

export const FOOD_SOURCES = ['ifct2017'] as const;
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
  fibreG: z.number(),
  fatG: z.number(),
  carbsG: z.number(),
  kcal: z.number(),
  /** The kcal value is estimated, not published (oils and fats: 9 kcal per g of fat, D-26). */
  kcalEstimated: z.boolean(),
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

export const foodsResponseSchema = z.object({
  version: z.string(),
  /** Null when the phone's `version` is already current. */
  items: z.array(foodSchema).nullable(),
  /** The dishes, per portion; null exactly when `items` is. */
  dishes: z.array(dishSchema).nullable(),
});
export type FoodsResponse = z.infer<typeof foodsResponseSchema>;

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
