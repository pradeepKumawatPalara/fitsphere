// The phone's copy of the user's data (data-model "On the phone"; ADR-0007 rules 1, 2 and 7).
// The server is the permanent record; pending and rejected entries are never deleted
// automatically (D-14).
import {
  currentExercises,
  exerciseNameKey,
  MEAL_DELETE,
  MEAL_SET,
  mealTotals,
  MEASUREMENTS_SET,
  MY_FOOD_DELETE,
  MY_FOOD_SET,
  PROFILE_SET,
  SAVED_MEAL_DELETE,
  SAVED_MEAL_SET,
  SETTING_SET,
  SLEEP_SET,
  STEPS_SET,
  syncWindowStart,
  TARGET_SET,
  WEIGH_IN_SET,
  WORKOUT_DELETE,
  WORKOUT_SET,
  type ChangeErrorCode,
  type Dish,
  type ExerciseGroup,
  type Food,
  type ListedExercise,
  type IstDay,
  type MealItem,
  type MealSetData,
  type MealTotals,
  type MeasurementsSetData,
  type MyFoodSetData,
  type ProfileSetData,
  type SavedMealSetData,
  type SettingName,
  type SettingSetData,
  type SleepSetData,
  type StepsSetData,
  type TargetKind,
  type TargetSetData,
  type WeighInSetData,
  type WorkoutSetData,
  type WorkoutTimer,
  type PackagedFood,
} from '@fitsphere/shared';
import type { BindValue, SqlDb } from './sql';

export type SyncState = 'synced' | 'pending' | 'rejected';
export type OutboxEntry = {
  changeId: string;
  type: string;
  data: unknown;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'rejected';
  errorCode: string | null;
};

// --- The kinds of entry the phone keeps ---

/**
 * One entry per IST day for the day kinds, one per target kind and IST day it starts for targets
 * (D-77), one per name for settings, one per ID for meals, saved meals and workouts (any number a
 * day), and one profile.
 */
export type EntryKind =
  | 'weighIn'
  | 'steps'
  | 'sleep'
  | 'measurements'
  | 'workout'
  | 'target'
  | 'setting'
  | 'meal'
  | 'savedMeal'
  | 'myFood'
  | 'profile';

/** The profile's one key (REQ-ACC-011); also the owner of its photo in the photos table. */
export const PROFILE_KEY = 'profile';

/** A workout as the phone keeps and sends it: always with its timer, null until "Start workout" (D-71). */
export type WorkoutData = Omit<WorkoutSetData, 'timer'> & { timer: WorkoutTimer | null };

/** What a change carries for each kind (api-conventions, "POST /v1/sync"). */
export type ChangeData = {
  weighIn: WeighInSetData;
  steps: StepsSetData;
  sleep: SleepSetData;
  measurements: MeasurementsSetData;
  workout: WorkoutData;
  target: TargetSetData;
  setting: SettingSetData;
  meal: MealSetData;
  // A saved meal keeps no meal (D-69); the phone never sends one.
  savedMeal: Omit<SavedMealSetData, 'mealType'>;
  myFood: MyFoodSetData;
  profile: ProfileSetData;
};

/** An entry on the phone: the change's fields, what only the server knows, and its sync state. */
export type LocalEntries = {
  weighIn: WeighInSetData & { syncState: SyncState };
  steps: StepsSetData & { syncState: SyncState };
  sleep: SleepSetData & { syncState: SyncState };
  measurements: MeasurementsSetData & { syncState: SyncState };
  workout: WorkoutData & { syncState: SyncState };
  target: { kind: TargetKind; day: IstDay; value: number; setAt: string; setByUserId: string | null; syncState: SyncState };
  setting: { name: SettingName; value: string; setAt: string; syncState: SyncState };
  meal: MealSetData & MealTotals & { syncState: SyncState };
  savedMeal: Omit<SavedMealSetData, 'mealType'> & MealTotals & { syncState: SyncState };
  myFood: MyFoodSetData & { syncState: SyncState };
  profile: ProfileSetData & { syncState: SyncState };
};
export type LocalWeighIn = LocalEntries['weighIn'];
export type LocalSteps = LocalEntries['steps'];
export type LocalSleep = LocalEntries['sleep'];
export type LocalMeasurements = LocalEntries['measurements'];
export type LocalWorkout = LocalEntries['workout'];
export type LocalTarget = LocalEntries['target'];
export type LocalSetting = LocalEntries['setting'];
export type LocalMeal = LocalEntries['meal'];
export type LocalSavedMeal = LocalEntries['savedMeal'];
export type LocalProfile = LocalEntries['profile'];
export type LocalMyFood = LocalEntries['myFood'];

/** The kinds a user can delete; each has its own delete change (meals, saved meals, workouts, My foods). */
export type DeletableKind = 'meal' | 'savedMeal' | 'workout' | 'myFood';

type KindSpec = {
  changeType: string;
  /** The change that deletes an entry, for kinds the user can delete. */
  deleteType?: string;
  table: string;
  /** The field that identifies an entry: its column, and its path in a change's data. */
  key: 'day' | 'kind' | 'name' | 'id';
  /** A second field that identifies an entry with `key`: a target's start day (D-77). */
  key2?: 'day';
  /** A kind with one entry (the profile): its key, always; the change's data does not carry it. */
  onlyKey?: string;
  /** Local columns and the field each holds, key first; `json` columns hold JSON text (null when absent). */
  columns: [column: string, field: string, json?: 'json'][];
  /** Fields worked out from the others when the row is written (a meal's totals). */
  derive?: (fields: Record<string, unknown>) => Record<string, BindValue>;
  /** The fields as the app uses them, from those a row holds (a workout's exercises saved before D-50). */
  read?: (fields: Record<string, unknown>) => Record<string, unknown>;
  /** Fields only the server's pull carries. */
  pullColumns: [column: string, field: string][];
  /** Day data keeps the last 90 IST days (ADR-0007 rule 1); targets and settings are always kept. */
  dayData: boolean;
};

const TOTAL_COLUMNS: [string, string][] = [
  ['kcal', 'kcal'],
  ['protein_g', 'proteinG'],
  ['carbs_g', 'carbsG'],
  ['fat_g', 'fatG'],
  ['fibre_g', 'fibreG'],
];

const KINDS: Record<EntryKind, KindSpec> = {
  weighIn: {
    changeType: WEIGH_IN_SET,
    table: 'weigh_ins',
    key: 'day',
    columns: [
      ['day', 'day'],
      ['weight_grams', 'weightGrams'],
      ['recorded_at', 'recordedAt'],
    ],
    pullColumns: [],
    dayData: true,
  },
  steps: {
    changeType: STEPS_SET,
    table: 'steps',
    key: 'day',
    columns: [
      ['day', 'day'],
      ['steps', 'steps'],
      ['recorded_at', 'recordedAt'],
    ],
    pullColumns: [],
    dayData: true,
  },
  sleep: {
    changeType: SLEEP_SET,
    table: 'sleep',
    key: 'day',
    columns: [
      ['day', 'day'],
      ['sleep_minutes', 'sleepMinutes'],
      ['recorded_at', 'recordedAt'],
    ],
    pullColumns: [],
    dayData: true,
  },
  measurements: {
    changeType: MEASUREMENTS_SET,
    table: 'measurements',
    key: 'day',
    columns: [
      ['day', 'day'],
      ['upper_waist_mm', 'upperWaistMm'],
      ['lower_waist_mm', 'lowerWaistMm'],
      ['chest_mm', 'chestMm'],
      ['hips_mm', 'hipsMm'],
      ['arm_mm', 'armMm'],
      ['thigh_mm', 'thighMm'],
      ['notes', 'notes'],
      ['recorded_at', 'recordedAt'],
    ],
    pullColumns: [],
    dayData: true,
  },
  workout: {
    changeType: WORKOUT_SET,
    deleteType: WORKOUT_DELETE,
    table: 'workouts',
    key: 'id',
    columns: [
      ['id', 'id'],
      ['day', 'day'],
      ['exercises', 'exercises', 'json'],
      ['recorded_at', 'recordedAt'],
      ['timer', 'timer', 'json'],
    ],
    // A workout stored before D-71 has no timer.
    read: (fields) => ({ ...fields, exercises: currentExercises(fields.exercises as unknown[]), timer: fields.timer ?? null }),
    pullColumns: [],
    dayData: true,
  },
  // The user's targets (REQ-ROLE-007): each value from its IST day on, until the next of its kind
  // (D-77), so one entry per kind and day.
  target: {
    changeType: TARGET_SET,
    table: 'targets',
    key: 'kind',
    key2: 'day',
    columns: [
      ['kind', 'kind'],
      ['day', 'day'],
      ['value', 'value'],
      ['set_at', 'setAt'],
    ],
    // Who set it is known once the server has it; until then it is the user (D-20).
    pullColumns: [['set_by_user_id', 'setByUserId']],
    dayData: false,
  },
  // The user's settings (REQ-ACC-001…003; MVP default, D-31): one value per name, like targets.
  setting: {
    changeType: SETTING_SET,
    table: 'settings',
    key: 'name',
    columns: [
      ['name', 'name'],
      ['value', 'value'],
      ['set_at', 'setAt'],
    ],
    pullColumns: [],
    dayData: false,
  },
  meal: {
    changeType: MEAL_SET,
    deleteType: MEAL_DELETE,
    table: 'meals',
    key: 'id',
    columns: [
      ['id', 'id'],
      ['day', 'day'],
      ['meal_type', 'mealType'],
      ['tags', 'tags', 'json'],
      ['items', 'items', 'json'],
      ['photo', 'photo', 'json'],
      ['recorded_at', 'recordedAt'],
      ...TOTAL_COLUMNS,
    ],
    pullColumns: [],
    // The same rule as the server's, so the phone shows the totals the server will store.
    derive: deriveTotals,
    dayData: true,
  },
  savedMeal: {
    changeType: SAVED_MEAL_SET,
    deleteType: SAVED_MEAL_DELETE,
    table: 'saved_meals',
    key: 'id',
    columns: [
      ['id', 'id'],
      ['name', 'name'],
      ['tags', 'tags', 'json'],
      ['items', 'items', 'json'],
      ['saved_at', 'savedAt'],
      ...TOTAL_COLUMNS,
    ],
    pullColumns: [],
    derive: deriveTotals,
    dayData: false,
  },
  // My foods (D-39): foods the user entered and saved, by the ID made on the phone, kept like saved
  // meals and never pruned. Values per 100 g or ml, or per one of the unit.
  myFood: {
    changeType: MY_FOOD_SET,
    deleteType: MY_FOOD_DELETE,
    table: 'my_foods',
    key: 'id',
    columns: [
      ['id', 'id'],
      ['name', 'name'],
      ['unit', 'unit'],
      ['kcal', 'kcal'],
      ['protein_g', 'proteinG'],
      ['carbs_g', 'carbsG'],
      ['fat_g', 'fatG'],
      ['fibre_g', 'fibreG'],
      ['saved_at', 'savedAt'],
    ],
    pullColumns: [],
    dayData: false,
  },
  // The user's profile (REQ-ACC-011): one, kept like the settings. The address is JSON; the height
  // in millimetres (invariant #6). Its photo is in the photos table, owned by PROFILE_KEY.
  profile: {
    changeType: PROFILE_SET,
    table: 'profile',
    key: 'id',
    onlyKey: PROFILE_KEY,
    columns: [
      ['id', 'id'],
      ['name', 'name'],
      ['date_of_birth', 'dateOfBirth'],
      ['sex', 'sex'],
      ['height_mm', 'heightMm'],
      ['phone', 'phone'],
      ['address', 'address', 'json'],
      ['photo_media_id', 'photoMediaId'],
      ['set_at', 'setAt'],
    ],
    pullColumns: [],
    derive: () => ({ id: PROFILE_KEY }),
    dayData: false,
  },
};

