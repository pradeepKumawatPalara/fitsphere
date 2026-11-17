// POST /v1/ai/meal-parse (ADR-0010, D-108; REQ-LOG-009, REQ-ACC-004): the foods a meal text names,
// read by the one AI module. The caller's own reading only: the path and body name no user.
// Order: the parser is set up (else 503), the body is valid, then consent is checked immediately
// before the call (invariant #3). Each reading made is counted by day; there is no daily limit (the
// owner, D-108: OpenAI's monthly spending limit is the only cap). The text and the answer are never
// logged (invariant #7).
import {
  AI_CONSENT_TEXT_VERSION,
  API_BASE_PATH,
  istToday,
  mealParseRequestSchema,
  validationDetails,
  type IstDay,
  type MealParseResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { MealParserFailed, type MealParser } from '../ai/mealParser.ts';
import { ApiError } from '../errors.ts';
import { latestAiConsent } from './aiConsent.ts';

type Queryable = Pick<pg.Pool, 'query'>;

export function registerAiMealParseRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; mealParser: MealParser | null },
) {
  app.post(`${API_BASE_PATH}/ai/meal-parse`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    // No key in the settings: unavailable, as the other optional services.
    if (!deps.mealParser) throw new ApiError('SERVICE_UNAVAILABLE');

    const parsed = mealParseRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    // Consent given on the current text, read right before the call (invariant #3, D-108).
    const consent = await latestAiConsent(deps.db, account.id);
    if (!consent?.consented || consent.textVersion !== AI_CONSENT_TEXT_VERSION) throw new ApiError('AI_CONSENT_REQUIRED');

    let answer: MealParseResponse;
    try {
      answer = await deps.mealParser.parse(parsed.data.text);
    } catch (error) {
      // The kind of failure and the provider's code only; never the text or the answer.
      const failed = error instanceof MealParserFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai reading failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return answer;
  });
}

/** Counts a reading made, by user and India day; never refuses (no daily limit, D-108). */
export async function countReading(db: Queryable, userId: string, day: IstDay): Promise<void> {
  await db.query(
    `insert into app.ai_readings as r (user_id, day, count) values ($1, $2, 1)
     on conflict (user_id, day) do update set count = least(r.count + 1, 1000)`,
    [userId, day],
  );
}
