import { AGE_CONFIRMATION_TEXT_VERSION, type MeResponse } from '@fitsphere/shared';
import { callApi } from '../api/client';

// Sign-up, sign-in and account setup (api-conventions "Sign-in flows"; REQ-ACC-010, D-11, D-18).
// The app talks to Supabase Auth for the session and to the FitSphere API for the account.

type ErrorLike = { name?: string; code?: string | undefined; status?: number | undefined } | null;

export type MinimalSession = {
  access_token: string;
  user: { id: string; email?: string | undefined; user_metadata: Record<string, unknown> };
};

type SessionResult = Promise<{ data: { session: MinimalSession | null }; error: ErrorLike }>;

/** The part of supabase-js's `auth` client the app uses; tests pass a fake. */
export type AuthClient = {
  signUp(credentials: {
    email: string;
    password: string;
    options: { emailRedirectTo: string; data: object };
  }): Promise<{ error: ErrorLike }>;
  signInWithPassword(credentials: { email: string; password: string }): SessionResult;
  signOut(options: { scope: 'local' | 'others' }): Promise<{ error: ErrorLike }>;
  getSession(): SessionResult;
  refreshSession(): SessionResult;
  updateUser(attributes: { data?: object; password?: string }): Promise<{ error: ErrorLike }>;
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: ErrorLike }>;
  exchangeCodeForSession(code: string): SessionResult;
  onAuthStateChange(callback: (event: string, session: MinimalSession | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
};

export type AuthDeps = { client: AuthClient; apiUrl: string | undefined; fetchImpl?: typeof fetch };

/** Where the verify email's link opens the app (redirect URL `fitsphere://**` in Supabase). */
export const VERIFIED_REDIRECT = 'fitsphere://verified';
/** Where the reset email's link opens the app. */
export const RESET_REDIRECT = 'fitsphere://reset-password';

// supabase-js reports a request that never reached Supabase as AuthRetryableFetchError, status 0.
function isOffline(error: ErrorLike): boolean {
  return error?.name === 'AuthRetryableFetchError' && !error.status;
}

/**
 * Sign up with the "I am 18 or older" confirmation in the user's metadata, so account setup on
 * any phone can send it. Whatever Supabase answers, the app shows the same neutral text; only a
 * request that never left the phone gets the "needs an internet connection" warning.
 */
export async function signUp(deps: AuthDeps, email: string, password: string): Promise<'sent' | 'offline'> {
  try {
    const { error } = await deps.client.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: VERIFIED_REDIRECT,
        data: { age_confirmed: true, age_confirmation_text_version: AGE_CONFIRMATION_TEXT_VERSION },
      },
    });
    return isOffline(error) ? 'offline' : 'sent';
  } catch {
    return 'offline';
  }
}

export type SignInResult = 'signedIn' | 'failed' | 'offline' | 'unavailable';

/** An unverified account gets the same failure text as a wrong password (error model, Q-080). */
export async function signIn(deps: AuthDeps, email: string, password: string): Promise<SignInResult> {
  try {
    const { data, error } = await deps.client.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (isOffline(error)) return 'offline';
    if (error && ((error.status ?? 0) >= 500 || error.code === 'over_request_rate_limit')) return 'unavailable';
    return data.session ? 'signedIn' : 'failed';
  } catch {
    return 'offline';
  }
}

export type AccountState =
  | { kind: 'ready'; me: MeResponse }
  | { kind: 'needsAgeConfirmation' }
  | { kind: 'emailNotVerified' }
  | { kind: 'signedOut' }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

/**
 * Makes sure the FitSphere account exists: `GET /v1/me`, and account setup with the confirmation
 * from the user's metadata when it is missing. `ageConfirmedNow` is set when the user has just
 * ticked "I am 18 or older" on this phone.
 */
