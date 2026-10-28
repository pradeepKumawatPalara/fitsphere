import {
  API_BASE_PATH,
  DEFAULT_LIST_LIMIT,
  validationDetails,
  weighInsQuerySchema,
  type WeighInsPage,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { authorizeWeighInRead, requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';

// GET /v1/users/{userId}/weigh-ins (api-conventions): older history read online, oldest first.
// The user's ID stays in the path so coach access can be added later as a rule, not a route.
export function registerWeighInsRoute(app: FastifyInstance, deps: { db: pg.Pool }) {
  app.get(`${API_BASE_PATH}/users/:userId/weigh-ins`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId } = request.params as { userId: string };
    authorizeWeighInRead(account, userId);

    const parsed = weighInsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));
    const { from, to, limit = DEFAULT_LIST_LIMIT, cursor } = parsed.data;
    const afterDay = cursor === undefined ? null : decodeDayCursor(cursor);
    if (afterDay === undefined) throw new ApiError('VALIDATION_FAILED', [{ field: 'cursor', issue: 'invalid_format' }]);

    const { rows } = await deps.db.query<{ day: string; weight_grams: number; recorded_at: Date; updated_at: Date }>(
      `select day::text as day, weight_grams, recorded_at, updated_at
       from app.weigh_ins
       where user_id = $1 and day between $2 and $3 and ($4::date is null or day > $4::date)
       order by day
       limit $5`,
      [account.id, from, to, afterDay, limit + 1],
    );
    const page = rows.slice(0, limit);
    const body: WeighInsPage = {
      items: page.map((row) => ({
        day: row.day,
        weightGrams: row.weight_grams,
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
