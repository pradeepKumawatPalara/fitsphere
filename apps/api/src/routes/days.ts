import { API_BASE_PATH, daysInRange, daysQuerySchema, MAX_DAYS_RANGE, validationDetails, type DaysResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { authorizeDaysRead, requireAccount } from '../access.ts';
import { ApiError } from '../errors.ts';
import { readDays } from '../sync.ts';

// GET /v1/users/{userId}/days?from=&to= (api-conventions; D-106): the day data of days older than the
// phone's 90, read online when the user opens them (ADR-0007 rule 1), at most MAX_DAYS_RANGE days a
// read. The user's ID stays in the path so coach access can be added later as a rule, not a route.
export function registerDaysRoute(app: FastifyInstance, deps: { db: pg.Pool }) {
  app.get(`${API_BASE_PATH}/users/:userId/days`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    const { userId } = request.params as { userId: string };
    authorizeDaysRead(account, userId);

    const parsed = daysQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));
    const { from, to } = parsed.data;
    const count = daysInRange(from, to);
    if (count < 1 || count > MAX_DAYS_RANGE) throw new ApiError('VALIDATION_FAILED', [{ field: 'to', issue: 'out_of_range' }]);

    const body: DaysResponse = await readDays(deps.db, account.id, from, to);
    return body;
  });
}
