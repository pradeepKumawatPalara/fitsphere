// Deleting an account (REQ-ACC-009; Q-048 MVP default, D-18; ADR-0004 rule 7; D-S1). The user's
// files, their rows in every table and their Supabase sign-in account are deleted. Only the
// request's log line is kept, with no email address or health data; the admin access log comes
// with RB-S1.
//
// The steps run in an order that is safe to repeat, so a deletion stopped part-way is finished by
// calling again: the files and rows go together, the rows only once the files are gone; the sign-in
// account goes last, so the user can still sign in to retry.
import type pg from 'pg';
import type { Auth, Identity } from './auth.ts';
import { findAccount, type Account } from './accounts.ts';
import { ApiError } from './errors.ts';
import { photoKeys, type MediaStorage } from './storage/mediaStorage.ts';

/** How many storage requests run at once while files are removed. */
const PARALLEL_REMOVALS = 5;

type Deps = { db: pg.Pool; auth: Auth; storage: MediaStorage | null };

/**
 * Deletes the caller's account and returns it, or null when only the sign-in account was left.
 * Throws SERVICE_UNAVAILABLE, with nothing deleted, when the secret key or storage is missing or a
 * file cannot be removed.
 */
export async function deleteAccount(deps: Deps, identity: Identity): Promise<Account | null> {
  if (!deps.auth.canDeleteUsers || !deps.storage) throw new ApiError('SERVICE_UNAVAILABLE');

  const account = await findAccount(deps.db, identity.subject);
  if (account) await deleteFilesAndRows(deps.db, deps.storage, account.id);
  await deps.auth.deleteUser(identity.subject);
  return account;
}

/**
 * One transaction that first locks the user's row, so a sync running at the same time finishes
 * before it, or finds the user gone after it. The files of every photo the user has, those deleted
 * but not yet removed included, leave storage before any row is deleted; if one cannot be removed,
 * the transaction is rolled back and nothing is deleted.
 */
async function deleteFilesAndRows(db: pg.Pool, storage: MediaStorage, userId: string): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select 1 from app.users where id = $1 for update', [userId]);

    const { rows } = await client.query<{ id: string }>(
      'select id from app.media where user_id = $1 and files_removed_at is null',
      [userId],
    );
    const keys = rows.flatMap((row) => photoKeys(userId, row.id));
    try {
      await Promise.all(spread(keys, PARALLEL_REMOVALS).map((group) => storage.remove(group)));
    } catch {
      throw new ApiError('SERVICE_UNAVAILABLE');
    }

    // Links and Head Coach permission answers are post-MVP (D-20) and do not cascade, so they are
    // deleted first and can never block the deletion. Every other table cascades from users.
    await client.query(
      `delete from app.head_coach_permission_answers
       where coach_trainee_link_id in (select id from app.links where $1::uuid in (upper_user_id, lower_user_id))
          or head_coach_link_id in (select id from app.links where $1::uuid in (upper_user_id, lower_user_id))`,
      [userId],
    );
    await client.query('delete from app.links where $1::uuid in (upper_user_id, lower_user_id)', [userId]);
    await client.query('delete from app.users where id = $1', [userId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Splits the keys into at most `count` groups of about the same size. */
function spread(keys: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: Math.min(count, keys.length) }, () => []);
  keys.forEach((key, index) => groups[index % groups.length]!.push(key));
  return groups;
}
