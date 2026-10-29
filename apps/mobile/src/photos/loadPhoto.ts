import { useEffect, useState } from 'react';
import { mediaLinks } from '../api/media';
import { useAuth } from '../auth/AuthProvider';
import type { AuthDeps } from '../auth/service';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { cachePhotoFile, getPhoto } from '../local/photos';
import type { SqlDb } from '../local/sql';
import { bytesToBase64 } from './bytes';

export type PhotoSize = 'thumbnail' | 'full';
export type LoadedPhoto = { kind: 'ready'; base64: string } | { kind: 'loading' } | { kind: 'offline' } | { kind: 'unavailable' };

/**
 * One file of a meal photo (REQ-LOG-006, REQ-NFR-006): from the phone when it is here, otherwise
 * read once with a fresh viewing link and kept in the encrypted database, so repeat views use no
 * data (ADR-0002 rule 7). "Unavailable" when the server has no file yet, e.g. it was taken on
 * another phone that has not uploaded it.
 */
export async function loadPhoto(
  db: SqlDb,
  auth: AuthDeps,
  photo: { id: string; mealId: string },
  size: PhotoSize,
  now: () => Date = () => new Date(),
): Promise<Exclude<LoadedPhoto, { kind: 'loading' }>> {
  const kept = await getPhoto(db, photo.id);
  if (kept?.[size]) return { kind: 'ready', base64: kept[size] };
  const outcome = await mediaLinks(db, auth, photo.id, 'view');
  if (outcome.kind === 'offline') return { kind: 'offline' };
  if (outcome.kind !== 'ok') return { kind: 'unavailable' };
  try {
    const response = await (auth.fetchImpl ?? fetch)(size === 'full' ? outcome.links.photoUrl : outcome.links.thumbnailUrl);
    if (!response.ok) return { kind: 'unavailable' };
    const base64 = bytesToBase64(new Uint8Array(await response.arrayBuffer()));
    await cachePhotoFile(db, { ...photo, createdAt: now().toISOString() }, { [size]: base64 });
    return { kind: 'ready', base64 };
  } catch {
    return { kind: 'offline' };
  }
}

/** `loadPhoto` for a screen; null loads nothing. */
export function usePhoto(photo: { id: string; mealId: string } | null, size: PhotoSize): LoadedPhoto {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const id = photo?.id ?? null;
  const mealId = photo?.mealId ?? null;
  const key = id && mealId ? `${id}:${size}` : null;
  // The result is kept with the photo it is for, so another photo shows "loading" until it is read.
  const [loaded, setLoaded] = useState<{ key: string; result: LoadedPhoto } | null>(null);

  useEffect(() => {
    if (!key || !id || !mealId || local.state.status !== 'ready') return;
    let active = true;
    void loadPhoto(local.state.db, deps, { id, mealId }, size)
      .catch((): LoadedPhoto => ({ kind: 'unavailable' }))
      .then((result) => {
        if (active) setLoaded({ key, result });
      });
    return () => {
      active = false;
    };
  }, [key, id, mealId, size, deps, local.state]);

  return loaded && loaded.key === key ? loaded.result : { kind: 'loading' };
}
