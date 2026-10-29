import { istToday, type SyncResult } from '@fitsphere/shared';
import { ME } from './fakes';

// A fake FitSphere API for app tests, with the sync rules of api-conventions: each change once,
// the last change received wins, a future IST day is rejected, and the pull returns what changed
// after the cursor.

type StoredWeighIn = { day: string; weightGrams: number; recordedAt: string; updatedAt: string; seq: number };
type Change = { changeId: string; type: string; data: { day: string; weightGrams: number; recordedAt: string } };

export function fakeServer(now: Date) {
  const weighIns = new Map<string, StoredWeighIn>();
  const seen = new Map<string, SyncResult>();
  const state = {
    offline: false,
    /** Answer every call with this HTTP status instead. */
    failWith: null as number | null,
    /** Reject every change with this code. */
    rejectWith: null as string | null,
    older: [] as { day: string; weightGrams: number }[],
  };
  const calls: { method: string; path: string; body: unknown }[] = [];
  let seq = 0;

  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (state.offline) throw new TypeError('Network request failed');
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/v1/, '');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    if (state.failWith) {
      return json(state.failWith, {
        error: { code: 'INTERNAL_ERROR', message: 'x', retryable: true, requestId: 'r', details: null },
      });
    }
    if (method === 'GET' && path === '/me') return json(200, ME);
    if (method === 'POST' && path === '/sync') {
      const request = body as { cursor: string | null; changes: Change[] };
      const results = request.changes.map((change) => {
        const known = seen.get(change.changeId);
        if (known) return known;
        const code = state.rejectWith ?? (change.data.day > istToday(now) ? 'DAY_IN_FUTURE' : null);
        if (!code) {
          seq += 1;
          weighIns.set(change.data.day, { ...change.data, updatedAt: now.toISOString(), seq });
        }
        const result = {
          changeId: change.changeId,
          status: code ? 'rejected' : 'accepted',
          error: code ? { code, message: 'x', details: null } : null,
        } as SyncResult;
        seen.set(change.changeId, result);
        return result;
      });
      const after = request.cursor ? Number(request.cursor) : 0;
      const pull = [...weighIns.values()].filter((entry) => entry.seq > after).sort((a, b) => a.seq - b.seq);
      return json(200, {
        results,
        pull: {
          weighIns: pull.map((entry) => ({
            day: entry.day,
            weightGrams: entry.weightGrams,
            recordedAt: entry.recordedAt,
            updatedAt: entry.updatedAt,
          })),
          steps: [],
          sleep: [],
          measurements: [],
          targets: [],
          removals: [],
        },
        cursor: String(seq),
        hasMore: false,
      });
    }
    if (method === 'GET' && /^\/users\/[^/]+\/weigh-ins$/.test(path)) {
      const items = state.older.map((entry) => ({
        ...entry,
        recordedAt: `${entry.day}T02:00:00.000Z`,
        updatedAt: `${entry.day}T02:00:00.000Z`,
      }));
      return json(200, { items, nextCursor: null });
    }
    throw new Error(`No fake reply for ${method} ${path}`);
  });

  /** A value saved from another phone. */
  function storeFromElsewhere(day: string, weightGrams: number) {
    seq += 1;
    weighIns.set(day, { day, weightGrams, recordedAt: `${day}T02:00:00.000Z`, updatedAt: now.toISOString(), seq });
  }

  return { fetchImpl: fetchImpl as unknown as typeof fetch, state, calls, weighIns, storeFromElsewhere };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
