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
 *
 * Once the app closes the database (signing out, another user, or the app reloading while it is
 * developed), a call still running on it, or made after, is dropped quietly: it neither resolves nor
 * rejects. Without this, a screen's read that was under way failed with expo-sqlite's "Access to
 * closed resource", shown as an uncaught error (the owner's phone test, 2026-11-06). The screen that
 * asked is gone by then; the next database is a new one. Errors before closing reject as before.
 */
export function oneTransactionAtATime(db: SqlDb): SqlDb {
  let previous: Promise<unknown> = Promise.resolve();
  let closed = false;
  const dropped = <T>() => new Promise<T>(() => undefined);
  function quiet<T>(start: () => Promise<T>): Promise<T> {
    if (closed) return dropped<T>();
    return start().catch((error: unknown) => (closed ? dropped<T>() : Promise.reject(error)));
  }
  return {
    execAsync: (source) => quiet(() => db.execAsync(source)),
    runAsync: (source, params) => quiet(() => db.runAsync(source, params)),
    getFirstAsync: <T>(source: string, params: BindValue[]) => quiet(() => db.getFirstAsync<T>(source, params)),
    getAllAsync: <T>(source: string, params: BindValue[]) => quiet(() => db.getAllAsync<T>(source, params)),
    withTransactionAsync(task) {
      const run = previous.then(() => quiet(() => db.withTransactionAsync(task)));
      previous = run.catch(() => undefined);
      return run;
    },
    closeAsync: () => {
      closed = true;
      return db.closeAsync();
    },
  };
}
