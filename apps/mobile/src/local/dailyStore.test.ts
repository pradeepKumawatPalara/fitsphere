import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  discardRejected,
  getEntry,
  getMeta,
  getWeighIn,
  listEntries,
  listTargets,
  markAccepted,
  markRejected,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  rejectedChanges,
  saveEntry,
  saveWeighIn,
  setMeta,
  type ChangeData,
  type EntryKind,
} from './store';

// Steps, sleep, measurements and targets on the phone (Home and daily tracking slice, step 3;
// ADR-0007 rules 1, 2 and 7; REQ-NFR-004). The weight cases are in store.test.ts.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };

let db: SqlDb;
let next = 0;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

function changeId(): string {
  next += 1;
  return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
}

async function save<K extends EntryKind>(kind: K, data: ChangeData[K]) {
  const id = changeId();
  await saveEntry(db, kind, { changeId: id, data });
  return id;
}

const SAMPLES: { [K in EntryKind]: { key: string; data: ChangeData[K]; stored: Record<string, unknown> } } = {
  weighIn: { key: DAY, data: { day: DAY, weightGrams: 70_000, recordedAt: AT }, stored: { weightGrams: 70_000 } },
  steps: { key: DAY, data: { day: DAY, steps: 8_432, recordedAt: AT }, stored: { steps: 8_432 } },
  sleep: { key: DAY, data: { day: DAY, sleepMinutes: 450, recordedAt: AT }, stored: { sleepMinutes: 450 } },
  measurements: {
    key: DAY,
    data: { day: DAY, upperWaistMm: 812, lowerWaistMm: 845, ...NO_OPTIONAL, notes: 'Synthetic note', recordedAt: AT },
    stored: { upperWaistMm: 812, chestMm: null, notes: 'Synthetic note' },
  },
  target: { key: 'calories', data: { kind: 'calories', value: 2_000, setAt: AT }, stored: { value: 2_000, setByUserId: null } },
};
const KINDS = Object.keys(SAMPLES) as EntryKind[];

describe('ADR-0007 the outbox for every kind', () => {
  it.each(KINDS)('ADR-0007 %s: saving writes the entry as pending and queues its change', async (kind) => {
    const sample = SAMPLES[kind];

    const id = await save(kind, sample.data);

    expect(await getEntry(db, kind, sample.key)).toMatchObject({ ...sample.stored, syncState: 'pending' });
    expect(await pendingChanges(db, 10)).toEqual([expect.objectContaining({ changeId: id, data: sample.data })]);
  });

  it.each(KINDS)('ADR-0007 %s: accepted becomes synced; rejected stays until discarded', async (kind) => {
    const sample = SAMPLES[kind];
    const accepted = await save(kind, sample.data);
    await markAccepted(db, accepted);
    expect(await getEntry(db, kind, sample.key)).toMatchObject({ syncState: 'synced' });

    const rejected = await save(kind, sample.data);
    await markRejected(db, rejected, 'VALIDATION_FAILED');
    expect(await getEntry(db, kind, sample.key)).toMatchObject({ syncState: 'rejected' });
    expect((await rejectedChanges(db)).map((entry) => entry.changeId)).toEqual([rejected]);

    await setMeta(db, 'cursor', '42');
    await discardRejected(db, rejected);
    // The phone forgets its copy and asks the server for everything again.
    expect(await getEntry(db, kind, sample.key)).toBeNull();
    expect(await rejectedChanges(db)).toEqual([]);
    expect(await getMeta(db, 'cursor')).toBeNull();
  });

  it('Q-030 a new measurements entry replaces the whole old one, clearing fields left empty', async () => {
    await save('measurements', { ...SAMPLES.measurements.data, chestMm: 990 });

    await save('measurements', { ...SAMPLES.measurements.data, upperWaistMm: 800, notes: null });

    expect(await getEntry(db, 'measurements', DAY)).toMatchObject({ upperWaistMm: 800, chestMm: null, notes: null });
  });

  it('REQ-ROLE-007 targets are kept per kind and listed together', async () => {
    await save('target', { kind: 'calories', value: 2_000, setAt: AT });
    await save('target', { kind: 'weekly_workouts', value: 4, setAt: AT });
    await save('target', { kind: 'calories', value: 1_800, setAt: AT });

    expect((await listTargets(db)).map(({ kind, value }) => [kind, value])).toEqual([
      ['calories', 1_800],
      ['weekly_workouts', 4],
    ]);
  });
});

