// Meal photo files on the phone (REQ-LOG-006; ADR-0002 rule 7, ADR-0007 rule 5). They are kept
// inside the encrypted database, never as files: the thumbnail for lists, and the viewing copy once
// taken or viewed on this phone, so repeat views use no data. A photo taken here waits with
// `uploaded = 0` until its files are uploaded; it counts as unsynced and is never cleared
// automatically (D-14). Photos no meal names any more are removed by `removeUnusedPhotos` (store).
import type { SqlDb } from './sql';

/** A photo's two JPEG files as base64 text. */
export type PhotoFiles = { thumbnail: string; full: string };

export type LocalPhoto = { id: string; mealId: string; thumbnail: string | null; full: string | null; uploaded: boolean };

type PhotoRow = { id: string; meal_id: string; thumbnail: string | null; full: string | null; uploaded: number };

/** A photo just taken for a meal; its files wait to be uploaded. */
export async function insertNewPhoto(db: SqlDb, photo: { id: string; mealId: string; createdAt: string; files: PhotoFiles }) {
  await db.runAsync(
    `INSERT INTO photos (id, meal_id, thumbnail, full, uploaded, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
    [photo.id, photo.mealId, photo.files.thumbnail, photo.files.full, photo.createdAt],
  );
}

export async function getPhoto(db: SqlDb, id: string): Promise<LocalPhoto | null> {
  const row = await db.getFirstAsync<PhotoRow>('SELECT * FROM photos WHERE id = ?', [id]);
  return row ? toPhoto(row) : null;
}

/**
 * Keeps a file read from storage, for a photo a meal on this phone still names. Files already
 * here are kept.
 */
export async function cachePhotoFile(db: SqlDb, photo: { id: string; mealId: string; createdAt: string }, file: Partial<PhotoFiles>) {
  await db.runAsync(
    `INSERT INTO photos (id, meal_id, thumbnail, full, uploaded, created_at)
     SELECT ?, ?, ?, ?, 1, ?
     WHERE EXISTS (SELECT 1 FROM meals WHERE id = ? AND json_extract(photo, '$.mediaId') = ?)
     ON CONFLICT (id) DO UPDATE SET thumbnail = coalesce(thumbnail, excluded.thumbnail), full = coalesce(full, excluded.full)`,
    [photo.id, photo.mealId, file.thumbnail ?? null, file.full ?? null, photo.createdAt, photo.mealId, photo.id],
  );
}

/** Photos taken on this phone whose files are not uploaded yet, oldest first. */
export async function photosToUpload(db: SqlDb): Promise<LocalPhoto[]> {
  const rows = await db.getAllAsync<PhotoRow>('SELECT * FROM photos WHERE uploaded = 0 ORDER BY created_at', []);
  return rows.map(toPhoto);
}

export async function markUploaded(db: SqlDb, id: string): Promise<void> {
  await db.runAsync('UPDATE photos SET uploaded = 1 WHERE id = ?', [id]);
}

function toPhoto(row: PhotoRow): LocalPhoto {
  return { id: row.id, mealId: row.meal_id, thumbnail: row.thumbnail, full: row.full, uploaded: row.uploaded === 1 };
}
