// POST /v1/sync (api-conventions; ADR-0007 option A; REQ-NFR-004, REQ-HOME-006, REQ-MEAS-*,
// REQ-ROLE-007, REQ-LOG-*, REQ-NUT-004, REQ-SAVED-001, REQ-TRN-003, REQ-ACC-001…003, REQ-ACC-011;
// My foods and USDA servings, D-39).
import {
  isAcceptedDateOfBirth,
  isFutureIstDay,
  istToday,
  MEAL_DELETE,
  MEAL_SET,
  mealDeleteDataSchema,
  mealSetDataSchema,
  mealTotals,
  MEASUREMENTS_SET,
  measurementsSetDataSchema,
  MY_FOOD_DELETE,
  MY_FOOD_SET,
  myFoodDeleteDataSchema,
  myFoodSetDataSchema,
  PROFILE_SET,
  profileSetDataSchema,
  SAVED_MEAL_DELETE,
  SAVED_MEAL_SET,
  savedMealDeleteDataSchema,
  savedMealSetDataSchema,
  SETTING_SET,
  settingSetDataSchema,
  SLEEP_SET,
  sleepSetDataSchema,
  STEPS_SET,
  stepsSetDataSchema,
  syncWindowStart,
  TARGET_SET,
  targetSetDataSchema,
  WEIGH_IN_SET,
  weighInSetDataSchema,
  WORKOUT_DELETE,
  WORKOUT_SET,
  workoutDeleteDataSchema,
  workoutSetDataSchema,
  type ChangeError,
  type ChangeErrorCode,
  type IstDay,
  type MealItem,
  type MealPhoto,
  type Profile,
  type PulledMeal,
  type PulledMyFood,
  type PulledSavedMeal,
  type PulledWorkout,
  type SyncChange,
  type SyncResponse,
  type SyncResult,
  type Workout,
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
 * the cursor: the last 90 IST days of day data, and the current targets and settings. One
 * transaction that first locks the user's row, so the user's change numbers commit in order and the
 * pull misses nothing (data-model "Ordering rule"). Every change is checked when it arrives, never
 * when it was queued (invariant #1).
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
    WORKOUT_SET,
    // Creates the workout, or replaces the whole workout with this ID: the change received last
    // wins (ADR-0007 rule 2), including over an earlier deletion.
    dayChange(workoutSetDataSchema, (client, userId, data) =>
      client.query(
        `insert into app.workouts (user_id, id, day, exercises, recorded_at) values ($1, $2, $3, $4::jsonb, $5)
         on conflict (user_id, id) do update
           set day = excluded.day, exercises = excluded.exercises, recorded_at = excluded.recorded_at,
               deleted_at = null`,
        // node-postgres would turn an array into a PostgreSQL array, so jsonb gets JSON text.
        [userId, data.id, data.day, JSON.stringify(data.exercises), data.recordedAt],
      ),
    ),
  ],
  [
    WORKOUT_DELETE,
    // Removes the workout's content and keeps an empty row with its day, so other phones learn of
    // the deletion. Deleting a workout the server never had changes nothing.
    async (client, account, input) => {
      const data = workoutDeleteDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `update app.workouts set deleted_at = $3, exercises = null
         where user_id = $1 and id = $2 and deleted_at is null`,
        [account.id, data.data.id, data.data.deletedAt],
      );
      return null;
    },
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
  [
    SETTING_SET,
    // The user's own setting (REQ-ACC-001…003): the change received last wins, as for targets.
    async (client, account, input) => {
      const data = settingSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `insert into app.settings (user_id, name, value, set_at) values ($1, $2, $3, $4)
         on conflict (user_id, name) do update set value = excluded.value, set_at = excluded.set_at`,
        [account.id, data.data.name, data.data.value, data.data.setAt],
      );
      return null;
    },
  ],
  [
    PROFILE_SET,
    // The user's profile (REQ-ACC-011): the whole profile, the change received last wins, as for
    // settings. A date of birth must give an age of 18 to 120 today in IST (REQ-ACC-010). A new photo
    // ID is claimed as the profile's, as a meal's is: one already used, or deleted, is refused, so a
    // photo never moves or comes back; a photo the profile no longer has is deleted.
    async (client, account, input, now) => {
      const data = profileSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      const profile = data.data;
      if (profile.dateOfBirth && !isAcceptedDateOfBirth(profile.dateOfBirth, istToday(now))) return 'VALIDATION_FAILED';
      const before = await client.query<{ photo_media_id: string | null }>(
        'select photo_media_id from app.profiles where user_id = $1',
        [account.id],
      );
      const oldMediaId = before.rows[0]?.photo_media_id ?? null;
      if (profile.photoMediaId && profile.photoMediaId !== oldMediaId) {
        const claimed = await client.query(
          `insert into app.media (user_id, id, kind) values ($1, $2, 'profile') on conflict (user_id, id) do nothing`,
          [account.id, profile.photoMediaId],
        );
        if (claimed.rowCount === 0) return 'VALIDATION_FAILED';
      }
      if (oldMediaId && oldMediaId !== profile.photoMediaId) await deletePhoto(client, account.id, oldMediaId, now);
      const address = profile.address;
      await client.query(
        `insert into app.profiles (user_id, name, date_of_birth, sex, height_mm, phone, address_line1, address_line2,
           city, state, pin_code, photo_media_id, set_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (user_id) do update set
           name = excluded.name, date_of_birth = excluded.date_of_birth, sex = excluded.sex,
           height_mm = excluded.height_mm, phone = excluded.phone, address_line1 = excluded.address_line1,
           address_line2 = excluded.address_line2, city = excluded.city, state = excluded.state,
           pin_code = excluded.pin_code, photo_media_id = excluded.photo_media_id, set_at = excluded.set_at`,
        [
          account.id,
          profile.name,
          profile.dateOfBirth,
          profile.sex,
          profile.heightMm,
          profile.phone,
          address?.line1 ?? null,
          address?.line2 ?? null,
          address?.city ?? null,
          address?.state ?? null,
          address?.pinCode ?? null,
          profile.photoMediaId,
          profile.setAt,
        ],
      );
      return null;
    },
  ],
  [
    MEAL_SET,
    // Creates the meal, or replaces the whole meal with this ID: the change received last wins
    // (ADR-0007 rule 2), including over an earlier deletion. The totals are computed here from the
    // items; a change cannot set them. A dish must be on the dish list (D-28), and a household unit
    // on the food list for its food (D-36). A new photo ID is claimed for this meal; an ID already
    // used, or one whose photo was deleted, is refused, so a photo never moves between meals or
    // comes back. A photo the meal no longer has is deleted (REQ-LOG-006).
    async (client, account, input, now) => {
      const data = mealSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      if (isFutureIstDay(data.data.day, now)) return 'DAY_IN_FUTURE';
      const meal = data.data;
      if (!(await itemsListed(client, meal.items))) return 'VALIDATION_FAILED';
      const before = await client.query<{ photo: MealPhoto | null }>(
        'select photo from app.meals where user_id = $1 and id = $2',
        [account.id, meal.id],
      );
      const oldMediaId = mediaIdOf(before.rows[0]?.photo ?? null);
      const newMediaId = mediaIdOf(meal.photo ?? null);
      if (newMediaId && newMediaId !== oldMediaId) {
        const claimed = await client.query(
          `insert into app.media (user_id, id, kind, meal_id) values ($1, $2, 'meal', $3) on conflict (user_id, id) do nothing`,
          [account.id, newMediaId, meal.id],
        );
        if (claimed.rowCount === 0) return 'VALIDATION_FAILED';
      }
      if (oldMediaId && oldMediaId !== newMediaId) await deletePhoto(client, account.id, oldMediaId, now);
      const totals = mealTotals(meal.items);
      await client.query(
        `insert into app.meals (user_id, id, day, meal_type, tags, items, kcal, protein_g, carbs_g, fat_g, fibre_g,
           photo, recorded_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12::jsonb, $13)
         on conflict (user_id, id) do update set
           day = excluded.day, meal_type = excluded.meal_type, tags = excluded.tags, items = excluded.items,
           kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
           fibre_g = excluded.fibre_g, photo = excluded.photo, recorded_at = excluded.recorded_at, deleted_at = null`,
        [
          account.id,
          meal.id,
          meal.day,
          meal.mealType,
          meal.tags,
          itemsJson(meal.items),
          ...totalValues(totals),
          meal.photo ? JSON.stringify(meal.photo) : null,
          meal.recordedAt,
        ],
      );
      return null;
    },
  ],
  [
    MEAL_DELETE,
    // Removes the meal's content and keeps an empty row, so other phones learn of the deletion.
    // Its photo is deleted with it (REQ-NUT-004, Q-032). Deleting a meal the server never had
    // changes nothing.
    async (client, account, input, now) => {
      const data = mealDeleteDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `update app.meals set deleted_at = $3, meal_type = null, tags = '{}', items = null, kcal = null,
           protein_g = null, carbs_g = null, fat_g = null, fibre_g = null, photo = null
         where user_id = $1 and id = $2 and deleted_at is null`,
        [account.id, data.data.id, data.data.deletedAt],
      );
      await client.query('update app.media set deleted_at = $3 where user_id = $1 and meal_id = $2 and deleted_at is null', [
        account.id,
        data.data.id,
        now,
      ]);
      return null;
    },
  ],
  [
    SAVED_MEAL_SET,
    async (client, account, input) => {
      const data = savedMealSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      const saved = data.data;
      if (!(await itemsListed(client, saved.items))) return 'VALIDATION_FAILED';
      const totals = mealTotals(saved.items);
      await client.query(
        `insert into app.saved_meals (user_id, id, name, meal_type, tags, items, kcal, protein_g, carbs_g, fat_g,
           fibre_g, saved_at)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
         on conflict (user_id, id) do update set
           name = excluded.name, meal_type = excluded.meal_type, tags = excluded.tags, items = excluded.items,
           kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
           fibre_g = excluded.fibre_g, saved_at = excluded.saved_at, deleted_at = null`,
        [account.id, saved.id, saved.name, saved.mealType, saved.tags, itemsJson(saved.items), ...totalValues(totals), saved.savedAt],
      );
      return null;
    },
  ],
  [
    MY_FOOD_SET,
    // A food the user entered and saved (D-39): created, or replaced whole; the change received last
    // wins, including over an earlier deletion. Meals already logged keep their own values.
    async (client, account, input) => {
      const data = myFoodSetDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      const food = data.data;
      await client.query(
        `insert into app.my_foods (user_id, id, name, unit, kcal, protein_g, carbs_g, fat_g, fibre_g, saved_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id, id) do update set
           name = excluded.name, unit = excluded.unit, kcal = excluded.kcal, protein_g = excluded.protein_g,
           carbs_g = excluded.carbs_g, fat_g = excluded.fat_g, fibre_g = excluded.fibre_g,
           saved_at = excluded.saved_at, deleted_at = null`,
        [account.id, food.id, food.name, food.unit, food.kcal, food.proteinG, food.carbsG, food.fatG, food.fibreG, food.savedAt],
      );
      return null;
    },
  ],
  [
    MY_FOOD_DELETE,
    // Removes the food's content and keeps an empty row, so other phones learn of the deletion.
    async (client, account, input) => {
      const data = myFoodDeleteDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `update app.my_foods set deleted_at = $3, name = null, unit = null, kcal = null, protein_g = null,
           carbs_g = null, fat_g = null, fibre_g = null
         where user_id = $1 and id = $2 and deleted_at is null`,
        [account.id, data.data.id, data.data.deletedAt],
      );
      return null;
    },
  ],
  [
    SAVED_MEAL_DELETE,
    async (client, account, input) => {
      const data = savedMealDeleteDataSchema.safeParse(input);
      if (!data.success) return 'VALIDATION_FAILED';
      await client.query(
        `update app.saved_meals set deleted_at = $3, name = null, meal_type = null, tags = '{}', items = null,
           kcal = null, protein_g = null, carbs_g = null, fat_g = null, fibre_g = null
         where user_id = $1 and id = $2 and deleted_at is null`,
        [account.id, data.data.id, data.data.deletedAt],
      );
      return null;
    },
  ],
]);