/** An entry's key from its fields (or a change's data); a target's is "<kind>|<day>" (D-77). */
function keyOf(spec: KindSpec, fields: Record<string, unknown>): unknown {
  if (spec.onlyKey) return spec.onlyKey;
  return spec.key2 ? `${String(fields[spec.key])}|${String(fields[spec.key2])}` : fields[spec.key];
}

/** SQL for the key of the entry an outbox row is for, compared with `= ?`. */
function outboxKey(spec: KindSpec): string {
  if (spec.onlyKey) return `'${spec.onlyKey}'`;
  const field = (name: string) => `json_extract(data, '$.${name}')`;
  return spec.key2 ? `${field(spec.key)} || '|' || ${field(spec.key2)}` : field(spec.key);
}

/** SQL for an entry's key in its table, compared with `= ?`, as `keyOf` makes it. */
function tableKey(spec: KindSpec): string {
  return spec.key2 ? `${spec.key} || '|' || ${spec.key2}` : spec.key;
}

function deriveTotals(fields: Record<string, unknown>): Record<string, BindValue> {
  return mealTotals(fields.items as MealItem[]);
}

const DAY_KINDS = (Object.keys(KINDS) as EntryKind[]).filter((kind) => KINDS[kind].dayData);

function specOfType(type: string): KindSpec | null {
  return Object.values(KINDS).find((spec) => spec.changeType === type || spec.deleteType === type) ?? null;
}

/** The change types of a kind, as SQL parameters for `type IN (?, ?)`. */
function typesOf(spec: KindSpec): [string, string] {
  return [spec.changeType, spec.deleteType ?? spec.changeType];
}

// --- The local schema ---

/**
 * How a food search reads names, brands, aliases and the words typed (D-62, D-86): the marks ' ’ ‘ ` ´
 * . are dropped ("haldirams" finds "Haldiram's", "mr. makhana" finds "Mr. Makhana"), and every other
 * mark is read as a space ("dal-makhani" reads "dal makhani", "paneer!" reads "paneer"), as are the
 * double quotes that keep a food's aliases apart. Only % stays, as names use it ("55% Dark
 * Chocolate"). The phone's own code reads any character that is not a letter, a digit or % as a space
 * (`readName`); SQL cannot, so it reads the marks below, those a phone's keyboard types (D-86).
 */
const DROPPED_MARKS = ["'", '’', '‘', '`', '´', '.'] as const;
/**
 * The letters SQL reads without their accents (D-88), as `withoutAccents` does: SQL's lower() leaves
 * them as they are, capitals too, so both are listed.
 */
const ACCENTED_LETTERS = Object.entries({ a: 'àáâãäåā', c: 'çč', e: 'èéêëē', i: 'ìíîïī', n: 'ñ', o: 'òóôõöøō', u: 'ùúûüū', y: 'ýÿ', l: 'ł', s: 'š', z: 'ž', d: 'đ', ss: 'ß', ae: 'æ', oe: 'œ' }).flatMap(
  ([plain, letters]) => [...letters].flatMap((letter) => [letter, letter.toUpperCase()].filter((form, at, forms) => form.length === 1 && forms.indexOf(form) === at).map((form) => [form, plain] as const)),
);
const SPACE_MARKS = [
  ...['-', '&', ',', '/', '(', ')', '"', '!', '?', ':', ';', '[', ']', '{', '}', '*', '#', '+', '_', '@', '=', '|', '~', '^', '<', '>', '$', '\\'],
  ...['“', '”', '„', '–', '—', '…', '•', '·', '°', '™', '®', '©', '₹'],
] as const;

const SYNC_STATE = `sync_state TEXT NOT NULL CHECK (sync_state IN ('synced', 'pending', 'rejected'))`;

