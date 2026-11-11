// The encrypted phone database (ADR-0007 rule 5; data-model "On the phone"). SQLCipher with a
// random 32-byte key kept in SecureStore; the user never sees a password.
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { oneTransactionAtATime, type SqlDb } from './sql';
import { getMeta, migrateLocal, setMeta } from './store';

export const DATABASE_NAME = 'fitsphere.db';
const KEY_NAME = 'fitsphere-db-key';
const KEY_PATTERN = /^[0-9a-f]{64}$/;

/**
 * How much of the database the connection keeps in memory, read and decrypted, in KiB (D-74). SQLite
 * keeps about 2 MB by default, but a food search reads the whole food list, about 2.4 MB (the foods
 * and the packaged foods), so each search pushed out pages the next one needed, and read and
 * decrypted most of the list again. 8 MB holds it about three times over; memory is used only as
 * pages are read.
 */
export const PAGE_CACHE_KIB = 8192;

/**
 * Expo's docs warn that without SQLCipher in the build, setting the key "has no effect and does
 * not throw an error". The app then stops instead of running unencrypted (ADR-0007 rule 5, D-14).
 */
export class SqlCipherMissingError extends Error {
  constructor() {
    super('SQLCipher is not active in this build');
    this.name = 'SqlCipherMissingError';
  }
}

export type LocalDatabase = { db: SqlDb; cipherVersion: string };

/** Opens the database for `owner` (the signed-in user's ID); another user's database is deleted. */
export async function openLocalDatabase(owner: string): Promise<LocalDatabase> {
  const opened = await openEncrypted();
  const current = await getMeta(opened.db, 'user_id');
  if (current === null) {
    await setMeta(opened.db, 'user_id', owner);
    return opened;
  }
  if (current === owner) return opened;
  // One signed-in user per database. Log out normally deletes it; this covers an interrupted one.
  await deleteLocalDatabase(opened.db);
  const fresh = await openEncrypted();
  await setMeta(fresh.db, 'user_id', owner);
  return fresh;
}

/** Closes and deletes the database and its key (log out, REQ-ACC-008). */
export async function deleteLocalDatabase(db?: SqlDb): Promise<void> {
  await db?.closeAsync().catch(() => undefined);
  await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_NAME).catch(() => undefined);
}

async function openEncrypted(): Promise<LocalDatabase> {
  const key = await databaseKey();
  let db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // Before the key: SQLCipher must answer, or the database would be plain SQLite.
  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version', []);
  if (!cipher?.cipher_version) {
    await db.closeAsync();
    throw new SqlCipherMissingError();
  }
  await db.execAsync(`PRAGMA key = "x'${key}'"`);

  try {
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master', []);
  } catch {
    // A database this key cannot open, e.g. restored without its key: start again. The server
    // holds everything that was synced (D-14).
    await db.closeAsync().catch(() => undefined);
    await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
  }
  // After the key, which SQLCipher needs first; it lasts as long as this connection (D-74).
  await db.execAsync(`PRAGMA cache_size = -${PAGE_CACHE_KIB}`);
  await migrateLocal(db);
  return { db: oneTransactionAtATime(db), cipherVersion: cipher.cipher_version };
}

async function databaseKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(KEY_NAME).catch(() => null);
  if (stored && KEY_PATTERN.test(stored)) return stored;
  const key = Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}
