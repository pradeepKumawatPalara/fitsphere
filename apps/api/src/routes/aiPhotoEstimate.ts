// POST /v1/ai/photo-estimate (D-120, ADR-0012; REQ-LOG-006, REQ-LOG-009): the foods a photo of a meal
// shows, each with its amount, weight and values per 100 g, estimated by the one AI module. The caller's
// own reading only: the path and body name no user. Order: the estimator is set up (else 503), the body
// is valid, then the user's Settings are read right before the call: there is no consent step for a
// photo (ADR-0012), but a user who switched AI meal reading off is not read (answered AI_CONSENT_REQUIRED,
// which the phone shows as "AI reading is off"). Each reading is counted by day, with no daily limit
// (D-115). The photo and the answer are never logged (invariant #7), and nothing is stored.
import { API_BASE_PATH, istToday, photoParseRequestSchema, validationDetails, type PhotoEstimateResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { PhotoEstimatorFailed, type PhotoEstimator } from '../ai/photoEstimator.ts';
import { ApiError } from '../errors.ts';
import { latestAiConsent } from './aiConsent.ts';
import { countReading } from './aiMealParse.ts';
import { PHOTO_PARSE_BODY_LIMIT } from './aiPhotoParse.ts';

export function registerAiPhotoEstimateRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; photoEstimator: PhotoEstimator | null },
) {
  app.post(`${API_BASE_PATH}/ai/photo-estimate`, { config: { access: 'account' }, bodyLimit: PHOTO_PARSE_BODY_LIMIT }, async (request) => {
    const account = requireAccount(request);
    if (!deps.photoEstimator) throw new ApiError('SERVICE_UNAVAILABLE');

    const parsed = photoParseRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    // Never chosen, or chosen on an older text: no question is asked for a photo. A recorded "off" holds.
    const setting = await latestAiConsent(deps.db, account.id);
    if (setting && !setting.consented) throw new ApiError('AI_CONSENT_REQUIRED');

    let answer: PhotoEstimateResponse;
    try {
      answer = await deps.photoEstimator.estimate(parsed.data.imageBase64);
    } catch (error) {
      // The kind of failure and the provider's code only; never the photo or the answer.
      const failed = error instanceof PhotoEstimatorFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai photo estimate failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return answer;
  });
}
