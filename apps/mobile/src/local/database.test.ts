import * as SQLite from 'expo-sqlite';
import { memoryDb } from '../testing/memoryDb';
import { deleteLocalDatabase, openLocalDatabase, SqlCipherMissingError } from './database';
import type { SqlDb } from './sql';
import { getMeta } from './store';

const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 0,
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecure.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecure.delete(key);
  }),
}));
jest.mock('expo-crypto', () => ({ getRandomBytes: (count: number) => new Uint8Array(count).fill(171) }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(), deleteDatabaseAsync: jest.fn(async () => undefined) }));

const KEY = 'ab'.repeat(32);

/** A database that records every statement; `cipher` is what PRAGMA cipher_version returns. */
function recordingDb(cipher: string | null, inner: SqlDb = memoryDb()) {
  const statements: string[] = [];
  const db: SqlDb = {
    ...inner,
    execAsync: async (source) => {
      statements.push(source.trim());
      if (!source.startsWith('PRAGMA key')) await inner.execAsync(source);
    },
    getFirstAsync: async <T,>(source: string, params: SQLite.SQLiteBindValue[]) => {
      statements.push(source.trim());
      if (source === 'PRAGMA cipher_version') return (cipher ? { cipher_version: cipher } : null) as T | null;
      return inner.getFirstAsync<T>(source, params as never);
    },
    closeAsync: jest.fn(async () => undefined),
  };
  return { db, statements };
}

beforeEach(() => {
  mockSecure.clear();
  jest.mocked(SQLite.openDatabaseAsync).mockReset();
});

describe('ADR-0007 rule 5: the encrypted phone database', () => {
  it('ADR-0007 stops with an error, and never sets a key, when SQLCipher is missing', async () => {
    const { db, statements } = recordingDb(null);
    jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(db as never);

    await expect(openLocalDatabase('user-1')).rejects.toBeInstanceOf(SqlCipherMissingError);

    expect(statements).toEqual(['PRAGMA cipher_version']);
    expect(db.closeAsync).toHaveBeenCalled();
  });

  it('ADR-0007 checks SQLCipher before the key, uses a random 32-byte key from secure storage, and records the owner', async () => {
    const { db, statements } = recordingDb('4.6.1 community');
    jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(db as never);

    const opened = await openLocalDatabase('user-1');

    expect(statements.slice(0, 2)).toEqual(['PRAGMA cipher_version', `PRAGMA key = "x'${KEY}'"`]);
    expect(mockSecure.get('fitsphere-db-key')).toBe(KEY);
    expect(opened.cipherVersion).toBe('4.6.1 community');
    expect(await getMeta(opened.db, 'user_id')).toBe('user-1');
  });

  it('D-74 keeps 8 MB of the database in memory, set after the key and before the tables are brought up to date', async () => {
    const { db, statements } = recordingDb('4.6.1 community');
    jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(db as never);

    const opened = await openLocalDatabase('user-1');

    const cache = statements.indexOf('PRAGMA cache_size = -8192');
    expect(cache).toBeGreaterThan(statements.indexOf(`PRAGMA key = "x'${KEY}'"`));
    expect(cache).toBeLessThan(statements.indexOf('PRAGMA user_version'));
    expect(await opened.db.getFirstAsync('PRAGMA cache_size', [])).toEqual({ cache_size: -8192 });
  });

  it('ADR-0007 reuses the stored key on the next start', async () => {
    mockSecure.set('fitsphere-db-key', 'cd'.repeat(32));
    const { db, statements } = recordingDb('4.6.1 community');
    jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(db as never);

    await openLocalDatabase('user-1');

    expect(statements).toContain(`PRAGMA key = "x'${'cd'.repeat(32)}'"`);
  });

  it('REQ-ACC-008 one user per database: another user’s database is deleted with its key', async () => {
    const inner = memoryDb();
    const first = recordingDb('4.6.1 community', inner);
    const fresh = recordingDb('4.6.1 community');
    jest
      .mocked(SQLite.openDatabaseAsync)
      .mockResolvedValueOnce(first.db as never)
      .mockResolvedValueOnce(first.db as never)
      .mockResolvedValueOnce(fresh.db as never);
    await openLocalDatabase('user-1');

    const opened = await openLocalDatabase('user-2');

    expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('fitsphere.db');
    expect(await getMeta(opened.db, 'user_id')).toBe('user-2');
  });

  it('REQ-ACC-008 log out deletes the database and its key', async () => {
    mockSecure.set('fitsphere-db-key', KEY);
    const { db } = recordingDb('4.6.1 community');

    await deleteLocalDatabase(db);

    expect(db.closeAsync).toHaveBeenCalled();
    expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('fitsphere.db');
    expect(mockSecure.has('fitsphere-db-key')).toBe(false);
  });
});
