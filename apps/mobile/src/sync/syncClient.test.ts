import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import type { SqlDb } from '../local/sql';
import {
  getMeta,
  getWeighIn,
  markAccepted,
  migrateLocal,
  pendingChanges,
  rejectedChanges,
  saveWeighIn,
  unsyncedCount,
} from '../local/store';
import { syncNow } from './syncClient';

// Wednesday 28 October 2026, 09:00 IST.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;

let db: SqlDb;
let next = 0;

beforeEach(async () => {
  db = memoryDb();
  await migrateLocal(db);
});

afterEach(async () => {
  await db.closeAsync();
});

async function save(day: string, weightGrams: number) {
  next += 1;
  const changeId = `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`;
  await saveWeighIn(db, { changeId, day, weightGrams, recordedAt: NOW.toISOString() });
  return changeId;
}

function auth(server: ReturnType<typeof fakeServer>, client = fakeAuthClient(fakeSession())) {
  return deps(client, server.fetchImpl);
}

describe('ADR-0007 sync client', () => {
  it('ADR-0007 sends the outbox oldest first, settles each result and keeps the cursor', async () => {
    const server = fakeServer(NOW);
    await save('2026-10-27', 70_000);
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('synced');

    const sent = server.calls[0]?.body as { cursor: null; changes: { data: { day: string } }[] };
    expect(sent.cursor).toBeNull();
    expect(sent.changes.map((change) => change.data.day)).toEqual(['2026-10-27', '2026-10-28']);
    expect(await unsyncedCount(db)).toBe(0);
    expect((await getWeighIn(db, '2026-10-28'))?.syncState).toBe('synced');
    expect(await getMeta(db, 'cursor')).toBe('2');
  });

  it('REQ-NFR-004 a sync without a connection keeps the outbox', async () => {
    const server = fakeServer(NOW);
    server.state.offline = true;
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('offline');

    expect(await pendingChanges(db, 100)).toMatchObject([{ attempts: 1, status: 'pending' }]);
    expect((await getWeighIn(db, '2026-10-28'))?.syncState).toBe('pending');
  });

  it('REQ-NFR-004 a failed sync (500 or 503) keeps the outbox and sends it again next time', async () => {
    const server = fakeServer(NOW);
    server.state.failWith = 503;
    const id = await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server), clock)).toBe('failed');
    expect((await pendingChanges(db, 100)).map((entry) => entry.changeId)).toEqual([id]);

    server.state.failWith = null;
    expect(await syncNow(db, auth(server), clock)).toBe('synced');
    expect(server.weighIns.get('2026-10-28')?.weightGrams).toBe(70_300);
  });

  it('ADR-0007 rule 2 a rejected change is kept and not sent again', async () => {
    const server = fakeServer(NOW);
    const id = await save('2026-10-29', 70_000);

    await syncNow(db, auth(server), clock);
    await syncNow(db, auth(server), clock);

    expect(await rejectedChanges(db)).toMatchObject([{ changeId: id, errorCode: 'DAY_IN_FUTURE' }]);
    expect((await getWeighIn(db, '2026-10-29'))?.syncState).toBe('rejected');
    const second = server.calls[1]?.body as { changes: unknown[] };
    expect(second.changes).toEqual([]);
  });

  it('ADR-0007 the pull is applied: a value saved on another phone appears here', async () => {
    const server = fakeServer(NOW);
    server.storeFromElsewhere('2026-10-25', 69_800);

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-10-25')).toMatchObject({ weightGrams: 69_800, syncState: 'synced' });
  });

  it('ADR-0007 the pull never overwrites a change still waiting on this phone', async () => {
    const server = fakeServer(NOW);
    server.storeFromElsewhere('2026-10-26', 69_000);
    server.state.offline = true;
    await save('2026-10-26', 71_000);
    await syncNow(db, auth(server), clock);
    server.state.offline = false;
    server.state.rejectWith = 'VALIDATION_FAILED';

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-10-26')).toMatchObject({ weightGrams: 71_000, syncState: 'rejected' });
  });

  it('ADR-0007 rule 1 removes synced entries older than 90 days at sync, never pending or rejected ones', async () => {
    const server = fakeServer(NOW);
    server.state.offline = true;
    const old = await save('2026-07-01', 70_000);
    await markAccepted(db, old);
    await save('2026-07-02', 70_000);

    await syncNow(db, auth(server), clock);

    expect(await getWeighIn(db, '2026-07-01')).toBeNull();
    expect(await getWeighIn(db, '2026-07-02')).not.toBeNull();
  });

  it('error model: after a 401 it refreshes the session once and retries', async () => {
    const server = fakeServer(NOW);
    server.state.failWith = 401;
    const client = fakeAuthClient(fakeSession());
    client.refreshSession.mockImplementationOnce(async () => {
      server.state.failWith = null;
      return { data: { session: fakeSession({}, 'access-token-2') }, error: null };
    });
    await save('2026-10-28', 70_300);

    expect(await syncNow(db, auth(server, client), clock)).toBe('synced');
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });
});
