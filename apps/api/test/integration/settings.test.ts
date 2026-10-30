import { randomUUID } from 'node:crypto';
import type { SyncResponse } from '@fitsphere/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApi, type TestUser } from './app.ts';

// Settings through POST /v1/sync (REQ-ACC-001…003; MVP default, D-S1) and the self-access cases
// for them (REQ-NFR-001, D-20). The sync route's authorization block is in sync.test.ts.

const NOW = new Date('2026-10-30T03:30:00Z');
const SET_AT = '2026-10-30T02:00:00.000Z';

let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({ now: () => NOW });
});

afterAll(async () => {
  await api.close();
});

function setting(name: string, value: string, changeId: string = randomUUID()) {
  return { changeId, type: 'setting.set', data: { name, value, setAt: SET_AT } };
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

async function storedSettings(userId: string) {
  const { rows } = await api.db.query('select name, value from app.settings where user_id = $1 order by name', [userId]);
  return rows;
}

describe('REQ-ACC-001…003 settings through POST /v1/sync', () => {
  it('REQ-ACC-001 applies each setting and returns it in the pull', async () => {
    const user = await api.signUpWithAccount();

    const reply = await syncOk(user, [
      setting('theme', 'dark'),
      setting('body_weight_unit', 'lb'),
      setting('lifting_weight_unit', 'kg'),
    ]);

    expect(reply.results.map((result) => result.status)).toEqual(['accepted', 'accepted', 'accepted']);
    expect(reply.pull.settings).toEqual([
      { name: 'theme', value: 'dark', setAt: SET_AT, updatedAt: expect.stringMatching(/Z$/) },
      { name: 'body_weight_unit', value: 'lb', setAt: SET_AT, updatedAt: expect.stringMatching(/Z$/) },
      { name: 'lifting_weight_unit', value: 'kg', setAt: SET_AT, updatedAt: expect.stringMatching(/Z$/) },
    ]);
  });

  it('REQ-ACC-002 the units are independent, and a later change replaces the earlier value', async () => {
    const user = await api.signUpWithAccount();
    await syncOk(user, [setting('body_weight_unit', 'lb'), setting('lifting_weight_unit', 'lb')]);

    const reply = await syncOk(user, [setting('lifting_weight_unit', 'kg')]);

    expect(reply.results[0]?.status).toBe('accepted');
    expect(await storedSettings(user.id)).toEqual([
      { name: 'body_weight_unit', value: 'lb' },
      { name: 'lifting_weight_unit', value: 'kg' },
    ]);
  });

  it('ADR-0007 a change sent twice is applied once', async () => {
    const user = await api.signUpWithAccount();
    const first = setting('theme', 'dark');
    const replyOne = await syncOk(user, [first]);
    await syncOk(user, [setting('theme', 'light')]);

    const replyTwo = await syncOk(user, [first]);

    expect(replyTwo.results).toEqual(replyOne.results);
    expect(await storedSettings(user.id)).toEqual([{ name: 'theme', value: 'light' }]);
  });

  it('ADR-0007 rule 1 settings are always in the pull, and only when they changed', async () => {
    const user = await api.signUpWithAccount();
    const first = await syncOk(user, [setting('theme', 'dark')]);

    const repeat = await syncOk(user, [], first.cursor);
    expect(repeat.pull.settings).toEqual([]);

    const changed = await syncOk(user, [setting('theme', 'system')], first.cursor);
    expect(changed.pull.settings.map((entry) => entry.value)).toEqual(['system']);
  });

  it('REQ-ACC-001 an unknown name or value, a missing field or an extra field is rejected, without the values', async () => {
    const user = await api.signUpWithAccount();
    const extra = setting('theme', 'dark');
    (extra.data as Record<string, unknown>).userId = randomUUID();
    const missing = { changeId: randomUUID(), type: 'setting.set', data: { name: 'theme', value: 'dark' } };

    const reply = await syncOk(user, [
      setting('theme', 'sepia-7d1c'),
      setting('body_weight_unit', 'st'),
      setting('lifting_weight_unit', 'dark'),
      setting('language', 'en'),
      missing,
      extra,
    ]);

    expect(reply.results.map((result) => result.error?.code)).toEqual(Array(6).fill('VALIDATION_FAILED'));
    expect(JSON.stringify(reply.results)).not.toContain('sepia-7d1c');
    expect(await storedSettings(user.id)).toEqual([]);
  });

  it('REQ-ROLE-002 a setting change needs the Personal Training User role', async () => {
    const user = await api.signUpWithAccount();
    await api.db.query(`delete from app.user_roles where user_id = $1 and role = 'personal'`, [user.id]);

    const reply = await syncOk(user, [setting('theme', 'dark')]);

    expect(reply.results[0]?.error?.code).toBe('ROLE_NOT_ENABLED');
    expect(await storedSettings(user.id)).toEqual([]);
  });
});

describe('REQ-NFR-001 self-access for settings (D-20)', () => {
  it('REQ-NFR-001 a second user’s sync never changes or returns the first user’s settings, even with the same name and changeId', async () => {
    const userA = await api.signUpWithAccount();
    const userB = await api.signUpWithAccount();
    const changeId = randomUUID();
    await syncOk(userA, [setting('body_weight_unit', 'lb', changeId)]);

    const replyB = await syncOk(userB, [setting('body_weight_unit', 'kg', changeId)]);

    expect(replyB.results[0]?.status).toBe('accepted');
    expect(replyB.pull.settings.map((entry) => entry.value)).toEqual(['kg']);
    expect(await storedSettings(userA.id)).toEqual([{ name: 'body_weight_unit', value: 'lb' }]);
    const againA = await syncOk(userA, []);
    expect(againA.pull.settings.map((entry) => entry.value)).toEqual(['lb']);
  });
});
