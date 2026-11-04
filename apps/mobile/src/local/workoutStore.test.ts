import type { WorkoutSetData } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  deleteEntry,
  discardRejected,
  getEntry,
  getMeta,
  getWeighIn,
  listEntries,
  markAccepted,
  markRejected,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  rejectedChanges,
  saveEntry,
  setMeta,
} from './store';

// Workouts on the phone (Training slice, step 2; ADR-0007 rules 1, 2 and 7; REQ-NFR-004). The
// outbox life cycle shared with the other kinds is in dailyStore.test.ts.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const LATER = `${DAY}T04:00:00.000Z`;
const SQUAT = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };
const PUSH_UP = { name: 'Push-up', sets: 2, reps: 20, weightGrams: null, note: 'Slow on the way down' };
const ID_A = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
const ID_B = '7c2a9e40-1d3b-4f5a-9e6d-2b1c0a9f8e7d';

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

function workout(id: string, fields: Partial<WorkoutSetData> = {}): WorkoutSetData {
  return { id, day: DAY, exercises: [SQUAT], recordedAt: AT, ...fields };
}

async function save(data: WorkoutSetData) {
  const id = changeId();
  await saveEntry(db, 'workout', { changeId: id, data });
  return id;
}

async function remove(key: string) {
  const id = changeId();
  await deleteEntry(db, 'workout', { changeId: id, data: { id: key, deletedAt: LATER } });
  return id;
}

describe('REQ-TRN-003 workouts on the phone', () => {
  it('Q-025 an empty workout is kept, and a day holds several, newest first', async () => {
    await save(workout(ID_A, { exercises: [] }));
    await save(workout(ID_B, { recordedAt: LATER }));

    const day = await listEntries(db, 'workout', DAY, DAY);

    expect(day.map((entry) => [entry.id, entry.exercises.length])).toEqual([
      [ID_B, 1],
      [ID_A, 0],
    ]);
  });

  it('ADR-0007 rule 2 saving the workout again replaces its exercises, with every change queued in order', async () => {
    const first = await save(workout(ID_A));

    const second = await save(workout(ID_A, { exercises: [SQUAT, PUSH_UP] }));

    expect(await getEntry(db, 'workout', ID_A)).toMatchObject({ exercises: [SQUAT, PUSH_UP], recordedAt: AT, syncState: 'pending' });
    expect((await pendingChanges(db, 10)).map((change) => change.changeId)).toEqual([first, second]);
  });
});

describe('REQ-TRN-003 deleting a workout', () => {
  it('ADR-0007 deleting removes the workout from the phone and queues the deletion after its save', async () => {
    const saved = await save(workout(ID_A));

    const deleted = await remove(ID_A);

    expect(await getEntry(db, 'workout', ID_A)).toBeNull();
    expect(await pendingChanges(db, 10)).toEqual([
      expect.objectContaining({ changeId: saved, type: 'workout.set' }),
      expect.objectContaining({ changeId: deleted, type: 'workout.delete', data: { id: ID_A, deletedAt: LATER } }),
    ]);
  });

  it('ADR-0007 rule 2 deleting replaces a rejected change for that workout', async () => {
    const rejected = await save(workout(ID_A));
    await markRejected(db, rejected, 'DAY_IN_FUTURE');

    await remove(ID_A);

    expect(await rejectedChanges(db)).toEqual([]);
    expect((await pendingChanges(db, 10)).map((change) => change.type)).toEqual(['workout.delete']);
  });

  it('ADR-0007 an accepted deletion leaves nothing behind', async () => {
    await applyServerEntries(db, 'workout', [workout(ID_A)]);
    const deleted = await remove(ID_A);

    await markAccepted(db, deleted);

    expect(await getEntry(db, 'workout', ID_A)).toBeNull();
    expect(await pendingChanges(db, 10)).toEqual([]);
  });

  it('ADR-0007 rule 2 discarding a rejected deletion clears the cursor, so the server’s copy comes back', async () => {
    await applyServerEntries(db, 'workout', [workout(ID_A)]);
    const deleted = await remove(ID_A);
    await markRejected(db, deleted, 'VALIDATION_FAILED');
    await setMeta(db, 'cursor', '42');

    await discardRejected(db, deleted);

    expect(await rejectedChanges(db)).toEqual([]);
    expect(await getMeta(db, 'cursor')).toBeNull();
    await applyServerEntries(db, 'workout', [workout(ID_A)]);
    expect(await getEntry(db, 'workout', ID_A)).toMatchObject({ syncState: 'synced' });
  });
});

