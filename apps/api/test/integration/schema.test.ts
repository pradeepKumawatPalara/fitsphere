import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { measureWeighInGrowth } from '../../src/db/growth.ts';
import { connect, insertUser } from './database.ts';

// ADR-0003 validation on the Skeleton schema. Links are post-MVP (D-20); these tests only show the
// schema can hold them, and no route, screen or other fixture writes links.

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

let client: pg.Client;

beforeAll(async () => {
  client = await connect();
});

afterAll(async () => {
  await client.end();
});

async function insertLink(upper: string, lower: string, kind = 'coach_trainee'): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into app.links (kind, upper_user_id, lower_user_id, status, started_at)
     values ($1, $2, $3, 'active', now()) returning id`,
    [kind, upper, lower],
  );
  return rows[0]!.id;
}

async function endLink(id: string, reason: string) {
  await client.query(
    `update app.links set status = 'ended', ended_at = now(), end_reason = $2 where id = $1`,
    [id, reason],
  );
}

async function linkStatus(id: string): Promise<string | undefined> {
  const { rows } = await client.query<{ status: string }>('select status from app.links where id = $1', [id]);
  return rows[0]?.status;
}

function sqlState(error: unknown): string | undefined {
  return (error as { code?: string }).code;
}

describe('ADR-0003 (a) one active coach link per trainee', () => {
  it('ADR-0003 (a) refuses a second active coach link for one trainee', async () => {
    const [coachA, coachB, trainee] = [await insertUser(client), await insertUser(client), await insertUser(client)];
    await insertLink(coachA, trainee);

    const second = insertLink(coachB, trainee);

    await expect(second).rejects.toSatisfy((error) => sqlState(error) === UNIQUE_VIOLATION);
  });

  it('ADR-0003 (a) allows a new active link once the old one has ended', async () => {
    const [coachA, coachB, trainee] = [await insertUser(client), await insertUser(client), await insertUser(client)];
    const old = await insertLink(coachA, trainee);
    await endLink(old, 'removed');

    await expect(insertLink(coachB, trainee)).resolves.toBeTypeOf('string');
  });

  it('ADR-0003 (a) a coach can have many trainees, and a trainee link and a Head Coach link do not clash', async () => {
    const [coach, headCoach, traineeA, traineeB] = [
      await insertUser(client),
      await insertUser(client),
      await insertUser(client),
      await insertUser(client),
    ];
    await insertLink(coach, traineeA);
    await insertLink(coach, traineeB);
    await expect(insertLink(headCoach, coach, 'head_coach_coach')).resolves.toBeTypeOf('string');
  });
});

describe('ADR-0003 (b) switching is all-or-nothing', () => {
  it('ADR-0003 (b) a failure after ending the old link leaves it active', async () => {
    const [coachA, trainee] = [await insertUser(client), await insertUser(client)];
    const old = await insertLink(coachA, trainee);

    await client.query('begin');
    await endLink(old, 'switched');
    // The new link fails: a trainee cannot be their own coach.
    await expect(insertLink(trainee, trainee)).rejects.toSatisfy(
      (error) => sqlState(error) === CHECK_VIOLATION,
    );
    await client.query('rollback');

    expect(await linkStatus(old)).toBe('active');
  });

  it('ADR-0003 (b) a successful switch ends the old link and starts the new one together', async () => {
    const [coachA, coachB, trainee] = [await insertUser(client), await insertUser(client), await insertUser(client)];
    const old = await insertLink(coachA, trainee);

    await client.query('begin');
    await endLink(old, 'switched');
    const next = await insertLink(coachB, trainee);
    await client.query('commit');

    expect(await linkStatus(old)).toBe('ended');
    expect(await linkStatus(next)).toBe('active');
  });
});

describe('ADR-0003 (d) ended links keep their row', () => {
  it('ADR-0003 (d) ending a link leaves its row with the end time and reason', async () => {
    const [coach, trainee] = [await insertUser(client), await insertUser(client)];
    const id = await insertLink(coach, trainee);
    await endLink(id, 'left');

    const { rows } = await client.query(
      'select status, ended_at, end_reason from app.links where id = $1',
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ended', end_reason: 'left' });
    expect(rows[0].ended_at).toBeInstanceOf(Date);
  });
});

describe('Link status checks', () => {
  it('refuses an active link with an end time, and an ended link without a reason', async () => {
    const [coach, trainee] = [await insertUser(client), await insertUser(client)];
    const id = await insertLink(coach, trainee);

    await expect(
      client.query(`update app.links set ended_at = now() where id = $1`, [id]),
    ).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
    await expect(
      client.query(`update app.links set status = 'ended', ended_at = now() where id = $1`, [id]),
    ).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
    await expect(
      client.query(`update app.links set status = 'paused' where id = $1`, [id]),
    ).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
  });
});

describe('REQ-HOME-006 weigh_ins', () => {
  async function insertWeighIn(userId: string, day: string, grams: number) {
    await client.query(
      `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, $2, $3, now())`,
      [userId, day, grams],
    );
  }

  it('REQ-HOME-006 refuses weights outside 20–300 kg', async () => {
    const user = await insertUser(client);
    await expect(insertWeighIn(user, '2026-10-01', 19_999)).rejects.toSatisfy(
      (error) => sqlState(error) === CHECK_VIOLATION,
    );
    await expect(insertWeighIn(user, '2026-10-02', 300_001)).rejects.toSatisfy(
      (error) => sqlState(error) === CHECK_VIOLATION,
    );
    await insertWeighIn(user, '2026-10-03', 20_000);
    await insertWeighIn(user, '2026-10-04', 300_000);
  });

  it('REQ-HOME-006 holds one value per user per day', async () => {
    const [userA, userB] = [await insertUser(client), await insertUser(client)];
    await insertWeighIn(userA, '2026-10-05', 70_000);
    await insertWeighIn(userB, '2026-10-05', 80_000);

    await expect(insertWeighIn(userA, '2026-10-05', 71_000)).rejects.toSatisfy(
      (error) => sqlState(error) === UNIQUE_VIOLATION,
    );
  });

  it('REQ-NFR-004 an update takes a new change_seq and updated_at', async () => {
    const user = await insertUser(client);
    await insertWeighIn(user, '2026-10-06', 70_000);
    const select = () =>
      client.query<{ change_seq: string; updated_at: Date }>(
        'select change_seq, updated_at from app.weigh_ins where user_id = $1',
        [user],
      );
    const before = (await select()).rows[0]!;

    await client.query('update app.weigh_ins set weight_grams = 70500 where user_id = $1', [user]);

    const after = (await select()).rows[0]!;
    expect(BigInt(after.change_seq)).toBeGreaterThan(BigInt(before.change_seq));
    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(before.updated_at.getTime());
  });
});

describe('ADR-0002 second safety layer', () => {
  it('ADR-0002 every table in schema app has row level security on and no policies', async () => {
    const { rows } = await client.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind = 'r'`,
    );
    expect(rows.map((row) => row.relname).sort()).toEqual([
      'applied_changes',
      'head_coach_permission_answers',
      'links',
      'schema_migrations',
      'user_roles',
      'users',
      'weigh_ins',
    ]);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);

    const policies = await client.query(`select 1 from pg_policies where schemaname = 'app'`);
    expect(policies.rowCount).toBe(0);
  });
});

