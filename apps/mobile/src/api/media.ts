import { mediaLinksSchema, meResponseSchema, type MediaLinks } from '@fitsphere/shared';
import type { AuthDeps, MinimalSession } from '../auth/service';
import type { SqlDb } from '../local/sql';
import { getMeta, setMeta } from '../local/store';
import { callApi } from './client';

export type LinksOutcome = { kind: 'ok'; links: MediaLinks } | { kind: 'notFound' } | { kind: 'offline' } | { kind: 'failed' };

// Links for one meal photo's files (api-conventions, "/v1/users/{userId}/media/{mediaId}"):
// upload links, or viewing links that work for 5 minutes. A link is used at once and never
// stored or logged (ADR-0002 rule 3). One session refresh after a 401 (error model).
export async function mediaLinks(db: SqlDb, auth: AuthDeps, mediaId: string, purpose: 'upload' | 'view'): Promise<LinksOutcome> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session =
      attempt === 0 ? (await auth.client.getSession()).data.session : (await auth.client.refreshSession()).data.session;
    if (!session) return { kind: 'failed' };
    const accountId = await fitSphereId(db, auth, session);
    if (accountId === 'offline' || accountId === 'failed') return { kind: accountId };
    const path = `/users/${accountId}/media/${mediaId}${purpose === 'upload' ? '/upload' : ''}`;
    const response = await callApi<unknown>(auth.apiUrl, path, {
      method: purpose === 'upload' ? 'POST' : 'GET',
      token: session.access_token,
      ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
    });
    if (response.kind === 'offline') return { kind: 'offline' };
    if (response.kind === 'error') {
      if (response.status === 401 && attempt === 0) continue;
      return { kind: response.status === 404 ? 'notFound' : 'failed' };
    }
    const parsed = mediaLinksSchema.safeParse(response.body);
    return parsed.success ? { kind: 'ok', links: parsed.data } : { kind: 'failed' };
  }
  return { kind: 'failed' };
}

/** The user's FitSphere ID, which the API's paths use; asked once (GET /v1/me) and kept. */
async function fitSphereId(db: SqlDb, auth: AuthDeps, session: MinimalSession): Promise<string | 'offline' | 'failed'> {
  const kept = await getMeta(db, 'account_id');
  if (kept) return kept;
  const me = await callApi<unknown>(auth.apiUrl, '/me', {
    token: session.access_token,
    ...(auth.fetchImpl ? { fetchImpl: auth.fetchImpl } : {}),
  });
  if (me.kind === 'offline') return 'offline';
  const parsed = me.kind === 'ok' ? meResponseSchema.safeParse(me.body) : null;
  if (!parsed?.success) return 'failed';
  await setMeta(db, 'account_id', parsed.data.user.id);
  return parsed.data.user.id;
}
