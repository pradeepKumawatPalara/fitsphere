import { randomUUID } from 'node:crypto';
import { AI_CONSENT_TEXT_VERSION, istToday, type MealItem } from '@fitsphere/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { photoKeys, type MediaStorage } from '../../src/storage/mediaStorage.ts';
import { createTestKeys, signToken, TEST_SECRET_KEY } from '../helpers/auth.ts';
import { startTestApi, type TestUser } from './app.ts';

// DELETE /v1/me (REQ-ACC-009; Q-048 MVP default; ADR-0004 rule 7 and validation step 7; D-31), with
// a fake storage and a fake Supabase Auth admin. All values are synthetic.

const NOW = new Date('2026-10-30T03:30:00Z');
const TODAY = istToday(NOW);
const AT = `${TODAY}T02:00:00.000Z`;

const ITEM: MealItem = {
  source: 'own',
  ref: null,
  name: 'Synthetic dal bowl',
  amount: { unit: 'g', value: 250 },
  kcal: 310,
  proteinG: 14,
  carbsG: 40,
  fatG: 9,
  fibreG: 6,
  estimated: false,
};

/** A fake storage that records the files removed. */
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

const lines: string[] = [];
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  api = await startTestApi({
    now: () => NOW,
    storage,
    log: { level: 'info', stream: { write: (line) => lines.push(line) } },
  });
});

afterAll(async () => {
  await api.close();
});

beforeEach(() => {
  removed.length = 0;
  failRemoval = false;
  api.supabase.state.adminFailure = null;
  api.supabase.adminCalls.length = 0;
  lines.length = 0;
});

function change(type: string, data: Record<string, unknown>) {
  return { changeId: randomUUID(), type, data };
}

async function sync(user: TestUser, changes: unknown[], server = api) {
  const response = await server.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { cursor: null, changes },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json().results.map((result: { status: string }) => result.status)).not.toContain('rejected');
}

