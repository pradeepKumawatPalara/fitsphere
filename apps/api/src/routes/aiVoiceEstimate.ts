// POST /v1/ai/voice-estimate (voice, owner 2026-11-24; ADR-0012's rule, extended to a spoken meal;
// REQ-LOG-009): the foods a spoken meal names, each with its amount, weight and values per 100 g,
// estimated by the one AI module (the photo estimator, given words instead of a picture). The caller's
// own reading only: the path and body name no user. Order: the estimator is set up (else 503), the body
// is valid, then the user's Settings are read right before the call: no consent step, but a user who
// switched AI meal reading off is not read (AI_CONSENT_REQUIRED, shown as "AI reading is off"). Each
// reading is counted by day, with no daily limit (D-115). The words and the answer are never logged
// (invariant #7) and nothing is stored.
import { API_BASE_PATH, istToday, mealParseRequestSchema, validationDetails, type PhotoEstimateResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { PhotoEstimatorFailed, type PhotoEstimator } from '../ai/photoEstimator.ts';
import { ApiError } from '../errors.ts';
import { latestAiConsent } from './aiConsent.ts';
import { countReading } from './aiMealParse.ts';

export function registerAiVoiceEstimateRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; photoEstimator: PhotoEstimator | null },
) {
  app.post(`${API_BASE_PATH}/ai/voice-estimate`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    if (!deps.photoEstimator) throw new ApiError('SERVICE_UNAVAILABLE');

    const parsed = mealParseRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    // Never chosen, or chosen on an older text: no question is asked. A recorded "off" holds.
    const setting = await latestAiConsent(deps.db, account.id);
    if (setting && !setting.consented) throw new ApiError('AI_CONSENT_REQUIRED');

    let answer: PhotoEstimateResponse;
    try {
      answer = await deps.photoEstimator.estimateText(parsed.data.text);
    } catch (error) {
      const failed = error instanceof PhotoEstimatorFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai voice estimate failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return answer;
  });
}
