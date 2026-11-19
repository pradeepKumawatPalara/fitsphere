import { foodLookupResponseSchema, type FoodLookupResponse } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type FoodLookup =
  | { kind: 'ok'; food: FoodLookupResponse }
  /** Consent not given on the current text. */
  | { kind: 'consent' }
  | { kind: 'offline' }
  /** Nothing found, no key on the server, OpenAI failing or at its limit, or any other answer. */
  | { kind: 'unavailable' };

/** Longer than the server's waits (Open Food Facts, then OpenAI), so the server's answer arrives first. */
export const FOOD_LOOKUP_TIMEOUT_MS = 25_000;

// POST /v1/ai/food-lookup (D-118): only the food's name leaves the phone. The server tries Open Food
// Facts by name, then an AI estimate. One session refresh after a 401 (error model).
export async function lookUpFood(auth: AuthDeps, name: string): Promise<FoodLookup> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, '/ai/food-lookup', {
      method: 'POST',
      token: session.access_token,
      body: { name },
      timeoutMs: FOOD_LOOKUP_TIMEOUT_MS,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      if (response.code === 'AI_CONSENT_REQUIRED') return { kind: 'consent' };
      return { kind: 'unavailable' };
    }
    const parsed = foodLookupResponseSchema.safeParse(response.body);
    return parsed.success ? { kind: 'ok', food: parsed.data } : { kind: 'unavailable' };
  }
  return { kind: 'unavailable' };
}