describe('ADR-0003 (c) weekly averages over 10,000 weigh-ins', () => {
  it('ADR-0003 (c) records the time of a weekly-average query (no target, Q-050)', async () => {
    const user = await insertUser(client);
    await client.query(
      `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at)
       select $1, date '2000-01-03' + d, 50000 + floor(random() * 50000)::int, now()
       from generate_series(0, 9999) as d`,
      [user],
    );
    await client.query('analyze app.weigh_ins');

    const started = performance.now();
    const { rows } = await client.query(
      `select date_trunc('week', day)::date as week, round(avg(weight_grams)) as average_grams
       from app.weigh_ins where user_id = $1 group by 1 order by 1`,
      [user],
    );
    const ms = performance.now() - started;

    expect(rows).toHaveLength(Math.ceil(10_000 / 7));
    console.log(`ADR-0003 (c): weekly averages over 10,000 weigh-ins took ${ms.toFixed(1)} ms`);
  });
});

describe('R-005 growth measurement script', () => {
  it('R-005 measures growth per 10,000 synthetic weigh-ins and keeps none of them', async () => {
    const countBefore = await client.query('select count(*)::int as n from app.weigh_ins');

    const result = await measureWeighInGrowth(client);

    expect(result.weighIns).toBe(10_000);
    expect(result.weighInsTableBytes).toBeGreaterThan(0);
    expect(result.serverVersion).toMatch(/^\d+/);
    const countAfter = await client.query('select count(*)::int as n from app.weigh_ins');
    expect(countAfter.rows[0].n).toBe(countBefore.rows[0].n);
    const synthetic = await client.query(
      `select count(*)::int as n from app.users where auth_subject like 'synthetic-growth-%'`,
    );
    expect(synthetic.rows[0].n).toBe(0);
  });
});

describe('Synthetic test users', () => {
  it('stores emails in lower case only', async () => {
    const id = randomUUID();
    await expect(
      client.query(
        `insert into app.users (auth_subject, email, age_confirmed_at, age_confirmation_text_version)
         values ($1, $2, now(), 'synthetic')`,
        [`test-${id}`, `User-${id}@Example.test`],
      ),
    ).rejects.toSatisfy((error) => sqlState(error) === CHECK_VIOLATION);
  });
});