/** Each entry moves the local schema up one version; `PRAGMA user_version` counts them. */
const MIGRATIONS = [
  `CREATE TABLE weigh_ins (
     day TEXT PRIMARY KEY,
     weight_grams INTEGER NOT NULL,
     recorded_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   CREATE TABLE outbox (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     change_id TEXT NOT NULL UNIQUE,
     type TEXT NOT NULL,
     data TEXT NOT NULL,
     created_at TEXT NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0,
     status TEXT NOT NULL CHECK (status IN ('pending', 'rejected')),
     error_code TEXT
   );
   CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // Home and daily tracking. The cursor is cleared so the next sync pulls the new kinds, which an
  // older app skipped; the server's copy of everything else comes back unchanged.
  `CREATE TABLE steps (day TEXT PRIMARY KEY, steps INTEGER NOT NULL, recorded_at TEXT NOT NULL, ${SYNC_STATE});
   CREATE TABLE sleep (day TEXT PRIMARY KEY, sleep_minutes INTEGER NOT NULL, recorded_at TEXT NOT NULL, ${SYNC_STATE});
   CREATE TABLE measurements (
     day TEXT PRIMARY KEY,
     upper_waist_mm INTEGER NOT NULL,
     lower_waist_mm INTEGER NOT NULL,
     chest_mm INTEGER,
     hips_mm INTEGER,
     arm_mm INTEGER,
     thigh_mm INTEGER,
     notes TEXT,
     recorded_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   CREATE TABLE targets (
     kind TEXT PRIMARY KEY,
     value INTEGER NOT NULL,
     set_at TEXT NOT NULL,
     set_by_user_id TEXT,
     ${SYNC_STATE}
   );
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // Meal logging. Meals and saved meals, and the cached food list (ADR-0006 rule 1). The cursor is
  // cleared so the next sync pulls the meals.
  `CREATE TABLE meals (
     id TEXT PRIMARY KEY,
     day TEXT NOT NULL,
     meal_type TEXT NOT NULL,
     tags TEXT NOT NULL,
     items TEXT NOT NULL,
     recorded_at TEXT NOT NULL,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL,
     fat_g REAL,
     fibre_g REAL,
     ${SYNC_STATE}
   );
   CREATE INDEX meals_day ON meals (day);
   CREATE TABLE saved_meals (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     meal_type TEXT NOT NULL,
     tags TEXT NOT NULL,
     items TEXT NOT NULL,
     saved_at TEXT NOT NULL,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL,
     fat_g REAL,
     fibre_g REAL,
     ${SYNC_STATE}
   );
   CREATE TABLE foods (
     source TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     food_group TEXT NOT NULL,
     aliases TEXT NOT NULL,
     protein_g REAL NOT NULL,
     fibre_g REAL NOT NULL,
     fat_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     kcal REAL NOT NULL,
     kcal_estimated INTEGER NOT NULL,
     PRIMARY KEY (source, code)
   );
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // Meal photos (REQ-LOG-006, REQ-LOG-010). A meal's photo or public link, and the photo files,
  // kept inside this encrypted database as the encrypted photo cache (ADR-0007 rule 5): the
  // thumbnail, and the viewing copy once taken or viewed here. `uploaded` is 0 while the files wait
  // to be uploaded; such a photo is an unsynced entry and is never cleared automatically (D-14).
  // The cursor is cleared so the next sync pulls the meals' photos.
  `ALTER TABLE meals ADD COLUMN photo TEXT;
   CREATE TABLE photos (
     id TEXT PRIMARY KEY,
     meal_id TEXT NOT NULL,
     thumbnail TEXT,
     full TEXT,
     uploaded INTEGER NOT NULL CHECK (uploaded IN (0, 1)),
     created_at TEXT NOT NULL
   );
   CREATE INDEX photos_meal ON photos (meal_id);
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // Dishes (D-28): the approved dishes of the food list, with their values for one portion. The food
  // list's version is cleared, so the next download brings the dishes.
  `CREATE TABLE dishes (
     code TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     portion_unit TEXT NOT NULL,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     fat_g REAL NOT NULL,
     fibre_g REAL NOT NULL
   );
   DELETE FROM sync_meta WHERE key = 'food_list_version';`,
  // Training (D-29). Workouts are keyed by the ID made on the phone, since a day may hold several;
  // the exercises are JSON. The cursor is cleared so the next sync pulls them.
  `CREATE TABLE workouts (
     id TEXT PRIMARY KEY,
     day TEXT NOT NULL,
     exercises TEXT NOT NULL,
     recorded_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   CREATE INDEX workouts_day ON workouts (day);
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // Settings (REQ-ACC-001…003; D-31): theme and units, one value per name. The cursor is cleared so
  // the next sync pulls the settings the account already has.
  `CREATE TABLE settings (
     name TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     set_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // Household units (D-36): each food's measured units and the grams one holds, as JSON. The food
  // list's version is cleared, so the next download brings them.
  `ALTER TABLE foods ADD COLUMN measures TEXT NOT NULL DEFAULT '[]';
   DELETE FROM sync_meta WHERE key = 'food_list_version';`,
  // The profile (REQ-ACC-011): one row, keyed 'profile'; the address as JSON. Its photo is a row of
  // the photos table whose meal_id is 'profile'. The cursor is cleared so the next sync pulls it.
  `CREATE TABLE profile (
     id TEXT PRIMARY KEY CHECK (id = 'profile'),
     name TEXT,
     date_of_birth TEXT,
     sex TEXT,
     height_mm INTEGER,
     phone TEXT,
     address TEXT NOT NULL,
     photo_media_id TEXT,
     set_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // More foods (D-39): each food's USDA servings as JSON, and My foods. The food list's version is
  // cleared, so the next download brings the USDA foods, and the cursor, so the next sync pulls My
  // foods.
  `ALTER TABLE foods ADD COLUMN portions TEXT NOT NULL DEFAULT '[]';
   CREATE TABLE my_foods (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     unit TEXT NOT NULL,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     fat_g REAL NOT NULL,
     fibre_g REAL,
     saved_at TEXT NOT NULL,
     ${SYNC_STATE}
   );
   DELETE FROM sync_meta WHERE key IN ('food_list_version', 'cursor');`,
  // Packaged foods sold in India, from Open Food Facts (D-48): kept apart from the food list, as on
  // the server. The food list's version is cleared, so the next download brings them.
  `CREATE TABLE packaged_foods (
     barcode TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     brand TEXT,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     fat_g REAL NOT NULL,
     fibre_g REAL,
     serving_grams REAL
   );
   DELETE FROM sync_meta WHERE key = 'food_list_version';`,
  // Brand labels (D-49): a label may give no fibre, so a food's fibre may be unknown. The cached list
  // is made again with fibre_g allowed to be null; its version is cleared, so the next download fills it.
  `DROP TABLE foods;
   CREATE TABLE foods (
     source TEXT NOT NULL,
     code TEXT NOT NULL,
     name TEXT NOT NULL,
     food_group TEXT NOT NULL,
     aliases TEXT NOT NULL,
     protein_g REAL NOT NULL,
     fibre_g REAL,
     fat_g REAL NOT NULL,
     carbs_g REAL NOT NULL,
     kcal REAL NOT NULL,
     kcal_estimated INTEGER NOT NULL,
     measures TEXT NOT NULL DEFAULT '[]',
     portions TEXT NOT NULL DEFAULT '[]',
     PRIMARY KEY (source, code)
   );
   DELETE FROM sync_meta WHERE key = 'food_list_version';`,
  // The exercise list (D-50): each exercise with how it is logged and its Compendium MET, the words it
  // is searched by and the keys its name and other names are matched by. Its version is cleared, so
  // the next download fills it. Workouts keep their exercises as JSON, read in today's shape.
  `CREATE TABLE exercises (
     code TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     exercise_group TEXT NOT NULL,
     log_type TEXT NOT NULL,
     aliases TEXT NOT NULL,
     compendium_code TEXT,
     met REAL,
     search_text TEXT NOT NULL,
     name_keys TEXT NOT NULL
   );
   DELETE FROM sync_meta WHERE key = 'exercise_list_version';`,
  // Speed bands (D-50): running's, walking's and cycling's Compendium activities by speed, as JSON. The
  // exercise list's version is cleared, so the next download brings them.
  `ALTER TABLE exercises ADD COLUMN speed_mets TEXT NOT NULL DEFAULT '[]';
   DELETE FROM sync_meta WHERE key = 'exercise_list_version';`,
  // Ready-made search text (D-66): each food's and packaged food's name, aliases and brand as a search
  // reads them, kept with the row, so a search does not read them again for every food. Filled here
  // from the rows already on the phone, so search keeps working offline; each new download writes them.
  `ALTER TABLE foods ADD COLUMN search_name TEXT NOT NULL DEFAULT '';
   ALTER TABLE foods ADD COLUMN search_aliases TEXT NOT NULL DEFAULT '';
   ALTER TABLE packaged_foods ADD COLUMN search_name TEXT NOT NULL DEFAULT '';
   ALTER TABLE packaged_foods ADD COLUMN search_brand TEXT NOT NULL DEFAULT '';
   UPDATE foods SET search_name = ${searched('name')}, search_aliases = ${searched('aliases')};
   UPDATE packaged_foods SET search_name = ${searched('name')}, search_brand = ${searched("coalesce(brand, '')")};`,
  // The exercise library (D-67): each exercise's places, the categories and sub-groups the library lists
  // it under, as JSON and as keys the exercise sheet narrows a search by. The list's version is
  // cleared, so the next download brings them.
  `ALTER TABLE exercises ADD COLUMN places TEXT NOT NULL DEFAULT '[]';
   ALTER TABLE exercises ADD COLUMN place_keys TEXT NOT NULL DEFAULT '';
   DELETE FROM sync_meta WHERE key = 'exercise_list_version';`,
  // Saved meals keep no meal (D-69): the table is made again without meal_type and every saved meal
  // copied over as it is, those waiting to sync too, so nothing on the phone is lost.
  `CREATE TABLE saved_meals_new (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     tags TEXT NOT NULL,
     items TEXT NOT NULL,
     saved_at TEXT NOT NULL,
     kcal REAL NOT NULL,
     protein_g REAL NOT NULL,
     carbs_g REAL,
     fat_g REAL,
     fibre_g REAL,
     ${SYNC_STATE}
   );
   INSERT INTO saved_meals_new (id, name, tags, items, saved_at, kcal, protein_g, carbs_g, fat_g, fibre_g, sync_state)
     SELECT id, name, tags, items, saved_at, kcal, protein_g, carbs_g, fat_g, fibre_g, sync_state FROM saved_meals;
   DROP TABLE saved_meals;
   ALTER TABLE saved_meals_new RENAME TO saved_meals;`,
  // The workout timer (D-71): each workout's timer as JSON, null until "Start workout"; the workouts
  // already on the phone have none.
  `ALTER TABLE workouts ADD COLUMN timer TEXT;`,
  // Targets by date (D-77): one value per kind and IST day it starts. The synced ones are fetched
  // again with their days (the cursor is cleared); one waiting to sync keeps its value, from the IST
  // day it was set, and so does its change in the outbox.
  `CREATE TABLE targets_by_day (
     kind TEXT NOT NULL,
     day TEXT NOT NULL,
     value INTEGER NOT NULL,
     set_at TEXT NOT NULL,
     set_by_user_id TEXT,
     ${SYNC_STATE},
     PRIMARY KEY (kind, day)
   );
   INSERT INTO targets_by_day (kind, day, value, set_at, set_by_user_id, sync_state)
     SELECT kind, date(set_at, '+330 minutes'), value, set_at, set_by_user_id, sync_state FROM targets WHERE sync_state <> 'synced';
   DROP TABLE targets;
   ALTER TABLE targets_by_day RENAME TO targets;
   UPDATE outbox SET data = json_set(data, '$.day', date(json_extract(data, '$.setAt'), '+330 minutes'))
     WHERE type = '${TARGET_SET}' AND json_extract(data, '$.day') IS NULL;
   DELETE FROM sync_meta WHERE key = 'cursor';`,
  // How to do each exercise (D-82): the library's details as JSON, null when it has none. The list's
  // version is cleared, so the next download brings them.
  `ALTER TABLE exercises ADD COLUMN details TEXT;
   DELETE FROM sync_meta WHERE key = 'exercise_list_version';`,
  // Accents (D-88): a search reads "é" as "e", so the food list's version is cleared and the next
  // download writes each food's search text again; the foods stay, and are searched as before till then.
  `DELETE FROM sync_meta WHERE key = 'food_list_version';`,
];

/** Brings the local tables up to date, one version at a time; one signed-in user per database. */
export async function migrateLocal(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version += 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`${MIGRATIONS[version]}\nPRAGMA user_version = ${version + 1};`);
    });
  }
}

/**
 * `measurement_unit` is the cm/in choice in the measurements sheet, kept on this phone only (D-23).
 * `user_id` is the signed-in user's sign-in ID; `account_id` their FitSphere ID, which the API's
 * paths use (GET /v1/me). `account_created_day` is the IST day the account was created, for
 * Progress's "Meals logged" (Q-044). `ai_consent` is the last AI consent read from the server,
 * shown offline (D-31); the server's record is the one that counts.
 */
export type MetaKey =
  | 'user_id'
  | 'account_id'
  | 'cursor'
  | 'last_synced_at'
  | 'measurement_unit'
  | 'food_list_version'
  | 'exercise_list_version'
  | 'account_created_day'
  | 'ai_consent';

export async function getMeta(db: SqlDb, key: MetaKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(db: SqlDb, key: MetaKey, value: string | null): Promise<void> {
  if (value === null) await db.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
  else await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
}

// --- Entries ---

/**
 * Saves an entry on the phone and queues it for the server, in one transaction. A new value
 * replaces the day's (or the target's) value (Q-030); it also replaces a rejected change for it,
 * which is how the user fixes one (ADR-0007 rule 2). `alsoFirst` runs in the same transaction (a
 * new meal photo's files); a photo the meal no longer names is removed.
 */
export async function saveEntry<K extends EntryKind>(
  db: SqlDb,
  kind: K,
  entry: { changeId: string; data: ChangeData[K] },
  alsoFirst?: () => Promise<void>,
): Promise<void> {
  const spec = KINDS[kind];
  const fields = entry.data as Record<string, unknown>;
  const key = keyOf(spec, fields) as string;
  const createdAt = (fields.recordedAt ?? fields.setAt ?? fields.savedAt) as string;
  await db.withTransactionAsync(async () => {
    await alsoFirst?.();
    await upsert(db, spec, spec.columns, fields, 'pending');
    if (kind === 'meal' || kind === 'profile') await removeUnusedPhotos(db);
    await db.runAsync(`DELETE FROM outbox WHERE status = 'rejected' AND type IN (?, ?) AND ${outboxKey(spec)} = ?`, [
      ...typesOf(spec),
      key,
    ]);
    await db.runAsync(
      `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES (?, ?, ?, ?, 'pending')`,
      [entry.changeId, spec.changeType, JSON.stringify(entry.data), createdAt],
    );
  });
}

export async function getEntry<K extends EntryKind>(db: SqlDb, kind: K, key: string): Promise<LocalEntries[K] | null> {
  const spec = KINDS[kind];
  const row = await db.getFirstAsync<Record<string, BindValue>>(`SELECT * FROM ${spec.table} WHERE ${tableKey(spec)} = ?`, [key]);
  return row ? (toEntry(spec, row) as LocalEntries[K]) : null;
}

/**
 * Deletes a meal or saved meal on the phone and queues the deletion, in one transaction. A rejected
 * change for it is replaced, as when saving.
 */
export async function deleteEntry(
  db: SqlDb,
  kind: DeletableKind,
  entry: { changeId: string; data: { id: string; deletedAt: string } },
): Promise<void> {
  const spec = KINDS[kind];
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM ${spec.table} WHERE id = ?`, [entry.data.id]);
    // A deleted meal's photo leaves the phone at once, uploaded or not (REQ-LOG-006).
    if (kind === 'meal') await removeUnusedPhotos(db);
    await db.runAsync(
      `DELETE FROM outbox WHERE status = 'rejected' AND type IN (?, ?) AND json_extract(data, '$.id') = ?`,
      [...typesOf(spec), entry.data.id],
    );
    await db.runAsync(
      `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES (?, ?, ?, ?, 'pending')`,
      [entry.changeId, spec.deleteType!, JSON.stringify(entry.data), entry.data.deletedAt],
    );
  });
}

