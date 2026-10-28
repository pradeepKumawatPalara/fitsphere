import type { AuthClient, AuthDeps, MinimalSession } from '../auth/service';

// Fakes for app tests: Supabase Auth and the FitSphere API. No test calls a real service.

type ErrorLike = { name?: string; code?: string; status?: number } | null;

export const OFFLINE: ErrorLike = { name: 'AuthRetryableFetchError', status: 0 };

export function fakeSession(metadata: Record<string, unknown> = {}, token = 'access-token-1'): MinimalSession {
  return { access_token: token, user: { id: 'user-1', email: 'user@example.test', user_metadata: metadata } };
}

export function fakeAuthClient(initial: MinimalSession | null = null) {
  let session = initial;
  const listeners = new Set<(event: string, session: MinimalSession | null) => void>();
  const setSession = (next: MinimalSession | null) => {
    session = next;
    for (const listener of listeners) listener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next);
  };
  const client = {
    signUp: jest.fn<ReturnType<AuthClient['signUp']>, Parameters<AuthClient['signUp']>>(async () => ({ error: null })),
    signInWithPassword: jest.fn<ReturnType<AuthClient['signInWithPassword']>, Parameters<AuthClient['signInWithPassword']>>(
      async () => {
        setSession(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
        return { data: { session }, error: null };
      },
    ),
    signOut: jest.fn(async () => {
      setSession(null);
      return { error: null };
    }),
    getSession: jest.fn(async () => ({ data: { session }, error: null })),
    refreshSession: jest.fn(async () => ({ data: { session }, error: null as ErrorLike })),
    updateUser: jest.fn<ReturnType<AuthClient['updateUser']>, Parameters<AuthClient['updateUser']>>(async () => ({ error: null })),
    resetPasswordForEmail: jest.fn<
      ReturnType<AuthClient['resetPasswordForEmail']>,
      Parameters<AuthClient['resetPasswordForEmail']>
    >(async () => ({ error: null })),
    exchangeCodeForSession: jest.fn(async () => ({ data: { session }, error: null as ErrorLike })),
    onAuthStateChange: jest.fn((callback: (event: string, session: MinimalSession | null) => void) => {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    }),
    setSession,
  };
  return client satisfies AuthClient;
}

type Route = { status: number; body: unknown } | 'offline';

/** A fetch that answers FitSphere API calls from a table of "METHOD /path" → reply. */
export function fakeApi(routes: Record<string, Route | Route[]>) {
  const calls: { method: string; path: string; token: string | null; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/v1/, '');
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path,
      token: headers.get('authorization')?.replace('Bearer ', '') ?? null,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const entry = routes[`${method} ${path}`];
    const reply = Array.isArray(entry) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
    if (!reply) throw new Error(`No fake reply for ${method} ${path}`);
    if (reply === 'offline') throw new TypeError('Network request failed');
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

export function apiError(status: number, code: string) {
  return { status, body: { error: { code, message: 'x', retryable: false, requestId: 'r', details: null } } };
}

export const ME = {
  user: { id: '0f8e5a1c-9b7d-4c1e-8a2b-3c4d5e6f7a8b', email: 'user@example.test', createdAt: '2026-10-28T03:00:00.000Z' },
  roles: ['personal'],
};

export function deps(client: AuthClient, fetchImpl: typeof fetch): AuthDeps {
  return { client, apiUrl: 'http://api.test', fetchImpl };
}