/** Marks a photo deleted at once, so no link is issued for it; its files are removed after the sync. */
async function deletePhoto(client: pg.PoolClient, userId: string, mediaId: string, now: Date) {
  await client.query('update app.media set deleted_at = $3 where user_id = $1 and id = $2 and deleted_at is null', [
    userId,
    mediaId,
    now,
  ]);
}

function mediaIdOf(photo: MealPhoto | null): string | null {
  return photo?.kind === 'photo' ? photo.mediaId : null;
}

/**
 * Every dish the items name is on FitSphere's dish list (D-28), so a meal can hold only approved
 * dishes. The item keeps its own values: they are the snapshot taken when it was logged.
 */
async function dishesListed(client: pg.PoolClient, items: MealItem[]): Promise<boolean> {
  const refs = new Set(items.filter((item) => item.source === 'dish').map((item) => item.ref));
  if (refs.size === 0) return true;
  if (refs.has(null)) return false;
  const { rows } = await client.query<{ n: number }>('select count(*)::int as n from app.dishes where code = any($1::text[])', [
    [...refs],
  ]);
  return rows[0]?.n === refs.size;
}

/**
 * Every household unit the items use is on the food list for that food (D-36), as for dishes. The
 * item keeps the grams it came to and its own values: the snapshot taken when it was logged.
 */
