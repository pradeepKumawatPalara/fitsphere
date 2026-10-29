import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from '../local/sql';
import {
  deleteEntry,
  getEntry,
  getMeta,
  getWeighIn,
  markAccepted,
  migrateLocal,
  pendingChanges,
  rejectedChanges,
  saveEntry,
  saveWeighIn,
  searchDishes,
  searchFoods,
  setMeta,
  unsyncedCount,
} from '../local/store';
import { refreshFoodList, syncNow } from './syncClient';

// Wednesday 28 October 2026, 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;

let db: SqlDb;
let next = 0;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

async function save(day: string, weightGrams: number) {
  next += 1;
  const changeId = `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  await saveWeighIn(db, { changeId, day, weightGrams, recordedAt: NOW.toISOString() });
  return changeId;
}

function auth(server: ReturnType<typeof fakeServer>, client = fakeAuthClient(fakeSession())) {
  return deps(client, server.fetchImpl);
}

describe('ADR-0007 sync client', () => {
  it('ADR-0007 sends the outbox oldest first, settles each result and keeps the cursor', async () => {
    const server = fakeServer(NOW);
    await save('2026-10-27', 70_000);
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('synced');

    const sent = server.calls[0]?.body as { cursor: null; changes: { data: { day: string } }[] };
    expect(sent.cursor).toBeNull();
    expect(sent.changes.map((change) => change.data.day)).toEqual(['2026-10-27', '2026-10-28']);
    expect(await unsyncedCount(db)).toBe(0);
    expect((await getWeighIn(db, '2026-10-28'))?.syncState).toBe('synced');
    expect(await getMeta(db, 'cursor')).toBe('2');
  });

  it('REQ-NFR-004 a sync without a connection keeps the outbox', async () => {
    const server = fakeServer(NOW);
    server.state.offline = true;
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('offline');

    expect(await pendingChanges(db, 100)).toMatchObject([{ attempts: 1, status: 'pending' }]);
    expect((await getWeighIn(db, '2026-10-28'))?.syncState).toBe('pending');
  });

  it('REQ-NFR-004 a failed sync (500 or 503) keeps the outbox and sends it again next time', async () => {
    const server = fakeServer(NOW);
    server.state.failWith = 503;
    const id = await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('failed');
    expect((await pendingChanges(db, 100)).map((entry) => entry.changeId)).toEqual([id]);

    server.state.failWith = null;
    expect(await syncNow(db, auth(server), clock)).toBe('synced');
    expect(server.weighIns.get('2026-10-28')?.weightGrams).toBe(70_300);
  });

  it('ADR-0007 rule 2 a rejected change is kept and not sent again', async () => {
    const server = fakeServer(NOW);
    const id = await save('2026-10-29', 70_000);

    await syncNow(db, auth(server), clock);
    await syncNow(db, auth(server), clock);

    expect(await rejectedChanges(db)).toMatchObject([{ changeId: id, errorCode: 'DAY_IN_FUTURE' }]);
    expect((await getWeighIn(db, '2026-10-29'))?.syncState).toBe('rejected');
    const second = server.calls[1]?.body as { changes: unknown[] };
    expect(second.changes).toEqual([]);
  });

  it('ADR-0007 the pull is applied: a value saved on another phone appears here', async () => {
    const server = fakeServer(NOW);
    server.storeFromElsewhere('2026-10-25', 69_800);

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-10-25')).toMatchObject({ weightGrams: 69_800, syncState: 'synced' });
  });

  it('ADR-0007 the pull never overwrites a change still waiting on this phone', async () => {
    const server = fakeServer(NOW);
    server.storeFromElsewhere('2026-10-26', 69_000);
    server.state.offline = true;
    await save('2026-10-26', 71_000);
    await syncNow(db, auth(server), clock);
    server.state.offline = false;
    server.state.rejectWith = 'VALIDATION_FAILED';

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-10-26')).toMatchObject({ weightGrams: 71_000, syncState: 'rejected' });
  });

  it('ADR-0007 rule 1 removes synced entries older than 90 days at sync, never pending or rejected ones', async () => {
    const server = fakeServer(NOW);
    server.state.offline = true;
    const old = await save('2026-07-01', 70_000);
    await markAccepted(db, old);
    await save('2026-07-02', 70_000);

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-07-01')).toBeNull();
    expect(await getWeighIn(db, '2026-07-02')).not.toBeNull();
  });

  it('error model: after a 401 it refreshes the session once and retries', async () => {
    const server = fakeServer(NOW);
    server.state.failWith = 401;
    const client = fakeAuthClient(fakeSession());
    client.refreshSession.mockImplementationOnce(async () => {
      server.state.failWith = null;
      return { data: { session: fakeSession({}, 'access-token-2') }, error: null };
    });
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server, client), clock)).toBe('synced');
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('ADR-0007 sync client: steps, sleep, measurements and targets', () => {
  it('REQ-NFR-004 sends each kind, settles it, and the server keeps it', async () => {
    const server = fakeServer(NOW);
    const at = NOW.toISOString();
    await saveEntry(db, 'steps', { changeId: '00000000-0000-4000-8000-0000000000a1', data: { day: '2026-10-28', steps: 8_432, recordedAt: at } });
    await saveEntry(db, 'sleep', { changeId: '00000000-0000-4000-8000-0000000000a2', data: { day: '2026-10-28', sleepMinutes: 450, recordedAt: at } });
    await saveEntry(db, 'measurements', {
      changeId: '00000000-0000-4000-8000-0000000000a3',
      data: { day: '2026-10-28', upperWaistMm: 812, lowerWaistMm: 845, chestMm: null, hipsMm: null, armMm: null, thighMm: null, notes: null, recordedAt: at },
    });
    await saveEntry(db, 'target', { changeId: '00000000-0000-4000-8000-0000000000a4', data: { kind: 'calories', value: 2_000, setAt: at } });

    expect(await syncNow(db, auth(server), clock)).toBe('synced');

    expect(await unsyncedCount(db)).toBe(0);
    expect(await getEntry(db, 'steps', '2026-10-28')).toMatchObject({ steps: 8_432, syncState: 'synced' });
    expect(await getEntry(db, 'sleep', '2026-10-28')).toMatchObject({ sleepMinutes: 450, syncState: 'synced' });
    expect(await getEntry(db, 'measurements', '2026-10-28')).toMatchObject({ upperWaistMm: 812, syncState: 'synced' });
    // The pull brings back who set the target: the user (D-20).
    expect(await getEntry(db, 'target', 'calories')).toMatchObject({ value: 2_000, setByUserId: expect.any(String), syncState: 'synced' });
    expect(server.entries('steps').get('2026-10-28')).toMatchObject({ steps: 8_432 });
  });

  it('ADR-0007 steps and a target saved on another phone appear here', async () => {
    const server = fakeServer(NOW);
    server.storeStepsFromElsewhere('2026-10-25', 6_000);
    server.storeTargetFromElsewhere('weekly_workouts', 4);

    await syncNow(db, auth(server), clock);

    expect(await getEntry(db, 'steps', '2026-10-25')).toMatchObject({ steps: 6_000, syncState: 'synced' });
    expect(await getEntry(db, 'target', 'weekly_workouts')).toMatchObject({ value: 4, syncState: 'synced' });
  });

  it('REQ-TRN-003 a workout saved, edited and deleted on the phone reaches the server in order', async () => {
    const server = fakeServer(NOW);
    const at = NOW.toISOString();
    const kept = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    const gone = '7c2a9e40-1d3b-4f5a-9e6d-2b1c0a9f8e7d';
    const squat = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };
    await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000b1', data: { id: kept, day: '2026-10-28', exercises: [], recordedAt: at } });
    await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000b2', data: { id: kept, day: '2026-10-28', exercises: [squat], recordedAt: at } });
    await saveEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000b3', data: { id: gone, day: '2026-10-28', exercises: [], recordedAt: at } });
    await deleteEntry(db, 'workout', { changeId: '00000000-0000-4000-8000-0000000000b4', data: { id: gone, deletedAt: at } });

    expect(await syncNow(db, auth(server), clock)).toBe('synced');

    expect(await unsyncedCount(db)).toBe(0);
    expect(await getEntry(db, 'workout', kept)).toMatchObject({ exercises: [squat], syncState: 'synced' });
    expect(await getEntry(db, 'workout', gone)).toBeNull();
    expect(server.entries('workouts').get(kept)).toMatchObject({ deleted: false, exercises: [squat] });
    expect(server.entries('workouts').get(gone)).toMatchObject({ deleted: true });
  });

  it('REQ-TRN-004 workouts saved or deleted on another phone appear or go here', async () => {
    const server = fakeServer(NOW);
    const id = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
    server.storeWorkoutFromElsewhere(id, '2026-10-26', []);
    await syncNow(db, auth(server), clock);
    expect(await getEntry(db, 'workout', id)).toMatchObject({ day: '2026-10-26', exercises: [], syncState: 'synced' });

    server.deleteWorkoutFromElsewhere(id);
    await syncNow(db, auth(server), clock);

    expect(await getEntry(db, 'workout', id)).toBeNull();
  });

  it('ADR-0007 with the cursor cleared by the version 2 update, the next sync pulls everything again', async () => {
    const server = fakeServer(NOW);
    server.storeFromElsewhere('2026-10-20', 70_000);
    server.storeStepsFromElsewhere('2026-10-20', 4_000);
    await syncNow(db, auth(server), clock);
    await db.runAsync('DELETE FROM steps', []);
    await setMeta(db, 'cursor', null);

    await syncNow(db, auth(server), clock);

    expect(await getEntry(db, 'steps', '2026-10-20')).toMatchObject({ steps: 4_000 });
  });
});

describe('Meal logging: the sync client', () => {
  const ATTA = {
    source: 'ifct2017' as const,
    ref: 'A019',
    name: 'Wheat flour, atta',
    amount: { unit: 'g' as const, value: 60 },
    kcal: 192,
    proteinG: 6.34,
    carbsG: 38.5,
    fatG: 0.92,
    fibreG: 6.82,
    estimated: false,
  };
  const MEAL_ID = '6a1f3c2e-0b7d-4c5e-9f8a-1b2c3d4e5f60';

  it('REQ-NFR-004 a meal saved and then deleted offline reaches the server as deleted', async () => {
    const server = fakeServer(NOW);
    server.state.offline = true;
    await saveEntry(db, 'meal', {
      changeId: '00000000-0000-4000-8000-0000000000b1',
      data: { id: MEAL_ID, day: '2026-10-28', mealType: 'lunch', tags: [], items: [ATTA], recordedAt: NOW.toISOString() },
    });
    await syncNow(db, auth(server), clock);
    await deleteEntry(db, 'meal', { changeId: '00000000-0000-4000-8000-0000000000b2', data: { id: MEAL_ID, deletedAt: NOW.toISOString() } });
    server.state.offline = false;

    expect(await syncNow(db, auth(server), clock)).toBe('synced');

    expect(await unsyncedCount(db)).toBe(0);
    expect(server.entries('meals').get(MEAL_ID)).toMatchObject({ deleted: true });
    expect(await getEntry(db, 'meal', MEAL_ID)).toBeNull();
  });

  it('ADR-0007 meals saved and deleted on another phone arrive and leave', async () => {
    const server = fakeServer(NOW);
    server.storeMealFromElsewhere({ id: MEAL_ID, day: '2026-10-27', mealType: 'dinner', tags: [], items: [ATTA], recordedAt: NOW.toISOString() });
    await syncNow(db, auth(server), clock);
    expect(await getEntry(db, 'meal', MEAL_ID)).toMatchObject({ mealType: 'dinner', kcal: 192, syncState: 'synced' });

    server.deleteMealFromElsewhere(MEAL_ID);
    await syncNow(db, auth(server), clock);

    expect(await getEntry(db, 'meal', MEAL_ID)).toBeNull();
  });

  it('ADR-0006 rule 1 downloads the food list once, then only when its version changes', async () => {
    const server = fakeServer(NOW);
    server.state.foods = [
      { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false },
    ];

    expect(await refreshFoodList(db, auth(server))).toBe('updated');
    expect(await refreshFoodList(db, auth(server))).toBe('current');
    expect(server.calls.filter((call) => call.path === '/foods')).toHaveLength(2);
    expect((await searchFoods(db, 'atta')).map((food) => food.code)).toEqual(['A019']);

    server.state.foodsVersion = 'foods-v2';
    server.state.foods = [];
    expect(await refreshFoodList(db, auth(server))).toBe('updated');
    expect(await searchFoods(db, 'atta')).toEqual([]);
  });

  it('D-28 downloads the dishes with the food list, and drops one the server no longer lists', async () => {
    const server = fakeServer(NOW);
    // A synthetic dish: made-up values for one portion.
    const dish = { code: 'test_dal', name: 'Test dal', portionUnit: 'katori' as const, kcal: 138.82, proteinG: 7.42, carbsG: 19.6, fatG: 3.05, fibreG: 3.33 };
    server.state.dishes = [dish];

    expect(await refreshFoodList(db, auth(server))).toBe('updated');
    expect(await searchDishes(db, 'dal')).toEqual([dish]);

    server.state.foodsVersion = 'foods-v2';
    server.state.dishes = [];
    expect(await refreshFoodList(db, auth(server))).toBe('updated');
    expect(await searchDishes(db, 'dal')).toEqual([]);
  });

  it('ADR-0006 rule 1 without a connection the food list on the phone is kept', async () => {
    const server = fakeServer(NOW);
    server.state.foods = [
      { source: 'ifct2017', code: 'T013', name: 'Ghee', foodGroup: 'Edible Oils and Fats', aliases: [], proteinG: 0, fibreG: 0, fatG: 100, carbsG: 0, kcal: 900, kcalEstimated: true },
    ];
    await refreshFoodList(db, auth(server));
    server.state.offline = true;

    expect(await refreshFoodList(db, auth(server))).toBe('offline');

    expect((await searchFoods(db, 'ghee')).map((food) => food.kcal)).toEqual([900]);
  });
});
