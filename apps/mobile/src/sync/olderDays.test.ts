import type { DaysResponse } from '@fitsphere/shared';
import type { SqlDb } from '../local/sql';
import { getEntry, getWeighIn, holdDays, markAccepted, migrateLocal, pruneSynced, replaceDays, saveEntry, saveWeighIn } from '../local/store';
import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { fetchDays, monthRange, olderPart } from './olderDays';

// Older days (D-106; ADR-0007 rule 1): any day back to 1 Jan 2000 can be chosen; a day before the
// phone's 90 is read from the server when shown and kept on the phone while the app is open.
// Wednesday 28 October 2026, 09:00 IST: the phone's 90 days start on Friday 31 July 2026.
const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = '2026-10-28';
const AT = NOW.toISOString();

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

const NONE: DaysResponse = { weighIns: [], steps: [], sleep: [], measurements: [], workouts: [], meals: [] };

async function savedAndSynced(day: string, weightGrams: number) {
  const changeId = `00000000-0000-4000-8000-${day.replaceAll('-', '').padStart(12, '0')}`;
  await saveWeighIn(db, { changeId, day, weightGrams, recordedAt: AT });
  await markAccepted(db, changeId);
}

describe('D-106 which days are read from the server', () => {
  it.each([
    ['a week of the 90 days', '2026-10-26', '2026-11-01', null],
    ['a week before them', '2026-07-20', '2026-07-26', { from: '2026-07-20', to: '2026-07-26' }],
    ['the week holding the first of the 90: only the days before it', '2026-07-27', '2026-08-02', { from: '2026-07-27', to: '2026-07-30' }],
    ['a month before them', '2025-03-01', '2025-03-31', { from: '2025-03-01', to: '2025-03-31' }],
    ['the week holding 1 Jan 2000: from that day', '1999-12-27', '2000-01-02', { from: '2000-01-01', to: '2000-01-02' }],
    ['a week before 2000', '1999-12-20', '1999-12-26', null],
  ])('%s', (_, from, to, older) => {
    expect(olderPart(from, to, TODAY)).toEqual(older);
  });

  it('a month is its first to its last day', () => {
    expect(monthRange('2025-02')).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange('2025-03')).toEqual({ from: '2025-03-01', to: '2025-03-31' });
  });
});

describe('D-106 older days on the phone', () => {
  it('ADR-0007 rule 1 the server’s days replace the phone’s synced ones there; pending ones stay', async () => {
    await savedAndSynced('2025-03-10', 74_000); // deleted on the server since: goes
    await savedAndSynced('2025-03-11', 74_100); // the server's value replaces it
    await saveWeighIn(db, { changeId: '00000000-0000-4000-8000-0000000000c1', day: '2025-03-12', weightGrams: 74_200, recordedAt: AT }); // pending
    await savedAndSynced('2025-03-20', 74_500); // outside the days read: untouched

    await replaceDays(db, '2025-03-10', '2025-03-16', {
      ...NONE,
      weighIns: [
        { day: '2025-03-11', weightGrams: 74_150, recordedAt: AT, updatedAt: AT, source: 'manual' },
        { day: '2025-03-12', weightGrams: 70_000, recordedAt: AT, updatedAt: AT, source: 'manual' },
      ],
      steps: [{ day: '2025-03-13', steps: 8_410, recordedAt: AT, updatedAt: AT, source: 'manual' }],
    });

    expect(await getWeighIn(db, '2025-03-10')).toBeNull();
    expect(await getWeighIn(db, '2025-03-11')).toMatchObject({ weightGrams: 74_150, syncState: 'synced' });
    expect(await getWeighIn(db, '2025-03-12')).toMatchObject({ weightGrams: 74_200, syncState: 'pending' });
    expect(await getWeighIn(db, '2025-03-20')).toMatchObject({ weightGrams: 74_500 });
    expect(await getEntry(db, 'steps', '2025-03-13')).toMatchObject({ steps: 8_410, syncState: 'synced' });
  });

  it('held older days stay through a prune while the app is open; others older than the 90 days go', async () => {
    await replaceDays(db, '2025-03-10', '2025-03-16', { ...NONE, weighIns: [{ day: '2025-03-11', weightGrams: 74_150, recordedAt: AT, updatedAt: AT, source: 'manual' }] });
    await savedAndSynced('2025-04-01', 73_000);
    holdDays(db, '2025-05-01', '2025-05-07');
    await savedAndSynced('2025-05-02', 72_000); // logged on a held day, then synced

    await pruneSynced(db, TODAY);

    expect(await getWeighIn(db, '2025-03-11')).not.toBeNull();
    expect(await getWeighIn(db, '2025-05-02')).not.toBeNull();
    expect(await getWeighIn(db, '2025-04-01')).toBeNull();
  });

  it('the next app start holds nothing: the first prune removes them (a new database connection here)', async () => {
    await replaceDays(db, '2025-03-10', '2025-03-16', { ...NONE, weighIns: [{ day: '2025-03-11', weightGrams: 74_150, recordedAt: AT, updatedAt: AT, source: 'manual' }] });
    const reopened: SqlDb = { ...db };

    await pruneSynced(reopened, TODAY);

    expect(await getWeighIn(db, '2025-03-11')).toBeNull();
  });

  it('a meal deleted on another phone leaves this one, as in the pull', async () => {
    const meal = { id: '00000000-0000-4000-8000-0000000000d1', day: '2025-03-12', mealType: 'lunch' as const, tags: [], items: [], recordedAt: AT };
    await saveEntry(db, 'meal', { changeId: '00000000-0000-4000-8000-0000000000d2', data: meal });
    await markAccepted(db, '00000000-0000-4000-8000-0000000000d2');

    await replaceDays(db, '2025-03-10', '2025-03-16', { ...NONE, meals: [{ deleted: true, id: meal.id, day: meal.day, updatedAt: AT }] });

    expect(await getEntry(db, 'meal', meal.id)).toBeNull();
  });
});

describe('D-106 GET /v1/users/{id}/days from the phone', () => {
  it('reads the days asked for, and says offline or failed otherwise', async () => {
    const server = fakeServer(NOW);
    server.storeStepsFromElsewhere('2025-03-13', 8_410);
    const auth = deps(fakeAuthClient(fakeSession()), server.fetchImpl);

    expect(await fetchDays(auth, '2025-03-10', '2025-03-16')).toMatchObject({ steps: [{ day: '2025-03-13', steps: 8_410 }], meals: [] });
    expect(server.state.dayQueries).toEqual([{ from: '2025-03-10', to: '2025-03-16' }]);

    server.state.daysFailWith = 503;
    expect(await fetchDays(auth, '2025-03-10', '2025-03-16')).toBe('failed');
    server.state.offline = true;
    expect(await fetchDays(auth, '2025-03-10', '2025-03-16')).toBe('offline');
  });
});
