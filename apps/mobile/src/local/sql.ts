// The part of expo-sqlite's database the app uses. Tests pass an in-memory SQLite database with
// the same methods (src/testing/memoryDb.ts).
export type BindValue = string | number | null;

export type SqlDb = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: BindValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(source: string, params: BindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: BindValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
};

/**
 * The database with one transaction at a time. expo-sqlite's `withTransactionAsync` is not
 * exclusive: started while another is open on the same connection, its BEGIN fails and its ROLLBACK
 * undoes the open one, whose COMMIT then fails with "cannot commit - no transaction is active", so
 * both changes are lost or half-saved (seen when choosing settings quickly). Here each transaction
 * waits for the one before it to finish, failed or not. A transaction's task must not start another
 * transaction: it would wait for itself.
 */
export function oneTransactionAtATime(db: SqlDb): SqlDb {
  let previous: Promise<unknown> = Promise.resolve();
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, params),
    getFirstAsync: (source, params) => db.getFirstAsync(source, params),
    getAllAsync: (source, params) => db.getAllAsync(source, params),
    withTransactionAsync(task) {
      const run = previous.then(() => db.withTransactionAsync(task));
      previous = run.catch(() => undefined);
      return run;
    },
    closeAsync: () => db.closeAsync(),
  };
}
