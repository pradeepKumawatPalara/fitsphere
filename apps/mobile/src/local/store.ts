// The phone's copy of the user's data (data-model "On the phone"; ADR-0007 rules 1, 2 and 7).
// The server is the permanent record; pending and rejected entries are never deleted
// automatically (D-14).
import { syncWindowStart, WEIGH_IN_SET, type ChangeErrorCode, type IstDay } from '@fitsphere/shared';
import type { SqlDb } from './sql';

export type SyncState = 'synced' | 'pending' | 'rejected';
export type LocalWeighIn = { day: IstDay; weightGrams: number; recordedAt: string; syncState: SyncState };
export type OutboxEntry = {
  changeId: string;
  type: string;
  data: unknown;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'rejected';
  errorCode: string | null;
};

const SCHEMA_VERSION = 1;

/** Creates the local tables; one signed-in user per database (`sync_meta.user_id`). */
export async function migrateLocal(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;
  await db.execAsync(`
    CREATE TABLE weigh_ins (
      day TEXT PRIMARY KEY,
      weight_grams INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      sync_state TEXT NOT NULL CHECK (sync_state IN ('synced', 'pending', 'rejected'))
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
    CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

export type MetaKey = 'user_id' | 'cursor' | 'last_synced_at';

export async function getMeta(db: SqlDb, key: MetaKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(db: SqlDb, key: MetaKey, value: string | null): Promise<void> {
  if (value === null) await db.runAsync('DELETE FROM sync_meta WHERE key = ?', [key]);
  else await db.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
}

/**
 * Saves a weight for a day on the phone and queues it for the server, in one transaction. A new
 * value replaces the day's value (Q-030); it also replaces a rejected change for that day, which
 * is how the user fixes it (ADR-0007 rule 2).
 */
export async function saveWeighIn(
  db: SqlDb,
  entry: { changeId: string; day: IstDay; weightGrams: number; recordedAt: string },
): Promise<void> {
  const data = JSON.stringify({ day: entry.day, weightGrams: entry.weightGrams, recordedAt: entry.recordedAt });
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO weigh_ins (day, weight_grams, recorded_at, sync_state) VALUES (?, ?, ?, 'pending')
       ON CONFLICT (day) DO UPDATE SET weight_grams = excluded.weight_grams,
         recorded_at = excluded.recorded_at, sync_state = 'pending'`,
      [entry.day, entry.weightGrams, entry.recordedAt],
    );
    await db.runAsync(
      `DELETE FROM outbox WHERE status = 'rejected' AND type = ? AND json_extract(data, '$.day') = ?`,
      [WEIGH_IN_SET, entry.day],
    );
    await db.runAsync(
      `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES (?, ?, ?, ?, 'pending')`,
      [entry.changeId, WEIGH_IN_SET, data, entry.recordedAt],
    );
  });
}

export async function getWeighIn(db: SqlDb, day: IstDay): Promise<LocalWeighIn | null> {
  const row = await db.getFirstAsync<WeighInRow>('SELECT * FROM weigh_ins WHERE day = ?', [day]);
  return row ? toWeighIn(row) : null;
}

/** Newest first. */
export async function listWeighIns(db: SqlDb, fromDay: IstDay, toDay: IstDay): Promise<LocalWeighIn[]> {
  const rows = await db.getAllAsync<WeighInRow>(
    'SELECT * FROM weigh_ins WHERE day BETWEEN ? AND ? ORDER BY day DESC',
    [fromDay, toDay],
  );
  return rows.map(toWeighIn);
}

/**
 * Applies the server's weigh-ins from a sync pull. A day with a change still waiting in the outbox
 * keeps the phone's value until that change is settled.
 */
export async function applyServerWeighIns(
  db: SqlDb,
  weighIns: { day: IstDay; weightGrams: number; recordedAt: string }[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const entry of weighIns) {
      if (await hasOutboxEntry(db, entry.day)) continue;
      await db.runAsync(
        `INSERT INTO weigh_ins (day, weight_grams, recorded_at, sync_state) VALUES (?, ?, ?, 'synced')
         ON CONFLICT (day) DO UPDATE SET weight_grams = excluded.weight_grams,
           recorded_at = excluded.recorded_at, sync_state = 'synced'`,
        [entry.day, entry.weightGrams, entry.recordedAt],
      );
    }
  });
}

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
 * The user discards a rejected change. The day's local value is removed and the sync cursor
 * cleared, so the next sync brings back what the server holds for that day.
 */
export async function discardRejected(db: SqlDb, changeId: string): Promise<void> {
  const day = await dayOf(db, changeId);
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM outbox WHERE change_id = ? AND status = 'rejected'`, [changeId]);
    if (day && !(await hasOutboxEntry(db, day))) {
      await db.runAsync('DELETE FROM weigh_ins WHERE day = ?', [day]);
    }
    await setMeta(db, 'cursor', null);
  });
}

/**
 * Keeps the last 90 IST days on the phone (ADR-0007 rule 1): synced entries older than that are
 * removed; pending and rejected ones never are (D-14).
 */
export async function pruneSynced(db: SqlDb, today: IstDay): Promise<number> {
  const result = await db.runAsync(`DELETE FROM weigh_ins WHERE sync_state = 'synced' AND day < ?`, [
    syncWindowStart(today),
  ]);
  return result.changes;
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

type WeighInRow = { day: string; weight_grams: number; recorded_at: string; sync_state: SyncState };
type OutboxRow = {
  change_id: string;
  type: string;
  data: string;
  created_at: string;
  attempts: number;
  status: 'pending' | 'rejected';
  error_code: string | null;
};

function toWeighIn(row: WeighInRow): LocalWeighIn {
  return { day: row.day, weightGrams: row.weight_grams, recordedAt: row.recorded_at, syncState: row.sync_state };
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

async function dayOf(db: SqlDb, changeId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ day: string | null }>(
    `SELECT json_extract(data, '$.day') AS day FROM outbox WHERE change_id = ?`,
    [changeId],
  );
  return row?.day ?? null;
}

async function hasOutboxEntry(db: SqlDb, day: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT count(*) AS n FROM outbox WHERE json_extract(data, '$.day') = ?`,
    [day],
  );
  return (row?.n ?? 0) > 0;
}

/** Runs `change`, then sets the day's sync state from what is left in the outbox for it. */
async function settle(db: SqlDb, changeId: string, change: () => Promise<void>): Promise<void> {
  const day = await dayOf(db, changeId);
  await db.withTransactionAsync(async () => {
    await change();
    if (!day) return;
    const row = await db.getFirstAsync<{ pending: number; rejected: number }>(
      `SELECT sum(status = 'pending') AS pending, sum(status = 'rejected') AS rejected
       FROM outbox WHERE json_extract(data, '$.day') = ?`,
      [day],
    );
    const state: SyncState = (row?.pending ?? 0) > 0 ? 'pending' : (row?.rejected ?? 0) > 0 ? 'rejected' : 'synced';
    await db.runAsync('UPDATE weigh_ins SET sync_state = ? WHERE day = ?', [state, day]);
  });
}
