import {
  API_BASE_PATH,
  currentExercises,
  DEFAULT_LIST_LIMIT,
  validationDetails,
  workoutsQuerySchema,
  type Workout,
  type WorkoutsPage,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { authorizeWorkoutRead, requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';

// GET /v1/users/{userId}/workouts (api-conventions): workouts older than the phone holds, read
// online, oldest first (REQ-TRN-004; ADR-0007 rules 1 and 6). Deleted workouts are left out. A day
// may hold several workouts, so the cursor is the last (day, id) returned.
export function registerWorkoutsRoute(app: FastifyInstance, deps: { db: pg.Pool }) {
  app.get(`${API_BASE_PATH}/users/:userId/workouts`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId } = request.params as { userId: string };
    authorizeWorkoutRead(account, userId);

    const parsed = workoutsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));
    const { from, to, limit = DEFAULT_LIST_LIMIT, cursor } = parsed.data;
    const after = cursor === undefined ? null : decodeWorkoutCursor(cursor);
    if (after === undefined) throw new ApiError('VALIDATION_FAILED', [{ field: 'cursor', issue: 'invalid_format' }]);

    const { rows } = await deps.db.query<{
      id: string;
      day: string;
      exercises: Workout['exercises'];
      timer_started_at: Date | null;
      timer_counted_seconds: number | null;
      timer_running_since: Date | null;
      timer_done_at: Date | null;
      recorded_at: Date;
      updated_at: Date;
    }>(
      `select id, day::text as day, exercises, timer_started_at, timer_counted_seconds, timer_running_since,
         timer_done_at, recorded_at, updated_at
       from app.workouts
       where user_id = $1 and deleted_at is null and day between $2 and $3
         and ($4::date is null or (day, id) > ($4::date, $5::uuid))
       order by day, id
       limit $6`,
      [account.id, from, to, after?.day ?? null, after?.id ?? null, limit + 1],
    );
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const body: WorkoutsPage = {
      items: page.map((row) => ({
        id: row.id,
        day: row.day,
        // Exercises saved before D-50 are served in today's shape.
        exercises: currentExercises(row.exercises),
        // Its timer (D-71), or none.
        timer:
          row.timer_started_at === null
            ? null
            : {
                startedAt: row.timer_started_at.toISOString(),
                countedSeconds: row.timer_counted_seconds ?? 0,
                runningSince: row.timer_running_since?.toISOString() ?? null,
                doneAt: row.timer_done_at?.toISOString() ?? null,
              },
        recordedAt: row.recorded_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
      nextCursor: rows.length > limit && last ? encodeWorkoutCursor(last.day, last.id) : null,
    };
    return body;
  });
}

function encodeWorkoutCursor(day: string, id: string): string {
  return Buffer.from(`v1w:${day}:${id}`).toString('base64url');
}

/** The last workout already returned; undefined when the cursor is not one of ours. */
function decodeWorkoutCursor(cursor: string): { day: string; id: string } | undefined {
  const match = /^v1w:(\d{4}-\d{2}-\d{2}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
    Buffer.from(cursor, 'base64url').toString(),
  );
  return match?.[1] && match[2] ? { day: match[1], id: match[2] } : undefined;
}
