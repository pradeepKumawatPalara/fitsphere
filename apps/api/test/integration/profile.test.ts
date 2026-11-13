import { randomUUID } from 'node:crypto';
import { istToday, type MealItem, type SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { photoKeys, type MediaStorage } from '../../src/storage/mediaStorage.ts';
import { startTestApi, type TestUser } from './app.ts';

// The profile through POST /v1/sync (REQ-ACC-011; docs/plans/user-profile.md), its photo through
// the media routes, and the self-access cases (REQ-NFR-001, D-20). Every value is synthetic.

const NOW = new Date('2026-11-03T06:30:00Z');
const TODAY = istToday(NOW);
const SET_AT = '2026-11-03T06:00:00.000Z';

const FULL = {
  name: 'Synthetic Person',
  dateOfBirth: '1994-06-14',
  sex: 'female',
  heightMm: 1620,
  phone: '+919876543210',
  address: { line1: '12 Example Lane', line2: 'Near the park', city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
  photoMediaId: null as string | null,
  setAt: SET_AT,
};
const EMPTY = { name: null, dateOfBirth: null, sex: null, heightMm: null, phone: null, address: null, photoMediaId: null, setAt: SET_AT };

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

/** A fake storage: links name the key; removals are recorded. */
const removed: string[] = [];
const storage: MediaStorage = {
  uploadLinks: async (keys) => keys.map((key) => `https://storage.test/upload/${key}`),
  viewLinks: async (keys) => keys.map((key) => `https://storage.test/view/${key}`),
  async remove(keys) {
    removed.push(...keys);
  },
};

const lines: string[] = [];
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW, storage, log: { level: 'info', stream: { write: (line) => lines.push(line) } } });
});

afterAll(async () => {
  await api.close();
});

beforeEach(() => {
  removed.length = 0;
  lines.length = 0;
});

function profileSet(data: Record<string, unknown>, changeId: string = randomUUID()) {
  return { changeId, type: 'profile.set', data };
}

async function syncOk(user: TestUser, changes: unknown[], cursor: string | null = null): Promise<SyncResponse> {
  const response = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor, changes },
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function storedProfile(userId: string) {
  const { rows } = await api.db.query('select * from app.profiles where user_id = $1', [userId]);
  return rows[0] ?? null;
}

type Account = TestUser & { id: string };

function view(user: Account, mediaId: string, owner = user.id) {
  return api.app.inject({ method: 'GET', url: `/v1/users/${owner}/media/${mediaId}`, headers: { authorization: `Bearer ${user.token}` } });
}

describe('REQ-ACC-011 the profile through POST /v1/sync', () => {
  it('REQ-ACC-011 stores the whole profile and returns it in the pull, the height in millimetres', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [profileSet(FULL)]);

    expect(reply.results[0]).toMatchObject({ status: 'accepted', error: null });
    expect(reply.pull.profiles).toEqual([{ ...FULL, updatedAt: expect.stringMatching(/Z$/) }]);
    expect(await storedProfile(user.id)).toMatchObject({ height_mm: 1620, phone: '+919876543210', pin_code: '411001' });
  });

  it('REQ-ACC-011 every field is optional, and a later profile replaces the earlier one', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [profileSet(FULL)]);

    const reply = await syncOk(user, [profileSet({ ...EMPTY, name: '  Synthetic  ' })]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(reply.pull.profiles).toEqual([{ ...EMPTY, name: 'Synthetic', updatedAt: expect.stringMatching(/Z$/) }]);
    expect(await storedProfile(user.id)).toMatchObject({ address_line1: null, city: null, pin_code: null, phone: null });
  });

  it('ADR-0007 a change sent twice is applied once', async () => {
    const user = await api.signUpWithAccount();
    const first = profileSet({ ...EMPTY, name: 'First' });
    await syncOk(user, [first]);
    await syncOk(user, [profileSet({ ...EMPTY, name: 'Second' })]);

    const reply = await syncOk(user, [first]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect((await storedProfile(user.id))?.name).toBe('Second');
  });

  it.each([
    ['a date of birth under 18 today in IST', { dateOfBirth: '2008-11-04' }],
    ['a date of birth over 120', { dateOfBirth: '1905-11-02' }],
    ['a phone that is not an Indian mobile number', { phone: '+915876543210' }],
    ['an address without its PIN code', { address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra' } }],
    ['a height under 50 cm', { heightMm: 499 }],
    ['a name with a digit (D-100)', { name: 'Asha 2' }],
    ['a PIN code starting with 0 (D-100)', { address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '011001' } }],
    ['a height over 300 cm', { heightMm: 3001 }],
    ['a field the profile does not have', { userId: randomUUID() }],
  ])('REQ-ACC-011 refuses %s and keeps the profile as it was', async (_case, change) => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [profileSet(FULL)]);

    const reply = await syncOk(user, [profileSet({ ...FULL, name: 'Changed', ...change })]);

    expect(reply.results[0]).toMatchObject({ status: 'rejected', error: { code: 'VALIDATION_FAILED' } });
    expect((await storedProfile(user.id))?.name).toBe('Synthetic Person');
  });

  it('REQ-ACC-010 accepts a date of birth that makes the user 18 today in IST', async () => {
    const user = await api.signUpWithAccount();
    const eighteen = `${Number(TODAY.slice(0, 4)) - 18}${TODAY.slice(4)}`;

    const reply = await syncOk(user, [profileSet({ ...EMPTY, dateOfBirth: eighteen })]);

    expect(reply.results[0]?.status).toBe('accepted');
  });

  it('REQ-NFR-001 a user only ever pulls their own profile, and no change can name another user', async () => {
    const owner = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    await syncOk(owner, [profileSet(FULL)]);

    const reply = await syncOk(other, []);

    expect(reply.pull.profiles).toEqual([]);
    expect(await storedProfile(other.id)).toBeNull();
  });

  it('invariant #7 no profile value is logged', async () => {
    const user = await api.signUpWithAccount();

    await syncOk(user, [profileSet(FULL)]);

    const logged = lines.join('\n');
    for (const value of ['Synthetic Person', '1994-06-14', '9876543210', 'Example Lane', '411001', 'Maharashtra', 'female']) {
      expect(logged).not.toContain(value);
    }
  });
});

