// The phone's copy of the user's data (data-model "On the phone"; ADR-0007 rules 1, 2 and 7).
// The server is the permanent record; pending and rejected entries are never deleted
// automatically (D-14).
import {
  MEAL_DELETE,
  MEAL_SET,
  mealTotals,
  MEASUREMENTS_SET,
  SAVED_MEAL_DELETE,
  SAVED_MEAL_SET,
  SLEEP_SET,
  STEPS_SET,
  syncWindowStart,
  TARGET_SET,
  WEIGH_IN_SET,
  type ChangeErrorCode,
  type Food,
  type IstDay,
  type MealItem,
  type MealSetData,
  type MealTotals,
  type MeasurementsSetData,
  type SavedMealSetData,
  type SleepSetData,
  type StepsSetData,
  type TargetKind,
  type TargetSetData,
  type WeighInSetData,
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

/** One entry per IST day for the day kinds, one per target kind for targets, and one per ID for
 * meals and saved meals. */
export type EntryKind = 'weighIn' | 'steps' | 'sleep' | 'measurements' | 'target' | 'meal' | 'savedMeal';

/** What a change carries for each kind (api-conventions, "POST /v1/sync"). */
export type ChangeData = {
  weighIn: WeighInSetData;
  steps: StepsSetData;
  sleep: SleepSetData;
  measurements: MeasurementsSetData;
  target: TargetSetData;
  meal: MealSetData;
  savedMeal: SavedMealSetData;
};

/** An entry on the phone: the change's fields, what only the server knows, and its sync state. */
export type LocalEntries = {
  weighIn: WeighInSetData & { syncState: SyncState };
  steps: StepsSetData & { syncState: SyncState };
  sleep: SleepSetData & { syncState: SyncState };
  measurements: MeasurementsSetData & { syncState: SyncState };
  target: { kind: TargetKind; value: number; setAt: string; setByUserId: string | null; syncState: SyncState };
  meal: MealSetData & MealTotals & { syncState: SyncState };
  savedMeal: SavedMealSetData & MealTotals & { syncState: SyncState };
};
export type LocalWeighIn = LocalEntries['weighIn'];
export type LocalSteps = LocalEntries['steps'];
export type LocalSleep = LocalEntries['sleep'];
export type LocalMeasurements = LocalEntries['measurements'];
export type LocalTarget = LocalEntries['target'];
export type LocalMeal = LocalEntries['meal'];
export type LocalSavedMeal = LocalEntries['savedMeal'];

/** The kinds a user can delete; each has its own delete change (meals, saved meals). */
export type DeletableKind = 'meal' | 'savedMeal';

type KindSpec = {
  changeType: string;
  /** The change that deletes an entry, for kinds the user can delete. */
  deleteType?: string;
  table: string;
  /** The field that identifies an entry: its column, and its path in a change's data. */
  key: 'day' | 'kind' | 'id';
  /** Local columns and the field each holds, key first; `json` columns hold arrays as JSON text. */
  columns: [column: string, field: string, json?: 'json'][];
  /** Fields worked out from the others when the row is written (a meal's totals). */
  derive?: (fields: Record<string, unknown>) => Record<string, BindValue>;
  /** Fields only the server's pull carries. */
  pullColumns: [column: string, field: string][];
  /** Day data keeps the last 90 IST days (ADR-0007 rule 1); targets are always kept. */
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
};

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

/** `measurement_unit` is the cm/in choice in the measurements sheet, kept on this phone only (D-23). */
export type MetaKey = 'user_id' | 'cursor' | 'last_synced_at' | 'measurement_unit' | 'food_list_version';

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
 * which is how the user fixes one (ADR-0007 rule 2).
 */
export async function saveEntry<K extends EntryKind>(
  db: SqlDb,
  kind: K,
  entry: { changeId: string; data: ChangeData[K] },
): Promise<void> {
  const spec = KINDS[kind];
  const fields = entry.data as Record<string, unknown>;
  const key = fields[spec.key] as string;
  const createdAt = (fields.recordedAt ?? fields.setAt ?? fields.savedAt) as string;
  await db.withTransactionAsync(async () => {
    await upsert(db, spec, spec.columns, fields, 'pending');
    await db.runAsync(
      `DELETE FROM outbox WHERE status = 'rejected' AND type IN (?, ?) AND json_extract(data, '$.${spec.key}') = ?`,
      [...typesOf(spec), key],
    );
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

/** Day data between two IST days, newest first. */
export async function listEntries<K extends Exclude<EntryKind, 'target' | 'savedMeal'>>(
  db: SqlDb,
  kind: K,
  fromDay: IstDay,
  toDay: IstDay,
): Promise<LocalEntries[K][]> {
  const spec = KINDS[kind];
  const rows = await db.getAllAsync<Record<string, BindValue>>(
    `SELECT * FROM ${spec.table} WHERE day BETWEEN ? AND ? ORDER BY day DESC`,
    [fromDay, toDay],
  );
  return rows.map((row) => toEntry(spec, row) as LocalEntries[K]);
}

/** The user's current targets (REQ-ROLE-007). */
export async function listTargets(db: SqlDb): Promise<LocalTarget[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>(`SELECT * FROM targets ORDER BY kind`, []);
  return rows.map((row) => toEntry(KINDS.target, row) as LocalTarget);
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
      const key = fields[spec.key] as string;
      if (await hasOutboxEntry(db, spec, key)) continue;
      // A meal or saved meal deleted on another phone leaves this one too.
      if (fields.deleted === true) await db.runAsync(`DELETE FROM ${spec.table} WHERE ${spec.key} = ?`, [key]);
      else await upsert(db, spec, columns, fields, 'synced');
    }
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
    await setMeta(db, 'cursor', null);
  });
}

/**
 * Keeps the last 90 IST days of day data on the phone (ADR-0007 rule 1): synced entries older
 * than that are removed; pending and rejected ones never are (D-14). Targets are always kept.
 */
export async function pruneSynced(db: SqlDb, today: IstDay): Promise<number> {
  let removed = 0;
  for (const kind of DAY_KINDS) {
    const result = await db.runAsync(`DELETE FROM ${KINDS[kind].table} WHERE sync_state = 'synced' AND day < ?`, [
      syncWindowStart(today),
    ]);
    removed += result.changes;
  }
  return removed;
}

/** Entries not yet on the server: pending or rejected. */
export async function unsyncedCount(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM outbox', []);
  return row?.n ?? 0;
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
      ...columns.map(([, field, json]) => (json ? JSON.stringify(fields[field]) : ((fields[field] as BindValue) ?? null))),
      state,
    ],
  );
}

