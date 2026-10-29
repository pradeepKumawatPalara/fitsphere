import { randomUUID } from 'node:crypto';
import { addDays, istToday } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// The authorization table in the test strategy (self-access in the MVP, D-20).

const NOW = new Date('2026-10-28T03:30:00Z');
const TODAY = istToday(NOW);

let api: Awaited<ReturnType<typeof startTestApi>>;
let owner: TestUser & { id: string };

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
  owner = await api.signUpWithAccount();
  const changes = [0, 1, 2, 3, 4].map((offset) => {
    const day = addDays(TODAY, -offset);
    return { changeId: randomUUID(), type: 'weighIn.set', data: { day, weightGrams: 70_000 + offset, recordedAt: `${day}T02:00:00.000Z` } };
  });
  await api.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${owner.token}` },
    payload: { cursor: null, changes },
  });
});

afterAll(async () => {
  await api.close();
});

function read(userId: string, token: string | null, query = `from=${addDays(TODAY, -10)}&to=${TODAY}`) {
  return api.app.inject({
    method: 'GET',
    url: `/v1/users/${userId}/weigh-ins?${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('authorization: GET /v1/users/:userId/weigh-ins', () => {
  it('REQ-NFR-001 the user themselves gets 200 with their weigh-ins, oldest first', async () => {
    const response = await read(owner.id, owner.token);

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { day: string }) => item.day)).toEqual(
      [4, 3, 2, 1, 0].map((offset) => addDays(TODAY, -offset)),
    );
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

    const missing = await read(randomUUID(), other.token);
    const someoneElse = await read(owner.id, other.token);
    const notAnId = await read('not-a-uuid', other.token);

    for (const response of [missing, someoneElse, notAnId]) {
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

describe('REQ-PRG-001 weigh-in history', () => {
  it('REQ-PRG-001 keeps to the requested IST days', async () => {
    const response = await read(owner.id, owner.token, `from=${addDays(TODAY, -1)}&to=${TODAY}`);

    expect(response.json().items).toEqual([
      expect.objectContaining({ day: addDays(TODAY, -1), weightGrams: 70_001 }),
      expect.objectContaining({ day: TODAY, weightGrams: 70_000 }),
    ]);
  });

  it('api-conventions pages with limit and an opaque cursor', async () => {
    const first = (await read(owner.id, owner.token, `from=${addDays(TODAY, -10)}&to=${TODAY}&limit=2`)).json();
    const second = (
      await read(owner.id, owner.token, `from=${addDays(TODAY, -10)}&to=${TODAY}&limit=2&cursor=${first.nextCursor}`)
    ).json();
    const third = (
      await read(owner.id, owner.token, `from=${addDays(TODAY, -10)}&to=${TODAY}&limit=2&cursor=${second.nextCursor}`)
    ).json();

    const days = [first, second, third].flatMap((page) => page.items.map((item: { day: string }) => item.day));
    expect(days).toEqual([4, 3, 2, 1, 0].map((offset) => addDays(TODAY, -offset)));
    expect(third.nextCursor).toBeNull();
  });

  it('api-conventions refuses missing days, unknown query fields and a limit over 500', async () => {
    for (const query of [`to=${TODAY}`, `from=${TODAY}&to=${TODAY}&userId=x`, `from=${TODAY}&to=${TODAY}&limit=501`]) {
      const response = await read(owner.id, owner.token, query);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
    }
  });
});