describe('REQ-ACC-011 the profile photo', () => {
  it('ADR-0002 is a photo of kind "profile": the user gets its upload and viewing links', async () => {
    const user = await api.signUpWithAccount();
    const mediaId = randomUUID();

    await syncOk(user, [profileSet({ ...FULL, photoMediaId: mediaId })]);

    const { rows } = await api.db.query('select kind, meal_id from app.media where user_id = $1 and id = $2', [user.id, mediaId]);
    expect(rows).toEqual([{ kind: 'profile', meal_id: null }]);
    const upload = await api.app.inject({
      method: 'POST',
      url: `/v1/users/${user.id}/media/${mediaId}/upload`,
      headers: { authorization: `Bearer ${user.token}` },
    });
    expect(upload.statusCode).toBe(200);
    expect((await view(user, mediaId)).statusCode).toBe(200);
  });

  it('REQ-NFR-001 another user gets 404 for it', async () => {
    const owner = await api.signUpWithAccount();
    const other = await api.signUpWithAccount();
    const mediaId = randomUUID();
    await syncOk(owner, [profileSet({ ...EMPTY, photoMediaId: mediaId })]);

    expect((await view(other, mediaId, owner.id)).statusCode).toBe(404);
    expect((await view(other, mediaId, other.id)).statusCode).toBe(404);
  });

  it('replacing or removing the photo deletes the old one: no more links, and its files leave storage', async () => {
    const user = await api.signUpWithAccount();
    const [first, second] = [randomUUID(), randomUUID()];
    await syncOk(user, [profileSet({ ...EMPTY, photoMediaId: first })]);

    await syncOk(user, [profileSet({ ...EMPTY, photoMediaId: second })]);
    expect((await view(user, first)).statusCode).toBe(404);
    expect((await view(user, second)).statusCode).toBe(200);

    await syncOk(user, [profileSet(EMPTY)]);
    expect((await view(user, second)).statusCode).toBe(404);
    expect(removed).toEqual(expect.arrayContaining([...photoKeys(user.id, first), ...photoKeys(user.id, second)]));
  });

  it('keeping the photo while changing the rest keeps it', async () => {
    const user = await api.signUpWithAccount();
    const mediaId = randomUUID();
    await syncOk(user, [profileSet({ ...EMPTY, photoMediaId: mediaId })]);

    const reply = await syncOk(user, [profileSet({ ...FULL, photoMediaId: mediaId })]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect((await view(user, mediaId)).statusCode).toBe(200);
  });

  it('a photo never moves: a meal photo cannot become the profile photo, nor the profile photo a meal’s', async () => {
    const user = await api.signUpWithAccount();
    const [mealPhoto, profilePhoto] = [randomUUID(), randomUUID()];
    const meal = (mediaId: string) => ({
      changeId: randomUUID(),
      type: 'meal.set',
      data: { id: randomUUID(), day: TODAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId }, recordedAt: SET_AT },
    });
    await syncOk(user, [meal(mealPhoto), profileSet({ ...EMPTY, photoMediaId: profilePhoto })]);

    const reply = await syncOk(user, [profileSet({ ...EMPTY, photoMediaId: mealPhoto }), meal(profilePhoto)]);

    expect(reply.results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect((await storedProfile(user.id))?.photo_media_id).toBe(profilePhoto);
  });
});