/** Every dish, household unit and USDA serving the items name is on the food list. */
async function itemsListed(client: pg.PoolClient, items: MealItem[]): Promise<boolean> {
  return (await dishesListed(client, items)) && (await measuresListed(client, items)) && (await servingsListed(client, items));
}

/** A USDA serving must be on the list for its food, with the grams per serving it came to (D-39). */
async function servingsListed(client: pg.PoolClient, items: MealItem[]): Promise<boolean> {
  const used = items.flatMap((item) =>
    item.amount.unit === 'serving' ? [{ code: item.ref ?? '', label: item.amount.label, grams: item.amount.grams / item.amount.value }] : [],
  );
  for (const { code, label, grams } of used) {
    const { rows } = await client.query<{ grams: string }>(
      `select grams from app.food_portions where source = 'usda_fndds' and code = $1 and label = $2`,
      [code, label],
    );
    // The phone multiplies the serving's grams by the count; allow for rounding to two decimals.
    if (!rows[0] || Math.abs(Number(rows[0].grams) - grams) > 0.02) return false;
  }
  return true;
}

async function measuresListed(client: pg.PoolClient, items: MealItem[]): Promise<boolean> {
  const used = new Set(items.flatMap((item) => (item.amount.unit === 'measure' ? [`${item.ref} ${item.amount.measure}`] : [])));
  if (used.size === 0) return true;
  const { rows } = await client.query<{ n: number }>(
    `select count(*)::int as n from app.food_measures
     where source = 'ifct2017' and code || ' ' || measure = any($1::text[])`,
    [[...used]],
  );
  return rows[0]?.n === used.size;
}

