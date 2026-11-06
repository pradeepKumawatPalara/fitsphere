import { memoryDb, rawMemoryDb } from '../testing/memoryDb';
import { oneTransactionAtATime, type SqlDb } from './sql';
import { getEntry, listSettings, migrateLocal, pendingChanges, saveEntry } from './store';

// One transaction at a time on the phone's database (ADR-0007; the owner's phone test, 2026-11-04:
// choosing System, Light and Dark quickly gave "cannot commit - no transaction is active"). The
// in-memory database's transactions behave as expo-sqlite's.

const AT = '2026-11-04T05:00:00.000Z';

function saveTheme(db: SqlDb, changeId: string, value: 'system' | 'light' | 'dark') {
  return saveEntry(db, 'setting', { changeId, data: { name: 'theme', value, setAt: AT } });
}

async function opened(db: SqlDb) {
  await migrateLocal(db);
  return db;
}

describe('ADR-0007 one transaction at a time', () => {
  it('without it, two saves at once fail as on the phone, and the changes are not both kept', async () => {
    const db = await opened(rawMemoryDb());
    try {
      const results = await Promise.allSettled([saveTheme(db, 'c1', 'light'), saveTheme(db, 'c2', 'dark')]);

      expect(results.some((result) => result.status === 'rejected')).toBe(true);
      expect((await pendingChanges(db, 10)).length).toBeLessThan(2);
    } finally {
      await db.closeAsync();
    }
  });

  it('settings chosen quickly are all saved and queued, in order; the last one is kept', async () => {
    const db = await opened(memoryDb());
    try {
      await Promise.all([saveTheme(db, 'c1', 'light'), saveTheme(db, 'c2', 'dark'), saveTheme(db, 'c3', 'system')]);

      expect((await pendingChanges(db, 10)).map((change) => change.changeId)).toEqual(['c1', 'c2', 'c3']);
      expect(await listSettings(db)).toEqual([{ name: 'theme', value: 'system', setAt: AT, syncState: 'pending' }]);
    } finally {
      await db.closeAsync();
    }
  });

  it('a failed transaction is rolled back alone, and the next one still runs', async () => {
    const db = await opened(oneTransactionAtATime(rawMemoryDb()));
    try {
      const failing = db.withTransactionAsync(async () => {
        await db.runAsync(`INSERT INTO sync_meta (key, value) VALUES ('cursor', 'x')`, []);
        throw new Error('synthetic failure');
      });
      const next = saveTheme(db, 'c1', 'dark');

      await expect(failing).rejects.toThrow('synthetic failure');
      await next;
      expect(await db.getFirstAsync(`SELECT value FROM sync_meta WHERE key = 'cursor'`, [])).toBeNull();
      expect(await getEntry(db, 'setting', 'theme')).toMatchObject({ value: 'dark' });
    } finally {
      await db.closeAsync();
    }
  });
});

describe('a closed database (the owner’s phone test, 2026-11-06: "Access to closed resource")', () => {
  /** Whether the promise settles within a few ticks: 'resolved', 'rejected' or 'pending'. */
  async function settled(promise: Promise<unknown>): Promise<string> {
    const outcome = promise.then(
      () => 'resolved',
      () => 'rejected',
    );
    return Promise.race([outcome, new Promise<string>((resolve) => setTimeout(() => resolve('pending'), 20))]);
  }

  /** A raw database whose reads wait until released, then fail as expo-sqlite's do once it is closed. */
  function slowDb() {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let isClosed = false;
    const fail = async (): Promise<never> => {
      await gate;
      throw new Error(isClosed ? 'Access to closed resource' : 'synthetic failure');
    };
    const raw: SqlDb = {
      execAsync: fail,
      runAsync: fail,
      getFirstAsync: fail,
      getAllAsync: fail,
      withTransactionAsync: fail,
      closeAsync: async () => {
        isClosed = true;
      },
    };
    return { db: oneTransactionAtATime(raw), release };
  }

  it('drops a read still running when the database closes, instead of an uncaught error', async () => {
    const { db, release } = slowDb();
    const reading = db.getAllAsync('SELECT 1', []);
    await db.closeAsync();
    release();

    expect(await settled(reading)).toBe('pending');
  });

  it('drops a read asked for after closing', async () => {
    const db = oneTransactionAtATime(rawMemoryDb());
    await db.closeAsync();

    expect(await settled(db.getFirstAsync('SELECT 1', []))).toBe('pending');
    expect(await settled(db.withTransactionAsync(async () => undefined))).toBe('pending');
  });

  it('still fails a read that fails while the database is open', async () => {
    const { db, release } = slowDb();
    const reading = db.getAllAsync('SELECT 1', []);
    release();

    await expect(reading).rejects.toThrow('synthetic failure');
  });
});
