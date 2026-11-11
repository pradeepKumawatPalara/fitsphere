import { MAX_LIST_LIMIT, type IstDay, type MeResponse, type Workout, type WorkoutsPage } from '@fitsphere/shared';
import { callApi } from './api/client';
import type { AuthDeps } from './auth/service';

// Workouts older than the phone holds (REQ-TRN-004; ADR-0007 rules 1 and 6), read online for a range
// of days and kept only on the screen that asked: Training's "Load older" (D-29) and an exercise's
// History (D-82). Deleted workouts are not sent.

/** A workout read from the server, newest first; it has no sync state on the phone. */
export type OlderWorkout = Pick<Workout, 'id' | 'day' | 'exercises' | 'timer' | 'recordedAt'>;

/** How many days one "Load older" reads. */
export const OLDER_CHUNK_DAYS = 90;

/** The workouts from `from` to `to`, newest first, or why they could not be read. */
export async function fetchOlderWorkouts(deps: AuthDeps, from: IstDay, to: IstDay): Promise<OlderWorkout[] | 'offline' | 'failed'> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return 'failed';
  const options = { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
  const me = await callApi<MeResponse>(deps.apiUrl, '/me', options);
  if (me.kind !== 'ok') return me.kind === 'offline' ? 'offline' : 'failed';
  const page = await callApi<WorkoutsPage>(deps.apiUrl, `/users/${me.body.user.id}/workouts?from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}`, options);
  if (page.kind !== 'ok') return page.kind === 'offline' ? 'offline' : 'failed';
  // The server sends oldest first.
  return [...page.body.items].reverse().map(({ id, day, exercises, timer, recordedAt }) => ({ id, day, exercises, timer, recordedAt }));
}
