import type { MealItem } from '@fitsphere/shared';
import { insertNewPhoto, getPhoto } from '../local/photos';
import type { SqlDb } from '../local/sql';
import { getMeta, migrateLocal, saveEntry, unsyncedCount } from '../local/store';
import { base64ToBytes } from '../photos/bytes';
import { loadPhoto } from '../photos/loadPhoto';
import { deps, fakeAuthClient, fakeSession, ME } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { uploadPhotos } from './photoSync';
import { syncNow } from './syncClient';

// Meal photo files between the phone and storage (REQ-LOG-006; ADR-0002 rules 3 and 7; D-14), with
// the fake API and storage. The files are synthetic base64 text, not images.

const NOW = new Date('2026-10-28T03:30:00Z');
const DAY = '2026-10-27';
const AT = `${DAY}T03:00:00.000Z`;
const FILES = { thumbnail: 'dGh1bWI=', full: 'ZnVsbA==' };
const MEAL_ID = '00000000-0000-4000-8000-0000000000a1';
const MEDIA_ID = '00000000-0000-4000-8000-0000000000c1';
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
let server: ReturnType<typeof fakeServer>;
let auth: ReturnType<typeof deps>;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
  server = fakeServer(NOW);
  auth = deps(fakeAuthClient(fakeSession()), server.fetchImpl);
});

afterEach(async () => {
  await db.closeAsync();
});

async function mealWithNewPhoto() {
  await saveEntry(
    db,
    'meal',
    {
      changeId: '00000000-0000-4000-8000-0000000000b1',
      data: { id: MEAL_ID, day: DAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId: MEDIA_ID }, recordedAt: AT },
    },
    () => insertNewPhoto(db, { id: MEDIA_ID, mealId: MEAL_ID, createdAt: AT, files: FILES }),
  );
}

describe('REQ-LOG-006 uploading a photo taken on this phone', () => {
  it('after its meal syncs, both files go straight to storage as JPEG, and it is no longer unsynced', async () => {
    await mealWithNewPhoto();
    expect(await syncNow(db, auth, () => NOW)).toBe('synced');

    expect(await uploadPhotos(db, auth)).toBe('done');

    expect(server.state.files.get(`${MEDIA_ID}.jpg`)).toEqual(base64ToBytes(FILES.full));
    expect(server.state.files.get(`${MEDIA_ID}-thumb.jpg`)).toEqual(base64ToBytes(FILES.thumbnail));
    const puts = jest.mocked(server.fetchImpl).mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(puts.map(([, init]) => init?.headers)).toEqual([{ 'Content-Type': 'image/jpeg' }, { 'Content-Type': 'image/jpeg' }]);
    expect(await getPhoto(db, MEDIA_ID)).toMatchObject({ uploaded: true });
    expect(await unsyncedCount(db)).toBe(0);
  });

  it('asks for the FitSphere ID once (GET /v1/me) and uses it in the path', async () => {
    await mealWithNewPhoto();
    await syncNow(db, auth, () => NOW);

    await uploadPhotos(db, auth);
    await loadPhoto(db, auth, { id: MEDIA_ID, mealId: MEAL_ID }, 'full');

    expect(await getMeta(db, 'account_id')).toBe(ME.user.id);
    expect(server.calls.filter((call) => call.path === '/me')).toHaveLength(1);
    expect(server.calls.some((call) => call.path === `/users/${ME.user.id}/media/${MEDIA_ID}/upload`)).toBe(true);
  });

  it('waits while its meal is not on the server yet: no link is asked for', async () => {
    await mealWithNewPhoto();

    expect(await uploadPhotos(db, auth)).toBe('done');

    expect(server.calls.filter((call) => call.path.includes('/media/'))).toEqual([]);
    expect(await getPhoto(db, MEDIA_ID)).toMatchObject({ uploaded: false });
  });

  it('offline: nothing is lost; it is uploaded later', async () => {
    await mealWithNewPhoto();
    await syncNow(db, auth, () => NOW);
    server.state.offline = true;

    expect(await uploadPhotos(db, auth)).toBe('offline');
    expect(await getPhoto(db, MEDIA_ID)).toMatchObject({ uploaded: false });

    server.state.offline = false;
    expect(await uploadPhotos(db, auth)).toBe('done');
    expect(await getPhoto(db, MEDIA_ID)).toMatchObject({ uploaded: true });
  });
});

describe('REQ-NFR-006 viewing a photo (ADR-0002 rule 7)', () => {
  it('reads a photo from another phone once with a viewing link, then from this phone', async () => {
    server.storeMealFromElsewhere({ id: MEAL_ID, day: DAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId: MEDIA_ID }, recordedAt: AT });
    server.state.files.set(`${MEDIA_ID}-thumb.jpg`, base64ToBytes(FILES.thumbnail));
    await syncNow(db, auth, () => NOW);
    const photo = { id: MEDIA_ID, mealId: MEAL_ID };

    expect(await loadPhoto(db, auth, photo, 'thumbnail')).toEqual({ kind: 'ready', base64: FILES.thumbnail });
    server.state.offline = true;
    expect(await loadPhoto(db, auth, photo, 'thumbnail')).toEqual({ kind: 'ready', base64: FILES.thumbnail });
    expect(await getPhoto(db, MEDIA_ID)).toMatchObject({ thumbnail: FILES.thumbnail, full: null, uploaded: true });

    expect(await loadPhoto(db, auth, photo, 'full')).toEqual({ kind: 'offline' });
    server.state.offline = false;
    expect(await loadPhoto(db, auth, photo, 'full')).toEqual({ kind: 'unavailable' });
  });
});