/** Day data between two IST days, newest first; entries of one day by the time saved, newest first. */
export async function listEntries<K extends Exclude<EntryKind, 'target' | 'setting' | 'savedMeal'>>(
  db: SqlDb,
  kind: K,
  fromDay: IstDay,
  toDay: IstDay,
): Promise<LocalEntries[K][]> {
  const spec = KINDS[kind];
  const rows = await db.getAllAsync<Record<string, BindValue>>(
    `SELECT * FROM ${spec.table} WHERE day BETWEEN ? AND ? ORDER BY day DESC, recorded_at DESC`,
    [fromDay, toDay],
  );
  return rows.map((row) => toEntry(spec, row) as LocalEntries[K]);
}

/** Every target value on the phone, each with the IST day it starts, oldest first (D-77, REQ-ROLE-018). */
export async function listTargets(db: SqlDb): Promise<LocalTarget[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>(`SELECT * FROM targets ORDER BY day, kind`, []);
  return rows.map((row) => toEntry(KINDS.target, row) as LocalTarget);
}

/**
 * The targets that hold on an IST day (REQ-ROLE-007, D-77): of each kind, the value with the latest
 * start day on or before it. A kind with none had no target that day.
 */
export async function targetsOn(db: SqlDb, day: IstDay): Promise<LocalTarget[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>(
    `SELECT * FROM targets WHERE day = (SELECT max(day) FROM targets AS later WHERE later.kind = targets.kind AND later.day <= ?)
     ORDER BY kind`,
    [day],
  );
  return rows.map((row) => toEntry(KINDS.target, row) as LocalTarget);
}

/** The settings the user has chosen (REQ-ACC-001…003); a name with no row has its default. */
export async function listSettings(db: SqlDb): Promise<LocalSetting[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>(`SELECT * FROM settings ORDER BY name`, []);
  return rows.map((row) => toEntry(KINDS.setting, row) as LocalSetting);
}

/**
 * Applies the server's entries from a sync pull. An entry with a change still waiting in the
 * outbox keeps the phone's value until that change is settled; other kinds for the same day are
 * applied.
 */
export async function applyServerEntries<K extends EntryKind>(
  db: SqlDb,
  kind: K,
  entries: (Partial<LocalEntries[K]> | { deleted: boolean; id: string })[],
): Promise<void> {
  const spec = KINDS[kind];
  const columns = [...spec.columns, ...spec.pullColumns];
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      const fields = entry as Record<string, unknown>;
      const key = keyOf(spec, fields) as string;
      if (await hasOutboxEntry(db, spec, key)) continue;
      // A meal or saved meal deleted on another phone leaves this one too.
      if (fields.deleted === true) await db.runAsync(`DELETE FROM ${spec.table} WHERE ${tableKey(spec)} = ?`, [key]);
      else await upsert(db, spec, columns, fields, 'synced');
    }
    if (kind === 'meal' || kind === 'profile') await removeUnusedPhotos(db);
  });
}

// Weight, as the Skeleton's screens and tests use it.

export async function saveWeighIn(
  db: SqlDb,
  entry: { changeId: string; day: IstDay; weightGrams: number; recordedAt: string },
): Promise<void> {
  const { changeId, ...data } = entry;
  await saveEntry(db, 'weighIn', { changeId, data });
}

export async function getWeighIn(db: SqlDb, day: IstDay): Promise<LocalWeighIn | null> {
  return getEntry(db, 'weighIn', day);
}

/** Newest first. */
export async function listWeighIns(db: SqlDb, fromDay: IstDay, toDay: IstDay): Promise<LocalWeighIn[]> {
  return listEntries(db, 'weighIn', fromDay, toDay);
}

export async function applyServerWeighIns(
  db: SqlDb,
  weighIns: { day: IstDay; weightGrams: number; recordedAt: string }[],
): Promise<void> {
  await applyServerEntries(db, 'weighIn', weighIns);
}

// --- The outbox ---

/** Changes to send, oldest first. */
export async function pendingChanges(db: SqlDb, limit: number): Promise<OutboxEntry[]> {
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY seq LIMIT ?`,
    [limit],
  );
  return rows.map(toOutboxEntry);
}

export async function rejectedChanges(db: SqlDb): Promise<OutboxEntry[]> {
  const rows = await db.getAllAsync<OutboxRow>(`SELECT * FROM outbox WHERE status = 'rejected' ORDER BY seq`, []);
  return rows.map(toOutboxEntry);
}

export async function recordAttempt(db: SqlDb, changeIds: string[]): Promise<void> {
  for (const changeId of changeIds) {
    await db.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE change_id = ?', [changeId]);
  }
}

/** The server applied the change: it leaves the outbox. */
export async function markAccepted(db: SqlDb, changeId: string): Promise<void> {
  await settle(db, changeId, async () => {
    await db.runAsync('DELETE FROM outbox WHERE change_id = ?', [changeId]);
  });
}

/** The server refused the change: it stays until the user fixes or discards it (ADR-0007 rule 2). */
export async function markRejected(db: SqlDb, changeId: string, errorCode: ChangeErrorCode): Promise<void> {
  await settle(db, changeId, async () => {
    await db.runAsync(`UPDATE outbox SET status = 'rejected', error_code = ? WHERE change_id = ?`, [errorCode, changeId]);
  });
}

/**
 * The user discards a rejected change. The entry's local value is removed and the sync cursor
 * cleared, so the next sync brings back what the server holds for it.
 */
export async function discardRejected(db: SqlDb, changeId: string): Promise<void> {
  const target = await outboxTarget(db, changeId);
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM outbox WHERE change_id = ? AND status = 'rejected'`, [changeId]);
    if (target && !(await hasOutboxEntry(db, target.spec, target.key))) {
      await db.runAsync(`DELETE FROM ${target.spec.table} WHERE ${tableKey(target.spec)} = ?`, [target.key]);
    }
    await removeUnusedPhotos(db);
    await setMeta(db, 'cursor', null);
  });
}

/**
 * Keeps the last 90 IST days of day data on the phone (ADR-0007 rule 1): synced entries older
 * than that are removed; pending and rejected ones never are (D-14), nor a meal whose photo waits
 * to be uploaded. Targets and settings are always kept. Photos of removed meals go with them.
 */
export async function pruneSynced(db: SqlDb, today: IstDay): Promise<number> {
  let removed = 0;
  for (const kind of DAY_KINDS) {
    const waitingPhoto = kind === 'meal' ? ' AND NOT EXISTS (SELECT 1 FROM photos WHERE photos.meal_id = meals.id AND uploaded = 0)' : '';
    const result = await db.runAsync(`DELETE FROM ${KINDS[kind].table} WHERE sync_state = 'synced' AND day < ?${waitingPhoto}`, [
      syncWindowStart(today),
    ]);
    removed += result.changes;
  }
  await removeUnusedPhotos(db);
  return removed;
}

