import { istToday, mealTotals, type BarcodeProduct, type Food, type MealItem, type SyncResult, type TargetKind } from '@fitsphere/shared';
import { ME } from './fakes';

// A fake FitSphere API for app tests, with the sync rules of api-conventions: each change once,
// the last change received wins, a future IST day is rejected, and the pull returns what changed
// after the cursor, for every kind. It also serves the food list (GET /v1/foods) and barcode lookups.

type Stored = { item: Record<string, unknown>; seq: number };
type Change = { changeId: string; type: string; data: Record<string, unknown> };

/** Change type → the pull list it lands in, and the field that identifies an entry. */
const KINDS = {
  'weighIn.set': { list: 'weighIns', key: 'day' },
  'steps.set': { list: 'steps', key: 'day' },
  'sleep.set': { list: 'sleep', key: 'day' },
  'measurements.set': { list: 'measurements', key: 'day' },
  'target.set': { list: 'targets', key: 'kind' },
  'meal.set': { list: 'meals', key: 'id' },
  'meal.delete': { list: 'meals', key: 'id' },
  'savedMeal.set': { list: 'savedMeals', key: 'id' },
  'savedMeal.delete': { list: 'savedMeals', key: 'id' },
} as const;
type ChangeType = keyof typeof KINDS;
type ListName = (typeof KINDS)[ChangeType]['list'];

export function fakeServer(now: Date) {
  const stored = new Map<string, Stored>();
  const seen = new Map<string, SyncResult>();
  const state = {
    offline: false,
    /** Answer every call with this HTTP status instead. */
    failWith: null as number | null,
    /** Reject every change with this code. */
    rejectWith: null as string | null,
    older: [] as { day: string; weightGrams: number }[],
    /** The food list GET /v1/foods serves, and its version. */
    foods: [] as Food[],
    foodsVersion: 'foods-v1',
    /** Products GET /v1/barcodes/{barcode} knows; any other barcode is not found. */
    barcodes: {} as Record<string, BarcodeProduct>,
    /** Answer barcode lookups with 503, as when Open Food Facts cannot answer. */
    barcodesUnavailable: false,
  };
  const calls: { method: string; path: string; body: unknown }[] = [];
  let seq = 0;

  function store(type: ChangeType, data: Record<string, unknown>) {
    const { list, key } = KINDS[type];
    const slot = `${list}|${String(data[key])}`;
    const updatedAt = now.toISOString();
    const { setAt, recordedAt, ...rest } = data;
    let item: Record<string, unknown>;
    if (type === 'target.set') {
      item = { ...rest, setByUserId: ME.user.id, setAt, updatedAt };
    } else if (type === 'meal.set' || type === 'savedMeal.set') {
      // The server computes the totals from the items.
      item = { deleted: false, ...(type === 'meal.set' ? { photo: null } : {}), ...data, totals: mealTotals(data.items as MealItem[]), updatedAt };
    } else if (type === 'meal.delete' || type === 'savedMeal.delete') {
      const previous = stored.get(slot)?.item;
      if (!previous) return; // deleting something the server never had changes nothing
      item = { deleted: true, id: data.id, ...(type === 'meal.delete' ? { day: previous.day } : {}), updatedAt };
    } else {
      item = { ...rest, recordedAt, updatedAt };
    }
    seq += 1;
    stored.set(slot, { item, seq });
  }

  /** The values stored for one list, keyed by day (by kind for targets, by ID for meals). */
  function entries(list: ListName): Map<string, Record<string, unknown>> {
    const result = new Map<string, Record<string, unknown>>();
    for (const [slot, { item }] of stored) {
      const [slotList, key] = slot.split('|') as [string, string];
      if (slotList === list) result.set(key, item);
    }
    return result;
  }

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
    if (method === 'GET' && path === '/foods') {
      const current = url.searchParams.get('version') === state.foodsVersion;
      return json(200, { version: state.foodsVersion, items: current ? null : state.foods });
    }
    const barcode = /^\/barcodes\/(\d+)$/.exec(path)?.[1];
    if (method === 'GET' && barcode) {
      if (state.barcodesUnavailable) {
        return json(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'x', retryable: true, requestId: 'r', details: null } });
      }
      const product = state.barcodes[barcode] ?? null;
      return json(200, { barcode, found: product !== null, product });
    }
    if (method === 'POST' && path === '/sync') {
      const request = body as { cursor: string | null; changes: Change[] };
      const results = request.changes.map((change) => {
        const known = seen.get(change.changeId);
        if (known) return known;
        const type = change.type in KINDS ? (change.type as ChangeType) : null;
        const day = change.data.day;
        const code =
          state.rejectWith ??
          (!type ? 'UNKNOWN_CHANGE_TYPE' : typeof day === 'string' && day > istToday(now) ? 'DAY_IN_FUTURE' : null);
        if (!code && type) store(type, change.data);
        const result = {
          changeId: change.changeId,
          status: code ? 'rejected' : 'accepted',
          error: code ? { code, message: 'x', details: null } : null,
        } as SyncResult;
        seen.set(change.changeId, result);
        return result;
      });
      const after = request.cursor ? Number(request.cursor) : 0;
      const pull: Record<ListName | 'removals', unknown[]> = {
        weighIns: [],
        steps: [],
        sleep: [],
        measurements: [],
        targets: [],
        meals: [],
        savedMeals: [],
        removals: [],
      };
      const changed = [...stored.entries()].filter(([, entry]) => entry.seq > after).sort((a, b) => a[1].seq - b[1].seq);
      for (const [slot, { item }] of changed) pull[slot.split('|')[0] as ListName].push(item);
      return json(200, { results, pull, cursor: String(seq), hasMore: false });
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

  /** A weight saved from another phone. */
  function storeFromElsewhere(day: string, weightGrams: number) {
    store('weighIn.set', { day, weightGrams, recordedAt: `${day}T02:00:00.000Z` });
  }

  /** Steps saved from another phone. */
  function storeStepsFromElsewhere(day: string, steps: number) {
    store('steps.set', { day, steps, recordedAt: `${day}T02:00:00.000Z` });
  }

  /** A target set from another phone. */
  function storeTargetFromElsewhere(kind: TargetKind, value: number) {
    store('target.set', { kind, value, setAt: now.toISOString() });
  }

  /** A meal saved, or deleted, on another phone. */
  function storeMealFromElsewhere(meal: Record<string, unknown>) {
    store('meal.set', meal);
  }

  function deleteMealFromElsewhere(id: string) {
    store('meal.delete', { id, deletedAt: now.toISOString() });
  }

  return {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    state,
    calls,
    /** The weights stored now, by day. */
    get weighIns() {
      return entries('weighIns');
    },
    entries,
    storeFromElsewhere,
    storeStepsFromElsewhere,
    storeTargetFromElsewhere,
    storeMealFromElsewhere,
    deleteMealFromElsewhere,
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
