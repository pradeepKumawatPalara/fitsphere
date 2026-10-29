import { addDays } from '@fitsphere/shared';
import type { SqlDb } from './sql';

// Development builds only (ADR-0001 step 4): writes and reads 1,000 synthetic rows in the encrypted
// database and times both. The rows live in their own table, which is dropped afterwards.
export const ROW_CHECK_ROWS = 1000;

export type RowCheckResult = { written: number; read: number; writeMs: number; readMs: number };

export async function runRowCheck(db: SqlDb, now: () => number = () => performance.now()): Promise<RowCheckResult> {
  await db.execAsync(
    'DROP TABLE IF EXISTS dev_row_check; CREATE TABLE dev_row_check (id INTEGER PRIMARY KEY, day TEXT NOT NULL, weight_grams INTEGER NOT NULL);',
  );
  try {
    const writeStart = now();
    await db.withTransactionAsync(async () => {
      for (let index = 0; index < ROW_CHECK_ROWS; index += 1) {
        await db.runAsync('INSERT INTO dev_row_check (day, weight_grams) VALUES (?, ?)', [
          addDays('2026-01-01', index),
          50_000 + ((index * 37) % 50_000),
        ]);
      }
    });
    const readStart = now();
    const rows = await db.getAllAsync('SELECT * FROM dev_row_check', []);
    const readEnd = now();
    return { written: ROW_CHECK_ROWS, read: rows.length, writeMs: readStart - writeStart, readMs: readEnd - readStart };
  } finally {
    await db.execAsync('DROP TABLE IF EXISTS dev_row_check;');
  }
}
