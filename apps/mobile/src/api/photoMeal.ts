import { mealParseResponseSchema, type ParsedMealItem } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type PhotoReading =
  | { kind: 'ok'; items: ParsedMealItem[] }
  /** Consent not given on the current text: ask once. */
  | { kind: 'consent' }
  | { kind: 'offline' }
  /** No key on the server, OpenAI failing or at its limit, or any other answer. */
  | { kind: 'unavailable' };

/** Longer than the server's wait for OpenAI, so the server's answer arrives first. */
export const PHOTO_READING_TIMEOUT_MS = 25_000;

// POST /v1/ai/photo-parse (D-118): the shrunk picture leaves the phone, as base64, only after consent
// on the current text; the answer names the foods seen, never nutrition. One session refresh after a
// 401 (error model). The picture is not kept by the phone or saved to the meal.
export async function readPhoto(auth: AuthDeps, imageBase64: string): Promise<PhotoReading> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, '/ai/photo-parse', {
      method: 'POST',
      token: session.access_token,
      body: { imageBase64 },
      timeoutMs: PHOTO_READING_TIMEOUT_MS,
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
