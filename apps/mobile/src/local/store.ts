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
 * One entry per IST day for the day kinds, one per target kind for targets, one per name for
 * settings, one per ID for meals, saved meals and workouts (any number a day), and one profile.
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

/** What a change carries for each kind (api-conventions, "POST /v1/sync"). */
export type ChangeData = {
  weighIn: WeighInSetData;
  steps: StepsSetData;
  sleep: SleepSetData;
  measurements: MeasurementsSetData;
  workout: WorkoutSetData;
  target: TargetSetData;
  setting: SettingSetData;
  meal: MealSetData;
  savedMeal: SavedMealSetData;
  myFood: MyFoodSetData;
  profile: ProfileSetData;
};

/** An entry on the phone: the change's fields, what only the server knows, and its sync state. */
export type LocalEntries = {
  weighIn: WeighInSetData & { syncState: SyncState };
  steps: StepsSetData & { syncState: SyncState };
  sleep: SleepSetData & { syncState: SyncState };
  measurements: MeasurementsSetData & { syncState: SyncState };
  workout: WorkoutSetData & { syncState: SyncState };
  target: { kind: TargetKind; value: number; setAt: string; setByUserId: string | null; syncState: SyncState };
  setting: { name: SettingName; value: string; setAt: string; syncState: SyncState };
  meal: MealSetData & MealTotals & { syncState: SyncState };
  savedMeal: SavedMealSetData & MealTotals & { syncState: SyncState };
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
    ],
    read: (fields) => ({ ...fields, exercises: currentExercises(fields.exercises as unknown[]) }),
    pullColumns: [],
    dayData: true,
  },
  target: {
    changeType: TARGET_SET,
    table: 'targets',
    key: 'kind',
    columns: [
      ['kind', 'kind'],
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
      ['meal_type', 'mealType'],
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

/** An entry's key from its fields (or a change's data). */
function keyOf(spec: KindSpec, fields: Record<string, unknown>): unknown {
  return spec.onlyKey ?? fields[spec.key];
}

/** SQL for the key of the entry an outbox row is for, compared with `= ?`. */
function outboxKey(spec: KindSpec): string {
  return spec.onlyKey ? `'${spec.onlyKey}'` : `json_extract(data, '$.${spec.key}')`;
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
  const row = await db.getFirstAsync<Record<string, BindValue>>(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ?`, [key]);
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

/** The user's current targets (REQ-ROLE-007). */
export async function listTargets(db: SqlDb): Promise<LocalTarget[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>(`SELECT * FROM targets ORDER BY kind`, []);
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
      if (fields.deleted === true) await db.runAsync(`DELETE FROM ${spec.table} WHERE ${spec.key} = ?`, [key]);
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
      await db.runAsync(`DELETE FROM ${target.spec.table} WHERE ${target.spec.key} = ?`, [target.key]);
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
  const updates = names.filter((name) => name !== spec.key).map((name) => `${name} = excluded.${name}`);
  await db.runAsync(
    `INSERT INTO ${spec.table} (${names.join(', ')}, sync_state) VALUES (${names.map(() => '?').join(', ')}, ?)
     ON CONFLICT (${spec.key}) DO UPDATE SET ${[...updates, 'sync_state = excluded.sync_state'].join(', ')}`,
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
    await db.runAsync(`UPDATE ${spec.table} SET sync_state = ? WHERE ${spec.key} = ?`, [state, key]);
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

/** My foods whose name has every word of the search, ignoring case; names starting with the first word first (D-39). */
export async function searchMyFoods(db: SqlDb, query: string, limit = 10): Promise<LocalMyFood[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const rows = await db.getAllAsync<Record<string, BindValue>>(
    `SELECT * FROM my_foods WHERE ${words.map(() => `lower(name) LIKE ? ESCAPE '\\'`).join(' AND ')}
     ORDER BY lower(name) LIKE ? DESC, name COLLATE NOCASE LIMIT ?`,
    [...words.map(like), startsWith(words[0]!), limit],
  );
  return rows.map((row) => toEntry(KINDS.myFood, row) as LocalMyFood);
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
        `INSERT INTO packaged_foods (barcode, name, brand, kcal, protein_g, carbs_g, fat_g, fibre_g, serving_grams)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((food) => [food.barcode, food.name, food.brand, food.kcal, food.proteinG, food.carbsG, food.fatG, food.fibreG, food.servingGrams]),
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
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated, measures, portions)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
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
        ]),
      );
    }
    await setMeta(db, 'food_list_version', version);
  });
}

