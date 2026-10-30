import { getMeta, migrateLocal, setMeta } from '../local/store';
import type { SqlDb } from '../local/sql';
import { fakeServer } from '../testing/fakeServer';
import { deps, fakeApi, fakeAuthClient, fakeSession, ME } from '../testing/fakes';
import { memoryDb } from '../testing/memoryDb';
import { accountStartDay } from './account';

// The day the account was created, for "Meals logged: X of Y days" (REQ-PRG-003, Q-044).

const NOW = new Date('2026-10-28T03:30:00.000Z');

let db: SqlDb;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('REQ-PRG-003 accountStartDay', () => {
  it('reads GET /v1/me once and keeps the IST day on the phone', async () => {
    const server = fakeServer(NOW);
    const auth = deps(fakeAuthClient(fakeSession()), server.fetchImpl);
    expect(await accountStartDay(db, auth)).toBe('2026-10-28');
    expect(await getMeta(db, 'account_created_day')).toBe('2026-10-28');

    server.state.offline = true;
    expect(await accountStartDay(db, auth)).toBe('2026-10-28');
  });

  it('uses the IST day, not the UTC one', async () => {
    const api = fakeApi({ 'GET /me': { status: 200, body: { ...ME, user: { ...ME.user, createdAt: '2026-10-20T19:00:00.000Z' } } } });
    expect(await accountStartDay(db, deps(fakeAuthClient(fakeSession()), api.fetchImpl))).toBe('2026-10-21');
  });

  it('does not call the server once the day is kept', async () => {
    await setMeta(db, 'account_created_day', '2026-09-01');
    const api = fakeApi({});
    expect(await accountStartDay(db, deps(fakeAuthClient(fakeSession()), api.fetchImpl))).toBe('2026-09-01');
    expect(api.calls).toHaveLength(0);
  });

  it('is null offline, and keeps nothing', async () => {
    const api = fakeApi({ 'GET /me': 'offline' });
    expect(await accountStartDay(db, deps(fakeAuthClient(fakeSession()), api.fetchImpl))).toBeNull();
    expect(await getMeta(db, 'account_created_day')).toBeNull();
  });
});
