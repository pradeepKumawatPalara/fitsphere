import { addDays } from '@fitsphere/shared';
import { getEntry, migrateLocal, saveEntry } from '../local/store';
import type { SqlDb } from '../local/sql';
import { memoryDb } from '../testing/memoryDb';
import { IMPORT_DAYS, daysRead, importFromHealth } from './importHealth';
import type { DaySteps, HealthSource, WeightReading } from './types';

// D-121, ADR-0013, plan "The rules for what is imported": what a read saves and what it leaves alone.
// A fake store; synthetic values.

const TODAY = '2026-10-28';
const AT = '2026-10-28T02:00:00.000Z';

let db: SqlDb;
let ids = 0;
beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
  ids = 0;
});
afterEach(async () => {
  await db.closeAsync();
});

function fakeSource(steps: DaySteps[], weights: WeightReading[] = []): HealthSource {
  return {
    availability: async () => 'available',
    hasAccess: async () => true,
    requestAccess: async () => true,
    readSteps: async () => steps,
    readWeights: async () => weights,
    openInstall: () => undefined,
  };
}

const newId = () => {
  ids += 1;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`;
};
const saves = () => ({
  saveSteps: (day: string, steps: number) =>
    saveEntry(db, 'steps', { changeId: newId(), data: { day, steps, recordedAt: AT, source: 'health_connect' } }),
  saveWeight: (day: string, weightGrams: number) =>
    saveEntry(db, 'weighIn', { changeId: newId(), data: { day, weightGrams, recordedAt: AT, source: 'health_connect' } }),
});
const read = (steps: DaySteps[], weights: WeightReading[] = []) =>
  importFromHealth({ db, source: fakeSource(steps, weights), today: TODAY, saves: saves() });

describe('D-121 importFromHealth', () => {
  it('reads the last 30 days, today included: day 30 is in, day 31 is skipped', async () => {
    const first = addDays(TODAY, -(IMPORT_DAYS - 1));

    const summary = await read([
      { day: first, steps: 1_000 },
      { day: addDays(first, -1), steps: 2_000 },
    ]);

    expect(summary.steps).toMatchObject({ added: 1, skipped: 1 });
    expect(await getEntry(db, 'steps', first)).toMatchObject({ steps: 1_000, source: 'health_connect' });
    expect(await getEntry(db, 'steps', addDays(first, -1))).toBeNull();
  });

  it('fills a day with no value, updates an earlier import, and leaves the same value alone', async () => {
    expect((await read([{ day: TODAY, steps: 2_000 }])).steps).toMatchObject({ added: 1 });
    expect((await read([{ day: TODAY, steps: 2_000 }])).steps).toMatchObject({ unchanged: 1, added: 0 });
    expect((await read([{ day: TODAY, steps: 5_000 }])).steps).toMatchObject({ updated: 1 });

    expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 5_000, source: 'health_connect' });
  });

  it('never changes a value the user typed, steps or weight, even one still waiting to sync', async () => {
    await saveEntry(db, 'steps', { changeId: newId(), data: { day: TODAY, steps: 4_000, recordedAt: AT } });
    await saveEntry(db, 'weighIn', { changeId: newId(), data: { day: TODAY, weightGrams: 70_000, recordedAt: AT } });

    const summary = await read([{ day: TODAY, steps: 9_000 }], [{ at: AT, grams: 65_000 }]);

    expect(summary.steps).toMatchObject({ typedKept: 1, added: 0, updated: 0 });
    expect(summary.weights).toMatchObject({ typedKept: 1, added: 0, updated: 0 });
    expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 4_000, source: 'manual', syncState: 'pending' });
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: 70_000, source: 'manual' });
  });

  it('skips, never clips, steps over 200,000, under 1, not whole, and days in the future', async () => {
    const summary = await read([
      { day: addDays(TODAY, -1), steps: 200_001 },
      { day: addDays(TODAY, -2), steps: 0 },
      { day: addDays(TODAY, -3), steps: 1_000.5 },
      { day: addDays(TODAY, 1), steps: 500 },
      { day: addDays(TODAY, -4), steps: 200_000 },
      { day: addDays(TODAY, -5), steps: 1 },
    ]);

    expect(summary.steps).toMatchObject({ added: 2, skipped: 4 });
    expect(await getEntry(db, 'steps', addDays(TODAY, -4))).toMatchObject({ steps: 200_000 });
    expect(await getEntry(db, 'steps', addDays(TODAY, -1))).toBeNull();
  });

  it('weights: the latest of an India day, whole grams, outside 20 to 300 kg skipped, a bad time skipped', async () => {
    const summary = await read(
      [],
      [
        { at: '2026-10-27T03:00:00.000Z', grams: 71_000.4 },
        { at: '2026-10-27T10:00:00.000Z', grams: 70_499.6 },
        // 00:10 on the 28th in India.
        { at: '2026-10-27T18:40:00.000Z', grams: 70_000 },
        { at: '2026-10-26T03:00:00.000Z', grams: 19_999 },
        { at: '2026-10-26T04:00:00.000Z', grams: 300_001 },
        { at: 'not a time', grams: 70_000 },
      ],
    );

    expect(summary.weights).toMatchObject({ added: 2, skipped: 3 });
    expect(await getEntry(db, 'weighIn', '2026-10-27')).toMatchObject({ weightGrams: 70_500 });
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: 70_000 });
  });

  it('daysRead counts every day that holds a value now, typed ones too', () => {
    expect(daysRead({ added: 1, updated: 2, unchanged: 3, typedKept: 4, skipped: 5 })).toBe(10);
  });
});
