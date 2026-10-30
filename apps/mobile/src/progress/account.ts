import { istDayOf, type IstDay, type MeResponse } from '@fitsphere/shared';
import { callApi } from '../api/client';
import type { AuthDeps } from '../auth/service';
import { getMeta, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';

/** The signed-in user's GET /v1/me, with the options for further calls; offline or failed otherwise. */
export type MeCall =
  | { kind: 'ok'; me: MeResponse; options: { token: string; fetchImpl?: typeof fetch } }
  | { kind: 'offline' }
  | { kind: 'failed' };

export async function callMe(deps: AuthDeps): Promise<MeCall> {
  const session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'failed' };
  const options = { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
  const me = await callApi<MeResponse>(deps.apiUrl, '/me', options);
  if (me.kind === 'ok') return { kind: 'ok', me: me.body, options };
  return { kind: me.kind === 'offline' ? 'offline' : 'failed' };
}

/** Keeps the IST day the account was created on this phone (Q-044) and returns it. */
export async function rememberAccountStart(db: SqlDb, me: MeResponse): Promise<IstDay> {
  const day = istDayOf(new Date(me.user.createdAt));
  await setMeta(db, 'account_created_day', day);
  return day;
}

/**
 * The IST day the account was created, for "Meals logged: X of Y days" (REQ-PRG-003, Q-044): kept
 * on the phone once read from GET /v1/me; null while it cannot be read (offline).
 */
export async function accountStartDay(db: SqlDb, deps: AuthDeps): Promise<IstDay | null> {
  const stored = await getMeta(db, 'account_created_day');
  if (stored) return stored;
  const call = await callMe(deps);
  return call.kind === 'ok' ? rememberAccountStart(db, call.me) : null;
}
