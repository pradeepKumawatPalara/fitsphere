import type { MealItem } from '@fitsphere/shared';
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
  targetsOn,
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
import { sameSets } from '../testing/exercises';

// Steps, sleep, measurements, targets, settings, meals and saved meals on the phone (Home and daily
// tracking slice, step 3; Meal logging slice, step 3; Settings slice, step 3; ADR-0007 rules 1, 2
// and 7; REQ-NFR-004). The weight
// cases are in store.test.ts; meal deletion, totals and the food list are in meals.test.ts.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const NO_OPTIONAL = { chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null };
const MEAL_ID = '6a1f3c2e-0b7d-4c5e-9f8a-1b2c3d4e5f60';
const ATTA: MealItem = {
  source: 'ifct2017',
  ref: 'A019',
  name: 'Wheat flour, atta',
  amount: { unit: 'g', value: 60 },
  kcal: 192,
  proteinG: 6.34,
  carbsG: 38.5,
  fatG: 0.92,
  fibreG: 6.82,
  estimated: false,
};

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
  workout: {
    key: '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b',
    data: {
      id: '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b',
      day: DAY,
      exercises: [sameSets('Squat', 3, 10, 40_000)],
      recordedAt: AT,
      timer: null,
    },
    stored: { day: DAY, exercises: [sameSets('Squat', 3, 10, 40_000)], timer: null },
  },
  // A target is kept per kind and the IST day it starts (D-77).
  target: { key: `calories|${DAY}`, data: { kind: 'calories', value: 2_000, day: DAY, setAt: AT }, stored: { day: DAY, value: 2_000, setByUserId: null } },
  setting: { key: 'body_weight_unit', data: { name: 'body_weight_unit', value: 'lb', setAt: AT }, stored: { value: 'lb' } },
  meal: {
    key: MEAL_ID,
    data: { id: MEAL_ID, day: DAY, mealType: 'lunch', tags: ['dessert'], items: [ATTA], recordedAt: AT },
    stored: { mealType: 'lunch', tags: ['dessert'], items: [ATTA], kcal: 192, proteinG: 6.34, fibreG: 6.82 },
  },
  savedMeal: {
    key: MEAL_ID,
    data: { id: MEAL_ID, name: 'Two rotis', tags: [], items: [ATTA], savedAt: AT },
    stored: { name: 'Two rotis', items: [ATTA], kcal: 192 },
  },
  myFood: {
    key: MEAL_ID,
    data: { id: MEAL_ID, name: 'Peanut butter bread', unit: 'slice', kcal: 180, proteinG: 6, carbsG: 20, fatG: 9, fibreG: null, savedAt: AT },
    stored: { name: 'Peanut butter bread', unit: 'slice', kcal: 180, fibreG: null },
  },
  profile: {
    key: 'profile',
    data: {
      name: 'Synthetic Person',
      dateOfBirth: '1994-06-14',
      sex: 'female',
      heightMm: 1620,
      phone: '+919876543210',
      address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
      photoMediaId: null,
      setAt: AT,
    },
    stored: { name: 'Synthetic Person', heightMm: 1620, address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001' }, photoMediaId: null },
  },
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

  it('D-77 a target is kept per kind and start day: the same day replaces its value, another day is kept beside it', async () => {
    const next = '2026-10-28';
    await save('target', { kind: 'calories', value: 2_000, day: DAY, setAt: AT });
    await save('target', { kind: 'weekly_workouts', value: 4, day: DAY, setAt: AT });
    await save('target', { kind: 'calories', value: 1_800, day: DAY, setAt: AT });
    await save('target', { kind: 'calories', value: 2_200, day: next, setAt: `${next}T03:00:00.000Z` });

    expect((await listTargets(db)).map(({ kind, day, value }) => [kind, day, value])).toEqual([
      ['calories', DAY, 1_800],
      ['weekly_workouts', DAY, 4],
      ['calories', next, 2_200],
    ]);
  });

  it('D-77 the targets on a day: of each kind, the latest value starting on or before it; none before the first', async () => {
    await save('target', { kind: 'calories', value: 1_800, day: '2026-10-20', setAt: AT });
    await save('target', { kind: 'calories', value: 2_000, day: '2026-10-25', setAt: AT });
    await save('target', { kind: 'protein', value: 110, day: '2026-10-25', setAt: AT });

    const on = async (day: string) => (await targetsOn(db, day)).map(({ kind, value }) => [kind, value]);
    expect(await on('2026-10-19')).toEqual([]);
    expect(await on('2026-10-20')).toEqual([['calories', 1_800]]);
    expect(await on('2026-10-24')).toEqual([['calories', 1_800]]);
    expect(await on('2026-10-25')).toEqual([
      ['calories', 2_000],
      ['protein', 110],
    ]);
    expect(await on('2026-11-30')).toEqual([
      ['calories', 2_000],
      ['protein', 110],
    ]);
  });
});

