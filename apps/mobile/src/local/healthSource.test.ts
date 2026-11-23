import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  countImported,
  getEntry,
  getMeta,
  markRejected,
  migrateLocal,
  pendingChanges,
  rejectedChanges,
  removeImportedValues,
  saveEntry,
  setMeta,
} from './store';

// D-121, ADR-0013: where a day's steps or weight came from, on the phone.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let db: SqlDb;
beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});
afterEach(async () => {
  await db.closeAsync();
});

describe('D-121 source on the phone', () => {
  it('a value saved with no source is manual; one saved from Health Connect says so', async () => {
    await saveEntry(db, 'steps', { changeId: id(1), data: { day: DAY, steps: 100, recordedAt: AT } });
    await saveEntry(db, 'weighIn', { changeId: id(2), data: { day: DAY, weightGrams: 70_000, recordedAt: AT, source: 'health_connect' } });

    expect(await getEntry(db, 'steps', DAY)).toMatchObject({ source: 'manual' });
    expect(await getEntry(db, 'weighIn', DAY)).toMatchObject({ source: 'health_connect' });
    // The typed value's change names no source; the server reads that as manual.
    const [typed, imported] = await pendingChanges(db, 10);
    expect(typed?.data).toEqual({ day: DAY, steps: 100, recordedAt: AT });
    expect(imported?.data).toMatchObject({ source: 'health_connect' });
  });

  it('a value the user types over an import is theirs from then on', async () => {
    await saveEntry(db, 'steps', { changeId: id(1), data: { day: DAY, steps: 100, recordedAt: AT, source: 'health_connect' } });

    await saveEntry(db, 'steps', { changeId: id(2), data: { day: DAY, steps: 150, recordedAt: AT } });

    expect(await getEntry(db, 'steps', DAY)).toMatchObject({ steps: 150, source: 'manual' });
  });

  it('the pull keeps the source the server sends, and reads none as manual', async () => {
    await applyServerEntries(db, 'steps', [{ day: DAY, steps: 5_000, recordedAt: AT, source: 'health_connect' }]);
    await applyServerEntries(db, 'weighIn', [{ day: DAY, weightGrams: 70_000, recordedAt: AT }]);

    expect(await getEntry(db, 'steps', DAY)).toMatchObject({ source: 'health_connect', syncState: 'synced' });
    expect(await getEntry(db, 'weighIn', DAY)).toMatchObject({ source: 'manual' });
  });

  it('an import refused because a typed value is there goes quietly, and the next sync brings the server value', async () => {
    await saveEntry(db, 'steps', { changeId: id(1), data: { day: DAY, steps: 100, recordedAt: AT, source: 'health_connect' } });
    await setMeta(db, 'cursor', '42');

    await markRejected(db, id(1), 'MANUAL_VALUE_EXISTS');

    expect(await rejectedChanges(db)).toEqual([]);
    expect(await pendingChanges(db, 10)).toEqual([]);
    expect(await getEntry(db, 'steps', DAY)).toBeNull();
    expect(await getMeta(db, 'cursor')).toBeNull();
  });

  it('any other refusal still waits for the user, as before', async () => {
    await saveEntry(db, 'steps', { changeId: id(1), data: { day: DAY, steps: 100, recordedAt: AT } });

    await markRejected(db, id(1), 'VALIDATION_FAILED');

    expect((await rejectedChanges(db)).map((entry) => entry.changeId)).toEqual([id(1)]);
    expect(await getEntry(db, 'steps', DAY)).toMatchObject({ syncState: 'rejected' });
  });
});

describe('D-121 Remove', () => {
  it('deletes the imported values and their waiting changes, queues one removal, and keeps typed values', async () => {
    await saveEntry(db, 'steps', { changeId: id(1), data: { day: DAY, steps: 100, recordedAt: AT, source: 'health_connect' } });
    await saveEntry(db, 'weighIn', { changeId: id(2), data: { day: DAY, weightGrams: 70_000, recordedAt: AT, source: 'health_connect' } });
    await saveEntry(db, 'steps', { changeId: id(3), data: { day: '2026-10-26', steps: 200, recordedAt: AT } });
    expect(await countImported(db)).toEqual({ steps: 1, weights: 1 });

    await removeImportedValues(db, { changeId: id(9), removedAt: AT });

    expect(await countImported(db)).toEqual({ steps: 0, weights: 0 });
    expect(await getEntry(db, 'steps', '2026-10-26')).toMatchObject({ steps: 200, source: 'manual' });
    const waiting = await pendingChanges(db, 10);
    expect(waiting.map((change) => change.type)).toEqual(['steps.set', 'healthImport.remove']);
    expect(waiting[1]).toMatchObject({ changeId: id(9), data: { removedAt: AT } });
  });
});

describe('D-121 local schema version 24', () => {
  it('an update keeps every value it holds as typed (manual)', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      await old.execAsync('DROP TABLE notifications; ALTER TABLE weigh_ins DROP COLUMN source; ALTER TABLE steps DROP COLUMN source; PRAGMA user_version = 23;');
      await old.runAsync(`INSERT INTO steps (day, steps, recorded_at, sync_state) VALUES (?, 5000, ?, 'synced')`, [DAY, AT]);
      await old.runAsync(`INSERT INTO weigh_ins (day, weight_grams, recorded_at, sync_state) VALUES (?, 70000, ?, 'pending')`, [DAY, AT]);

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 25 });
      expect(await getEntry(old, 'steps', DAY)).toMatchObject({ steps: 5_000, source: 'manual', syncState: 'synced' });
      expect(await getEntry(old, 'weighIn', DAY)).toMatchObject({ weightGrams: 70_000, source: 'manual', syncState: 'pending' });
    } finally {
      await old.closeAsync();
    }
  });
});

describe('D-121 a database already at version 24 from another branch', () => {
  it('gets the source columns, keeps its values as typed, and a second start changes nothing', async () => {
    const other = memoryDb();
    try {
      await migrateLocal(other);
      // Version 24 as another branch made it: the steps and weight tables never got `source`.
      await other.execAsync('ALTER TABLE weigh_ins DROP COLUMN source; ALTER TABLE steps DROP COLUMN source;');
      await other.runAsync(`INSERT INTO steps (day, steps, recorded_at, sync_state) VALUES (?, 5000, ?, 'synced')`, [DAY, AT]);
      expect(await other.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 25 });

      await migrateLocal(other);
      await migrateLocal(other);

      expect(await getEntry(other, 'steps', DAY)).toMatchObject({ steps: 5_000, source: 'manual' });
      expect(await countImported(other)).toEqual({ steps: 0, weights: 0 });
    } finally {
      await other.closeAsync();
    }
  });
});
