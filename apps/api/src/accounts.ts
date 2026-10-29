// FitSphere accounts (data-model "users", "user_roles"; REQ-ACC-010, REQ-ROLE-001).
import type { MeResponse, Role } from '@fitsphere/shared';
import type pg from 'pg';

export type Account = { id: string; email: string; createdAt: Date; roles: Role[] };

type Queryable = Pick<pg.Pool, 'query'>;

export async function findAccount(db: Queryable, subject: string): Promise<Account | null> {
  const { rows } = await db.query<{ id: string; email: string; created_at: Date; roles: Role[] }>(
    `select u.id, u.email, u.created_at,
            coalesce(array_agg(r.role order by r.role) filter (where r.role is not null), '{}') as roles
     from app.users u left join app.user_roles r on r.user_id = u.id
     where u.auth_subject = $1
     group by u.id`,
    [subject],
  );
  const row = rows[0];
  return row ? { id: row.id, email: row.email, createdAt: row.created_at, roles: row.roles } : null;
}

/**
 * Creates the account with the server's time as the 18+ confirmation time and turns on the
 * Personal Training User role (MVP default, D-18). Returns false when another request created
 * it first; nothing changes then.
 */
export async function createAccount(
  db: pg.Pool,
  input: { subject: string; email: string; ageConfirmationTextVersion: string },
): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query<{ id: string }>(
      `insert into app.users (auth_subject, email, age_confirmed_at, age_confirmation_text_version)
       values ($1, $2, now(), $3)
       on conflict (auth_subject) do nothing
       returning id`,
      [input.subject, input.email, input.ageConfirmationTextVersion],
    );
    const id = rows[0]?.id;
    if (id) {
      await client.query(`insert into app.user_roles (user_id, role) values ($1, 'personal')`, [id]);
    }
    await client.query('commit');
    return id !== undefined;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function meBody(account: Account): MeResponse {
  return {
    user: { id: account.id, email: account.email, createdAt: account.createdAt.toISOString() },
    roles: account.roles,
  };
}