describe('ADR-0007 the pull for every kind', () => {
  it('ADR-0007 applies the server’s entries as synced, with who set a target', async () => {
    await applyServerEntries(db, 'steps', [{ day: DAY, steps: 5_000, recordedAt: AT }]);
    await applyServerEntries(db, 'target', [
      { kind: 'protein', day: DAY, value: 120, setAt: AT, setByUserId: '11111111-1111-4111-8111-111111111111' },
    ]);

    expect(await getEntry(db, 'steps', DAY)).toEqual({ day: DAY, steps: 5_000, recordedAt: AT, syncState: 'synced' });
    expect(await getEntry(db, 'target', `protein|${DAY}`)).toEqual({
      kind: 'protein',
      day: DAY,
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

  it('ADR-0007 a waiting target of one kind and day does not hold back another kind, nor another day (D-77)', async () => {
    await save('target', { kind: 'calories', value: 2_000, day: DAY, setAt: AT });

    await applyServerEntries(db, 'target', [
      { kind: 'calories', day: DAY, value: 1, setAt: AT, setByUserId: null },
      { kind: 'calories', day: '2026-10-20', value: 1_800, setAt: AT, setByUserId: null },
      { kind: 'steps', day: DAY, value: 10_000, setAt: AT, setByUserId: null },
    ]);

    expect(await getEntry(db, 'target', `calories|${DAY}`)).toMatchObject({ value: 2_000, syncState: 'pending' });
    expect(await getEntry(db, 'target', 'calories|2026-10-20')).toMatchObject({ value: 1_800, syncState: 'synced' });
    expect(await getEntry(db, 'target', `steps|${DAY}`)).toMatchObject({ value: 10_000, syncState: 'synced' });
  });
});

describe('ADR-0007 rule 1 pruning across kinds', () => {
  it('ADR-0007 rule 1 removes synced day data older than 90 IST days, keeps targets, and never removes pending entries', async () => {
    const old = '2026-07-01';
    await applyServerEntries(db, 'steps', [{ day: old, steps: 1, recordedAt: AT }]);
    await applyServerEntries(db, 'sleep', [{ day: old, sleepMinutes: 1, recordedAt: AT }]);
    await applyServerEntries(db, 'measurements', [{ ...SAMPLES.measurements.data, day: old }]);
    await applyServerEntries(db, 'target', [
      { kind: 'steps', day: '2026-01-01', value: 10_000, setAt: '2026-01-01T00:00:00.000Z', setByUserId: null },
    ]);
    await save('sleep', { day: '2026-07-02', sleepMinutes: 2, recordedAt: AT });

    expect(await pruneSynced(db, '2026-10-28')).toBe(3);

    expect(await getEntry(db, 'steps', old)).toBeNull();
    expect(await getEntry(db, 'measurements', old)).toBeNull();
    expect(await getEntry(db, 'sleep', '2026-07-02')).toMatchObject({ syncState: 'pending' });
    expect(await getEntry(db, 'target', 'steps|2026-01-01')).toMatchObject({ value: 10_000 });
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

describe('Local schema version 19 (D-77)', () => {
  it('D-77 an update keeps a target waiting to sync, from the IST day it was set, adds that day to its change, and fetches the synced ones again', async () => {
    const old = memoryDb();
    try {
      await migrateLocal(old);
      // Version 18's targets: one value per kind.
      await old.execAsync(`DROP TABLE targets;
        CREATE TABLE targets (kind TEXT PRIMARY KEY, value INTEGER NOT NULL, set_at TEXT NOT NULL, set_by_user_id TEXT,
          sync_state TEXT NOT NULL CHECK (sync_state IN ('synced', 'pending', 'rejected')));
        ALTER TABLE exercises DROP COLUMN details;
        PRAGMA user_version = 18;`);
      // Set at 20:00 UTC on 10 Nov: 01:30 on 11 Nov in India.
      const setAt = '2026-11-10T20:00:00.000Z';
      await old.runAsync(`INSERT INTO targets VALUES ('calories', 2200, ?, NULL, 'pending')`, [setAt]);
      await old.runAsync(`INSERT INTO targets VALUES ('protein', 120, ?, 'user-1', 'synced')`, [AT]);
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c1', 'target.set', ?, ?, 'pending')`,
        [JSON.stringify({ kind: 'calories', value: 2_200, setAt }), setAt],
      );
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c2', 'steps.set', ?, ?, 'pending')`,
        [JSON.stringify({ day: DAY, steps: 10, recordedAt: AT }), AT],
      );
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 20 });
      expect(await listTargets(old)).toEqual([
        { kind: 'calories', day: '2026-11-11', value: 2_200, setAt, setByUserId: null, syncState: 'pending' },
      ]);
      expect((await pendingChanges(old, 10)).map((entry) => entry.data)).toEqual([
        { kind: 'calories', value: 2_200, setAt, day: '2026-11-11' },
        { day: DAY, steps: 10, recordedAt: AT },
      ]);
      expect(await getMeta(old, 'cursor')).toBeNull();
    } finally {
      await old.closeAsync();
    }
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

      // Up to the latest version, which `db` was migrated to.
      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual(await db.getFirstAsync('PRAGMA user_version', []));
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