function deleteMe(token?: string, server = api) {
  return server.app.inject({
    method: 'DELETE',
    url: '/v1/me',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

/**
 * A user with data in every table a user owns: a meal whose first photo was replaced (deleted, and
 * not yet marked as removed) and whose second is live, a profile with its photo (REQ-ACC-011), plus
 * a setting and a consent record.
 */
async function userWithData(server = api) {
  const user = await server.signUpWithAccount();
  const mealId = randomUUID();
  const [oldPhoto, livePhoto, profilePhoto] = [randomUUID(), randomUUID(), randomUUID()];
  const meal = (mediaId: string) =>
    change('meal.set', { id: mealId, day: TODAY, mealType: 'lunch', tags: [], items: [ITEM], photo: { kind: 'photo', mediaId }, recordedAt: AT });
  await sync(user, [
    change('weighIn.set', { day: TODAY, weightGrams: 71_234, recordedAt: AT }),
    change('steps.set', { day: TODAY, steps: 6_000, recordedAt: AT }),
    change('sleep.set', { day: TODAY, sleepMinutes: 420, recordedAt: AT }),
    change('measurements.set', {
      day: TODAY,
      upperWaistMm: 800,
      lowerWaistMm: 820,
      chestMm: null,
      hipsMm: null,
      armMm: null,
      thighMm: null,
      notes: null,
      recordedAt: AT,
    }),
    change('target.set', { kind: 'calories', value: 2_000, setAt: AT }),
    change('workout.set', { id: randomUUID(), day: TODAY, exercises: [], recordedAt: AT }),
    meal(oldPhoto),
    meal(livePhoto),
    change('savedMeal.set', { id: randomUUID(), name: 'Synthetic lunch', mealType: 'lunch', tags: [], items: [ITEM], savedAt: AT }),
    change('setting.set', { name: 'body_weight_unit', value: 'lb', setAt: AT }),
    change('profile.set', {
      name: 'Synthetic Person',
      dateOfBirth: '1994-06-14',
      sex: 'other',
      heightMm: 1700,
      phone: '+919876543210',
      address: { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
      photoMediaId: profilePhoto,
      setAt: AT,
    }),
  ], server);
  const consent = await server.app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: { authorization: `Bearer ${user.token}` },
    payload: { consented: true, textVersion: AI_CONSENT_TEXT_VERSION },
  });
  expect(consent.statusCode).toBe(200);
  // Each sync already removes a replaced photo's files, again until its upload links expire
  // (removeDeletedPhotos); only what the deletion removes is checked.
  removed.length = 0;
  return {
    user,
    files: [...photoKeys(user.id, oldPhoto), ...photoKeys(user.id, livePhoto), ...photoKeys(user.id, profilePhoto)],
  };
}

/** How many rows each table that has a `user_id` holds for the user, plus their `users` row. */
async function rowsOf(userId: string, server = api): Promise<Record<string, number>> {
  const { rows: tables } = await server.db.query<{ table_name: string }>(
    `select table_name from information_schema.columns
     where table_schema = 'app' and column_name = 'user_id' order by table_name`,
  );
  const counts: Record<string, number> = {};
  for (const { table_name: table } of tables) {
    const { rows } = await server.db.query<{ n: number }>(`select count(*)::int as n from app.${table} where user_id = $1`, [userId]);
    counts[table] = rows[0]!.n;
  }
  const { rowCount } = await server.db.query('select 1 from app.users where id = $1', [userId]);
  counts.users = rowCount ?? 0;
  return counts;
}

function nonEmpty(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([table]) => table)
    .sort();
}

const EVERY_TABLE = [
  'ai_consents',
  'applied_changes',
  'meals',
  'measurements',
  'media',
  'profiles',
  'saved_meals',
  'settings',
  'sleep_logs',
  'step_counts',
  'targets',
  'user_roles',
  'users',
  'weigh_ins',
  'workouts',
];

describe('authorization: DELETE /v1/me', () => {
  it('REQ-NFR-001 no token, an expired token or another key gets 401 and deletes nothing', async () => {
    const { user } = await userWithData();
    const other = await createTestKeys();
    const tokens = [
      undefined,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ];

    for (const token of tokens) {
      const response = await deleteMe(token);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('AUTH_REQUIRED');
    }
    expect(nonEmpty(await rowsOf(user.id))).toEqual(EVERY_TABLE);
    expect(removed).toEqual([]);
    expect(api.supabase.adminCalls).toEqual([]);
  });

  it('REQ-NFR-001 deletes only the caller’s own account: another user’s rows, files and sign-in account stay', async () => {
    const first = await userWithData();
    const second = await userWithData();

    expect((await deleteMe(second.user.token)).statusCode).toBe(204);

    expect(nonEmpty(await rowsOf(first.user.id))).toEqual(EVERY_TABLE);
    expect(removed.sort()).toEqual([...second.files].sort());
    expect(api.supabase.users.has(first.user.subject)).toBe(true);
    expect(api.supabase.users.has(second.user.subject)).toBe(false);
  });
});

describe('REQ-ACC-009 delete account', () => {
  it('REQ-ACC-009 deletes every row the user owns, every photo file (a deleted one too) and the sign-in account', async () => {
    const { user, files } = await userWithData();
    expect(nonEmpty(await rowsOf(user.id))).toEqual(EVERY_TABLE);

    const response = await deleteMe(user.token);

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(nonEmpty(await rowsOf(user.id))).toEqual([]);
    expect(removed.sort()).toEqual([...files].sort());
    expect(api.supabase.users.has(user.subject)).toBe(false);
    expect((await deleteMe(user.token)).statusCode).toBe(204);
  });

  it('D-31 answer 4 the sign-in account is hard-deleted with the secret key on the apikey header only', async () => {
    const { user } = await userWithData();

    await deleteMe(user.token);

    expect(api.supabase.adminCalls).toHaveLength(1);
    const call = api.supabase.adminCalls[0]!;
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe(`https://project-ref.supabase.test/auth/v1/admin/users/${user.subject}`);
    expect(call.headers.get('apikey')).toBe(TEST_SECRET_KEY);
    expect(call.headers.has('authorization')).toBe(false);
    expect(JSON.parse(call.body)).toEqual({ should_soft_delete: false });
  });

  it('REQ-ACC-009 after deletion the account no longer exists for the API', async () => {
    const { user } = await userWithData();
    await deleteMe(user.token);

    const me = await api.app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${user.token}` } });
    expect(me.statusCode).toBe(403);
    expect(me.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('REQ-ACC-009 links and Head Coach permission answers never block a deletion, and are deleted with it (D-20)', async () => {
    const { user } = await userWithData();
    const coach = await api.signUpWithAccount();
    const headCoach = await api.signUpWithAccount();
    const link = async (kind: string, upper: string, lower: string) =>
      (
        await api.db.query<{ id: string }>(
          `insert into app.links (kind, upper_user_id, lower_user_id, status, started_at) values ($1, $2, $3, 'active', now()) returning id`,
          [kind, upper, lower],
        )
      ).rows[0]!.id;
    const trainee = await link('coach_trainee', coach.id, user.id);
    const coachLink = await link('head_coach_coach', headCoach.id, coach.id);
    await api.db.query(
      `insert into app.head_coach_permission_answers (coach_trainee_link_id, head_coach_link_id, answer, answered_at)
       values ($1, $2, 'allowed', now())`,
      [trainee, coachLink],
    );

    expect((await deleteMe(user.token)).statusCode).toBe(204);

    const links = await api.db.query('select id from app.links where id = any($1::uuid[])', [[trainee, coachLink]]);
    expect(links.rows).toEqual([{ id: coachLink }]);
    const answers = await api.db.query('select 1 from app.head_coach_permission_answers where coach_trainee_link_id = $1', [trainee]);
    expect(answers.rowCount).toBe(0);
    expect((await rowsOf(coach.id)).users).toBe(1);
  });

  it('REQ-ACC-009 signed in with no FitSphere account: only the sign-in account is deleted', async () => {
    const user = await api.signUp();

    expect((await deleteMe(user.token)).statusCode).toBe(204);

    expect(removed).toEqual([]);
    expect(api.supabase.users.has(user.subject)).toBe(false);
  });
});

describe('REQ-ACC-009 a deletion that cannot finish', () => {
  it('D-31 answer 4 without the secret key: 503 and nothing is deleted', async () => {
    const server = await startTestApi({ now: () => NOW, storage, secretKey: null });
    try {
      const { user } = await userWithData(server);

      const response = await deleteMe(user.token, server);

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true });
      expect(nonEmpty(await rowsOf(user.id, server))).toEqual(EVERY_TABLE);
      expect(removed).toEqual([]);
      expect(server.supabase.adminCalls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it('ADR-0002 rule 4 without storage: 503 and nothing is deleted', async () => {
    const server = await startTestApi({ now: () => NOW, storage: null });
    try {
      const user = await server.signUpWithAccount();

      expect((await deleteMe(user.token, server)).statusCode).toBe(503);
      expect((await rowsOf(user.id, server)).users).toBe(1);
      expect(server.supabase.users.has(user.subject)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('REQ-ACC-009 storage failing: 503 and no row or sign-in account is deleted', async () => {
    const { user } = await userWithData();
    failRemoval = true;

    expect((await deleteMe(user.token)).statusCode).toBe(503);

    expect(nonEmpty(await rowsOf(user.id))).toEqual(EVERY_TABLE);
    expect(api.supabase.adminCalls).toEqual([]);
    expect(api.supabase.users.has(user.subject)).toBe(true);
  });

  it('REQ-ACC-009 Supabase Auth failing after the data is gone: 503, and calling again finishes the deletion', async () => {
    const { user } = await userWithData();
    api.supabase.state.adminFailure = 500;

    const first = await deleteMe(user.token);
    expect(first.statusCode).toBe(503);
    expect(nonEmpty(await rowsOf(user.id))).toEqual([]);
    expect(api.supabase.users.has(user.subject)).toBe(true);

    api.supabase.state.adminFailure = null;
    expect((await deleteMe(user.token)).statusCode).toBe(204);
    expect(api.supabase.users.has(user.subject)).toBe(false);
  });

  it('REQ-ACC-009 a sign-in account Supabase no longer has counts as deleted', async () => {
    const { user } = await userWithData();
    api.supabase.users.delete(user.subject);

    expect((await deleteMe(user.token)).statusCode).toBe(204);
    expect(nonEmpty(await rowsOf(user.id))).toEqual([]);
  });
});

describe('invariant #7 the log of a deletion', () => {
  it('invariant #7 logs the route, the account ID and "account deleted", never the email, the key or a health value', async () => {
    const { user } = await userWithData();
    lines.length = 0;

    await deleteMe(user.token);

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.map((entry) => entry.msg)).toEqual(['account deleted', 'request']);
    expect(entries[1]).toMatchObject({ method: 'DELETE', route: '/v1/me', status: 204, userId: user.id });
    const log = lines.join('');
    expect(log).not.toContain(user.email);
    expect(log).not.toContain(user.subject);
    expect(log).not.toContain(TEST_SECRET_KEY);
    expect(log).not.toContain('71234');
    expect(log).not.toContain('Synthetic');
    expect(log).not.toContain('meals/');
  });
});
