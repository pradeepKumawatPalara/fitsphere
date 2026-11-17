import { mealParseResponseSchema, type ParsedMealItem } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type MealReading =
  | { kind: 'ok'; items: ParsedMealItem[] }
  /** Consent not given on the current text (D-115): ask once. */
  | { kind: 'consent' }
  | { kind: 'offline' }
  /**
   * Not available: no key on the server, OpenAI failing or its monthly limit reached, or any other
   * answer. There is no daily limit (D-115).
   */
  | { kind: 'unavailable' };

/** Longer than the server's 12 seconds for OpenAI, so the server's answer arrives first. */
export const MEAL_READING_TIMEOUT_MS = 20_000;

// POST /v1/ai/meal-parse (ADR-0010, D-115): only the meal text leaves the phone, never audio. One
// session refresh after a 401 (error model).
export async function readMeal(auth: AuthDeps, text: string): Promise<MealReading> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, '/ai/meal-parse', {
      method: 'POST',
      token: session.access_token,
      body: { text },
      timeoutMs: MEAL_READING_TIMEOUT_MS,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      if (response.code === 'AI_CONSENT_REQUIRED') return { kind: 'consent' };
      return { kind: 'unavailable' };
    }
    const parsed = mealParseResponseSchema.safeParse(response.body);
    return parsed.success ? { kind: 'ok', items: parsed.data.items } : { kind: 'unavailable' };
  }
  return { kind: 'unavailable' };
}