/** Entries not yet on the server: pending or rejected changes, and photos waiting to be uploaded. */
export async function unsyncedCount(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT count(*) FROM outbox) + (SELECT count(*) FROM photos WHERE uploaded = 0) AS n',
    [],
  );
  return row?.n ?? 0;
}

/**
 * Removes photos no meal on the phone, nor the profile, names any more: the meal was deleted, here
 * or on another phone, its photo was replaced or removed, or it left the 90 days (REQ-LOG-006,
 * A-004, REQ-ACC-011).
 */
export async function removeUnusedPhotos(db: SqlDb): Promise<void> {
  await db.runAsync(
    `DELETE FROM photos WHERE NOT EXISTS (
       SELECT 1 FROM meals WHERE meals.id = photos.meal_id AND json_extract(meals.photo, '$.mediaId') = photos.id
     ) AND NOT EXISTS (
       SELECT 1 FROM profile WHERE photos.meal_id = profile.id AND profile.photo_media_id = photos.id
     )`,
    [],
  );
}

/** Log out (REQ-ACC-008; MVP default): delete at once when nothing is waiting, otherwise warn. */
export async function logOutDecision(db: SqlDb): Promise<{ kind: 'deleteNow' } | { kind: 'warn'; unsynced: number }> {
  const unsynced = await unsyncedCount(db);
  return unsynced === 0 ? { kind: 'deleteNow' } : { kind: 'warn', unsynced };
}

// --- helpers ---

type OutboxRow = {
  change_id: string;
  type: string;
  data: string;
  created_at: string;
  attempts: number;
  status: 'pending' | 'rejected';
  error_code: string | null;
};

async function upsert(
  db: SqlDb,
  spec: KindSpec,
  columns: KindSpec['columns'],
  given: Record<string, unknown>,
  state: SyncState,
): Promise<void> {
  const fields = { ...given, ...spec.derive?.(given) };
  const names = columns.map(([column]) => column);
  const keys: string[] = spec.key2 ? [spec.key, spec.key2] : [spec.key];
  const updates = names.filter((name) => !keys.includes(name)).map((name) => `${name} = excluded.${name}`);
  await db.runAsync(
    `INSERT INTO ${spec.table} (${names.join(', ')}, sync_state) VALUES (${names.map(() => '?').join(', ')}, ?)
     ON CONFLICT (${keys.join(', ')}) DO UPDATE SET ${[...updates, 'sync_state = excluded.sync_state'].join(', ')}`,
    [
      ...columns.map(([, field, json]) => (json ? JSON.stringify(fields[field] ?? null) : ((fields[field] as BindValue) ?? null))),
      state,
    ],
  );
}

function toEntry(spec: KindSpec, row: Record<string, BindValue>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [column, field, json] of [...spec.columns, ...spec.pullColumns]) {
    fields[field] = json ? (JSON.parse(String(row[column])) as unknown) : row[column];
  }
  return { ...(spec.read ? spec.read(fields) : fields), syncState: row.sync_state };
}

function toOutboxEntry(row: OutboxRow): OutboxEntry {
  return {
    changeId: row.change_id,
    type: row.type,
    data: JSON.parse(row.data) as unknown,
    createdAt: row.created_at,
    attempts: row.attempts,
    status: row.status,
    errorCode: row.error_code,
  };
}

/** The kind and key of the entry an outbox change is for. */
async function outboxTarget(db: SqlDb, changeId: string): Promise<{ spec: KindSpec; key: string } | null> {
  const row = await db.getFirstAsync<{ type: string; data: string }>('SELECT type, data FROM outbox WHERE change_id = ?', [
    changeId,
  ]);
  const spec = row ? specOfType(row.type) : null;
  if (!row || !spec) return null;
  const key = keyOf(spec, JSON.parse(row.data) as Record<string, unknown>);
  return typeof key === 'string' ? { spec, key } : null;
}

/** The entry has a change in the outbox, pending or rejected, so the server may not have it. */
export async function entryWaiting(db: SqlDb, kind: EntryKind, key: string): Promise<boolean> {
  return hasOutboxEntry(db, KINDS[kind], key);
}

