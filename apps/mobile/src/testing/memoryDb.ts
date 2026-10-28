import type { BindValue, SqlDb } from '../local/sql';

// An in-memory SQLite database for app tests, from Node's built-in node:sqlite, with the methods
// of expo-sqlite the app uses. The SQL that runs on the phone runs here unchanged.

type NodeStatement = {
  run(...params: BindValue[]): { changes: number | bigint };
  all(...params: BindValue[]): unknown[];
  get(...params: BindValue[]): unknown;
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): NodeStatement; close(): void };

export function memoryDb(): SqlDb {
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
    withTransactionAsync: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    closeAsync: async () => {
      db.close();
    },
  };
}
