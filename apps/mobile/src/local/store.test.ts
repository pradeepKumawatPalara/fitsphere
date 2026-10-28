import { memoryDb } from '../testing/memoryDb';
import {
  discardRejected,
  getMeta,
  getWeighIn,
  logOutDecision,
  markAccepted,
  markRejected,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  recordAttempt,
  rejectedChanges,
  saveWeighIn,
  setMeta,
  unsyncedCount,
} from './store';
import type { SqlDb } from './sql';
import { runRowCheck } from './rowCheck';

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

async function save(day: string, weightGrams: number) {
  const id = changeId();
  await saveWeighIn(db, { changeId: id, day, weightGrams, recordedAt: `${day}T03:00:00.000Z` });
  return id;
}

async function markSynced(day: string, weightGrams: number) {
  const id = await save(day, weightGrams);
  await markAccepted(db, id);
}

describe('ADR-0007 outbox', () => {
  it('ADR-0007 saving writes the value and queues one weighIn.set change, in order', async () => {
    const first = await save('2026-10-27', 70_250);
    const second = await save('2026-10-28', 70_100);

    expect(await getWeighIn(db, '2026-10-27')).toEqual({
      day: '2026-10-27',
      weightGrams: 70_250,
      recordedAt: '2026-10-27T03:00:00.000Z',
      syncState: 'pending',
    });
    const pending = await pendingChanges(db, 100);
    expect(pending.map((entry) => entry.changeId)).toEqual([first, second]);
    expect(pending[0]).toMatchObject({
      type: 'weighIn.set',
      data: { day: '2026-10-27', weightGrams: 70_250, recordedAt: '2026-10-27T03:00:00.000Z' },
      attempts: 0,
      status: 'pending',
      errorCode: null,
    });
  });

  it('Q-030 a new value for the day replaces the old one on the phone', async () => {
    await save('2026-10-27', 70_250);
    await save('2026-10-27', 70_500);

    expect((await getWeighIn(db, '2026-10-27'))?.weightGrams).toBe(70_500);
    expect(await pendingChanges(db, 100)).toHaveLength(2);
  });

  it('ADR-0007 an accepted change leaves the outbox and the day becomes synced', async () => {
    const id = await save('2026-10-27', 70_250);
    await recordAttempt(db, [id]);

    await markAccepted(db, id);

    expect(await pendingChanges(db, 100)).toEqual([]);
    expect((await getWeighIn(db, '2026-10-27'))?.syncState).toBe('synced');
  });

  it('ADR-0007 a day stays pending while a later change for it is still queued', async () => {
    const first = await save('2026-10-27', 70_250);
    await save('2026-10-27', 70_500);

    await markAccepted(db, first);

    expect((await getWeighIn(db, '2026-10-27'))?.syncState).toBe('pending');
  });

  it('ADR-0007 rule 2 a rejected change stays, with its code, until fixed or discarded', async () => {
    const id = await save('2026-10-29', 70_250);

    await markRejected(db, id, 'DAY_IN_FUTURE');

    expect(await pendingChanges(db, 100)).toEqual([]);
    expect(await rejectedChanges(db)).toMatchObject([{ changeId: id, status: 'rejected', errorCode: 'DAY_IN_FUTURE' }]);
    expect((await getWeighIn(db, '2026-10-29'))?.syncState).toBe('rejected');
  });

  it('ADR-0007 rule 2 saving a new value for the day fixes a rejected change', async () => {
    const rejected = await save('2026-10-27', 70_250);
    await markRejected(db, rejected, 'VALIDATION_FAILED');

    const fixed = await save('2026-10-27', 70_300);

    expect(await rejectedChanges(db)).toEqual([]);
    expect((await pendingChanges(db, 100)).map((entry) => entry.changeId)).toEqual([fixed]);
  });

  it('ADR-0007 rule 2 discarding a rejected change removes it and asks for a full pull', async () => {
    await setMeta(db, 'cursor', 'opaque');
    const id = await save('2026-10-29', 70_250);
    await markRejected(db, id, 'DAY_IN_FUTURE');

    await discardRejected(db, id);

    expect(await rejectedChanges(db)).toEqual([]);
    expect(await getWeighIn(db, '2026-10-29')).toBeNull();
    expect(await getMeta(db, 'cursor')).toBeNull();
  });
});

describe('ADR-0007 rule 1 pruning', () => {
  it('ADR-0007 rule 1 removes synced entries older than 90 IST days and keeps the rest', async () => {
    // Today 2026-10-28: the window starts on 2026-07-31.
    await markSynced('2026-07-30', 70_000);
    await markSynced('2026-07-31', 70_100);

    expect(await pruneSynced(db, '2026-10-28')).toBe(1);
    expect(await getWeighIn(db, '2026-07-30')).toBeNull();
    expect(await getWeighIn(db, '2026-07-31')).not.toBeNull();
  });

  it('D-14 never removes pending or rejected entries, however old', async () => {
    await save('2026-01-01', 70_000);
    const rejected = await save('2026-01-02', 70_000);
    await markRejected(db, rejected, 'VALIDATION_FAILED');

    expect(await pruneSynced(db, '2026-10-28')).toBe(0);
    expect(await getWeighIn(db, '2026-01-01')).not.toBeNull();
    expect(await getWeighIn(db, '2026-01-02')).not.toBeNull();
    expect(await unsyncedCount(db)).toBe(2);
  });
});

describe('REQ-ACC-008 log-out decision', () => {
  it('REQ-ACC-008 deletes at once when nothing is waiting', async () => {
    await markSynced('2026-10-27', 70_000);

    expect(await logOutDecision(db)).toEqual({ kind: 'deleteNow' });
  });

  it('REQ-ACC-008 warns when pending or rejected entries would be lost', async () => {
    await save('2026-10-27', 70_000);
    const rejected = await save('2026-10-28', 70_000);
    await markRejected(db, rejected, 'VALIDATION_FAILED');

    expect(await logOutDecision(db)).toEqual({ kind: 'warn', unsynced: 2 });
  });
});

describe('ADR-0001 step 4 row check', () => {
  it('ADR-0001 step 4 writes and reads 1,000 rows, times both, and leaves nothing behind', async () => {
    let clock = 0;
    const result = await runRowCheck(db, () => (clock += 5));

    expect(result).toEqual({ written: 1000, read: 1000, writeMs: 5, readMs: 5 });
    const table = await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE name = 'dev_row_check'`, []);
    expect(table).toBeNull();
  });
});
