import { oneTransactionAtATime, type BindValue, type SqlDb } from '../local/sql';

// An in-memory SQLite database for app tests, from Node's built-in node:sqlite, with the methods
// of expo-sqlite the app uses. The SQL that runs on the phone runs here unchanged. Its transactions
// behave as expo-sqlite's (not exclusive), and it is wrapped as the app's is (database.ts); the raw
// one is `rawMemoryDb`.

type NodeStatement = {
  run(...params: BindValue[]): { changes: number | bigint };
  all(...params: BindValue[]): unknown[];
  get(...params: BindValue[]): unknown;
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): NodeStatement; close(): void };

export function memoryDb(): SqlDb {
  return oneTransactionAtATime(rawMemoryDb());
}

export function rawMemoryDb(): SqlDb {
  const { DatabaseSync } = jest.requireActual<{ DatabaseSync: new (path: string) => NodeDatabase }>('node:sqlite');
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (source) => {
      db.exec(source);
    },
    runAsync: async (source, params) => ({ changes: Number(db.prepare(source).run(...params).changes) }),
    getFirstAsync: async <T,>(source: string, params: BindValue[]) =>
      ((db.prepare(source).get(...params) as T | undefined) ?? null),
    getAllAsync: async <T,>(source: string, params: BindValue[]) => db.prepare(source).all(...params) as T[],
    // As expo-sqlite's SQLiteDatabase.withTransactionAsync.
    withTransactionAsync: async (task) => {
      try {
        db.exec('BEGIN');
        await task();
        db.exec('COMMIT');
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // Already rolled back.
        }
        throw error;
      }
    },
    closeAsync: async () => {
      db.close();
    },
  };
}