/** Foods a statement writes when the list is replaced: 13 values each, within SQLite's 999. */
const FOOD_ROWS_PER_INSERT = 50;
/** Packaged foods a statement writes: 9 values each, within SQLite's 999. */
const PACKAGED_ROWS_PER_INSERT = 100;

/** A packaged food's brand or name compared for sameness: lowercase, letters and digits, one space between words. */
function sameKey(text: string | null): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * What makes two packaged foods the same product for search (D-56): the brand, the name (without the
 * brand in front) and every value. Open Food Facts keeps one product a barcode, so a food sold in
 * several pack sizes, or added twice, is there several times with the same values.
 */
function sameProduct(food: PackagedFood): string {
  const brand = sameKey(food.brand);
  const name = sameKey(food.name);
  const bare = brand && name.startsWith(`${brand} `) ? name.slice(brand.length + 1) : name;
  return JSON.stringify([brand, bare, food.kcal, food.proteinG, food.carbsG, food.fatG, food.fibreG]);
}

/**
 * The packaged foods with each product once (D-56): the first in their order stays, taking the
 * serving of a copy when it has none. Every barcode stays on the phone, so any pack still scans.
 */
export function onePerProduct(foods: readonly PackagedFood[]): PackagedFood[] {
  const kept = new Map<string, PackagedFood>();
  for (const food of foods) {
    const key = sameProduct(food);
    const first = kept.get(key);
    if (!first) kept.set(key, food);
    else if (first.servingGrams === null && food.servingGrams !== null) kept.set(key, { ...first, servingGrams: food.servingGrams });
  }
  return [...kept.values()];
}

/** How many more matches are read than shown, so products listed several times do not crowd out others (D-56). */
const PACKAGED_READ_FACTOR = 4;

/**
 * Searches the packaged foods, offline (D-48): every word must appear in the name or the brand,
 * ignoring case; names or brands starting with the first word come first. A product listed under
 * several barcodes with the same values shows once (D-56).
 */
export async function searchPackaged(db: SqlDb, query: string, limit = 30): Promise<PackagedFood[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const conditions = words.map(() => `(lower(name) LIKE ? ESCAPE '\\' OR lower(coalesce(brand, '')) LIKE ? ESCAPE '\\')`);
  const rows = await db.getAllAsync<{
    barcode: string;
    name: string;
    brand: string | null;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number | null;
    serving_grams: number | null;
  }>(
    `SELECT * FROM packaged_foods WHERE ${conditions.join(' AND ')}
     ORDER BY (lower(name) LIKE ? OR lower(coalesce(brand, '')) LIKE ?) DESC, name COLLATE NOCASE LIMIT ?`,
    [...words.flatMap((word) => [like(word), like(word)]), startsWith(words[0]!), startsWith(words[0]!), limit * PACKAGED_READ_FACTOR],
  );
  const foods = rows.map((row) => ({
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
    servingGrams: row.serving_grams,
  }));
  return onePerProduct(foods).slice(0, limit);
}

/** The order the food list's sources are searched and listed in: INDB's Indian recipes, IFCT's Indian foods, brand labels, then home-style foods (D-46, D-47, D-49, D-59). */
const SEARCH_ORDER: readonly Food['source'][] = ['indb', 'ifct2017', 'brand_label', 'home'];

