// The phone's side of POST /v1/sync (ADR-0007; api-conventions). Sends the outbox oldest first,
// settles each result, applies the pull for every kind, and keeps everything that was not
// accepted.
import {
  foodsResponseSchema,
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
  applyServerEntries,
  getMeta,
  markAccepted,
  markRejected,
  pendingChanges,
  pruneSynced,
  recordAttempt,
  replaceFoods,
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
    await applyServerEntries(db, 'weighIn', reply.pull.weighIns);
    await applyServerEntries(db, 'steps', reply.pull.steps);
    await applyServerEntries(db, 'sleep', reply.pull.sleep);
    await applyServerEntries(db, 'measurements', reply.pull.measurements);
    await applyServerEntries(db, 'workout', reply.pull.workouts);
    await applyServerEntries(db, 'target', reply.pull.targets);
    await applyServerEntries(db, 'meal', reply.pull.meals);
    await applyServerEntries(db, 'savedMeal', reply.pull.savedMeals);
    await setMeta(db, 'cursor', reply.cursor);
    await setMeta(db, 'last_synced_at', now().toISOString());

    if (!reply.hasMore && changes.length < MAX_SYNC_CHANGES) return 'synced';
  }
  return 'synced';
}

export type FoodListOutcome = 'updated' | 'current' | 'offline' | 'failed';

/**
 * Keeps the phone's copy of the food list and its dishes current (ADR-0006 rule 1; D-28): it sends
 * the version it holds and stores the list only when the server's differs, so search keeps working
 * offline. A failure keeps the copy already on the phone.
 */
export async function refreshFoodList(db: SqlDb, auth: AuthDeps): Promise<FoodListOutcome> {
  const session = (await auth.client.getSession()).data.session;
  if (!session) return 'failed';
  const version = await getMeta(db, 'food_list_version');
  const response = await callApi<unknown>(auth.apiUrl, `/foods${version ? `?version=${encodeURIComponent(version)}` : ''}`, {
    token: session.access_token,
    ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
  });
  if (response.kind === 'offline') return 'offline';
  if (response.kind === 'error') return 'failed';
  const parsed = foodsResponseSchema.safeParse(response.body);
  if (!parsed.success) return 'failed';
  if (parsed.data.items === null) return 'current';
  await replaceFoods(db, parsed.data.version, parsed.data.items, parsed.data.dishes ?? []);
  return 'updated';
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
