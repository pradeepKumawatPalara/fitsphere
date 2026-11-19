// POST /v1/ai/barcode-estimate (ADR-0010's amendment, D-117; REQ-LOG-007, REQ-ACC-004): an estimate of a
// packaged product's values per 100 g, for a barcode found nowhere and not in FitSphere's own list.
// The caller's own reading only: the path and body name no user. Order: the estimator is set up (else
// 503), the body is valid, then consent is checked immediately before the call (invariant #3). The
// reading is counted by day; nothing is stored (the shared barcode table stays real data only), and
// the name, barcode and answer are never logged (invariant #7).
import {
  AI_CONSENT_TEXT_VERSION,
  API_BASE_PATH,
  barcodeEstimateRequestSchema,
  istToday,
  validationDetails,
  type BarcodeEstimateResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { requireAccount } from '../access.ts';
import { ProductEstimatorFailed, type ProductEstimator } from '../ai/productEstimator.ts';
import { ApiError } from '../errors.ts';
import { latestAiConsent } from './aiConsent.ts';
import { countReading } from './aiMealParse.ts';

export function registerAiBarcodeEstimateRoute(
  app: FastifyInstance,
  deps: { db: pg.Pool; now: () => Date; productEstimator: ProductEstimator | null },
) {
  app.post(`${API_BASE_PATH}/ai/barcode-estimate`, { config: { access: 'account' } }, async (request) => {
    const account = requireAccount(request);
    if (!deps.productEstimator) throw new ApiError('SERVICE_UNAVAILABLE');

    const parsed = barcodeEstimateRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.body));

    // Consent given on the current text, read right before the call (invariant #3).
    const consent = await latestAiConsent(deps.db, account.id);
    if (!consent?.consented || consent.textVersion !== AI_CONSENT_TEXT_VERSION) throw new ApiError('AI_CONSENT_REQUIRED');

    let answer: BarcodeEstimateResponse;
    try {
      answer = await deps.productEstimator.estimate(parsed.data);
    } catch (error) {
      // The kind of failure and the provider's code only; never the name, barcode or answer.
      const failed = error instanceof ProductEstimatorFailed ? error : null;
      request.log.warn({ reason: failed?.reason ?? 'unexpected', providerCode: failed?.code ?? null }, 'ai estimate failed');
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    await countReading(deps.db, account.id, istToday(deps.now()));
    return answer;
  });
}
