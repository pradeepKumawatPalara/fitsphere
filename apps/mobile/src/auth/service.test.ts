import { apiError, deps, fakeApi, fakeAuthClient, fakeSession, ME, OFFLINE } from '../testing/fakes';
import { ensureAccount, signIn, signUp, VERIFIED_REDIRECT } from './service';

describe('REQ-ACC-010 sign-up', () => {
  it('REQ-ACC-010 sends the 18+ confirmation and its text version in the user metadata', async () => {
    const client = fakeAuthClient();

    await signUp(deps(client, fakeApi({}).fetchImpl), ' Someone@Example.test ', 'password1');

    expect(client.signUp).toHaveBeenCalledWith({
      email: 'someone@example.test',
      password: 'password1',
      options: {
        emailRedirectTo: VERIFIED_REDIRECT,
        data: { age_confirmed: true, age_confirmation_text_version: '2026-10-27' },
      },
    });
  });

  it.each([
    ['a new address', null],
    ['an already registered address (obfuscated user, no error)', null],
    ['an address outside the team', { name: 'AuthApiError', code: 'email_address_not_authorized', status: 400 }],
    ['the email rate limit', { name: 'AuthApiError', code: 'over_email_send_rate_limit', status: 429 }],
    ['a Supabase failure', { name: 'AuthRetryableFetchError', status: 503 }],
  ])('D-11 gives the same result for %s', async (_case, error) => {
    const client = fakeAuthClient();
    client.signUp.mockResolvedValueOnce({ error });

    expect(await signUp(deps(client, fakeApi({}).fetchImpl), 'someone@example.test', 'password1')).toBe('sent');
  });

  it('ADR-0007 rule 6 reports a request that never left the phone as offline', async () => {
    const client = fakeAuthClient();
    client.signUp.mockResolvedValueOnce({ error: OFFLINE });

    expect(await signUp(deps(client, fakeApi({}).fetchImpl), 'someone@example.test', 'password1')).toBe('offline');
  });
});

describe('REQ-ACC-010 sign-in', () => {
  it.each([
    ['a wrong password', { name: 'AuthApiError', code: 'invalid_credentials', status: 400 }, 'failed'],
    ['an unverified email (Q-080)', { name: 'AuthApiError', code: 'email_not_confirmed', status: 400 }, 'failed'],
    ['no connection', OFFLINE, 'offline'],
    ['a Supabase failure', { name: 'AuthApiError', status: 500 }, 'unavailable'],
  ])('REQ-ACC-010 %s', async (_case, error, expected) => {
    const client = fakeAuthClient();
    client.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error });

    expect(await signIn(deps(client, fakeApi({}).fetchImpl), 'someone@example.test', 'password1')).toBe(expected);
  });
});

describe('REQ-ACC-010 account setup', () => {
  const confirmed = { age_confirmed: true, age_confirmation_text_version: '2026-10-27' };

  it('REQ-ACC-010 is ready when the account exists', async () => {
    const api = fakeApi({ 'GET /me': { status: 200, body: ME } });

    const state = await ensureAccount(deps(fakeAuthClient(fakeSession(confirmed)), api.fetchImpl));

    expect(state).toEqual({ kind: 'ready', me: ME });
    expect(api.calls[0]?.token).toBe('access-token-1');
  });

  it('REQ-ACC-010 sets up the account with the confirmation and text version from the metadata', async () => {
    const api = fakeApi({
      'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'),
      'POST /me': { status: 201, body: ME },
    });

    const state = await ensureAccount(deps(fakeAuthClient(fakeSession(confirmed)), api.fetchImpl));

    expect(state.kind).toBe('ready');
    expect(api.calls[1]).toMatchObject({
      method: 'POST',
      path: '/me',
      body: { ageConfirmed: true, ageConfirmationTextVersion: '2026-10-27' },
    });
  });

  it('REQ-ACC-010 asks the 18+ question when the metadata lacks it, and creates nothing', async () => {
    const api = fakeApi({ 'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED') });

    const state = await ensureAccount(deps(fakeAuthClient(fakeSession({})), api.fetchImpl));

    expect(state).toEqual({ kind: 'needsAgeConfirmation' });
    expect(api.calls.filter((call) => call.method === 'POST')).toEqual([]);
  });

  it('REQ-ACC-010 sends a confirmation given on this phone and keeps it in the metadata', async () => {
    const client = fakeAuthClient(fakeSession({}));
    const api = fakeApi({
      'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'),
      'POST /me': { status: 201, body: ME },
    });

    const state = await ensureAccount(deps(client, api.fetchImpl), true);

    expect(state.kind).toBe('ready');
    expect(api.calls[1]?.body).toEqual({ ageConfirmed: true, ageConfirmationTextVersion: '2026-10-27' });
    expect(client.updateUser).toHaveBeenCalledWith({ data: confirmed });
  });

  it('Q-080 reports an unverified email', async () => {
    const api = fakeApi({
      'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'),
      'POST /me': apiError(403, 'EMAIL_NOT_VERIFIED'),
    });

    expect(await ensureAccount(deps(fakeAuthClient(fakeSession(confirmed)), api.fetchImpl))).toEqual({
      kind: 'emailNotVerified',
    });
  });

  it('error model: after a 401 it refreshes the session once and retries, then signs out', async () => {
    const client = fakeAuthClient(fakeSession(confirmed));
    const retried = fakeApi({ 'GET /me': [apiError(401, 'AUTH_REQUIRED'), { status: 200, body: ME }] });
    expect((await ensureAccount(deps(client, retried.fetchImpl))).kind).toBe('ready');
    expect(client.refreshSession).toHaveBeenCalledTimes(1);

    const refused = fakeApi({ 'GET /me': apiError(401, 'AUTH_REQUIRED') });
    expect(await ensureAccount(deps(client, refused.fetchImpl))).toEqual({ kind: 'signedOut' });
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('REQ-NFR-004 reports offline when the API cannot be reached', async () => {
    const api = fakeApi({ 'GET /me': 'offline' });

    expect(await ensureAccount(deps(fakeAuthClient(fakeSession(confirmed)), api.fetchImpl))).toEqual({
      kind: 'offline',
    });
  });
});
