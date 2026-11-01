// The one module that talks to Supabase Auth (ADR-0004 rule 3, api-conventions "Authentication").
// Replacing the sign-in provider means replacing this file.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from './errors.ts';

/** Who signed in: the provider's user ID (the token's `sub`) and the token, kept only for the
 * account-setup call to Supabase. Neither is ever logged. */
export type Identity = { subject: string; token: string };

export type SignedInUser = { subject: string; email: string | null; emailConfirmed: boolean };

export type Auth = {
  /** Checks a Supabase access token. Throws AUTH_REQUIRED, or SERVICE_UNAVAILABLE when the
   * signing keys cannot be fetched. */
  verify(token: string): Promise<Identity>;
  /** Reads the signed-in user from Supabase Auth with the caller's own token. Used only at
   * account setup, for the confirmed email (Supabase tokens carry no "email verified" claim). */
  readSignedInUser(identity: Identity): Promise<SignedInUser>;
  /** Whether sign-in accounts can be deleted: only with the secret key (D-31 answer 4). */
  readonly canDeleteUsers: boolean;
  /** Deletes the Supabase sign-in account for good (REQ-ACC-009). A user already gone counts as
   * deleted. Throws SERVICE_UNAVAILABLE without the secret key, or when Supabase does not delete
   * it. */
  deleteUser(subject: string): Promise<void>;
};

type Options = {
  supabaseUrl: string;
  publishableKey: string;
  /** The secret key (`sb_secret_…`): server only, used for nothing but deleting a sign-in account
   * (D-31 answer 4). Without it, accounts cannot be deleted. Never logged. */
  secretKey?: string;
  /** The project's signing keys; tests pass their own. */
  keySet?: JWTVerifyGetKey;
  fetch?: typeof fetch;
};

// Asymmetric keys only: the legacy shared-secret (HS256) method is not accepted.
const ALGORITHMS = ['ES256', 'RS256'];
const SUPABASE_TIMEOUT_MS = 5000;

export function createSupabaseAuth(options: Options): Auth {
  const authUrl = `${options.supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  const fetchImpl = options.fetch ?? fetch;

  return {
    async verify(token) {
      let payload;
      try {
        ({ payload } = await jwtVerify(token, keySet, {
          issuer: authUrl,
          audience: 'authenticated',
          algorithms: ALGORITHMS,
          requiredClaims: ['sub', 'exp'],
        }));
      } catch (error) {
        throw keysUnavailable(error) ? new ApiError('SERVICE_UNAVAILABLE') : new ApiError('AUTH_REQUIRED');
      }
      if (payload.role !== 'authenticated' || payload.is_anonymous === true || !payload.sub) {
        throw new ApiError('AUTH_REQUIRED');
      }
      return { subject: payload.sub, token };
    },

    async readSignedInUser(identity) {
      let response: Response;
      try {
        response = await fetchImpl(`${authUrl}/user`, {
          headers: { apikey: options.publishableKey, Authorization: `Bearer ${identity.token}` },
          signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
        });
      } catch {
        throw new ApiError('SERVICE_UNAVAILABLE');
      }
      if (response.status === 401 || response.status === 403) throw new ApiError('AUTH_REQUIRED');
      if (!response.ok) throw new ApiError('SERVICE_UNAVAILABLE');
      const user = (await response.json()) as { id?: unknown; email?: unknown; email_confirmed_at?: unknown };
      if (user.id !== identity.subject) throw new ApiError('AUTH_REQUIRED');
      return {
        subject: identity.subject,
        email: typeof user.email === 'string' && user.email !== '' ? user.email.toLowerCase() : null,
        emailConfirmed: typeof user.email_confirmed_at === 'string' && user.email_confirmed_at !== '',
      };
    },

    canDeleteUsers: Boolean(options.secretKey),

    // Supabase Auth's admin "delete user", as supabase-js's `auth.admin.deleteUser(id)` sends it:
    // a hard delete, not a soft one. Supabase's API-keys guide says a secret key goes on the
    // `apikey` header, never as a Bearer token, because it is not a JWT.
    async deleteUser(subject) {
      if (!options.secretKey) throw new ApiError('SERVICE_UNAVAILABLE');
      let response: Response;
      try {
        response = await fetchImpl(`${authUrl}/admin/users/${encodeURIComponent(subject)}`, {
          method: 'DELETE',
          headers: { apikey: options.secretKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ should_soft_delete: false }),
          signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
        });
      } catch {
        throw new ApiError('SERVICE_UNAVAILABLE');
      }
      if (response.ok || response.status === 404) return;
      throw new ApiError('SERVICE_UNAVAILABLE');
    },
  };
}

// The key list could not be fetched or read: not the caller's fault.
function keysUnavailable(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return true;
  return error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid;
}
