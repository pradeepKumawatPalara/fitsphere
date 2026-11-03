import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  getEntry,
  getMeta,
  getWeighIn,
  listSettings,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  saveEntry,
  setMeta,
} from './store';

// Settings on the phone (REQ-ACC-001…003; MVP default, D-31): one value per name, synced like
// targets and never pruned. Saving, accepting, rejecting and discarding are in dailyStore.test.ts,
// which runs them for every kind.

const AT = '2026-10-30T03:00:00.000Z';

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('REQ-ACC-001…003 settings on the phone', () => {
  it('REQ-ACC-002 lists the settings chosen, one per name, the latest value kept', async () => {
    await saveEntry(db, 'setting', { changeId: 'c1', data: { name: 'lifting_weight_unit', value: 'lb', setAt: AT } });
    await saveEntry(db, 'setting', { changeId: 'c2', data: { name: 'theme', value: 'dark', setAt: AT } });
    await saveEntry(db, 'setting', { changeId: 'c3', data: { name: 'lifting_weight_unit', value: 'kg', setAt: AT } });

    expect(await listSettings(db)).toEqual([
      { name: 'lifting_weight_unit', value: 'kg', setAt: AT, syncState: 'pending' },
      { name: 'theme', value: 'dark', setAt: AT, syncState: 'pending' },
    ]);
    expect((await pendingChanges(db, 10)).map((change) => change.changeId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('ADR-0007 the pull never overwrites a setting still waiting, but applies the other names', async () => {
    await saveEntry(db, 'setting', { changeId: 'c1', data: { name: 'body_weight_unit', value: 'lb', setAt: AT } });

    await applyServerEntries(db, 'setting', [
      { name: 'body_weight_unit', value: 'kg', setAt: AT },
      { name: 'theme', value: 'light', setAt: AT },
    ]);

    expect(await getEntry(db, 'setting', 'body_weight_unit')).toMatchObject({ value: 'lb', syncState: 'pending' });
    expect(await getEntry(db, 'setting', 'theme')).toMatchObject({ value: 'light', syncState: 'synced' });
  });

  it('ADR-0007 rule 1 settings are never pruned, however old', async () => {
    await applyServerEntries(db, 'setting', [{ name: 'theme', value: 'dark', setAt: '2025-01-01T00:00:00.000Z' }]);

    await pruneSynced(db, '2026-10-30');

    expect(await getEntry(db, 'setting', 'theme')).toMatchObject({ value: 'dark' });
  });
});

describe('Local schema version 7', () => {
  it('ADR-0007 an update from version 6 keeps the data and the outbox and clears the cursor', async () => {
    const old = memoryDb();
    try {
      // Version 6 as phones have it: build it with the current migrations, then drop what 7 adds.
      await migrateLocal(old);
      await old.execAsync('DROP TABLE profile; DROP TABLE settings; ALTER TABLE foods DROP COLUMN measures; PRAGMA user_version = 6;');
      await old.runAsync(`INSERT INTO weigh_ins VALUES ('2026-10-20', 70000, ?, 'synced')`, [AT]);
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c1', 'weighIn.set', ?, ?, 'pending')`,
        [JSON.stringify({ day: '2026-10-21', weightGrams: 70_100, recordedAt: AT }), AT],
      );
      await setMeta(old, 'cursor', '99');
      await setMeta(old, 'measurement_unit', 'in');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 9 });
      expect(await getWeighIn(old, '2026-10-20')).toMatchObject({ weightGrams: 70_000 });
      expect((await pendingChanges(old, 10)).map((change) => change.changeId)).toEqual(['c1']);
      expect(await getMeta(old, 'cursor')).toBeNull();
      expect(await getMeta(old, 'measurement_unit')).toBe('in');
      expect(await listSettings(old)).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});

describe('Local schema version 9', () => {
  it('REQ-ACC-011 the update from version 8 adds no profile yet, keeps the data and the outbox, and clears the cursor', async () => {
    const old = memoryDb();
    try {
      // Version 8 as phones have it: build it with the current migrations, then drop what 9 adds.
      await migrateLocal(old);
      await old.execAsync('DROP TABLE profile; PRAGMA user_version = 8;');
      await old.runAsync(`INSERT INTO weigh_ins VALUES ('2026-10-20', 70000, ?, 'synced')`, [AT]);
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c1', 'setting.set', ?, ?, 'pending')`,
        [JSON.stringify({ name: 'theme', value: 'dark', setAt: AT }), AT],
      );
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 9 });
      expect(await getEntry(old, 'profile', 'profile')).toBeNull();
      expect(await getWeighIn(old, '2026-10-20')).toMatchObject({ weightGrams: 70_000 });
      expect((await pendingChanges(old, 10)).map((change) => change.changeId)).toEqual(['c1']);
      expect(await getMeta(old, 'cursor')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });

  it('ADR-0007 a profile waiting to sync keeps the phone’s value over the pull', async () => {
    const mine = { name: 'Mine', dateOfBirth: null, sex: null, heightMm: null, phone: null, address: null, photoMediaId: null, setAt: AT };
    await saveEntry(db, 'profile', { changeId: 'c1', data: mine });

    await applyServerEntries(db, 'profile', [{ ...mine, name: 'Theirs' }]);
    expect(await getEntry(db, 'profile', 'profile')).toMatchObject({ name: 'Mine', syncState: 'pending' });
  });
});
