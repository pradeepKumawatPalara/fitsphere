import { API_BASE_PATH, MAX_SYNC_CHANGES, syncRequestSchema, validationDetails } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';
import { decodeSyncCursor, runSync } from '../sync.ts';

// POST /v1/sync: the caller's own data only. The path names no user, so no one can write
// another user's weigh-ins through it (invariant #1).
export function registerSyncRoute(app: FastifyInstance, deps: { db: pg.Pool; now: () => Date; syncPageSize: number }) {
  app.post(`${API_BASE_PATH}/sync`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const body: unknown = request.body;
    const changes = typeof body === 'object' && body !== null ? (body as { changes?: unknown }).changes : undefined;
    if (Array.isArray(changes) && changes.length > MAX_SYNC_CHANGES) throw new ApiError('PAYLOAD_TOO_LARGE');

    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, body));
    const afterSeq = parsed.data.cursor === null ? 0n : decodeSyncCursor(parsed.data.cursor);
    if (afterSeq === null) throw new ApiError('VALIDATION_FAILED', [{ field: 'cursor', issue: 'invalid_format' }]);

    return runSync(deps.db, account, parsed.data.changes, afterSeq, {
      now: deps.now(),
      pageSize: deps.syncPageSize,
    });
  });
}
