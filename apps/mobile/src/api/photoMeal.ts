import { photoEstimateResponseSchema, type PhotoEstimateItem } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi } from './client';

export type PhotoReading =
  | { kind: 'ok'; items: PhotoEstimateItem[] }
  /** AI meal reading is switched off in Settings: the photo is not read (ADR-0012). */
  | { kind: 'off' }
  | { kind: 'offline' }
  /** No key on the server, OpenAI failing or at its limit, or any other answer. */
  | { kind: 'unavailable' };

/** Longer than the server's wait for OpenAI (30 s), so the server's answer arrives first. */
export const PHOTO_READING_TIMEOUT_MS = 35_000;

// POST /v1/ai/photo-estimate (D-120, ADR-0012): the shrunk picture leaves the phone, as base64, with no
// consent step; a user who switched AI meal reading off in Settings is refused by the server. The answer
// gives each food seen with its amount, its weight and its values per 100 g: an estimate. One session
// refresh after a 401 (error model). The picture is not kept by the phone or saved to the meal.
export async function estimatePhoto(auth: AuthDeps, imageBase64: string): Promise<PhotoReading> {
  return estimateFrom(auth, '/ai/photo-estimate', { imageBase64 });
}

// POST /v1/ai/voice-estimate (voice, owner 2026-11-24): only the words of a spoken meal leave the phone,
// never audio, with no consent step; the answer is the same estimate as a photo's. A user who switched AI
// meal reading off in Settings is refused by the server.
export async function estimateSpoken(auth: AuthDeps, text: string): Promise<PhotoReading> {
  return estimateFrom(auth, '/ai/voice-estimate', { text });
}

async function estimateFrom(auth: AuthDeps, path: string, body: Record<string, string>): Promise<PhotoReading> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'unavailable' };
    const response = await callApi<unknown>(auth.apiUrl, path, {
      method: 'POST',
      token: session.access_token,
      body,
      timeoutMs: PHOTO_READING_TIMEOUT_MS,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      if (response.code === 'AI_CONSENT_REQUIRED') return { kind: 'off' };
      return { kind: 'unavailable' };
    }
    const parsed = photoEstimateResponseSchema.safeParse(response.body);
    return parsed.success ? { kind: 'ok', items: parsed.data.items } : { kind: 'unavailable' };
  }
  return { kind: 'unavailable' };
}