/** node-postgres turns a JavaScript array into a PostgreSQL array, so jsonb gets JSON text. */
function itemsJson(items: MealItem[]): string {
  return JSON.stringify(items);
}

function totalValues(totals: ReturnType<typeof mealTotals>) {
  return [totals.kcal, totals.proteinG, totals.carbsG, totals.fatG, totals.fibreG];
}

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
  | { kind: 'workout'; item: StoredWorkout }
  | { kind: 'target'; item: SyncResponse['pull']['targets'][number] }
  | { kind: 'setting'; item: SyncResponse['pull']['settings'][number] }
  | { kind: 'profile'; item: Profile }
  | { kind: 'meal'; item: StoredMeal }
  | { kind: 'savedMeal'; item: StoredSavedMeal }
  | { kind: 'myFood'; item: StoredMyFood }
);

type StoredTotals = { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; fibreG: number | null };
type StoredMeal = Omit<Extract<PulledMeal, { deleted: false }>, 'totals' | 'mealType'> &
  StoredTotals & { mealType: Extract<PulledMeal, { deleted: false }>['mealType'] | null };
type StoredSavedMeal = Omit<Extract<PulledSavedMeal, { deleted: false }>, 'totals' | 'mealType' | 'name'> &
  StoredTotals & { name: string | null; mealType: Extract<PulledSavedMeal, { deleted: false }>['mealType'] | null };