async function hasOutboxEntry(db: SqlDb, spec: KindSpec, key: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM outbox WHERE type IN (?, ?) AND ${outboxKey(spec)} = ?`,
    [...typesOf(spec), key],
  );
  return (row?.n ?? 0) > 0;
}

/** Runs `change`, then sets the entry's sync state from what is left in the outbox for it. */
async function settle(db: SqlDb, changeId: string, change: () => Promise<void>): Promise<void> {
  const target = await outboxTarget(db, changeId);
  await db.withTransactionAsync(async () => {
    await change();
    if (!target) return;
    const { spec, key } = target;
    const row = await db.getFirstAsync<{ pending: number; rejected: number }>(
      `SELECT sum(status = 'pending') AS pending, sum(status = 'rejected') AS rejected
       FROM outbox WHERE type IN (?, ?) AND ${outboxKey(spec)} = ?`,
      [...typesOf(spec), key],
    );
    const state: SyncState = (row?.pending ?? 0) > 0 ? 'pending' : (row?.rejected ?? 0) > 0 ? 'rejected' : 'synced';
    await db.runAsync(`UPDATE ${spec.table} SET sync_state = ? WHERE ${tableKey(spec)} = ?`, [state, key]);
  });
}

// --- Meals, saved meals and the food list ---

/** A day's meals, in the order they were saved. */
export async function listMealsOfDay(db: SqlDb, day: IstDay): Promise<LocalMeal[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>('SELECT * FROM meals WHERE day = ? ORDER BY recorded_at', [day]);
  return rows.map((row) => toEntry(KINDS.meal, row) as LocalMeal);
}

/**
 * What was eaten on a day (REQ-HOME-003, REQ-NUT-002): the sum of the meals' totals, with carbs,
 * fat and fibre null when no meal has a value for them, and null altogether when nothing is logged.
 */
export async function dayNutrition(db: SqlDb, day: IstDay): Promise<(MealTotals & { meals: number }) | null> {
  const row = await db.getFirstAsync<{
    meals: number;
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fibre_g: number | null;
  }>(
    `SELECT count(*) AS meals, sum(kcal) AS kcal, sum(protein_g) AS protein_g, sum(carbs_g) AS carbs_g,
       sum(fat_g) AS fat_g, sum(fibre_g) AS fibre_g
     FROM meals WHERE day = ?`,
    [day],
  );
  if (!row || row.meals === 0) return null;
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  return {
    meals: row.meals,
    kcal: round(row.kcal) ?? 0,
    proteinG: round(row.protein_g) ?? 0,
    carbsG: round(row.carbs_g),
    fatG: round(row.fat_g),
    fibreG: round(row.fibre_g),
  };
}

/** How many meals each day between two IST days has (REQ-HOME-002, REQ-LOG-002). */
export async function mealCounts(db: SqlDb, fromDay: IstDay, toDay: IstDay): Promise<Record<IstDay, number>> {
  const rows = await db.getAllAsync<{ day: string; n: number }>(
    'SELECT day, count(*) AS n FROM meals WHERE day BETWEEN ? AND ? GROUP BY day',
    [fromDay, toDay],
  );
  return Object.fromEntries(rows.map((row) => [row.day, row.n]));
}

/** The latest IST day on or before `toDay` with measurements on the phone, or null (D-85). */
export async function latestMeasurementsDay(db: SqlDb, toDay: IstDay): Promise<IstDay | null> {
  const row = await db.getFirstAsync<{ day: string | null }>('SELECT max(day) AS day FROM measurements WHERE day <= ?', [toDay]);
  return row?.day ?? null;
}

/** Each day's kcal and protein between two IST days, for days with at least one meal (REQ-PRG-002, REQ-PRG-005). */
export async function dailyNutrition(
  db: SqlDb,
  fromDay: IstDay,
  toDay: IstDay,
): Promise<Record<IstDay, { kcal: number; proteinG: number }>> {
  const rows = await db.getAllAsync<{ day: string; kcal: number | null; protein_g: number | null }>(
    'SELECT day, sum(kcal) AS kcal, sum(protein_g) AS protein_g FROM meals WHERE day BETWEEN ? AND ? GROUP BY day',
    [fromDay, toDay],
  );
  const round = (value: number | null) => Math.round((value ?? 0) * 100) / 100;
  return Object.fromEntries(rows.map((row) => [row.day, { kcal: round(row.kcal), proteinG: round(row.protein_g) }]));
}

/**
 * Every My food whose name has every word of the search, ignoring case, spaces and marks (D-62, D-66);
 * names starting with the first word first (D-39). A short search finds only a name that is all of
 * it (D-72). A `limit` keeps only that many.
 */
export async function searchMyFoods(db: SqlDb, query: string, limit?: number): Promise<LocalMyFood[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const match = isShortSearch(query) ? wholeMatch(query, ['s0']) : wordsMatch(words, READ_NAME);
  const first = firstWordFirst(words[0]!, READ_NAME);
  const rows = await db.getAllAsync<Record<string, BindValue>>(
    `SELECT * FROM ${searchedTable('my_foods', ['name'])} WHERE ${match.sql} ORDER BY ${first.sql} DESC, name COLLATE NOCASE LIMIT ?`,
    [...match.params, ...first.params, sqlLimit(limit)],
  );
  return rows.map((row) => toEntry(KINDS.myFood, row) as LocalMyFood);
}

/** How a food is told apart in Recent foods (D-60): by its name, ignoring case and spaces. */
export function recentFoodKey(item: Pick<MealItem, 'name'>): string {
  return item.name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The foods logged between two IST days, for Search foods' Recent foods (D-60, REQ-LOG-007): the
 * latest first (by the meal's day, then when it was saved, then a meal's last food first), each food
 * once by its name, with the amount and values it was last logged with. A meal the server refused
 * is left out.
 */
export async function recentFoods(db: SqlDb, fromDay: IstDay, toDay: IstDay): Promise<MealItem[]> {
  const rows = await db.getAllAsync<{ items: string }>(
    `SELECT items FROM meals WHERE day BETWEEN ? AND ? AND sync_state != 'rejected' ORDER BY day DESC, recorded_at DESC`,
    [fromDay, toDay],
  );
  const seen = new Set<string>();
  const foods: MealItem[] = [];
  for (const row of rows) {
    for (const item of (JSON.parse(row.items) as MealItem[]).reverse()) {
      const key = recentFoodKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      foods.push(item);
    }
  }
  return foods;
}

/** A food as Search foods lists it and its page opens it (D-45). */
export type ListedFood =
  | { kind: 'dish'; dish: Dish }
  | { kind: 'food'; food: Food }
  | { kind: 'mine'; food: LocalMyFood }
  // A packaged food sold in India, from Open Food Facts (D-48).
  | { kind: 'packaged'; food: PackagedFood };

/**
 * The food a meal's item was logged from, as the phone lists it now, so a recent food's page can open
 * (D-60); null when it is no longer listed: your own food not kept in My foods, a My food deleted, a
 * food that left the list, or a barcode product scanned rather than listed.
 */
export async function listedFoodOf(db: SqlDb, item: MealItem): Promise<ListedFood | null> {
  if (item.ref === null) return null;
  if (item.source === 'own') {
    const food = await getEntry(db, 'myFood', item.ref);
    return food ? { kind: 'mine', food } : null;
  }
  if (item.source === 'dish') {
    const row = await db.getFirstAsync<DishRow>('SELECT * FROM dishes WHERE code = ?', [item.ref]);
    return row ? { kind: 'dish', dish: toDish(row) } : null;
  }
  if (item.source === 'barcode') {
    const row = await db.getFirstAsync<PackagedRow>('SELECT * FROM packaged_foods WHERE barcode = ?', [item.ref]);
    return row ? { kind: 'packaged', food: toPackaged(row) } : null;
  }
  const food = await getFood(db, item.source, item.ref);
  return food ? { kind: 'food', food } : null;
}

/** Saved meals, by name (REQ-SAVED-001). */
export async function listSavedMeals(db: SqlDb): Promise<LocalSavedMeal[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>('SELECT * FROM saved_meals ORDER BY name COLLATE NOCASE', []);
  return rows.map((row) => toEntry(KINDS.savedMeal, row) as LocalSavedMeal);
}

/**
 * Replaces the cached food list (ADR-0006 rule 1), its dishes (D-28) and the packaged foods (D-48),
 * and records its version, in one transaction.
 */
export async function replaceFoods(
  db: SqlDb,
  version: string,
  foods: Food[],
  dishes: readonly Dish[] = [],
  packaged: readonly PackagedFood[] = [],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM packaged_foods', []);
    for (let start = 0; start < packaged.length; start += PACKAGED_ROWS_PER_INSERT) {
      const batch = packaged.slice(start, start + PACKAGED_ROWS_PER_INSERT);
      await db.runAsync(
        `INSERT INTO packaged_foods (barcode, name, brand, kcal, protein_g, carbs_g, fat_g, fibre_g, serving_grams, search_name, search_brand)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((food) => [
          food.barcode,
          food.name,
          food.brand,
          food.kcal,
          food.proteinG,
          food.carbsG,
          food.fatG,
          food.fibreG,
          food.servingGrams,
          searchText(food.name),
          searchText(food.brand ?? ''),
        ]),
      );
    }
    await db.runAsync('DELETE FROM dishes', []);
    for (const dish of dishes) {
      await db.runAsync(
        `INSERT INTO dishes (code, name, portion_unit, kcal, protein_g, carbs_g, fat_g, fibre_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [dish.code, dish.name, dish.portionUnit, dish.kcal, dish.proteinG, dish.carbsG, dish.fatG, dish.fibreG],
      );
    }
    await db.runAsync('DELETE FROM foods', []);
    // Many rows a statement: about 6,000 foods since USDA's (D-39), one statement each was slow.
    for (let start = 0; start < foods.length; start += FOOD_ROWS_PER_INSERT) {
      const batch = foods.slice(start, start + FOOD_ROWS_PER_INSERT);
      await db.runAsync(
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated, measures, portions, search_name, search_aliases)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((food) => [
          food.source,
          food.code,
          food.name,
          food.foodGroup,
          JSON.stringify(food.aliases),
          food.proteinG,
          food.fibreG,
          food.fatG,
          food.carbsG,
          food.kcal,
          food.kcalEstimated ? 1 : 0,
          JSON.stringify(food.measures),
          JSON.stringify(food.portions),
          searchText(food.name),
          searchText(JSON.stringify(food.aliases)),
        ]),
      );
    }
    await setMeta(db, 'food_list_version', version);
  });
}

/** Foods a statement writes when the list is replaced: 15 values each, within SQLite's 999. */
const FOOD_ROWS_PER_INSERT = 50;
/** Packaged foods a statement writes: 11 values each, within SQLite's 999. */
const PACKAGED_ROWS_PER_INSERT = 90;

/**
 * Searches the packaged foods, offline (D-48): every product whose name or brand has every word,
 * ignoring case, spaces and marks (D-62: "haldirams" finds Haldiram's), all of them (D-66); names or
 * brands starting with the first word come first. Every barcode is returned, each with its own values
 * and serving: Search foods shows each product once (D-78, which replaced D-56's copies with the same
 * values, where a copy could show another barcode's serving). A short search finds only a name or a
 * brand that is all of it (D-72: "on" finds the brand ON, "h" the product named H). A `limit` keeps
 * only that many.
 */
export async function searchPackaged(db: SqlDb, query: string, limit?: number): Promise<PackagedFood[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const columns = ['search_name', 'search_brand'];
  const match = isShortSearch(query) ? wholeMatch(query, columns) : wordsMatch(words, columns);
  const first = firstWordFirst(words[0]!, columns);
  const rows = await db.getAllAsync<PackagedRow>(
    `SELECT * FROM packaged_foods WHERE ${match.sql} ORDER BY ${first.sql} DESC, name COLLATE NOCASE LIMIT ?`,
    [...match.params, ...first.params, sqlLimit(limit)],
  );
  return rows.map(toPackaged);
}

type PackagedRow = {
  barcode: string;
  name: string;
  brand: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number | null;
  serving_grams: number | null;
};

function toPackaged(row: PackagedRow): PackagedFood {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
    servingGrams: row.serving_grams,
  };
}

/**
 * The order the food list's sources are searched and listed in: INDB's Indian recipes, IFCT's Indian
 * foods, brand labels, home-style foods, then the estimated dishes (D-46, D-47, D-49, D-59, D-62).
 */
const SEARCH_ORDER: readonly Food['source'][] = ['indb', 'ifct2017', 'brand_label', 'home', 'dish_estimate'];

/**
 * Searches the cached food list, offline (ADR-0006 rule 1; REQ-LOG-007): every food whose name or an
 * alias has every word, ignoring case, spaces and marks (D-62), all of them (D-66), source by source
 * in SEARCH_ORDER; within each, names starting with the first word come first. A short search finds
 * only a name, or one of its other names, that is all of it (D-72: "go" finds the brand Go's labels,
 * whose other names have "Go"). A `limit` keeps only that many from each source.
 */
export async function searchFoods(db: SqlDb, query: string, limit?: number): Promise<Food[]> {
  return (await foodMatches<FoodRow>(db, query, '*', limit)).map(toFood);
}

/**
 * What Search foods' list reads of a food (D-73): enough to order it, group it with its brand and draw
 * its row. The rest (its other names, servings and household units) is read when it is opened
 * (`getFood`), so a search reads less for each of its matches.
 */
export type FoodSummary = Pick<Food, 'source' | 'code' | 'name' | 'foodGroup' | 'kcal' | 'kcalEstimated'>;

/** `searchFoods`' matches, in the same order, each as its summary (D-73). */
export async function searchFoodSummaries(db: SqlDb, query: string, limit?: number): Promise<FoodSummary[]> {
  const rows = await foodMatches<Pick<FoodRow, 'source' | 'code' | 'name' | 'food_group' | 'kcal' | 'kcal_estimated'>>(
    db,
    query,
    'source, code, name, food_group, kcal, kcal_estimated',
    limit,
  );
  return rows.map((row) => ({
    source: row.source,
    code: row.code,
    name: row.name,
    foodGroup: row.food_group,
    kcal: row.kcal,
    kcalEstimated: row.kcal_estimated === 1,
  }));
}

/**
 * A food of the cached list, whole, by its source and code (D-73); null when it is no longer listed.
 * Any source a meal's item names may be asked for (a USDA food a phone still holds from before D-47).
 */
export async function getFood(db: SqlDb, source: string, code: string): Promise<Food | null> {
  const row = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE source = ? AND code = ?', [source, code]);
  return row ? toFood(row) : null;
}

/** The rows `searchFoods` finds, with only `columns` read. */
async function foodMatches<T>(db: SqlDb, query: string, columns: string, limit: number | undefined): Promise<T[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const match = isShortSearch(query) ? wholeMatch(query, ['search_name'], true) : wordsMatch(words, ['search_name', 'search_aliases']);
  const first = firstWordFirst(words[0]!, ['search_name']);
  const rows: T[] = [];
  for (const source of SEARCH_ORDER) {
    rows.push(
      ...(await db.getAllAsync<T>(
        `SELECT ${columns} FROM foods WHERE source = ? AND ${match.sql} ORDER BY ${first.sql} DESC, name COLLATE NOCASE LIMIT ?`,
        [source, ...match.params, ...first.params, sqlLimit(limit)],
      )),
    );
  }
  return rows;
}

/** A row of the cached food list. */
type FoodRow = {
  source: Food['source'];
  code: string;
  name: string;
  food_group: string;
  aliases: string;
  protein_g: number;
  fibre_g: number | null;
  fat_g: number;
  carbs_g: number;
  kcal: number;
  kcal_estimated: number;
  measures: string;
  portions: string;
};

function toFood(row: FoodRow): Food {
  return {
    source: row.source,
    code: row.code,
    name: row.name,
    foodGroup: row.food_group,
    aliases: JSON.parse(row.aliases) as string[],
    proteinG: row.protein_g,
    fibreG: row.fibre_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    kcal: row.kcal,
    kcalEstimated: row.kcal_estimated === 1,
    measures: JSON.parse(row.measures) as Food['measures'],
    portions: JSON.parse(row.portions) as Food['portions'],
  };
}

/**
 * Searches the cached dishes, offline (D-28), with the words of a food search: every dish whose name
 * has every word, ignoring case, spaces and marks (D-62), all of them (D-66); names starting with the
 * first word come first. A short search finds only a name that is all of it (D-72). A `limit` keeps
 * only that many.
 */
export async function searchDishes(db: SqlDb, query: string, limit?: number): Promise<Dish[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const match = isShortSearch(query) ? wholeMatch(query, ['s0']) : wordsMatch(words, READ_NAME);
  const first = firstWordFirst(words[0]!, READ_NAME);
  const rows = await db.getAllAsync<DishRow>(
    `SELECT * FROM ${searchedTable('dishes', ['name'])} WHERE ${match.sql} ORDER BY ${first.sql} DESC, name COLLATE NOCASE LIMIT ?`,
    [...match.params, ...first.params, sqlLimit(limit)],
  );
  return rows.map(toDish);
}

type DishRow = {
  code: string;
  name: string;
  portion_unit: Dish['portionUnit'];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
};

function toDish(row: DishRow): Dish {
  return {
    code: row.code,
    name: row.name,
    portionUnit: row.portion_unit,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
  };
}

/** At most five lowercase words of a search. */
// --- The exercise list (D-50) ---

/** Short forms and other words an exercise's group is found by: "db bench" finds "Dumbbell bench press". */
const GROUP_SEARCH_WORDS: Record<ExerciseGroup, readonly string[]> = {
  barbell: ['barbell', 'bb'],
  dumbbell: ['dumbbell', 'db'],
  kettlebell: ['kettlebell', 'kb'],
  machine: ['machine'],
  cable: ['cable'],
  bodyweight: ['bodyweight', 'calisthenics'],
  band: ['band', 'resistance band'],
  cardio: ['cardio'],
  sport: ['sport'],
  yoga: ['yoga', 'mobility'],
  other: [],
};

/** An exercise's words as searched: its name's, its other names' and its group's, and each whole name, as keys. */
function exerciseSearchText(exercise: ListedExercise): string {
  const names = [exercise.name, ...exercise.aliases];
  const words = [...names, ...GROUP_SEARCH_WORDS[exercise.group]].flatMap((text) => text.split(/\s+/));
  return [...words, ...names].map(exerciseNameKey).filter((key) => key !== '').join(' ');
}

/** A search's words as keys; a plural's final s is dropped, so "dips" finds "Dip". */
function exerciseQueryWords(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map(exerciseNameKey)
    .filter((word) => word !== '')
    .map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word))
    .slice(0, 5);
}

type ExerciseRow = {
  code: string;
  name: string;
  exercise_group: ListedExercise['group'];
  log_type: ListedExercise['logType'];
  aliases: string;
  compendium_code: string | null;
  met: number | null;
  speed_mets: string;
  places: string;
  details: string | null;
};

function toListedExercise(row: ExerciseRow): ListedExercise {
  return {
    code: row.code,
    name: row.name,
    group: row.exercise_group,
    logType: row.log_type,
    aliases: JSON.parse(row.aliases) as string[],
    compendiumCode: row.compendium_code,
    met: row.met,
    speedMets: JSON.parse(row.speed_mets) as ListedExercise['speedMets'],
    places: JSON.parse(row.places) as ListedExercise['places'],
    details: row.details === null ? null : (JSON.parse(row.details) as ListedExercise['details']),
  };
}

/**
 * An exercise's places as keys a search narrows by (D-67): "<Barbell>Chest<" for each, so a category
 * is found with LIKE '%<Barbell>%', a sub-group with '%>Chest<%' and both with '%<Barbell>Chest<%'.
 */
function placeKeys(places: ListedExercise['places']): string {
  return places.map((place) => `<${place.category}>${place.subGroup ?? ''}<`).join('');
}

/** What the exercise sheet's Category and Sub-group narrow a search to (D-67); null for every one. */
export type ExerciseFilter = { category: string | null; subGroup: string | null };

/** The SQL that keeps a search to `filter`'s exercises, or null for all. */
function placeCondition(filter: ExerciseFilter | undefined): SqlPart | null {
  if (!filter || (filter.category === null && filter.subGroup === null)) return null;
  const pattern =
    filter.category !== null && filter.subGroup !== null
      ? `%<${escapeLike(filter.category)}>${escapeLike(filter.subGroup)}<%`
      : filter.category !== null
        ? `%<${escapeLike(filter.category)}>%`
        : `%>${escapeLike(filter.subGroup!)}<%`;
  return { sql: `place_keys LIKE ? ESCAPE '\\'`, params: [pattern] };
}

/** Exercises a statement writes when the list is replaced: 12 values each, within SQLite's 999. */
const EXERCISE_ROWS_PER_INSERT = 80;

/** Replaces the cached exercise list (D-50) and records its version, in one transaction. */
export async function replaceExercises(db: SqlDb, version: string, exercises: readonly ListedExercise[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercises', []);
    for (let start = 0; start < exercises.length; start += EXERCISE_ROWS_PER_INSERT) {
      const batch = exercises.slice(start, start + EXERCISE_ROWS_PER_INSERT);
      await db.runAsync(
        `INSERT INTO exercises (code, name, exercise_group, log_type, aliases, compendium_code, met, speed_mets, places, details, place_keys, search_text, name_keys)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((exercise) => [
          exercise.code,
          exercise.name,
          exercise.group,
          exercise.logType,
          JSON.stringify(exercise.aliases),
          exercise.compendiumCode,
          exercise.met,
          JSON.stringify(exercise.speedMets),
          JSON.stringify(exercise.places),
          exercise.details === null ? null : JSON.stringify(exercise.details),
          placeKeys(exercise.places),
          exerciseSearchText(exercise),
          // " name other names ", so a whole key is found with LIKE '% key %' and the name's comes first.
          ` ${[exercise.name, ...exercise.aliases].map(exerciseNameKey).join(' ')} `,
        ]),
      );
    }
    await setMeta(db, 'exercise_list_version', version);
  });
}

