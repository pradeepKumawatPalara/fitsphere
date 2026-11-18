import type { IstDay, Workout } from '@fitsphere/shared';
import type { AuthDeps } from './auth/service';
import { fetchDatedPages, type DatedSource } from './dateRange';
import { listEntries, type SyncState } from './local/store';

// Workouts older than the phone holds (REQ-TRN-004; ADR-0007 rules 1 and 6), read online for the
// dates a list shows (D-116: a year or dates picked, on Training's All workouts and an exercise's
// History) and kept only on the screen that asked. Deleted workouts are not sent.

/** A workout read from the server, newest first; it has no sync state on the phone. */
export type OlderWorkout = Pick<Workout, 'id' | 'day' | 'exercises' | 'timer' | 'recordedAt'>;

/** A workout of a list: one on the phone (with its sync state), or one read from the server (null). */
export type ListedWorkout = OlderWorkout & { syncState: SyncState | null };

/** The workouts from `from` to `to`, newest first, every page the server sends, or why they could not be read. */
export async function fetchOlderWorkouts(deps: AuthDeps, from: IstDay, to: IstDay): Promise<OlderWorkout[] | 'offline' | 'failed'> {
  const items = await fetchDatedPages<Workout>(deps, 'workouts', from, to);
  if (typeof items === 'string') return items;
  // The server sends oldest first.
  return [...items].reverse().map(({ id, day, exercises, timer, recordedAt }) => ({ id, day, exercises, timer, recordedAt }));
}

/** A list's workouts by dates (`useDatedList`): the phone's, then the server's older ones; one per id. */
export const WORKOUTS: DatedSource<ListedWorkout> = {
  phone: async (db, from, to) =>
    (await listEntries(db, 'workout', from, to)).map(({ id, day, exercises, timer, recordedAt, syncState }) => ({ id, day, exercises, timer, recordedAt, syncState })),
  online: async (deps, from, to) => {
    const result = await fetchOlderWorkouts(deps, from, to);
    return typeof result === 'string' ? result : result.map((workout) => ({ ...workout, syncState: null }));
  },
  key: (workout) => workout.id,
};
