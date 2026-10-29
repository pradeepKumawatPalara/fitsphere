// POST /v1/sync (api-conventions; ADR-0007 option A; REQ-NFR-004, REQ-HOME-006, REQ-MEAS-*,
// REQ-ROLE-007).
import {
  isFutureIstDay,
  istToday,
  MEASUREMENTS_SET,
  measurementsSetDataSchema,
  SLEEP_SET,
  sleepSetDataSchema,
  STEPS_SET,
  stepsSetDataSchema,
  syncWindowStart,
  TARGET_SET,
  targetSetDataSchema,
  WEIGH_IN_SET,
  weighInSetDataSchema,
  type ChangeError,
  type ChangeErrorCode,
  type IstDay,
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
 * Applies the changes in the order sent, each once, then returns the user's own data changed after
 * the cursor: the last 90 IST days of day data, and the current targets. One transaction that
 * first locks the user's row, so the user's change numbers commit in order and the pull misses
 * nothing (data-model "Ordering rule"). Every change is checked when it arrives, never when it was
 * queued (invariant #1).
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

    const rows = await changedRows(client, account.id, afterSeq, syncWindowStart(istToday(options.now)), options.pageSize + 1);
    await client.query('commit');

    const page = rows.slice(0, options.pageSize);
    const last = page.at(-1);
    return {
      results,
      pull: toPull(page),
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
  const handler = HANDLERS.get(change.type);
  if (!handler) return 'UNKNOWN_CHANGE_TYPE';
  if (!hasRole(account, 'personal')) return 'ROLE_NOT_ENABLED';
  return handler(client, account, change.data, now);
}

type Handler = (client: pg.PoolClient, account: Account, data: unknown, now: Date) => Promise<ChangeErrorCode | null>;
type Schema<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } };

/**
 * A change to one IST day's value. A value already stored for the day is replaced; the change
 * received last wins (Q-030). The user is always the caller: no change names a user (invariant #1).
 */
function dayChange<T extends { day: IstDay }>(
  schema: Schema<T>,
  write: (client: pg.PoolClient, userId: string, data: T) => Promise<unknown>,
): Handler {
  return async (client, account, input, now) => {
    const data = schema.safeParse(input);
    if (!data.success) return 'VALIDATION_FAILED';
    if (isFutureIstDay(data.data.day, now)) return 'DAY_IN_FUTURE';
    await write(client, account.id, data.data);
    return null;
  };
}

const HANDLERS = new Map<string, Handler>([
  [
    WEIGH_IN_SET,
    dayChange(weighInSetDataSchema, (client, userId, data) =>
      client.query(
        `insert into app.weigh_ins (user_id, day, weight_grams, recorded_at) values ($1, $2, $3, $4)
         on conflict (user_id, day) do update
           set weight_grams = excluded.weight_grams, recorded_at = excluded.recorded_at`,
        [userId, data.day, data.weightGrams, data.recordedAt],
      ),
    ),
  ],
  [
    STEPS_SET,
    dayChange(stepsSetDataSchema, (client, userId, data) =>
      client.query(
        `insert into app.step_counts (user_id, day, steps, recorded_at) values ($1, $2, $3, $4)
         on conflict (user_id, day) do update
           set steps = excluded.steps, recorded_at = excluded.recorded_at`,
        [userId, data.day, data.steps, data.recordedAt],
      ),
    ),
  ],
  [
    SLEEP_SET,
    dayChange(sleepSetDataSchema, (client, userId, data) =>
      client.query(
        `insert into app.sleep_logs (user_id, day, sleep_minutes, recorded_at) values ($1, $2, $3, $4)
         on conflict (user_id, day) do update
           set sleep_minutes = excluded.sleep_minutes, recorded_at = excluded.recorded_at`,
        [userId, data.day, data.sleepMinutes, data.recordedAt],
      ),
    ),
  ],
  [
    MEASUREMENTS_SET,
    // The whole entry is replaced, so an optional field left empty clears the day's old value.
    dayChange(measurementsSetDataSchema, (client, userId, data) =>
      client.query(
        `insert into app.measurements
           (user_id, day, upper_waist_mm, lower_waist_mm, chest_mm, hips_mm, arm_mm, thigh_mm, notes, recorded_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id, day) do update
           set upper_waist_mm = excluded.upper_waist_mm, lower_waist_mm = excluded.lower_waist_mm,
               chest_mm = excluded.chest_mm, hips_mm = excluded.hips_mm, arm_mm = excluded.arm_mm,
               thigh_mm = excluded.thigh_mm, notes = excluded.notes, recorded_at = excluded.recorded_at`,
        [
          userId,
          data.day,
          data.upperWaistMm,
          data.lowerWaistMm,
          data.chestMm,
          data.hipsMm,
          data.armMm,
          data.thighMm,
          data.notes,
          data.recordedAt,
        ],
      ),
    ),
  ],
  [
    TARGET_SET,
    // The user's own target (REQ-ROLE-007). Who set it is the caller, from the token, never from
    // the change. Post-MVP (backlog B-21): refuse it while an active coach's target applies
    // (invariant #2).
    async (client, account, input) => {
      const data = targetSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `insert into app.targets (user_id, kind, value, set_by_user_id, set_at) values ($1, $2, $3, $1, $4)
         on conflict (user_id, kind) do update
           set value = excluded.value, set_by_user_id = excluded.set_by_user_id, set_at = excluded.set_at`,
        [account.id, data.data.kind, data.data.value, data.data.setAt],
      );
      return null;
    },
  ],
]);

