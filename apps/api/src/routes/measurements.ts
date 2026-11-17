import {
  API_BASE_PATH,
  DEFAULT_LIST_LIMIT,
  measurementsQuerySchema,
  validationDetails,
  type MeasurementsPage,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { authorizeMeasurementsRead, requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';

// GET /v1/users/{userId}/measurements (api-conventions; D-114): the user's measurements of the
// dates asked for, read online for days older than the 90 the phone holds (ADR-0007 rules 1 and 6),
// oldest first. One entry per user per day, so the cursor is the last day returned, as for weigh-ins.
export function registerMeasurementsRoute(app: FastifyInstance, deps: { db: pg.Pool }) {
  app.get(`${API_BASE_PATH}/users/:userId/measurements`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId } = request.params as { userId: string };
    authorizeMeasurementsRead(account, userId);

    const parsed = measurementsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));
    const { from, to, limit = DEFAULT_LIST_LIMIT, cursor } = parsed.data;
    const afterDay = cursor === undefined ? null : decodeDayCursor(cursor);
    if (afterDay === undefined) throw new ApiError('VALIDATION_FAILED', [{ field: 'cursor', issue: 'invalid_format' }]);

    const { rows } = await deps.db.query<{
      day: string;
      upper_waist_mm: number;
      lower_waist_mm: number;
      chest_mm: number | null;
      hips_mm: number | null;
      arm_mm: number | null;
      thigh_mm: number | null;
      notes: string | null;
      recorded_at: Date;
      updated_at: Date;
    }>(
      `select day::text as day, upper_waist_mm, lower_waist_mm, chest_mm, hips_mm, arm_mm, thigh_mm, notes,
         recorded_at, updated_at
       from app.measurements
       where user_id = $1 and day between $2 and $3 and ($4::date is null or day > $4::date)
       order by day
       limit $5`,
      [account.id, from, to, afterDay, limit + 1],
    );
    const page = rows.slice(0, limit);
    const body: MeasurementsPage = {
      items: page.map((row) => ({
        day: row.day,
        upperWaistMm: row.upper_waist_mm,
        lowerWaistMm: row.lower_waist_mm,
        chestMm: row.chest_mm,
        hipsMm: row.hips_mm,
        armMm: row.arm_mm,
        thighMm: row.thigh_mm,
        notes: row.notes,
        recordedAt: row.recorded_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
      nextCursor: rows.length > limit && page.length > 0 ? encodeDayCursor(page.at(-1)!.day) : null,
    };
    return body;
  });
}

function encodeDayCursor(day: string): string {
  return Buffer.from(`v1d:${day}`).toString('base64url');
}

/** The last day already returned; undefined when the cursor is not one of ours. */
function decodeDayCursor(cursor: string): string | undefined {
  const match = /^v1d:(\d{4}-\d{2}-\d{2})$/.exec(Buffer.from(cursor, 'base64url').toString());
  return match?.[1];
}