/**
 * Searches the cached exercise list, offline (D-50): every word must appear in the name, another name
 * or the group's words, ignoring case, hyphens and doubled letters ("dumbell" finds "Dumbbell"); names
 * starting with the first word come first. With a category or sub-group (D-67), only that one's
 * exercises; then no words lists them all, by name. An exercise named, or with another name, exactly
 * as typed comes before all (D-67: "push-up" finds "Standard Push-Up", which took over our Push-up).
 * With no words and no choice, nothing; or, with `everything` (the name's chevron, D-67), every
 * exercise by name.
 */
export async function searchExercises(
  db: SqlDb,
  query: string,
  limit = 8,
  filter?: ExerciseFilter,
  everything = false,
): Promise<ListedExercise[]> {
  const words = exerciseQueryWords(query);
  const place = placeCondition(filter);
  if (words.length === 0 && place === null && !everything) return [];
  const conditions = [...words.map(() => `search_text LIKE ? ESCAPE '\\'`), ...(place ? [place.sql] : [])];
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY ${words.length > 0 ? "name_keys LIKE ? ESCAPE '\\' DESC, name_keys LIKE ? DESC, " : ''}name COLLATE NOCASE LIMIT ?`,
    [
      ...words.map(like),
      ...(place ? place.params : []),
      ...(words.length > 0 ? [`% ${escapeLike(exerciseNameKey(query))} %`, ` ${startsWith(words[0]!)}`] : []),
      limit,
    ],
  );
  return rows.map(toListedExercise);
}

/** How many exercises each category, each category's sub-group and each sub-group name holds (D-67). */
export type ExercisePlaceCounts = {
  total: number;
  byCategory: ReadonlyMap<string, number>;
  /** By "Category>Sub-group". */
  byPlace: ReadonlyMap<string, number>;
  /** By sub-group name, across categories: "Chest" in Barbell, Dumbbell, Cable and Machine. */
  bySubGroup: ReadonlyMap<string, number>;
};

/** Counts the cached list's exercises by category and sub-group (D-67); an exercise counts once in each. */
export async function exercisePlaceCounts(db: SqlDb): Promise<ExercisePlaceCounts> {
  const rows = await db.getAllAsync<{ places: string }>('SELECT places FROM exercises', []);
  const byCategory = new Map<string, number>();
  const byPlace = new Map<string, number>();
  const bySubGroup = new Map<string, number>();
  const add = (map: Map<string, number>, keys: Iterable<string>) => {
    for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1);
  };
  for (const row of rows) {
    const places = JSON.parse(row.places) as ListedExercise['places'];
    add(byCategory, new Set(places.map((place) => place.category)));
    add(byPlace, new Set(places.filter((place) => place.subGroup !== null).map((place) => `${place.category}>${place.subGroup}`)));
    add(bySubGroup, new Set(places.flatMap((place) => (place.subGroup === null ? [] : [place.subGroup]))));
  }
  return { total: rows.length, byCategory, byPlace, bySubGroup };
}

/** The weight to estimate calories burned with (D-50): the latest weigh-in on or before `day`, or null. */
export async function weighInOnOrBefore(db: SqlDb, day: IstDay): Promise<number | null> {
  const row = await db.getFirstAsync<{ weight_grams: number }>(
    `SELECT weight_grams FROM weigh_ins WHERE day <= ? AND sync_state != 'rejected' ORDER BY day DESC LIMIT 1`,
    [day],
  );
  return row?.weight_grams ?? null;
}

/** The exercise whose name or other name is `name`, ignoring case, hyphens and doubled letters, or null. */
export async function findListedExercise(db: SqlDb, name: string): Promise<ListedExercise | null> {
  const key = exerciseNameKey(name);
  if (key === '') return null;
  const row = await db.getFirstAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE name_keys LIKE ? ESCAPE '\\' ORDER BY name_keys LIKE ? DESC LIMIT 1`,
    [`% ${escapeLike(key)} %`, ` ${escapeLike(key)} %`],
  );
  return row ? toListedExercise(row) : null;
}