function result(changeId: string, errorCode: ChangeErrorCode | null): SyncResult {
  // Details are left out, so a change sent again gets exactly the same reply.
  const error: ChangeError | null = errorCode ? { code: errorCode, message: CHANGE_MESSAGES[errorCode], details: null } : null;
  return { changeId, status: errorCode ? 'rejected' : 'accepted', error };
}

// --- The pull ---

// One row of the pull query: the table it came from and its fields as JSON. JSON gives timestamps
// with the session's offset, so they are turned into UTC with Z before they are returned.
type Times = { recordedAt: string; updatedAt: string };
type ChangedRow = { change_seq: string } & (
  | { kind: 'weighIn'; item: { day: IstDay; weightGrams: number } & Times }
  | { kind: 'steps'; item: { day: IstDay; steps: number } & Times }
  | { kind: 'sleep'; item: { day: IstDay; sleepMinutes: number } & Times }
  | { kind: 'measurements'; item: SyncResponse['pull']['measurements'][number] }
  | { kind: 'target'; item: SyncResponse['pull']['targets'][number] }
);

/**
 * The user's rows changed after `afterSeq`, oldest change first, from all five tables. They share
 * `app.change_seq`, so one cursor covers them all. Day data is limited to the 90-day window;
 * targets are always included.
 */
async function changedRows(client: pg.PoolClient, userId: string, afterSeq: bigint, windowStart: IstDay, limit: number) {
  const { rows } = await client.query<ChangedRow>(
    `select kind, change_seq::text as change_seq, item from (
       select 'weighIn' as kind, change_seq,
         json_build_object('day', day::text, 'weightGrams', weight_grams,
           'recordedAt', recorded_at, 'updatedAt', updated_at) as item
       from app.weigh_ins where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'steps', change_seq,
         json_build_object('day', day::text, 'steps', steps, 'recordedAt', recorded_at, 'updatedAt', updated_at)
       from app.step_counts where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'sleep', change_seq,
         json_build_object('day', day::text, 'sleepMinutes', sleep_minutes,
           'recordedAt', recorded_at, 'updatedAt', updated_at)
       from app.sleep_logs where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'measurements', change_seq,
         json_build_object('day', day::text, 'upperWaistMm', upper_waist_mm, 'lowerWaistMm', lower_waist_mm,
           'chestMm', chest_mm, 'hipsMm', hips_mm, 'armMm', arm_mm, 'thighMm', thigh_mm, 'notes', notes,
           'recordedAt', recorded_at, 'updatedAt', updated_at)
       from app.measurements where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'target', change_seq,
         json_build_object('kind', kind, 'value', value, 'setByUserId', set_by_user_id,
           'setAt', set_at, 'updatedAt', updated_at)
       from app.targets where user_id = $1 and change_seq > $2
     ) as changed
     order by change_seq
     limit $4`,
    [userId, afterSeq.toString(), windowStart, limit],
  );
  return rows;
}

function toPull(rows: ChangedRow[]): SyncResponse['pull'] {
  const pull: SyncResponse['pull'] = { weighIns: [], steps: [], sleep: [], measurements: [], targets: [], removals: [] };
  for (const row of rows) {
    switch (row.kind) {
      case 'weighIn':
        pull.weighIns.push(withUtcTimes(row.item));
        break;
      case 'steps':
        pull.steps.push(withUtcTimes(row.item));
        break;
      case 'sleep':
        pull.sleep.push(withUtcTimes(row.item));
        break;
      case 'measurements':
        pull.measurements.push(withUtcTimes(row.item));
        break;
      case 'target':
        pull.targets.push({ ...row.item, setAt: utc(row.item.setAt), updatedAt: utc(row.item.updatedAt) });
        break;
    }
  }
  return pull;
}

function withUtcTimes<T extends Times>(item: T): T {
  return { ...item, recordedAt: utc(item.recordedAt), updatedAt: utc(item.updatedAt) };
}

function utc(value: string): string {
  return new Date(value).toISOString();
}
