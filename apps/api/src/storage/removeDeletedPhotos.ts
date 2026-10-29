import type pg from 'pg';
import { photoKeys, UPLOAD_LINK_SECONDS, type MediaStorage } from './mediaStorage.ts';

/** At most this many deleted photos are handled per sync; the rest wait for the next one. */
const BATCH = 20;

/**
 * Removes from storage the files of the user's photos marked deleted (REQ-LOG-006; ADR-0002 rule
 * 5): the viewing copy and the thumbnail. Runs after each sync of that user. A photo counts as done
 * only once every upload link issued before its deletion has expired, so a file uploaded late is
 * removed by a later run. Throws when storage fails; the photos then wait for the next sync.
 */
export async function removeDeletedPhotos(db: Pick<pg.Pool, 'query'>, storage: MediaStorage, userId: string, now: Date) {
  const { rows } = await db.query<{ id: string; deleted_at: Date }>(
    `select id, deleted_at from app.media
     where user_id = $1 and deleted_at is not null and files_removed_at is null
     order by deleted_at limit $2`,
    [userId, BATCH],
  );
  for (const row of rows) {
    await storage.remove(photoKeys(userId, row.id));
    if (now.getTime() - row.deleted_at.getTime() > UPLOAD_LINK_SECONDS * 1000) {
      await db.query('update app.media set files_removed_at = $3 where user_id = $1 and id = $2', [userId, row.id, now]);
    }
  }
}
