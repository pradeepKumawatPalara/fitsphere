import { randomUUID } from 'node:crypto';
import { addDays, istToday } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// GET /v1/users/{userId}/measurements (D-114): the authorization table in the test strategy
// (self-access in the MVP, D-20), the dates asked for and paging. Synthetic values only.

const NOW = new Date('2026-11-17T03:30:00Z');
const TODAY = istToday(NOW);
// Two days older than the phone's 90, one of today's weeks.
const DAYS = ['2024-03-03', '2024-12-15', addDays(TODAY, -2)];

let api: Awaited<ReturnType<typeof startTestApi>>;
let owner: TestUser & { id: string };

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
  owner = await api.signUpWithAccount();
  const changes = DAYS.map((day, index) => ({
    changeId: randomUUID(),
    type: 'measurements.set',
    data: {
      day,
      upperWaistMm: 900 + index,
      lowerWaistMm: 950 + index,
      chestMm: index === 0 ? 1000 : null,
      hipsMm: null,
      armMm: null,
      thighMm: null,
      notes: index === 0 ? 'Synthetic note' : null,
      recordedAt: '2026-11-17T02:00:00.000Z',
    },
  }));
  const sync = await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { cursor: null, changes },
  });
  expect(sync.json().results.map((result: { status: string }) => result.status)).toEqual(['accepted', 'accepted', 'accepted']);
});

afterAll(async () => {
  await api.close();
});

function read(userId: string, token: string | null, query = `from=2000-01-01&to=${TODAY}`) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/users/${userId}/measurements?${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('authorization: GET /v1/users/:userId/measurements', () => {
  it('REQ-NFR-001 the user themselves gets 200 with their measurements, oldest first', async () => {
    const response = await read(owner.id, owner.token);

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { day: string }) => item.day)).toEqual(DAYS);
    expect(response.json().nextCursor).toBeNull();
  });

  it('REQ-NFR-001 another signed-in user with an account gets 404', async () => {
    const other = await api.signUpWithAccount();

    const response = await read(owner.id, other.token);

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: 'NOT_FOUND', message: 'Not available.', details: null });
  });

  it('T-01 a user ID that does not exist gets the same 404 as another user', async () => {
    const other = await api.signUpWithAccount();

    for (const response of [await read(randomUUID(), other.token), await read(owner.id, other.token), await read('not-a-uuid', other.token)]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error).toEqual({
        code: 'NOT_FOUND',
        message: 'Not available.',
        retryable: false,
        requestId: expect.any(String),
        details: null,
      });
    }
  });

  it('REQ-NFR-001 no token, an expired token or one signed by another key gets 401', async () => {
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, owner.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, owner.subject),
    ]) {
      expect((await read(owner.id, token)).statusCode).toBe(401);
    }
  });

  it('REQ-ACC-010 signed in without an account set up gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await read(owner.id, user.token);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });
});

describe('REQ-PRG-006 measurements of the dates asked for (D-114)', () => {
  it('REQ-PRG-006 keeps to the requested IST days and sends every field', async () => {
    const response = await read(owner.id, owner.token, 'from=2024-01-01&to=2024-12-31');

    expect(response.json().items).toEqual([
      {
        day: '2024-03-03',
        upperWaistMm: 900,
        lowerWaistMm: 950,
        chestMm: 1000,
        hipsMm: null,
        armMm: null,
        thighMm: null,
        notes: 'Synthetic note',
        recordedAt: '2026-11-17T02:00:00.000Z',
        updatedAt: expect.any(String),
      },
      expect.objectContaining({ day: '2024-12-15', upperWaistMm: 901, lowerWaistMm: 951, chestMm: null, notes: null }),
    ]);
  });

  it('api-conventions pages with limit and an opaque cursor', async () => {
    const first = (await read(owner.id, owner.token, `from=2000-01-01&to=${TODAY}&limit=2`)).json();
    const second = (await read(owner.id, owner.token, `from=2000-01-01&to=${TODAY}&limit=2&cursor=${first.nextCursor}`)).json();

    expect([...first.items, ...second.items].map((item: { day: string }) => item.day)).toEqual(DAYS);
    expect(second.nextCursor).toBeNull();
  });

  it('api-conventions refuses missing days, unknown query fields, a limit over 500 and a cursor not its own', async () => {
    for (const query of [
      `to=${TODAY}`,
      `from=${TODAY}&to=${TODAY}&userId=x`,
      `from=${TODAY}&to=${TODAY}&limit=501`,
      `from=${TODAY}&to=${TODAY}&cursor=bm90LW91cnM`,
    ]) {
      const response = await read(owner.id, owner.token, query);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
  });
});
