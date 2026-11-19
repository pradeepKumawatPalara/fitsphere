import { barcodeEstimateResponseSchema, type BarcodeEstimateResponse } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type ProductEstimate =
  | { kind: 'ok'; estimate: BarcodeEstimateResponse }
  /** Consent not given on the current text: ask once. */
  | { kind: 'consent' }
  | { kind: 'offline' }
  /** No key on the server, OpenAI failing or at its limit, an answer out of contract, or any other answer. */
  | { kind: 'unavailable' };

/** Longer than the server's 12 seconds for OpenAI, so the server's answer arrives first. */
export const PRODUCT_ESTIMATE_TIMEOUT_MS = 20_000;

// POST /v1/ai/barcode-estimate (ADR-0010's amendment, D-117): only the barcode and the name the user
// typed leave the phone. One session refresh after a 401 (error model).
export async function estimateProduct(auth: AuthDeps, barcode: string, name: string): Promise<ProductEstimate> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, '/ai/barcode-estimate', {
      method: 'POST',
      token: session.access_token,
      body: { barcode, name },
      timeoutMs: PRODUCT_ESTIMATE_TIMEOUT_MS,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      if (response.code === 'AI_CONSENT_REQUIRED') return { kind: 'consent' };
      return { kind: 'unavailable' };
    }
    const parsed = barcodeEstimateResponseSchema.safeParse(response.body);
    return parsed.success ? { kind: 'ok', estimate: parsed.data } : { kind: 'unavailable' };
  }
  return { kind: 'unavailable' };
}