/**
 * The words of a food search, up to five, each read as a search reads it (D-62): a mark inside a word
 * reads as a space there ("dal-makhani" reads "dal makhani"), and a word of marks alone is left out
 * (D-86: "aloo & gobi" searches as "aloo gobi").
 */
function searchWords(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map(readName)
    .filter((word) => word.length > 0)
    .slice(0, 5);
}

/** The fewest characters, spaces and marks not counted, a search needs to find foods by part of their name (D-72). */
export const SEARCH_MIN_CHARACTERS = 3;

/**
 * Whether a food search is short (D-72): fewer than SEARCH_MIN_CHARACTERS, spaces and marks not
 * counted (D-86: "on!" is as short as "on"). One or two letters match thousands of foods; a short
 * search finds only those named by all of it.
 */
export function isShortSearch(query: string): boolean {
  return readName(query).replace(/ /g, '').length < SEARCH_MIN_CHARACTERS;
}

/**
 * A short search's match (D-72): one of the columns, read as a search reads it, is the search whole;
 * with `aliases`, also one of a food's other names. Marks alone find nothing.
 */
function wholeMatch(query: string, columns: readonly string[], aliases = false): SqlPart {
  const text = readName(query);
  if (!text) return { sql: '0', params: [] };
  const parts: SqlPart[] = columns.map((column) => ({ sql: `${column} = ?`, params: [` ${text}`] }));
  if (aliases) {
    parts.push({
      // Each other name is read only where the ready-made search text has the search as a word, so
      // the thousands of foods without it are passed over quickly.
      sql: `(search_aliases LIKE ? ESCAPE '\\' AND EXISTS (SELECT 1 FROM json_each(aliases) WHERE ${searched('value')} = ?))`,
      params: [`% ${escapeLike(text)} %`, ` ${text}`],
    });
  }
  return { sql: `(${parts.map((part) => part.sql).join(' OR ')})`, params: parts.flatMap((part) => part.params) };
}

const escapeLike = (word: string) => word.replace(/[\\%_]/g, (char) => `\\${char}`);
const like = (word: string) => `%${escapeLike(word)}%`;
const startsWith = (word: string) => `${escapeLike(word)}%`;

/** A food search's LIMIT: every match when no limit is given (D-66), as SQLite reads a negative LIMIT. */
const sqlLimit = (limit: number | undefined) => limit ?? -1;

/** A piece of SQL and the values for its `?`s. */
type SqlPart = { sql: string; params: string[] };

/**
 * `lower(column)` read as a search reads it in SQL, after a space, so every word starts after one: as
 * `readName` reads it, for every mark a keyboard types (D-86).
 */
function searched(column: string): string {
  const plain = ACCENTED_LETTERS.reduce((sql, [letter, without]) => `replace(${sql}, '${letter}', '${without}')`, `lower(${column})`);
  const dropped = DROPPED_MARKS.reduce((sql, mark) => `replace(${sql}, '${mark.replace(/'/g, "''")}', '')`, plain);
  const spaced = SPACE_MARKS.reduce((sql, mark) => `replace(${sql}, '${mark}', ' ')`, dropped);
  // Up to four spaces in a row read as one, and none at the ends: "dal (makhani)" reads "dal makhani".
  return `' ' || trim(replace(replace(${spaced}, '  ', ' '), '  ', ' '))`;
}

/**
 * A small table's rows (My foods, dishes), each with its searched columns read once, as s0, s1 and so
 * on, so the many tests of a word do not read them again (D-66). LIMIT -1 keeps SQLite from folding
 * this into the query around it, which would read them again for each test. The food list and the
 * packaged foods keep theirs ready-made (`searchText`).
 */
function searchedTable(table: string, columns: readonly string[], where?: string): string {
  const read = columns.map((column, index) => `${searched(column)} AS s${index}`).join(', ');
  return `(SELECT *, ${read} FROM ${table}${where ? ` WHERE ${where}` : ''} LIMIT -1)`;
}

/**
 * A text as a search reads it, after a space, kept with each food and packaged food when the list is
 * stored (D-66): as `searched` reads it in SQL.
 */
export function searchText(text: string): string {
  return ` ${readName(text)}`;
}

/** The name of a small table, as `searchedTable` reads it. */
const READ_NAME: readonly string[] = ['s0'];

/** The longest word typed that is also tried as two words typed together. */
const JOINED_WORD_MAX = 24;

/**
 * A word typed as two words run together, at each place it can be split with two letters or more on
 * either side ("healthfactory": "he althfactory", …, "health factory", …), for matching whole words
 * written apart (D-62). Never one word's end and the next one's start: "dal" does not find "stuffed
 * aloo".
 */
function joinedForms(word: string): [string, string][] {
  if (word.includes(' ') || word.length < 4 || word.length > JOINED_WORD_MAX) return [];
  return Array.from({ length: word.length - 3 }, (_, index) => [word.slice(0, index + 2), word.slice(index + 2)]);
}

/**
 * Whether the column, read as a search reads it, has the word (D-62): anywhere, or typed as
 * two words run together where the column has them apart, the first starting a word
 * ("healthfactory" finds "The Health Factory", "dalmakhani" finds "Dal Makhani"); or, for ordering,
 * at its start. The word is one of `searchWords`, so never marks alone (D-86).
 */
function columnHas(column: string, word: string, at: 'anywhere' | 'start'): SqlPart {
  const forms = joinedForms(word).map(([first, second]) => ` ${escapeLike(first)} ${escapeLike(second)}%`);
  const params = [at === 'anywhere' ? like(word) : ` ${escapeLike(word)}%`, ...forms.map((form) => (at === 'anywhere' ? `%${form}` : form))];
  return { sql: params.map(() => `${column} LIKE ? ESCAPE '\\'`).join(' OR '), params };
}

/**
 * How well a food's name has the words of a search, for listing the best matches first (D-66), as a
 * test to run on each name:
 * 0 every word is a whole word of the name ("dal" in "Moong dal"; two words typed together count when
 * the name has them apart), 1 a word only starts a word of the name ("Dalia", "Dalda"), 2 a word is
 * only inside a word ("Vindaloo"), 3 a word is not in the name at all: the food was found by its
 * hidden search words ("Baati", by "dal baati"). The worst of the words counts.
 */
export function nameMatcher(query: string): (name: string) => 0 | 1 | 2 | 3 {
  const words = searchWords(query).map((word) => ({ word, forms: [word, ...joinedForms(word).map(([first, second]) => `${first} ${second}`)] }));
  return (name) => {
    const text = ` ${readName(name)} `;
    let worst: 0 | 1 | 2 | 3 = 0;
    for (const { word, forms } of words) {
      const tier = forms.some((form) => text.includes(` ${form} `)) ? 0 : forms.some((form) => text.includes(` ${form}`)) ? 1 : text.includes(word) ? 2 : 3;
      if (tier > worst) worst = tier;
    }
    return worst;
  };
}

/** Letters with no accent to take off, read as the plain letters they stand for (D-88). */
const PLAIN_LETTERS: Readonly<Record<string, string>> = { ø: 'o', ł: 'l', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe' };

/**
 * A lowercase text without its letters' accents (D-88): "nestlé" reads "nestle", "jalapeño"
 * "jalapeno", "ø" "o". Only Latin letters' accents go: Devanagari's vowel signs stay.
 */
export function withoutAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/[øłđßæœ]/g, (letter) => PLAIN_LETTERS[letter]!);
}

/**
 * A name, or a search, read as a search reads it (D-62, D-86, D-88): lowercase, without accents; ' ’ ‘
 * ` ´ . dropped; and any other character that is not a letter, a digit or % read as a space, one space
 * between words, none at the ends. So no mark typed can keep a search from finding a food.
 */
function readName(name: string): string {
  return withoutAccents(name.toLowerCase())
    .replace(/['’‘`´.]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}%]+/gu, ' ')
    .trim();
}

/** Every word in one of the columns, each column as a search reads it (D-62). */
function wordsMatch(words: readonly string[], columns: readonly string[]): SqlPart {
  const parts = words.map((word): SqlPart => {
    const each = columns.map((column) => columnHas(column, word, 'anywhere'));
    return { sql: `(${each.map((part) => part.sql).join(' OR ')})`, params: each.flatMap((part) => part.params) };
  });
  return { sql: parts.map((part) => part.sql).join(' AND '), params: parts.flatMap((part) => part.params) };
}

/** Whether one of the columns starts with the word, for ordering (D-62). */
function firstWordFirst(word: string, columns: readonly string[]): SqlPart {
  const each = columns.map((column) => columnHas(column, word, 'start'));
  return { sql: `(${each.map((part) => part.sql).join(' OR ')})`, params: each.flatMap((part) => part.params) };
}