function toEntry(spec: KindSpec, row: Record<string, BindValue>): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const [column, field, json] of [...spec.columns, ...spec.pullColumns]) {
    entry[field] = json ? (JSON.parse(String(row[column])) as unknown) : row[column];
  }
  entry.syncState = row.sync_state;
  return entry;
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
  const key = (JSON.parse(row.data) as Record<string, unknown>)[spec.key];
  return typeof key === 'string' ? { spec, key } : null;
}

async function hasOutboxEntry(db: SqlDb, spec: KindSpec, key: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM outbox WHERE type IN (?, ?) AND json_extract(data, '$.${spec.key}') = ?`,
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
       FROM outbox WHERE type IN (?, ?) AND json_extract(data, '$.${spec.key}') = ?`,
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

/** Saved meals, by name (REQ-SAVED-001). */
export async function listSavedMeals(db: SqlDb): Promise<LocalSavedMeal[]> {
  const rows = await db.getAllAsync<Record<string, BindValue>>('SELECT * FROM saved_meals ORDER BY name COLLATE NOCASE', []);
  return rows.map((row) => toEntry(KINDS.savedMeal, row) as LocalSavedMeal);
}

/** Replaces the cached food list (ADR-0006 rule 1) and records its version, in one transaction. */
export async function replaceFoods(db: SqlDb, version: string, foods: Food[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM foods', []);
    for (const food of foods) {
      await db.runAsync(
        `INSERT INTO foods (source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_estimated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ],
      );
    }
    await setMeta(db, 'food_list_version', version);
  });
}

/**
 * Searches the cached food list, offline (ADR-0006 rule 1; REQ-LOG-007). Every word must appear in
 * the name or an alias, ignoring case; names starting with the first word come first.
 */
export async function searchFoods(db: SqlDb, query: string, limit = 30): Promise<Food[]> {
  const words = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((word) => word.length > 0)
    .slice(0, 5);
  if (words.length === 0) return [];
  const like = (word: string) => `%${word.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const conditions = words.map(() => `(lower(name) LIKE ? ESCAPE '\\' OR lower(aliases) LIKE ? ESCAPE '\\')`);
  const rows = await db.getAllAsync<{
    source: Food['source'];
    code: string;
    name: string;
    food_group: string;
    aliases: string;
    protein_g: number;
    fibre_g: number;
    fat_g: number;
    carbs_g: number;
    kcal: number;
    kcal_estimated: number;
  }>(
    `SELECT * FROM foods WHERE ${conditions.join(' AND ')}
     ORDER BY lower(name) LIKE ? DESC, name COLLATE NOCASE LIMIT ?`,
    [...words.flatMap((word) => [like(word), like(word)]), `${words[0]!.replace(/[\\%_]/g, (char) => `\\${char}`)}%`, limit],
  );
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
  }));
}
