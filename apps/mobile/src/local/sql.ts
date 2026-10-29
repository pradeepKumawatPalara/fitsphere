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
