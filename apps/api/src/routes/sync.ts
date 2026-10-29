import { API_BASE_PATH, MAX_SYNC_CHANGES, syncRequestSchema, validationDetails } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';
import { removeDeletedPhotos } from '../storage/removeDeletedPhotos.ts';
import type { MediaStorage } from '../storage/mediaStorage.ts';
import { decodeSyncCursor, runSync } from '../sync.ts';

// POST /v1/sync: the caller's own data only. The path names no user, so no one can write
// another user's weigh-ins through it (invariant #1).
export function registerSyncRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; syncPageSize: number; storage: MediaStorage | null },
) {
  app.post(`${API_BASE_PATH}/sync`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const body: unknown = request.body;
    const changes = typeof body === 'object' && body !== null ? (body as { changes?: unknown }).changes : undefined;
    if (Array.isArray(changes) && changes.length > MAX_SYNC_CHANGES) throw new ApiError('PAYLOAD_TOO_LARGE');

    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));
    const afterSeq = parsed.data.cursor === null ? 0n : decodeSyncCursor(parsed.data.cursor);
    if (afterSeq === null) throw new ApiError('VALIDATION_FAILED', [{ field: 'cursor', issue: 'invalid_format' }]);

    const now = deps.now();
    const response = await runSync(deps.db, account, parsed.data.changes, afterSeq, { now, pageSize: deps.syncPageSize });
    // After the commit: files of deleted photos leave storage. A failure never fails the sync; the
    // photos wait for the next one (REQ-LOG-006).
    if (deps.storage) {
      await removeDeletedPhotos(deps.db, deps.storage, account.id, now).catch(() => {
        request.log.warn({ userId: account.id }, 'deleted photo files not removed yet');
      });
    }
    return response;
  });
}
