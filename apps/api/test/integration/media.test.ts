import { randomUUID } from 'node:crypto';
import { istToday, type MealItem, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MediaStorage } from '../../src/storage/mediaStorage.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// Meal photos and public image links (REQ-LOG-006, REQ-LOG-010; ADR-0002 rules 3–5 and 8) with a
// fake storage. The photo files never pass through the API. All values are synthetic.

let clock = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(clock);
const AT = `${TODAY}T02:00:00.000Z`;

const ITEM: MealItem = {
  source: 'own',
  ref: null,
  name: 'Synthetic snack bar',
  amount: { unit: 'g', value: 40 },
  kcal: 180,
  proteinG: 4,
  carbsG: 24,
  fatG: 8,
  fibreG: null,
  estimated: false,
};

/** A fake storage: links name the key and their purpose; removals are recorded. */
const removed: string[] = [];
let failRemoval = false;
const storage: MediaStorage = {
  uploadLinks: async (keys) => keys.map((key) => `https://storage.test/upload/${key}`),
  viewLinks: async (keys) => keys.map((key) => `https://storage.test/view/${key}`),
  async remove(keys) {
    if (failRemoval) throw new Error('storage down');
    removed.push(...keys);
  },
};

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => clock, storage });
});

afterAll(async () => {
  await api.close();
});

beforeEach(() => {
  clock = new Date('2026-10-28T03:30:00Z');
  removed.length = 0;
  failRemoval = false;
});

function mealSet(id: string, photo: unknown) {
  return {
    changeId: randomUUID(),
    type: 'meal.set',
    data: { id, day: TODAY, mealType: 'lunch', tags: [], items: [ITEM], photo, recordedAt: AT },
  };
}

async function sync(user: TestUser, changes: unknown[]): Promise<SyncResponse> {
  const response = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor: null, changes },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

/** A user with a synced meal that has a photo. */
async function userWithPhoto() {
  const user = await api.signUpWithAccount();
  const mealId = randomUUID();
  const mediaId = randomUUID();
  const reply = await sync(user, [mealSet(mealId, { kind: 'photo', mediaId })]);
  expect(reply.results[0]?.status).toBe('accepted');
  return { user, mealId, mediaId };
}