/**
 * Searches the cached food list, offline (ADR-0006 rule 1; REQ-LOG-007). Every word must appear in
 * the name or an alias, ignoring case. Each source gives up to `limit` foods, in SEARCH_ORDER, so a
 * long list from one never hides another's; within each, names starting with the first word come
 * first.
 */
export async function searchFoods(db: SqlDb, query: string, limit = 30): Promise<Food[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const conditions = words.map(() => `(lower(name) LIKE ? ESCAPE '\\' OR lower(aliases) LIKE ? ESCAPE '\\')`);
  const rows = [];
  for (const source of SEARCH_ORDER) {
    rows.push(...(await searchSource(db, source, words, conditions, limit)));
  }
  return rows.map((row) => ({
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
  }));
}

/** One source's matches for `searchFoods`. */
function searchSource(db: SqlDb, source: Food['source'], words: string[], conditions: string[], limit: number) {
  return db.getAllAsync<{
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
  }>(
    `SELECT * FROM foods WHERE source = ? AND ${conditions.join(' AND ')}
     ORDER BY lower(name) LIKE ? DESC, name COLLATE NOCASE LIMIT ?`,
    [source, ...words.flatMap((word) => [like(word), like(word)]), startsWith(words[0]!), limit],
  );
}

/**
 * Searches the cached dishes, offline (D-28), with the words of a food search: every word must
 * appear in the name, ignoring case; names starting with the first word come first.
 */
export async function searchDishes(db: SqlDb, query: string, limit = 10): Promise<Dish[]> {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const rows = await db.getAllAsync<{
    code: string;
    name: string;
    portion_unit: Dish['portionUnit'];
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number;
  }>(
    `SELECT * FROM dishes WHERE ${words.map(() => `lower(name) LIKE ? ESCAPE '\\'`).join(' AND ')}
     ORDER BY lower(name) LIKE ? DESC, name COLLATE NOCASE LIMIT ?`,
    [...words.map(like), startsWith(words[0]!), limit],
  );
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    portionUnit: row.portion_unit,
    kcal: row.kcal,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
  }));
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
  };
}

/** Exercises a statement writes when the list is replaced: 10 values each, within SQLite's 999. */
const EXERCISE_ROWS_PER_INSERT = 90;

/** Replaces the cached exercise list (D-50) and records its version, in one transaction. */
export async function replaceExercises(db: SqlDb, version: string, exercises: readonly ListedExercise[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM exercises', []);
    for (let start = 0; start < exercises.length; start += EXERCISE_ROWS_PER_INSERT) {
      const batch = exercises.slice(start, start + EXERCISE_ROWS_PER_INSERT);
      await db.runAsync(
        `INSERT INTO exercises (code, name, exercise_group, log_type, aliases, compendium_code, met, speed_mets, search_text, name_keys)
         VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        batch.flatMap((exercise) => [
          exercise.code,
          exercise.name,
          exercise.group,
          exercise.logType,
          JSON.stringify(exercise.aliases),
          exercise.compendiumCode,
          exercise.met,
          JSON.stringify(exercise.speedMets),
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
 * starting with the first word come first.
 */
export async function searchExercises(db: SqlDb, query: string, limit = 8): Promise<ListedExercise[]> {
  const words = exerciseQueryWords(query);
  if (words.length === 0) return [];
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE ${words.map(() => `search_text LIKE ? ESCAPE '\\'`).join(' AND ')}
     ORDER BY name_keys LIKE ? DESC, name COLLATE NOCASE LIMIT ?`,
    [...words.map(like), ` ${startsWith(words[0]!)}`, limit],
  );
  return rows.map(toListedExercise);
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

function searchWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((word) => word.length > 0)
    .slice(0, 5);
}

const escapeLike = (word: string) => word.replace(/[\\%_]/g, (char) => `\\${char}`);
const like = (word: string) => `%${escapeLike(word)}%`;
const startsWith = (word: string) => `${escapeLike(word)}%`;
