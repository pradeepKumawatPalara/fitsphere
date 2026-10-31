import { AI_CONSENT_TEXT_VERSION, aiConsentResponseSchema, type AiConsentResponse } from '@fitsphere/shared';
import type { AuthDeps } from '../auth/service';
import { callApi, type ApiResult } from './client';

// The account calls of the Settings slice (api-conventions; D-S1): the AI consent record
// (REQ-ACC-004) and deleting the account (REQ-ACC-009). Both are online only.

export type AiConsent = AiConsentResponse['aiConsent'];

/** Calls the API with the session's token, refreshing it once after a 401 (error model). */
async function withSession<T>(
  deps: AuthDeps,
  call: (token: string) => Promise<ApiResult<T>>,
): Promise<ApiResult<T> | { kind: 'signedOut' }> {
  let session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };
  let result = await call(session.access_token);
  if (result.kind === 'error' && result.status === 401) {
    session = (await deps.client.refreshSession()).data.session;
    if (!session) return { kind: 'signedOut' };
    result = await call(session.access_token);
  }
  return result;
}

function options(deps: AuthDeps, token: string) {
  return { token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
}

/** The user's current AI consent: the latest record, or null when they have never chosen (AI off). */
export async function readAiConsent(deps: AuthDeps): Promise<{ kind: 'ok'; consent: AiConsent } | { kind: 'offline' | 'failed' }> {
  const result = await withSession(deps, (token) => callApi<unknown>(deps.apiUrl, '/me/ai-consent', options(deps, token)));
  if (result.kind === 'offline') return { kind: 'offline' };
  if (result.kind !== 'ok') return { kind: 'failed' };
  const parsed = aiConsentResponseSchema.safeParse(result.body);
  return parsed.success ? { kind: 'ok', consent: parsed.data.aiConsent } : { kind: 'failed' };
}

/** Records the user turning AI meal reading on or off, with the version of the text shown. */
export async function saveAiConsent(
  deps: AuthDeps,
  consented: boolean,
): Promise<{ kind: 'ok'; consent: AiConsent } | { kind: 'offline' | 'failed' }> {
  const result = await withSession(deps, (token) =>
    callApi<unknown>(deps.apiUrl, '/me/ai-consent', {
      ...options(deps, token),
      method: 'PUT',
      body: { consented, textVersion: AI_CONSENT_TEXT_VERSION },
    }),
  );
  if (result.kind === 'offline') return { kind: 'offline' };
  if (result.kind !== 'ok') return { kind: 'failed' };
  const parsed = aiConsentResponseSchema.safeParse(result.body);
  return parsed.success ? { kind: 'ok', consent: parsed.data.aiConsent } : { kind: 'failed' };
}

/**
 * Deletes the account: the user's data, files and sign-in account (`DELETE /v1/me`). `unavailable`
 * when the server could not finish; calling again finishes it.
 */
export async function deleteAccount(deps: AuthDeps): Promise<'deleted' | 'offline' | 'unavailable' | 'signedOut'> {
  const result = await withSession(deps, (token) => callApi<unknown>(deps.apiUrl, '/me', { ...options(deps, token), method: 'DELETE' }));
  if (result.kind === 'ok') return 'deleted';
  if (result.kind === 'offline' || result.kind === 'signedOut') return result.kind;
  return 'unavailable';
}