function upload(token: string | null, userId: string, mediaId: string) {
  return api.app.inject({
    method: 'POST',
    url: `/v1/users/${userId}/media/${mediaId}/upload`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function view(token: string | null, userId: string, mediaId: string) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/users/${userId}/media/${mediaId}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

type Call = typeof upload;

/** The same authorization cases for both routes (REQ-NFR-001; D-20 self-access). */
function authorizationCases(call: Call) {
  it('REQ-NFR-001 no token, an expired token or another key get 401', async () => {
    const { user, mediaId } = await userWithPhoto();
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ]) {
      expect((await call(token, user.id, mediaId)).statusCode).toBe(401);
    }
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const { user, mediaId } = await userWithPhoto();
    const stranger = await api.signUp();

    const response = await call(stranger.token, user.id, mediaId);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-NFR-001 another user gets 404, by the owner’s ID or by their own (D-20 self-access)', async () => {
    const { user, mediaId } = await userWithPhoto();
    const other = await api.signUpWithAccount();

    expect((await call(other.token, user.id, mediaId)).statusCode).toBe(404);
    expect((await call(other.token, other.id, mediaId)).statusCode).toBe(404);
  });

  it('REQ-LOG-006 the user gets links for their own photo', async () => {
    const { user, mediaId } = await userWithPhoto();

    expect((await call(user.token, user.id, mediaId)).statusCode).toBe(200);
  });
}

describe('authorization: POST /v1/users/:userId/media/:mediaId/upload', () => {
  authorizationCases(upload);
});

describe('authorization: GET /v1/users/:userId/media/:mediaId', () => {
  authorizationCases(view);
});

describe('REQ-LOG-006 photo links (ADR-0002 rule 3)', () => {
  it('upload links: the viewing copy and the thumbnail, at keys made only of IDs, for 10 minutes', async () => {
    const { user, mediaId } = await userWithPhoto();

    expect((await upload(user.token, user.id, mediaId)).json()).toEqual({
      photoUrl: `https://storage.test/upload/meals/${user.id}/${mediaId}.jpg`,
      thumbnailUrl: `https://storage.test/upload/meals/${user.id}/${mediaId}-thumb.jpg`,
      expiresAt: '2026-10-28T03:40:00.000Z',
    });
  });

  it('viewing links expire after 5 minutes (D-16)', async () => {
    const { user, mediaId } = await userWithPhoto();

    expect((await view(user.token, user.id, mediaId)).json()).toEqual({
      photoUrl: `https://storage.test/view/meals/${user.id}/${mediaId}.jpg`,
      thumbnailUrl: `https://storage.test/view/meals/${user.id}/${mediaId}-thumb.jpg`,
      expiresAt: '2026-10-28T03:35:00.000Z',
    });
  });

  it('a photo ID the server does not know, or that is not an ID, gets 404', async () => {
    const user = await api.signUpWithAccount();

    expect((await view(user.token, user.id, randomUUID())).statusCode).toBe(404);
    expect((await upload(user.token, user.id, 'not-an-id')).statusCode).toBe(404);
  });

  it('error model: without storage set up, 503', async () => {
    const without = await startTestApi({ now: () => clock, storage: null });
    try {
      const user = await without.signUpWithAccount();
      const mediaId = randomUUID();
      await without.app.inject({
        method: 'POST',
        url: '/v1/sync',
        headers: { authorization: `Bearer ${user.token}` },
        payload: { cursor: null, changes: [mealSet(randomUUID(), { kind: 'photo', mediaId })] },
      });

      const response = await without.app.inject({
        method: 'GET',
        url: `/v1/users/${user.id}/media/${mediaId}`,
        headers: { authorization: `Bearer ${user.token}` },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('SERVICE_UNAVAILABLE');
    } finally {
      await without.close();
    }
  });
});

describe('REQ-LOG-006 a meal’s photo through sync', () => {
  it('is pulled with the meal', async () => {
    const user = await api.signUpWithAccount();
    const mediaId = randomUUID();

    const reply = await sync(user, [mealSet(randomUUID(), { kind: 'photo', mediaId })]);

    expect(reply.pull.meals[0]).toMatchObject({ deleted: false, photo: { kind: 'photo', mediaId } });
  });

  it('Q-032 deleting the meal deletes its photo: no more links, and its files leave storage', async () => {
    const { user, mealId, mediaId } = await userWithPhoto();

    await sync(user, [{ changeId: randomUUID(), type: 'meal.delete', data: { id: mealId, deletedAt: AT } }]);

    expect((await view(user.token, user.id, mediaId)).statusCode).toBe(404);
    expect((await upload(user.token, user.id, mediaId)).statusCode).toBe(404);
    expect(removed).toEqual([`meals/${user.id}/${mediaId}.jpg`, `meals/${user.id}/${mediaId}-thumb.jpg`]);
  });

  it('replacing or removing the photo deletes the old one', async () => {
    const { user, mealId, mediaId } = await userWithPhoto();
    const second = randomUUID();

    await sync(user, [mealSet(mealId, { kind: 'photo', mediaId: second })]);
    expect((await view(user.token, user.id, mediaId)).statusCode).toBe(404);
    expect((await view(user.token, user.id, second)).statusCode).toBe(200);

    await sync(user, [mealSet(mealId, null)]);
    expect((await view(user.token, user.id, second)).statusCode).toBe(404);
  });

  it('editing the meal and keeping its photo keeps the photo', async () => {
    const { user, mealId, mediaId } = await userWithPhoto();

    const reply = await sync(user, [mealSet(mealId, { kind: 'photo', mediaId })]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect((await view(user.token, user.id, mediaId)).statusCode).toBe(200);
    expect(removed).toEqual([]);
  });

  it('a photo ID already used by another meal, or deleted, is refused, and the meal is unchanged', async () => {
    const { user, mealId, mediaId } = await userWithPhoto();
    const otherMeal = randomUUID();

    const reused = await sync(user, [mealSet(otherMeal, { kind: 'photo', mediaId })]);
    expect(reused.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });

    await sync(user, [mealSet(mealId, null)]);
    const back = await sync(user, [mealSet(mealId, { kind: 'photo', mediaId })]);
    expect(back.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
    const { rows } = await api.db.query('select photo from app.meals where user_id = $1 and id = $2', [user.id, mealId]);
    expect(rows).toEqual([{ photo: null }]);
  });

  it('REQ-NFR-001 another user using the same photo ID only ever claims their own', async () => {
    const { user, mediaId } = await userWithPhoto();
    const other = await api.signUpWithAccount();

    const reply = await sync(other, [mealSet(randomUUID(), { kind: 'photo', mediaId })]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect((await view(other.token, other.id, mediaId)).json().photoUrl).toBe(`https://storage.test/view/meals/${other.id}/${mediaId}.jpg`);
    expect((await view(user.token, user.id, mediaId)).statusCode).toBe(200);
  });

  it('files are removed again until every upload link issued before the deletion has expired', async () => {
    const { user, mealId, mediaId } = await userWithPhoto();
    await sync(user, [mealSet(mealId, null)]);
    expect(removed).toEqual([`meals/${user.id}/${mediaId}.jpg`, `meals/${user.id}/${mediaId}-thumb.jpg`]);

    clock = new Date(clock.getTime() + 5 * 60 * 1000);
    await sync(user, []);
    expect(removed).toHaveLength(4);

    clock = new Date(clock.getTime() + 6 * 60 * 1000);
    await sync(user, []);
    await sync(user, []);
    expect(removed).toHaveLength(6);
    const { rows } = await api.db.query('select files_removed_at is not null as done from app.media where user_id = $1', [user.id]);
    expect(rows).toEqual([{ done: true }]);
  });

  it('when storage cannot remove the files, the sync still succeeds and they wait', async () => {
    const { user, mealId } = await userWithPhoto();
    failRemoval = true;

    await sync(user, [mealSet(mealId, null)]);

    const { rows } = await api.db.query('select deleted_at is not null as deleted, files_removed_at from app.media where user_id = $1', [
      user.id,
    ]);
    expect(rows).toEqual([{ deleted: true, files_removed_at: null }]);
  });
});

describe('REQ-LOG-010 a public image link instead of a photo', () => {
  it('is stored with the meal and pulled; FitSphere keeps no file for it', async () => {
    const user = await api.signUpWithAccount();
    const photo = { kind: 'link', url: 'https://images.example.com/meal.jpg' };

    const reply = await sync(user, [mealSet(randomUUID(), photo)]);

    expect(reply.pull.meals[0]).toMatchObject({ photo });
    expect((await api.db.query('select 1 from app.media where user_id = $1', [user.id])).rowCount).toBe(0);
  });

  it('only https links with a host name and no user name or password', async () => {
    const user = await api.signUpWithAccount();

    for (const url of [
      'http://images.example.com/meal.jpg',
      'javascript:alert(1)',
      'https://localhost/meal.jpg',
      'https://name:secret@images.example.com/meal.jpg',
      `https://images.example.com/${'a'.repeat(2_000)}`,
    ]) {
      const reply = await sync(user, [mealSet(randomUUID(), { kind: 'link', url })]);
      expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
    }
  });
});
