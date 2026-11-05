import type { MealItem, MealPhoto } from '@fitsphere/shared';
import { memoryDb } from '../testing/memoryDb';
import { cachePhotoFile, getPhoto, insertNewPhoto, markUploaded, photosToUpload } from './photos';
import type { SqlDb } from './sql';
import {
  applyServerEntries,
  deleteEntry,
  discardRejected,
  getEntry,
  getMeta,
  markAccepted,
  markRejected,
  migrateLocal,
  pendingChanges,
  pruneSynced,
  saveEntry,
  setMeta,
  unsyncedCount,
} from './store';

// Meal photos on the phone (REQ-LOG-006, REQ-LOG-010; ADR-0007 rules 1 and 5; D-14). The files are
// synthetic base64 text, not images.

const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const FILES = { thumbnail: 'dGh1bWI=', full: 'ZnVsbA==' };
const ITEM: MealItem = {
  source: 'own',
  ref: null,
  name: 'Synthetic bar',
  amount: { unit: 'g', value: 40 },
  kcal: 180,
  proteinG: 4,
  carbsG: null,
  fatG: null,
  fibreG: null,
  estimated: false,
};

let db: SqlDb;
let next = 0;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

function id(): string {
  next += 1;
  return `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
}

/** Saves a meal as the app does: a new photo's files in the same transaction. */
async function saveMeal(mealId: string, photo: MealPhoto | null, files?: { mediaId: string }, day = DAY) {
  const changeId = id();
  await saveEntry(
    db,
    'meal',
    { changeId, data: { id: mealId, day, mealType: 'lunch', tags: [], items: [ITEM], photo, recordedAt: AT } },
    files ? () => insertNewPhoto(db, { id: files.mediaId, mealId, createdAt: AT, files: FILES }) : undefined,
  );
  return changeId;
}

async function photoIds() {
  return (await db.getAllAsync<{ id: string }>('SELECT id FROM photos ORDER BY id', [])).map((row) => row.id);
}

describe('REQ-LOG-006 a photo taken on this phone', () => {
  it('is saved with its meal, waits to be uploaded, and counts as unsynced (D-14)', async () => {
    const mealId = id();
    const mediaId = id();

    await saveMeal(mealId, { kind: 'photo', mediaId }, { mediaId });

    expect(await getEntry(db, 'meal', mealId)).toMatchObject({ photo: { kind: 'photo', mediaId } });
    expect(await getPhoto(db, mediaId)).toEqual({ id: mediaId, mealId, ...FILES, uploaded: false });
    expect((await pendingChanges(db, 10))[0]?.data).toMatchObject({ photo: { kind: 'photo', mediaId } });
    expect(await unsyncedCount(db)).toBe(2);

    await markAccepted(db, (await pendingChanges(db, 10))[0]!.changeId);
    expect(await unsyncedCount(db)).toBe(1);
    expect((await photosToUpload(db)).map((photo) => photo.id)).toEqual([mediaId]);
    await markUploaded(db, mediaId);
    expect(await unsyncedCount(db)).toBe(0);
    expect(await photosToUpload(db)).toEqual([]);
  });

  it('a public link is kept with the meal, with no file', async () => {
    const mealId = id();
    const photo: MealPhoto = { kind: 'link', url: 'https://images.example.com/meal.jpg' };

    await saveMeal(mealId, photo);

    expect(await getEntry(db, 'meal', mealId)).toMatchObject({ photo });
    expect(await photoIds()).toEqual([]);
  });

  it('a meal saved without a photo has none', async () => {
    const mealId = id();
    await saveEntry(db, 'meal', {
      changeId: id(),
      data: { id: mealId, day: DAY, mealType: 'lunch', tags: [], items: [ITEM], recordedAt: AT },
    });

    expect(await getEntry(db, 'meal', mealId)).toMatchObject({ photo: null });
  });
});

describe('REQ-LOG-006 a photo leaves the phone with its meal (A-004)', () => {
  it('replacing or removing the photo removes the old one, uploaded or not', async () => {
    const mealId = id();
    const [first, second] = [id(), id()];
    await saveMeal(mealId, { kind: 'photo', mediaId: first }, { mediaId: first });

    await saveMeal(mealId, { kind: 'photo', mediaId: second }, { mediaId: second });
    expect(await photoIds()).toEqual([second]);

    await saveMeal(mealId, null);
    expect(await photoIds()).toEqual([]);
  });

  it('deleting the meal removes its photo at once', async () => {
    const mealId = id();
    const mediaId = id();
    await saveMeal(mealId, { kind: 'photo', mediaId }, { mediaId });

    await deleteEntry(db, 'meal', { changeId: id(), data: { id: mealId, deletedAt: AT } });

    expect(await photoIds()).toEqual([]);
  });

  it('a meal deleted on another phone, or pulled with another photo, takes its photo with it', async () => {
    const [kept, deleted] = [id(), id()];
    const [keptPhoto, deletedPhoto, newer] = [id(), id(), id()];
    await saveMeal(kept, { kind: 'photo', mediaId: keptPhoto }, { mediaId: keptPhoto });
    await saveMeal(deleted, { kind: 'photo', mediaId: deletedPhoto }, { mediaId: deletedPhoto });
    for (const change of await pendingChanges(db, 10)) await markAccepted(db, change.changeId);

    await applyServerEntries(db, 'meal', [
      { deleted: true, id: deleted },
      { id: kept, day: DAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId: newer }, recordedAt: AT },
    ]);

    expect(await photoIds()).toEqual([]);
    expect(await getEntry(db, 'meal', kept)).toMatchObject({ photo: { kind: 'photo', mediaId: newer } });
  });

  it('discarding a rejected new meal removes its photo', async () => {
    const mealId = id();
    const mediaId = id();
    const changeId = await saveMeal(mealId, { kind: 'photo', mediaId }, { mediaId });
    await markRejected(db, changeId, 'VALIDATION_FAILED');

    await discardRejected(db, changeId);

    expect(await photoIds()).toEqual([]);
  });
});

describe('ADR-0007 rule 1 pruning keeps photos that wait (D-14)', () => {
  it('an old synced meal stays while its photo waits to be uploaded, and goes with it afterwards', async () => {
    const mealId = id();
    const mediaId = id();
    await saveMeal(mealId, { kind: 'photo', mediaId }, { mediaId }, '2026-07-01');
    for (const change of await pendingChanges(db, 10)) await markAccepted(db, change.changeId);

    expect(await pruneSynced(db, '2026-10-28')).toBe(0);
    expect(await photoIds()).toEqual([mediaId]);

    await markUploaded(db, mediaId);
    expect(await pruneSynced(db, '2026-10-28')).toBe(1);
    expect(await photoIds()).toEqual([]);
  });
});

describe('ADR-0002 rule 7 files read from storage are kept in the encrypted database', () => {
  it('only for a photo a meal on the phone names; files already here are kept', async () => {
    const mealId = id();
    const mediaId = id();
    await applyServerEntries(db, 'meal', [
      { id: mealId, day: DAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId }, recordedAt: AT },
    ]);

    await cachePhotoFile(db, { id: id(), mealId, createdAt: AT }, { thumbnail: 'b3RoZXI=' });
    expect(await photoIds()).toEqual([]);

    await cachePhotoFile(db, { id: mediaId, mealId, createdAt: AT }, { thumbnail: FILES.thumbnail });
    await cachePhotoFile(db, { id: mediaId, mealId, createdAt: AT }, { full: FILES.full, thumbnail: 'bmV3ZXI=' });
    expect(await getPhoto(db, mediaId)).toEqual({ id: mediaId, mealId, ...FILES, uploaded: true });
    expect(await unsyncedCount(db)).toBe(0);
  });
});

describe('Local schema version 4', () => {
  it('ADR-0007 the update from version 3 keeps the meals, with no photo, and clears the cursor', async () => {
    const old = memoryDb();
    try {
      await old.execAsync(`
        CREATE TABLE sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE meals (id TEXT PRIMARY KEY, day TEXT NOT NULL, meal_type TEXT NOT NULL, tags TEXT NOT NULL,
          items TEXT NOT NULL, recorded_at TEXT NOT NULL, kcal REAL NOT NULL, protein_g REAL NOT NULL, carbs_g REAL,
          fat_g REAL, fibre_g REAL, sync_state TEXT NOT NULL);
        CREATE TABLE foods (source TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, food_group TEXT NOT NULL,
          aliases TEXT NOT NULL, protein_g REAL NOT NULL, fibre_g REAL NOT NULL, fat_g REAL NOT NULL, carbs_g REAL NOT NULL,
          kcal REAL NOT NULL, kcal_estimated INTEGER NOT NULL, PRIMARY KEY (source, code));
        PRAGMA user_version = 3;`);
      const mealId = id();
      await old.runAsync(`INSERT INTO meals VALUES (?, ?, 'lunch', '[]', ?, ?, 180, 4, NULL, NULL, NULL, 'synced')`, [
        mealId,
        DAY,
        JSON.stringify([ITEM]),
        AT,
      ]);
      await setMeta(old, 'cursor', '42');

      await migrateLocal(old);

      expect(await old.getFirstAsync('PRAGMA user_version', [])).toEqual({ user_version: 14 });
      expect(await getEntry(old, 'meal', mealId)).toMatchObject({ id: mealId, photo: null });
      expect(await getMeta(old, 'cursor')).toBeNull();
    } finally {
      await old.closeAsync();
    }
  });
});
