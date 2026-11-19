// POST /v1/ai/food-lookup (D-118; REQ-LOG-009, REQ-ACC-004): a food the phone's own list does not
// have, looked up by name: Open Food Facts first (the same source as barcodes, only the name is sent),
// then an AI estimate per 100 g. The caller's own reading only. Consent is read first, whichever
// source answers, because the estimate is an AI call (invariant #3). Only an AI estimate is counted.
// Nothing is stored; the name and the answer are never logged (invariant #7).
import {
  AI_CONSENT_TEXT_VERSION,
  API_BASE_PATH,
  foodLookupRequestSchema,
  istToday,
  validationDetails,
  type BarcodeEstimateResponse,
  type FoodLookupResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ProductEstimatorFailed, type ProductEstimator } from '../ai/productEstimator.ts';
import { ApiError } from '../errors.ts';
import type { FoodNameSource } from '../foods/openFoodFacts.ts';
import { latestAiConsent } from './aiConsent.ts';
import { countReading } from './aiMealParse.ts';

export function registerAiFoodLookupRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; foodNames: FoodNameSource; productEstimator: ProductEstimator | null },
) {
  app.post(`${API_BASE_PATH}/ai/food-lookup`, { config: { access: 'account' } }, async (request): Promise<FoodLookupResponse> => {
    const account = requireAccount(request);

    const parsed = foodLookupRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    const consent = await latestAiConsent(deps.db, account.id);
    if (!consent?.consented || consent.textVersion !== AI_CONSENT_TEXT_VERSION) throw new ApiError('AI_CONSENT_REQUIRED');

    const listed = await deps.foodNames.searchByName(parsed.data.name);
    if (listed) return { ...listed, source: 'open_food_facts' };

    // Not in Open Food Facts: an AI estimate, or unavailable when there is no key or it fails.
    if (!deps.productEstimator) throw new ApiError('SERVICE_UNAVAILABLE');
    let estimate: BarcodeEstimateResponse;
    try {
      estimate = await deps.productEstimator.estimate({ name: parsed.data.name });
    } catch (error) {
      const failed = error instanceof ProductEstimatorFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai food lookup failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return { ...estimate, source: 'ai_estimate' };
  });
}
