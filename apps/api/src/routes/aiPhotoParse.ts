// POST /v1/ai/photo-parse (D-118; REQ-LOG-006, REQ-LOG-009, REQ-ACC-004): the foods a photo of a meal
// shows, read by the one AI module. The caller's own reading only: the path and body name no user.
// Order: the parser is set up (else 503), the body is valid, then consent is checked immediately
// before the call (invariant #3). Each reading is counted by day, with no daily limit (D-115). The
// photo and the answer are never logged (invariant #7), and nothing is stored.
import {
  AI_CONSENT_TEXT_VERSION,
  API_BASE_PATH,
  istToday,
  photoParseRequestSchema,
  validationDetails,
  type MealParseResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { PhotoParserFailed, type PhotoParser } from '../ai/photoParser.ts';
import { ApiError } from '../errors.ts';
import { latestAiConsent } from './aiConsent.ts';
import { countReading } from './aiMealParse.ts';

/** A shrunk photo is about 270 KB as base64; the app's usual 100 KB body limit is too small for it. */
export const PHOTO_PARSE_BODY_LIMIT = 1_500_000;

export function registerAiPhotoParseRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; photoParser: PhotoParser | null },
) {
  app.post(`${API_BASE_PATH}/ai/photo-parse`, { config: { access: 'account' }, bodyLimit: PHOTO_PARSE_BODY_LIMIT }, async (request) => {
    const account = requireAccount(request);
    if (!deps.photoParser) throw new ApiError('SERVICE_UNAVAILABLE');

    const parsed = photoParseRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    // Consent given on the current text, read right before the call (invariant #3).
    const consent = await latestAiConsent(deps.db, account.id);
    if (!consent?.consented || consent.textVersion !== AI_CONSENT_TEXT_VERSION) throw new ApiError('AI_CONSENT_REQUIRED');

    let answer: MealParseResponse;
    try {
      answer = await deps.photoParser.parse(parsed.data.imageBase64);
    } catch (error) {
      // The kind of failure and the provider's code only; never the photo or the answer.
      const failed = error instanceof PhotoParserFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai photo reading failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return answer;
  });
}
