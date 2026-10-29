import { API_BASE_PATH, idSchema, type MediaLinks } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { authorizeMealPhoto, requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';
import { photoKeys, UPLOAD_LINK_SECONDS, VIEW_LINK_SECONDS, type MediaStorage } from '../storage/mediaStorage.ts';

// Meal photo files (REQ-LOG-006; ADR-0002 rules 3 and 4; api-conventions). The phone uploads the
// viewing copy and the thumbnail straight to storage with links from here, and asks again for
// short viewing links each time it needs the files. A photo exists here once the meal that names it
// has synced, and is gone once it is deleted. Links are never stored or logged (invariant #7).
// The user's ID stays in the path so coach access can be added later as a rule, not a route.
export function registerMediaRoutes(app: FastifyInstance, deps: { db: Pick<pg.Pool, 'query'>; storage: MediaStorage | null; now: () => Date }) {
  async function livePhoto(userId: string, mediaId: string): Promise<string> {
    if (!idSchema.safeParse(mediaId).success) throw new ApiError('NOT_FOUND');
    const { rowCount } = await deps.db.query('select 1 from app.media where user_id = $1 and id = $2 and deleted_at is null', [
      userId,
      mediaId,
    ]);
    if (!rowCount) throw new ApiError('NOT_FOUND');
    return mediaId;
  }

  app.post(`${API_BASE_PATH}/users/:userId/media/:mediaId/upload`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId, mediaId } = request.params as { userId: string; mediaId: string };
    authorizeMealPhoto(account, userId);
    await livePhoto(account.id, mediaId);
    if (!deps.storage) throw new ApiError('SERVICE_UNAVAILABLE');

    const [photoUrl, thumbnailUrl] = await deps.storage.uploadLinks(photoKeys(account.id, mediaId));
    return links(photoUrl!, thumbnailUrl!, deps.now(), UPLOAD_LINK_SECONDS);
  });

  app.get(`${API_BASE_PATH}/users/:userId/media/:mediaId`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId, mediaId } = request.params as { userId: string; mediaId: string };
    authorizeMealPhoto(account, userId);
    await livePhoto(account.id, mediaId);
    if (!deps.storage) throw new ApiError('SERVICE_UNAVAILABLE');

    const [photoUrl, thumbnailUrl] = await deps.storage.viewLinks(photoKeys(account.id, mediaId));
    return links(photoUrl!, thumbnailUrl!, deps.now(), VIEW_LINK_SECONDS);
  });
}

function links(photoUrl: string, thumbnailUrl: string, now: Date, seconds: number): MediaLinks {
  return { photoUrl, thumbnailUrl, expiresAt: new Date(now.getTime() + seconds * 1000).toISOString() };
}
