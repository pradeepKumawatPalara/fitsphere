// POST /v1/sync (api-conventions; ADR-0007 option A; REQ-NFR-004, REQ-HOME-006).
import {
  isFutureIstDay,
  istToday,
  syncWindowStart,
  WEIGH_IN_SET,
  weighInSetDataSchema,
  type ChangeError,
  type ChangeErrorCode,
  type SyncChange,
  type SyncResponse,
  type SyncResult,
} from '@fitsphere/shared';
import type pg from 'pg';
import { hasRole } from './access.ts';
import type { Account } from './accounts.ts';

const CHANGE_MESSAGES: Record<ChangeErrorCode, string> = {
  VALIDATION_FAILED: 'The entry is not valid.',
  DAY_IN_FUTURE: 'The date is in the future.',
  ROLE_NOT_ENABLED: 'This needs the Personal Training User role.',
  NOT_ALLOWED: 'You cannot change this.',
  UNKNOWN_CHANGE_TYPE: 'This kind of change is not supported.',
};

// The cursor is opaque to the phone: the last change number it has seen.
export function encodeSyncCursor(seq: bigint): string {
  return Buffer.from(`v1:${seq}`).toString('base64url');
}

export function decodeSyncCursor(cursor: string): bigint | null {
  const match = /^v1:(\d{1,19})$/.exec(Buffer.from(cursor, 'base64url').toString());
  return match?.[1] ? BigInt(match[1]) : null;
}

type Options = { now: Date; pageSize: number };

/**
 * Applies the changes in the order sent, each once, then returns the user's own weigh-ins from the
 * last 90 IST days changed after the cursor. One transaction that first locks the user's row, so
 * the user's change numbers commit in order and the pull misses nothing (data-model "Ordering
 * rule"). Every change is checked when it arrives, never when it was queued (invariant #1).
 */
export async function runSync(
  db: pg.Pool,
  account: Account,
  changes: SyncChange[],
  afterSeq: bigint,
  options: Options,
): Promise<SyncResponse> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select 1 from app.users where id = $1 for update', [account.id]);

    const results: SyncResult[] = [];
    for (const change of changes) results.push(await applyChange(client, account, change, options.now));

    const { rows } = await client.query<{
      day: string;
      weight_grams: number;
      recorded_at: Date;
      updated_at: Date;
      change_seq: string;
    }>(
      `select day::text as day, weight_grams, recorded_at, updated_at, change_seq::text as change_seq
       from app.weigh_ins
       where user_id = $1 and change_seq > $2 and day >= $3
       order by change_seq
       limit $4`,
      [account.id, afterSeq.toString(), syncWindowStart(istToday(options.now)), options.pageSize + 1],
    );
    await client.query('commit');

    const page = rows.slice(0, options.pageSize);
    const last = page.at(-1);
    return {
      results,
      pull: {
        weighIns: page.map((row) => ({
          day: row.day,
          weightGrams: row.weight_grams,
          recordedAt: row.recorded_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        })),
        removals: [],
      },
      cursor: encodeSyncCursor(last ? BigInt(last.change_seq) : afterSeq),
      hasMore: rows.length > options.pageSize,
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function applyChange(client: pg.PoolClient, account: Account, change: SyncChange, now: Date): Promise<SyncResult> {
  // Once only: a change seen before returns its stored result (data-model "applied_changes").
  const prior = await client.query<{ status: 'accepted' | 'rejected'; error_code: ChangeErrorCode | null }>(
    'select status, error_code from app.applied_changes where user_id = $1 and change_id = $2',
    [account.id, change.changeId],
  );
  const seen = prior.rows[0];
  if (seen) return result(change.changeId, seen.error_code);

  const errorCode = await apply(client, account, change, now);
  await client.query(
    `insert into app.applied_changes (user_id, change_id, change_type, status, error_code)
     values ($1, $2, $3, $4, $5)`,
    [account.id, change.changeId, change.type, errorCode ? 'rejected' : 'accepted', errorCode],
  );
  return result(change.changeId, errorCode);
}

/** Applies one change; returns why it was refused, or null when it was applied. */
async function apply(client: pg.PoolClient, account: Account, change: SyncChange, now: Date): Promise<ChangeErrorCode | null> {
  if (change.type !== WEIGH_IN_SET) return 'UNKNOWN_CHANGE_TYPE';
  if (!hasRole(account, 'personal')) return 'ROLE_NOT_ENABLED';
  const data = weighInSetDataSchema.safeParse(change.data);
  if (!data.success) return 'VALIDATION_FAILED';
  if (isFutureIstDay(data.data.day, now)) return 'DAY_IN_FUTURE';

  // A value already stored for the day is replaced; the change received last wins (Q-030).
  await client.query(
    `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, $2, $3, $4)
     on conflict (user_id, day) do update
       set weight_grams = excluded.weight_grams, recorded_at = excluded.recorded_at`,
    [account.id, data.data.day, data.data.weightGrams, data.data.recordedAt],
  );
  return null;
}

function result(changeId: string, errorCode: ChangeErrorCode | null): SyncResult {
  // Details are left out, so a change sent again gets exactly the same reply.
  const error: ChangeError | null = errorCode ? { code: errorCode, message: CHANGE_MESSAGES[errorCode], details: null } : null;
  return { changeId, status: errorCode ? 'rejected' : 'accepted', error };
}