export async function ensureAccount(deps: AuthDeps, ageConfirmedNow = false): Promise<AccountState> {
  let session = (await deps.client.getSession()).data.session;
  if (!session) return { kind: 'signedOut' };

  let me = await callApi<MeResponse>(deps.apiUrl, '/me', options(deps, session));
  if (me.kind === 'error' && me.status === 401) {
    // Refresh the session once and retry; if it fails again, sign in again (error model).
    session = (await deps.client.refreshSession()).data.session;
    if (!session) return signOutLocally(deps);
    me = await callApi<MeResponse>(deps.apiUrl, '/me', options(deps, session));
    if (me.kind === 'error' && me.status === 401) return signOutLocally(deps);
  }
  if (me.kind === 'ok') return { kind: 'ready', me: me.body };
  if (me.kind === 'offline') return { kind: 'offline' };
  if (me.code !== 'ACCOUNT_SETUP_REQUIRED') return { kind: 'unavailable' };

  const metadata = session.user.user_metadata;
  const version =
    metadata.age_confirmed === true && typeof metadata.age_confirmation_text_version === 'string'
      ? metadata.age_confirmation_text_version
      : ageConfirmedNow
        ? AGE_CONFIRMATION_TEXT_VERSION
        : null;
  if (!version) return { kind: 'needsAgeConfirmation' };

  const setup = await callApi<MeResponse>(deps.apiUrl, '/me', {
    ...options(deps, session),
    method: 'POST',
    body: { ageConfirmed: true, ageConfirmationTextVersion: version },
  });
  if (setup.kind === 'ok') {
    if (ageConfirmedNow) {
      // Kept in the metadata so another phone does not ask again; not needed for this setup.
      await deps.client
        .updateUser({ data: { age_confirmed: true, age_confirmation_text_version: version } })
        .catch(() => undefined);
    }
    return { kind: 'ready', me: setup.body };
  }
  if (setup.kind === 'offline') return { kind: 'offline' };
  if (setup.code === 'EMAIL_NOT_VERIFIED') return { kind: 'emailNotVerified' };
  if (setup.code === 'AGE_CONFIRMATION_REQUIRED') return { kind: 'needsAgeConfirmation' };
  return { kind: 'unavailable' };
}

/** Forgot password: whatever Supabase answers, the app shows the same neutral text (D-11). */
export async function requestPasswordReset(deps: AuthDeps, email: string): Promise<'sent' | 'offline'> {
  try {
    const { error } = await deps.client.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: RESET_REDIRECT,
    });
    return isOffline(error) ? 'offline' : 'sent';
  } catch {
    return 'offline';
  }
}

/**
 * Opens the reset link: trades its one-time code for a session. The code works only on the phone
 * that asked for the reset, which holds the matching PKCE verifier (MVP default).
 */
export async function startPasswordReset(
  deps: AuthDeps,
  code: string | undefined,
): Promise<'ready' | 'invalid' | 'offline'> {
  if (!code) return 'invalid';
  try {
    const { data, error } = await deps.client.exchangeCodeForSession(code);
    if (isOffline(error)) return 'offline';
    return data.session ? 'ready' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export type NewPasswordResult = 'changed' | 'samePassword' | 'failed' | 'offline';

export async function setNewPassword(deps: AuthDeps, password: string): Promise<NewPasswordResult> {
  try {
    const { error } = await deps.client.updateUser({ password });
    if (!error) return 'changed';
    if (isOffline(error)) return 'offline';
    return error.code === 'same_password' ? 'samePassword' : 'failed';
  } catch {
    return 'offline';
  }
}

export type ChangePasswordResult = 'changed' | 'wrongPassword' | 'samePassword' | 'failed' | 'offline';

/**
 * Change password (REQ-ACC-007; MVP default, D-S1). The current password is checked by signing in
 * again, which also gives Supabase the recent sign-in it may ask for; then the new password is set
 * and the user's other devices are signed out. This phone stays signed in as the same user.
 */
export async function changePassword(
  deps: AuthDeps,
  email: string,
  current: string,
  next: string,
): Promise<ChangePasswordResult> {
  const check = await signIn(deps, email, current);
  if (check === 'offline') return 'offline';
  if (check === 'unavailable') return 'failed';
  if (check === 'failed') return 'wrongPassword';
  const result = await setNewPassword(deps, next);
  if (result !== 'changed') return result;
  await deps.client.signOut({ scope: 'others' }).catch(() => undefined);
  return 'changed';
}

export async function signOutLocally(deps: AuthDeps): Promise<{ kind: 'signedOut' }> {
  await deps.client.signOut({ scope: 'local' }).catch(() => undefined);
  return { kind: 'signedOut' };
}

function options(deps: AuthDeps, session: MinimalSession) {
  return { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
}