type StoredMyFood = { id: string; deleted: boolean; name: string | null; unit: Extract<PulledMyFood, { deleted: false }>['unit'] | null } & {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
  savedAt: string;
  updatedAt: string;
};
type StoredWorkout = Omit<Workout, 'exercises'> & { deleted: boolean; exercises: Workout['exercises'] | null };

/**
 * The user's rows changed after `afterSeq`, oldest change first, from every synced table. They
 * share `app.change_seq`, so one cursor covers them all. Day data, meals and workouts included, is
 * limited to the 90-day window; targets, settings, the profile, saved meals and My foods are always
 * included.
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
       select 'workout', change_seq,
         json_build_object('id', id, 'day', day::text, 'deleted', deleted_at is not null, 'exercises', exercises,
           'recordedAt', recorded_at, 'updatedAt', updated_at)
       from app.workouts where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'target', change_seq,
         json_build_object('kind', kind, 'value', value, 'setByUserId', set_by_user_id,
           'setAt', set_at, 'updatedAt', updated_at)
       from app.targets where user_id = $1 and change_seq > $2
       union all
       select 'setting', change_seq,
         json_build_object('name', name, 'value', value, 'setAt', set_at, 'updatedAt', updated_at)
       from app.settings where user_id = $1 and change_seq > $2
       union all
       select 'profile', change_seq,
         json_build_object('name', name, 'dateOfBirth', date_of_birth::text, 'sex', sex, 'heightMm', height_mm,
           'phone', phone,
           'address', case when address_line1 is null then null else json_build_object('line1', address_line1,
             'line2', address_line2, 'city', city, 'state', state, 'pinCode', pin_code) end,
           'photoMediaId', photo_media_id, 'setAt', set_at, 'updatedAt', updated_at)
       from app.profiles where user_id = $1 and change_seq > $2
       union all
       select 'meal', change_seq,
         json_build_object('id', id, 'day', day::text, 'deleted', deleted_at is not null, 'mealType', meal_type,
           'tags', tags, 'items', items, 'kcal', kcal, 'proteinG', protein_g, 'carbsG', carbs_g, 'fatG', fat_g,
           'fibreG', fibre_g, 'photo', photo, 'recordedAt', recorded_at, 'updatedAt', updated_at)
       from app.meals where user_id = $1 and change_seq > $2 and day >= $3
       union all
       select 'savedMeal', change_seq,
         json_build_object('id', id, 'deleted', deleted_at is not null, 'name', name, 'mealType', meal_type,
           'tags', tags, 'items', items, 'kcal', kcal, 'proteinG', protein_g, 'carbsG', carbs_g, 'fatG', fat_g,
           'fibreG', fibre_g, 'savedAt', saved_at, 'updatedAt', updated_at)
       from app.saved_meals where user_id = $1 and change_seq > $2
       union all
       select 'myFood', change_seq,
         json_build_object('id', id, 'deleted', deleted_at is not null, 'name', name, 'unit', unit, 'kcal', kcal,
           'proteinG', protein_g, 'carbsG', carbs_g, 'fatG', fat_g, 'fibreG', fibre_g, 'savedAt', saved_at,
           'updatedAt', updated_at)
       from app.my_foods where user_id = $1 and change_seq > $2
     ) as changed
     order by change_seq
     limit $4`,
    [userId, afterSeq.toString(), windowStart, limit],
  );
  return rows;
}

function toPull(rows: ChangedRow[]): SyncResponse['pull'] {
  const pull: SyncResponse['pull'] = {
    weighIns: [],
    steps: [],
    sleep: [],
    measurements: [],
    workouts: [],
    targets: [],
    settings: [],
    profiles: [],
    meals: [],
    savedMeals: [],
    myFoods: [],
    removals: [],
  };
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
      case 'workout':
        pull.workouts.push(toPulledWorkout(row.item));
        break;
      case 'target':
        pull.targets.push({ ...row.item, setAt: utc(row.item.setAt), updatedAt: utc(row.item.updatedAt) });
        break;
      case 'setting':
        pull.settings.push({ ...row.item, setAt: utc(row.item.setAt), updatedAt: utc(row.item.updatedAt) });
        break;
      case 'profile':
        pull.profiles.push({ ...row.item, setAt: utc(row.item.setAt), updatedAt: utc(row.item.updatedAt) });
        break;
      case 'meal':
        pull.meals.push(toPulledMeal(row.item));
        break;
      case 'savedMeal':
        pull.savedMeals.push(toPulledSavedMeal(row.item));
        break;
      case 'myFood':
        pull.myFoods.push(toPulledMyFood(row.item));
        break;
    }
  }
  return pull;
}

function toPulledMeal(meal: StoredMeal): PulledMeal {
  if (meal.deleted || meal.mealType === null) {
    return { deleted: true, id: meal.id, day: meal.day, updatedAt: utc(meal.updatedAt) };
  }
  return {
    deleted: false,
    id: meal.id,
    day: meal.day,
    mealType: meal.mealType,
    tags: meal.tags,
    items: meal.items,
    totals: totalsOf(meal),
    photo: meal.photo,
    recordedAt: utc(meal.recordedAt),
    updatedAt: utc(meal.updatedAt),
  };
}

function toPulledSavedMeal(saved: StoredSavedMeal): PulledSavedMeal {
  if (saved.deleted || saved.mealType === null || saved.name === null) {
    return { deleted: true, id: saved.id, updatedAt: utc(saved.updatedAt) };
  }
  return {
    deleted: false,
    id: saved.id,
    name: saved.name,
    mealType: saved.mealType,
    tags: saved.tags,
    items: saved.items,
    totals: totalsOf(saved),
    savedAt: utc(saved.savedAt),
    updatedAt: utc(saved.updatedAt),
  };
}

function totalsOf(row: StoredTotals) {
  return { kcal: row.kcal ?? 0, proteinG: row.proteinG ?? 0, carbsG: row.carbsG, fatG: row.fatG, fibreG: row.fibreG };
}

function toPulledMyFood(food: StoredMyFood): PulledMyFood {
  if (food.deleted || food.name === null || food.unit === null) return { deleted: true, id: food.id, updatedAt: utc(food.updatedAt) };
  return {
    deleted: false,
    id: food.id,
    name: food.name,
    unit: food.unit,
    kcal: Number(food.kcal),
    proteinG: Number(food.proteinG),
    carbsG: Number(food.carbsG),
    fatG: Number(food.fatG),
    fibreG: food.fibreG === null ? null : Number(food.fibreG),
    savedAt: utc(food.savedAt),
    updatedAt: utc(food.updatedAt),
  };
}

function toPulledWorkout(workout: StoredWorkout): PulledWorkout {
  if (workout.deleted || workout.exercises === null) {
    return { deleted: true, id: workout.id, day: workout.day, updatedAt: utc(workout.updatedAt) };
  }
  return {
    deleted: false,
    id: workout.id,
    day: workout.day,
    exercises: workout.exercises,
    recordedAt: utc(workout.recordedAt),
    updatedAt: utc(workout.updatedAt),
  };
}

function withUtcTimes<T extends Times>(item: T): T {
  return { ...item, recordedAt: utc(item.recordedAt), updatedAt: utc(item.updatedAt) };
}

function utc(value: string): string {
  return new Date(value).toISOString();
}