describe('ADR-0007 workouts in the pull', () => {
  it('ADR-0007 applies the server’s workouts as synced, and removes one the server marks deleted', async () => {
    await applyServerEntries(db, 'workout', [
      { deleted: false, ...workout(ID_A, { exercises: [PUSH_UP] }) },
      { deleted: false, ...workout(ID_B) },
    ]);

    await applyServerEntries(db, 'workout', [{ deleted: true, id: ID_B, day: DAY }]);

    expect(await getEntry(db, 'workout', ID_A)).toEqual({ ...workout(ID_A, { exercises: [PUSH_UP] }), syncState: 'synced' });
    expect(await getEntry(db, 'workout', ID_B)).toBeNull();
  });

  it('ADR-0007 never overwrites or removes a workout whose change is still waiting, but applies the others', async () => {
    await save(workout(ID_A, { exercises: [PUSH_UP] }));
    await remove(ID_B);

    await applyServerEntries(db, 'workout', [{ deleted: false, ...workout(ID_A) }, { deleted: false, ...workout(ID_B) }]);
    await applyServerEntries(db, 'workout', [{ deleted: true, id: ID_A, day: DAY }]);

    expect(await getEntry(db, 'workout', ID_A)).toMatchObject({ exercises: [PUSH_UP], syncState: 'pending' });
    expect(await getEntry(db, 'workout', ID_B)).toBeNull();
  });
});

describe('ADR-0007 rule 1 pruning workouts', () => {
  it('ADR-0007 rule 1 removes synced workouts older than 90 IST days and never pending ones', async () => {
    await applyServerEntries(db, 'workout', [workout(ID_A, { day: '2026-07-01' })]);
    await save(workout(ID_B, { day: '2026-07-01' }));

    expect(await pruneSynced(db, '2026-10-28')).toBe(1);

    expect(await getEntry(db, 'workout', ID_A)).toBeNull();
    expect(await getEntry(db, 'workout', ID_B)).toMatchObject({ syncState: 'pending' });
  });
});

describe('Local schema version 6', () => {
  it('ADR-0007 an update from version 5 keeps the data and the outbox and clears the cursor', async () => {
    const old = memoryDb();
    try {
      // Version 5 as phones have it: build it with the current migrations, then drop what 6 and 7 add.
      await migrateLocal(old);
      await old.execAsync(
        'DROP TABLE packaged_foods; DROP TABLE my_foods; ALTER TABLE foods DROP COLUMN portions; DROP TABLE profile; DROP TABLE workouts; DROP TABLE settings; ALTER TABLE foods DROP COLUMN measures; PRAGMA user_version = 5;',
      );
      await old.runAsync(`INSERT INTO weigh_ins VALUES ('2026-10-20', 70000, ?, 'synced')`, [AT]);
      await old.runAsync(`INSERT INTO steps VALUES ('2026-10-20', 4000, ?, 'pending')`, [AT]);
      await old.runAsync(
        `INSERT INTO outbox (change_id, type, data, created_at, status) VALUES ('c1', 'steps.set', ?, ?, 'pending')`,
        [JSON.stringify({ day: '2026-10-20', steps: 4_000, recordedAt: AT }), AT],
      );
      await setMeta(old, 'cursor', '99');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 12 });
      expect(await getWeighIn(old, '2026-10-20')).toMatchObject({ weightGrams: 70_000 });
      expect((await pendingChanges(old, 10)).map((change) => change.changeId)).toEqual(['c1']);
      expect(await getMeta(old, 'cursor')).toBeNull();
      expect(await listEntries(old, 'workout', '2026-10-01', '2026-10-31')).toEqual([]);
    } finally {
      await old.closeAsync();
    }
  });
});
