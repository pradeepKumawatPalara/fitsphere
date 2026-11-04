import { mediaLinks } from '../api/media';
import type { AuthDeps } from '../auth/service';
import { markUploaded, photosToUpload } from '../local/photos';
import type { SqlDb } from '../local/sql';
import { entryWaiting, PROFILE_KEY } from '../local/store';
import { base64ToBytes } from '../photos/bytes';

export type UploadOutcome = 'done' | 'offline';

/**
 * Uploads the photos taken on this phone (REQ-LOG-006, REQ-ACC-011; ADR-0002 rule 3), straight to
 * storage with links from the API, after a sync that reached the server. A photo waits while its
 * meal's (or the profile's) change is still in the outbox, since the server knows the photo only
 * once that change is applied; one the server does not know is skipped and tried again next time.
 * Nothing is cleared here (D-14).
 */
export async function uploadPhotos(db: SqlDb, auth: AuthDeps): Promise<UploadOutcome> {
  const fetchImpl = auth.fetchImpl ?? fetch;
  for (const photo of await photosToUpload(db)) {
    const owner = photo.mealId === PROFILE_KEY ? 'profile' : 'meal';
    if (!photo.full || !photo.thumbnail || (await entryWaiting(db, owner, photo.mealId))) continue;
    const outcome = await mediaLinks(db, auth, photo.id, 'upload');
    if (outcome.kind === 'offline') return 'offline';
    if (outcome.kind !== 'ok') continue;
    const put = (url: string, base64: string) =>
      fetchImpl(url, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: base64ToBytes(base64) });
    try {
      const [full, thumbnail] = await Promise.all([put(outcome.links.photoUrl, photo.full), put(outcome.links.thumbnailUrl, photo.thumbnail)]);
      if (full.ok && thumbnail.ok) await markUploaded(db, photo.id);
    } catch {
      return 'offline';
    }
  }
  return 'done';
}
