// The phone's side of POST /v1/sync (ADR-0007; api-conventions). Sends the outbox oldest first,
// settles each result, applies the pull, and keeps everything that was not accepted.
import {
  istToday,
  MAX_SYNC_CHANGES,
  syncResponseSchema,
  type SyncRequest,
  type SyncResponse,
} from '@fitsphere/shared';
import { callApi } from '../api/client';
import type { AuthDeps } from '../auth/service';
import type { SqlDb } from '../local/sql';
import {
  applyServerWeighIns,
  getMeta,
  markAccepted,
  markRejected,
  pendingChanges,
  pruneSynced,
  recordAttempt,
  setMeta,
} from '../local/store';

export type SyncOutcome = 'synced' | 'offline' | 'failed' | 'signedOut';

// More rounds than a 90-day window can need; it only stops a loop if the server misbehaves.
const MAX_ROUNDS = 20;

export async function syncNow(db: SqlDb, auth: AuthDeps, now: () => Date = () => new Date()): Promise<SyncOutcome> {
  // Synced entries older than 90 IST days leave the phone (ADR-0007 rule 1).
  await pruneSynced(db, istToday(now()));

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const changes = await pendingChanges(db, MAX_SYNC_CHANGES);
    const request: SyncRequest = {
      cursor: await getMeta(db, 'cursor'),
      changes: changes.map(({ changeId, type, data }) => ({ changeId, type, data })),
    };
    await recordAttempt(
      db,
      changes.map((change) => change.changeId),
    );

    const reply = await send(auth, request);
    if (typeof reply === 'string') return reply;

    for (const result of reply.results) {
      if (result.status === 'accepted') await markAccepted(db, result.changeId);
      else await markRejected(db, result.changeId, result.error?.code ?? 'VALIDATION_FAILED');
    }
    await applyServerWeighIns(db, reply.pull.weighIns);
    await setMeta(db, 'cursor', reply.cursor);
    await setMeta(db, 'last_synced_at', now().toISOString());

    if (!reply.hasMore && changes.length < MAX_SYNC_CHANGES) return 'synced';
  }
  return 'synced';
}

/** One sync call, with one session refresh after a 401 (error model). */
async function send(auth: AuthDeps, request: SyncRequest): Promise<SyncResponse | Exclude<SyncOutcome, 'synced'>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return 'signedOut';
    const response = await callApi<unknown>(auth.apiUrl, '/sync', {
      method: 'POST',
      token: session.access_token,
      body: request,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return 'offline';
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      return response.status === 401 ? 'signedOut' : 'failed';
    }
    const parsed = syncResponseSchema.safeParse(response.body);
    return parsed.success ? parsed.data : 'failed';
  }
  return 'signedOut';
}
