import {
  istToday,
  mealTotals,
  type BarcodeProduct,
  type Dish,
  type Food,
  type MealItem,
  type SyncResult,
  type TargetKind,
  type Workout,
  type WorkoutExercise,
} from '@fitsphere/shared';
import { ME } from './fakes';

// A fake FitSphere API for app tests, with the sync rules of api-conventions: each change once,
// the last change received wins, a future IST day is rejected, and the pull returns what changed
// after the cursor, for every kind; a deleted meal or workout stays as `deleted: true`. It also
// serves the food list (GET /v1/foods), barcode lookups, meal photo links with a fake storage
// behind them, and older workouts (GET /v1/users/{id}/workouts).

type Stored = { item: Record<string, unknown>; seq: number };

const STORAGE_HOST = 'storage.test';
type Change = { changeId: string; type: string; data: Record<string, unknown> };

/** Change type → the pull list it lands in, and the field that identifies an entry. */
const KINDS = {
  'weighIn.set': { list: 'weighIns', key: 'day' },
  'steps.set': { list: 'steps', key: 'day' },
  'sleep.set': { list: 'sleep', key: 'day' },
  'measurements.set': { list: 'measurements', key: 'day' },
  'workout.set': { list: 'workouts', key: 'id' },
  'workout.delete': { list: 'workouts', key: 'id' },
  'target.set': { list: 'targets', key: 'kind' },
  'setting.set': { list: 'settings', key: 'name' },
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
    /** What `GET /users/{id}/weigh-ins` holds, filtered by `from` and `to` and returned oldest first. */
    older: [] as { day: string; weightGrams: number }[],
    /** Weigh-ins a page holds; null puts them all on one page. */
    olderPageSize: null as number | null,
    /** The `from`, `to` and `cursor` of each weigh-ins request. */
    weighInQueries: [] as { from: string | null; to: string | null; cursor: string | null }[],
    /** The food list GET /v1/foods serves, with its dishes, and its version. */
    foods: [] as Food[],
    dishes: [] as Dish[],
    foodsVersion: 'foods-v1',
    /** Products GET /v1/barcodes/{barcode} knows; any other barcode is not found. */
    barcodes: {} as Record<string, BarcodeProduct>,
    /** Answer barcode lookups with 503, as when Open Food Facts cannot answer. */
    barcodesUnavailable: false,
    /** The files in the fake storage, by key ("<mediaId>.jpg", "<mediaId>-thumb.jpg"). */
    files: new Map<string, Uint8Array>(),
    /** What `GET /users/{id}/workouts` returns. */
    olderWorkouts: [] as Workout[],
    /** The latest AI consent record (REQ-ACC-004); null until the user chooses. */
    aiConsent: null as { consented: boolean; textVersion: string; recordedAt: string } | null,
    /** Answer `DELETE /me` with this status instead of deleting (503: not available). */
    deleteFailsWith: null as number | null,
    /** Set once `DELETE /me` succeeded. */
    deleted: false,
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
    } else if (type === 'setting.set') {
      item = { ...rest, setAt, updatedAt };
    } else if (type === 'meal.set' || type === 'savedMeal.set') {
      // The server computes the totals from the items.
      item = { deleted: false, ...(type === 'meal.set' ? { photo: null } : {}), ...data, totals: mealTotals(data.items as MealItem[]), updatedAt };
    } else if (type === 'workout.set') {
      item = { deleted: false, ...rest, recordedAt, updatedAt };
    } else if (type === 'meal.delete' || type === 'savedMeal.delete' || type === 'workout.delete') {
      const previous = stored.get(slot)?.item;
      if (!previous) return; // deleting something the server never had changes nothing
      item = { deleted: true, id: data.id, ...(type === 'savedMeal.delete' ? {} : { day: previous.day }), updatedAt };
    } else {
      item = { ...rest, recordedAt, updatedAt };
    }
    seq += 1;
    stored.set(slot, { item, seq });
  }

  /** The values stored for one list, keyed by day (by kind for targets, by name for settings, by ID for
   * meals and workouts). */
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
    // The fake storage behind upload and viewing links (ADR-0002 rule 3).
    if (url.host === STORAGE_HOST) {
      const [, purpose, key] = url.pathname.split('/') as [string, 'upload' | 'view', string];
      calls.push({ method, path: `storage:${purpose}/${key}`, body: undefined });
      if (purpose === 'upload' && method === 'PUT') {
        state.files.set(key, new Uint8Array(init?.body as Uint8Array));
        return new Response(null, { status: 200 });
      }
      const file = purpose === 'view' ? state.files.get(key) : undefined;
      return file ? new Response(new Uint8Array(file), { status: 200 }) : new Response('NoSuchKey', { status: 404 });
    }
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
      return json(200, { version: state.foodsVersion, items: current ? null : state.foods, dishes: current ? null : state.dishes });
    }
    const barcode = /^\/barcodes\/(\d+)$/.exec(path)?.[1];
    if (method === 'GET' && barcode) {
      if (state.barcodesUnavailable) {
        return json(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'x', retryable: true, requestId: 'r', details: null } });
      }
      const product = state.barcodes[barcode] ?? null;
      return json(200, { barcode, found: product !== null, product });
    }
    // Meal photo links: only for a photo a synced meal names, and only for the user (D-20).
    const media = /^\/users\/([^/]+)\/media\/([^/]+)(\/upload)?$/.exec(path);
    if (media) {
      const [, userId, mediaId, upload] = media as unknown as [string, string, string, string | undefined];
      const named = [...entries('meals').values()].some((meal) => (meal.photo as { mediaId?: string } | null)?.mediaId === mediaId);
      if (userId !== ME.user.id || !named || method !== (upload ? 'POST' : 'GET')) {
        return json(404, { error: { code: 'NOT_FOUND', message: 'x', retryable: false, requestId: 'r', details: null } });
      }
      const purpose = upload ? 'upload' : 'view';
      return json(200, {
        photoUrl: `https://${STORAGE_HOST}/${purpose}/${mediaId}.jpg`,
        thumbnailUrl: `https://${STORAGE_HOST}/${purpose}/${mediaId}-thumb.jpg`,
        expiresAt: new Date(now.getTime() + (upload ? 600 : 300) * 1000).toISOString(),
      });
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
      const pull: Record<ListName | 'profiles' | 'removals', unknown[]> = {
        weighIns: [],
        steps: [],
        sleep: [],
        measurements: [],
        workouts: [],
        targets: [],
        settings: [],
        profiles: [],
        meals: [],
        savedMeals: [],
        removals: [],
      };
      const changed = [...stored.entries()].filter(([, entry]) => entry.seq > after).sort((a, b) => a[1].seq - b[1].seq);
      for (const [slot, { item }] of changed) pull[slot.split('|')[0] as ListName].push(item);
      return json(200, { results, pull, cursor: String(seq), hasMore: false });
    }
    if (method === 'GET' && /^\/users\/[^/]+\/workouts$/.test(path)) {
      return json(200, { items: state.olderWorkouts, nextCursor: null });
    }
    if (method === 'GET' && /^\/users\/[^/]+\/weigh-ins$/.test(path)) {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const cursor = url.searchParams.get('cursor');
      state.weighInQueries.push({ from, to, cursor });
      const matching = state.older
        .filter((entry) => (!from || entry.day >= from) && (!to || entry.day <= to))
        .sort((a, b) => (a.day < b.day ? -1 : 1));
      const start = Number(cursor ?? 0);
      const end = start + (state.olderPageSize ?? matching.length);
      const items = matching.slice(start, end).map((entry) => ({
        ...entry,
        recordedAt: `${entry.day}T02:00:00.000Z`,
        updatedAt: `${entry.day}T02:00:00.000Z`,
      }));
      return json(200, { items, nextCursor: end < matching.length ? String(end) : null });
    }
    if (path === '/me/ai-consent' && method === 'GET') return json(200, { aiConsent: state.aiConsent });
    if (path === '/me/ai-consent' && method === 'PUT') {
      const { consented, textVersion } = body as { consented: boolean; textVersion: string };
      state.aiConsent = { consented, textVersion, recordedAt: now.toISOString() };
      return json(200, { aiConsent: state.aiConsent });
    }
    if (path === '/me' && method === 'DELETE') {
      if (state.deleteFailsWith) {
        return json(state.deleteFailsWith, {
          error: { code: 'SERVICE_UNAVAILABLE', message: 'x', retryable: true, requestId: 'r', details: null },
        });
      }
      state.deleted = true;
      return new Response(null, { status: 204 });
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

  /** A workout saved, or deleted, from another phone. */
  function storeWorkoutFromElsewhere(id: string, day: string, exercises: WorkoutExercise[]) {
    store('workout.set', { id, day, exercises, recordedAt: `${day}T02:00:00.000Z` });
  }

  function deleteWorkoutFromElsewhere(id: string) {
    store('workout.delete', { id, deletedAt: now.toISOString() });
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
    storeWorkoutFromElsewhere,
    deleteWorkoutFromElsewhere,
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
