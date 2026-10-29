// The phone's copy of the user's data (data-model "On the phone"; ADR-0007 rules 1, 2 and 7).
// The server is the permanent record; pending and rejected entries are never deleted
// automatically (D-14).
import {
  MEASUREMENTS_SET,
  SLEEP_SET,
  STEPS_SET,
  syncWindowStart,
  TARGET_SET,
  WEIGH_IN_SET,
  type ChangeErrorCode,
  type IstDay,
  type MeasurementsSetData,
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

/** One entry per IST day for the day kinds, and one per target kind for targets. */
export type EntryKind = 'weighIn' | 'steps' | 'sleep' | 'measurements' | 'target';

/** What a change carries for each kind (api-conventions, "POST /v1/sync"). */
export type ChangeData = {
  weighIn: WeighInSetData;
  steps: StepsSetData;
  sleep: SleepSetData;
  measurements: MeasurementsSetData;
  target: TargetSetData;
};

/** An entry on the phone: the change's fields, what only the server knows, and its sync state. */
export type LocalEntries = {
  weighIn: WeighInSetData & { syncState: SyncState };
  steps: StepsSetData & { syncState: SyncState };
  sleep: SleepSetData & { syncState: SyncState };
  measurements: MeasurementsSetData & { syncState: SyncState };
  target: { kind: TargetKind; value: number; setAt: string; setByUserId: string | null; syncState: SyncState };
};
export type LocalWeighIn = LocalEntries['weighIn'];
export type LocalSteps = LocalEntries['steps'];
export type LocalSleep = LocalEntries['sleep'];
export type LocalMeasurements = LocalEntries['measurements'];
export type LocalTarget = LocalEntries['target'];

type KindSpec = {
  changeType: string;
  table: string;
  /** The field that identifies an entry: its column, and its path in a change's data. */
  key: 'day' | 'kind';
  /** Local columns and the change field each holds, key first. */
  columns: [column: string, field: string][];
  /** Fields only the server's pull carries. */
  pullColumns: [column: string, field: string][];
  /** Day data keeps the last 90 IST days (ADR-0007 rule 1); targets are always kept. */
  dayData: boolean;
};

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
};

const DAY_KINDS = (Object.keys(KINDS) as EntryKind[]).filter((kind) => KINDS[kind].dayData);

function specOfType(type: string): KindSpec | null {
  return Object.values(KINDS).find((spec) => spec.changeType === type) ?? null;
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
export type MetaKey = 'user_id' | 'cursor' | 'last_synced_at' | 'measurement_unit';

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
  const fields = entry.data as Record<string, BindValue>;
  const key = fields[spec.key] as string;
  const createdAt = (fields.recordedAt ?? fields.setAt) as string;
  await db.withTransactionAsync(async () => {
    await upsert(db, spec, spec.columns, fields, 'pending');
    await db.runAsync(
      `DELETE FROM outbox WHERE status = 'rejected' AND type = ? AND json_extract(data, '$.${spec.key}') = ?`,
      [spec.changeType, key],
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

/** Day data between two IST days, newest first. */
export async function listEntries<K extends Exclude<EntryKind, 'target'>>(
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
  entries: Partial<LocalEntries[K]>[],
): Promise<void> {
  const spec = KINDS[kind];
  const columns = [...spec.columns, ...spec.pullColumns];
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      const fields = entry as Record<string, BindValue>;
      if (await hasOutboxEntry(db, spec, fields[spec.key] as string)) continue;
      await upsert(db, spec, columns, fields, 'synced');
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
  columns: [string, string][],
  fields: Record<string, BindValue>,
  state: SyncState,
): Promise<void> {
  const names = columns.map(([column]) => column);
  const updates = names.filter((name) => name !== spec.key).map((name) => `${name} = excluded.${name}`);
  await db.runAsync(
    `INSERT INTO ${spec.table} (${names.join(', ')}, sync_state) VALUES (${names.map(() => '?').join(', ')}, ?)
     ON CONFLICT (${spec.key}) DO UPDATE SET ${[...updates, 'sync_state = excluded.sync_state'].join(', ')}`,
    [...columns.map(([, field]) => fields[field] ?? null), state],
  );
}

function toEntry(spec: KindSpec, row: Record<string, BindValue>): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const [column, field] of [...spec.columns, ...spec.pullColumns]) entry[field] = row[column];
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
    `SELECT count(*) AS n FROM outbox WHERE type = ? AND json_extract(data, '$.${spec.key}') = ?`,
    [spec.changeType, key],
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
       FROM outbox WHERE type = ? AND json_extract(data, '$.${spec.key}') = ?`,
      [spec.changeType, key],
    );
    const state: SyncState = (row?.pending ?? 0) > 0 ? 'pending' : (row?.rejected ?? 0) > 0 ? 'rejected' : 'synced';
    await db.runAsync(`UPDATE ${spec.table} SET sync_state = ? WHERE ${spec.key} = ?`, [state, key]);
  });
}
