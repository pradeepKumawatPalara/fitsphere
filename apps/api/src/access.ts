// The access module (invariant #1, ADR-0004 rule 4, api-conventions "Authorization").
// Every route declares its rule in its config; a route without one cannot be registered, and
// anything a rule does not allow is refused.
import type { Role } from '@fitsphere/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { findAccount, type Account } from './accounts.ts';
import type { Auth, Identity } from './auth.ts';
import { ApiError } from './errors.ts';

/**
 * - `public`: no token (only `GET /v1/health`).
 * - `signedIn`: a valid token; the account may not be set up yet (`/v1/me`).
 * - `account`: a valid token and a set-up account; anything else answers
 *   `403 ACCOUNT_SETUP_REQUIRED`.
 */
export type AccessRule = 'public' | 'signedIn' | 'account';

export type RegisteredRoute = { method: string; url: string; access: AccessRule };

declare module 'fastify' {
  interface FastifyContextConfig {
    access?: AccessRule;
  }
  interface FastifyRequest {
    identity: Identity | null;
    account: Account | null;
  }
  interface FastifyInstance {
    registeredRoutes: RegisteredRoute[];
  }
}

export function registerAccess(app: FastifyInstance, deps: { auth: Auth; db: Pick<pg.Pool, 'query'> }) {
  const routes: RegisteredRoute[] = [];
  app.decorate('registeredRoutes', routes);
  app.decorateRequest('identity', null);
  app.decorateRequest('account', null);

  app.addHook('onRoute', (route) => {
    const access = route.config?.access;
    if (!access) throw new Error(`${String(route.method)} ${route.url} has no access rule`);
    for (const method of [route.method].flat()) routes.push({ method, url: route.url, access });
  });

  app.addHook('onRequest', async (request) => {
    if (request.is404) return;
    const access = request.routeOptions.config.access;
    if (access === 'public') return;

    request.identity = await deps.auth.verify(bearerToken(request));
    if (access === 'signedIn') return;

    request.account = await findAccount(deps.db, request.identity.subject);
    if (!request.account) throw new ApiError('ACCOUNT_SETUP_REQUIRED');
  });
}

/** The caller's identity, for handlers behind `signedIn` or `account`. */
export function requireIdentity(request: FastifyRequest): Identity {
  if (!request.identity) throw new ApiError('AUTH_REQUIRED');
  return request.identity;
}

/** The caller's account, for handlers behind `account`. */
export function requireAccount(request: FastifyRequest): Account {
  if (!request.account) throw new ApiError('ACCOUNT_SETUP_REQUIRED');
  return request.account;
}

/** Roles the account has turned on; the app's active role is never used (REQ-ROLE-002). */
export function hasRole(account: Account, role: Role): boolean {
  return account.roles.includes(role);
}

/**
 * Who may read a person's weigh-ins (permission matrix, body metrics). MVP (D-20): only the
 * person themselves. Anyone else gets 404, exactly as for a user that does not exist (T-01).
 * Post-MVP (backlog B-19, B-20): their coach with an active link, and a Head Coach the trainee
 * allows, read-only.
 */
export function authorizeWeighInRead(caller: Account, userId: string): void {
  if (caller.id !== userId) throw new ApiError('NOT_FOUND');
}

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  const match = header ? /^Bearer ([^\s]+)$/i.exec(header) : null;
  if (!match?.[1]) throw new ApiError('AUTH_REQUIRED');
  return match[1];
}