describe('ADR-0007 the pull for every kind', () => {
  it('ADR-0007 applies the server’s entries as synced, with who set a target', async () => {
    await applyServerEntries(db, 'steps', [{ day: DAY, steps: 5_000, recordedAt: AT }]);
    await applyServerEntries(db, 'target', [
      { kind: 'protein', value: 120, setAt: AT, setByUserId: '11111111-1111-4111-8111-111111111111' },
    ]);

    expect(await getEntry(db, 'steps', DAY)).toEqual({ day: DAY, steps: 5_000, recordedAt: AT, syncState: 'synced' });
    expect(await getEntry(db, 'target', 'protein')).toEqual({
      kind: 'protein',
      value: 120,
      setAt: AT,
      setByUserId: '11111111-1111-4111-8111-111111111111',
      syncState: 'synced',
    });
  });

  it('ADR-0007 never overwrites a change of the same kind and key still waiting, but does update other kinds for that day', async () => {
    await save('steps', { day: DAY, steps: 9_000, recordedAt: AT });
    await saveWeighIn(db, { changeId: changeId(), day: DAY, weightGrams: 70_000, recordedAt: AT });

    await applyServerEntries(db, 'steps', [{ day: DAY, steps: 1, recordedAt: AT }]);
    await applyServerEntries(db, 'sleep', [{ day: DAY, sleepMinutes: 420, recordedAt: AT }]);

    expect(await getEntry(db, 'steps', DAY)).toMatchObject({ steps: 9_000, syncState: 'pending' });
    expect(await getEntry(db, 'sleep', DAY)).toMatchObject({ sleepMinutes: 420, syncState: 'synced' });
    expect(await getWeighIn(db, DAY)).toMatchObject({ weightGrams: 70_000, syncState: 'pending' });
  });

  it('ADR-0007 a waiting target of one kind does not hold back another kind', async () => {
    await save('target', { kind: 'calories', value: 2_000, setAt: AT });

    await applyServerEntries(db, 'target', [
      { kind: 'calories', value: 1, setAt: AT, setByUserId: null },
      { kind: 'steps', value: 10_000, setAt: AT, setByUserId: null },
    ]);

    expect(await getEntry(db, 'target', 'calories')).toMatchObject({ value: 2_000, syncState: 'pending' });
    expect(await getEntry(db, 'target', 'steps')).toMatchObject({ value: 10_000, syncState: 'synced' });
  });
});

describe('ADR-0007 rule 1 pruning across kinds', () => {
  it('ADR-0007 rule 1 removes synced day data older than 90 IST days, keeps targets, and never removes pending entries', async () => {
    const old = '2026-07-01';
    await applyServerEntries(db, 'steps', [{ day: old, steps: 1, recordedAt: AT }]);
    await applyServerEntries(db, 'sleep', [{ day: old, sleepMinutes: 1, recordedAt: AT }]);
    await applyServerEntries(db, 'measurements', [{ ...SAMPLES.measurements.data, day: old }]);
    await applyServerEntries(db, 'target', [{ kind: 'steps', value: 10_000, setAt: '2026-01-01T00:00:00.000Z', setByUserId: null }]);
    await save('sleep', { day: '2026-07-02', sleepMinutes: 2, recordedAt: AT });

    expect(await pruneSynced(db, '2026-10-28')).toBe(3);

    expect(await getEntry(db, 'steps', old)).toBeNull();
    expect(await getEntry(db, 'measurements', old)).toBeNull();
    expect(await getEntry(db, 'sleep', '2026-07-02')).toMatchObject({ syncState: 'pending' });
    expect(await getEntry(db, 'target', 'steps')).toMatchObject({ value: 10_000 });
  });

  it('REQ-HOME-008 lists a week of measurements', async () => {
    await applyServerEntries(db, 'measurements', [
      { ...SAMPLES.measurements.data, day: '2026-10-25' },
      { ...SAMPLES.measurements.data, day: '2026-10-27' },
    ]);

    const week = await listEntries(db, 'measurements', '2026-10-26', '2026-11-01');

    expect(week.map((entry) => entry.day)).toEqual(['2026-10-27']);
  });
});

describe('Local schema version 2', () => {
  // The schema the Skeleton shipped as version 1, as it is on phones already.
  const VERSION_1 = `
    CREATE TABLE weigh_ins (day TEXT PRIMARY KEY, weight_grams INTEGER NOT NULL, recorded_at TEXT NOT NULL,
      sync_state TEXT NOT NULL CHECK (sync_state IN ('synced', 'pending', 'rejected')));
    CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, change_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
      data TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('pending', 'rejected')), error_code TEXT);
    CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = 1;`;

  it('ADR-0007 an update keeps the weigh-ins and the outbox and clears the cursor for a full pull', async () => {
    const old = memoryDb();
    try {
      await old.execAsync(VERSION_1);
      await old.runAsync(`INSERT INTO weigh_ins VALUES ('2026-10-20', 70000, ?, 'synced')`, [AT]);
      await old.runAsync(`INSERT INTO weigh_ins VALUES ('2026-10-21', 70100, ?, 'pending')`, [AT]);
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c1', 'weighIn.set', ?, ?, 'pending')`,
        [JSON.stringify({ day: '2026-10-21', weightGrams: 70_100, recordedAt: AT }), AT],
      );
      await setMeta(old, 'cursor', '99');
      await setMeta(old, 'user_id', 'someone');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 2 });
      expect(await getWeighIn(old, '2026-10-20')).toMatchObject({ weightGrams: 70_000, syncState: 'synced' });
      expect((await pendingChanges(old, 10)).map((entry) => entry.changeId)).toEqual(['c1']);
      expect(await getMeta(old, 'cursor')).toBeNull();
      expect(await getMeta(old, 'user_id')).toBe('someone');
      expect(await listTargets(old)).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });

  it('ADR-0007 running it again changes nothing', async () => {
    await setMeta(db, 'cursor', '7');

    await migrateLocal(db);

    expect(await getMeta(db, 'cursor')).toBe('7');
  });
});
