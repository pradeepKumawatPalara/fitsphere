// Schemas shared by the app and the API (api-conventions, "Strict input"; error-model).
// Request schemas are strict: unknown fields are refused. Response schemas accept added fields,
// because adding a field does not change the API version.
import { z } from 'zod';
import { addDays, isIstDay, type IstDay } from './dates.ts';
import { WEIGHT_GRAMS_MAX, WEIGHT_GRAMS_MIN } from './units.ts';

// --- Error codes (error-model, "Codes") ---

export const REQUEST_ERROR_CODES = [
  'VALIDATION_FAILED',
  'AGE_CONFIRMATION_REQUIRED',
  'AUTH_REQUIRED',
  'ACCOUNT_SETUP_REQUIRED',
  'EMAIL_NOT_VERIFIED',
  'ROLE_NOT_ENABLED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;
export type RequestErrorCode = (typeof REQUEST_ERROR_CODES)[number];

export const CHANGE_ERROR_CODES = [
  'VALIDATION_FAILED',
  'DAY_IN_FUTURE',
  'ROLE_NOT_ENABLED',
  'NOT_ALLOWED',
  'UNKNOWN_CHANGE_TYPE',
] as const;
export type ChangeErrorCode = (typeof CHANGE_ERROR_CODES)[number];

export const VALIDATION_ISSUES = [
  'required',
  'invalid_format',
  'out_of_range',
  'unknown_field',
  'too_many',
] as const;
export type ValidationIssue = (typeof VALIDATION_ISSUES)[number];

// --- Field types (api-conventions, "Types") ---

export const istDaySchema = z.string().refine(isIstDay);
/** ISO 8601 in UTC with `Z`. */
export const instantSchema = z.iso.datetime();
export const idSchema = z.uuid();
export const weightGramsSchema = z.int().min(WEIGHT_GRAMS_MIN).max(WEIGHT_GRAMS_MAX);

// --- Errors (error-model, "Error shape") ---

export const validationDetailSchema = z.strictObject({
  field: z.string(),
  issue: z.enum(VALIDATION_ISSUES),
});
export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(REQUEST_ERROR_CODES),
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
    details: z.array(validationDetailSchema).nullable(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

// --- Account: GET and POST /v1/me ---

/** Version of the "I am 18 or older" text the app shows (MVP default). */
export const AGE_CONFIRMATION_TEXT_VERSION = '2026-10-27';

export const meSetupRequestSchema = z.strictObject({
  ageConfirmed: z.boolean(),
  ageConfirmationTextVersion: z.string().min(1).max(32),
});
export type MeSetupRequest = z.infer<typeof meSetupRequestSchema>;

export const ROLES = ['personal', 'coach', 'head_coach'] as const;
export type Role = (typeof ROLES)[number];

export const meResponseSchema = z.object({
  user: z.object({ id: idSchema, email: z.string(), createdAt: instantSchema }),
  roles: z.array(z.enum(ROLES)),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// --- Sync: POST /v1/sync (ADR-0007) ---

export const MAX_SYNC_CHANGES = 100;
export const SYNC_PAGE_SIZE = 500;
/** The phone keeps, and the pull returns, the last 90 IST days (ADR-0007 rule 1). */
export const SYNC_WINDOW_DAYS = 90;

/** The first IST day of the window that ends today: 90 days including today. */
export function syncWindowStart(today: IstDay): IstDay {
  return addDays(today, -(SYNC_WINDOW_DAYS - 1));
}

export const WEIGH_IN_SET = 'weighIn.set';

export const weighInSetDataSchema = z.strictObject({
  day: istDaySchema,
  weightGrams: weightGramsSchema,
  recordedAt: instantSchema,
});
export type WeighInSetData = z.infer<typeof weighInSetDataSchema>;

/** The envelope of one change. Its `data` is checked per change type, so one bad change does
 * not fail the others. */
export const syncChangeSchema = z.strictObject({
  changeId: idSchema,
  type: z.string().min(1).max(64),
  data: z.unknown(),
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncRequestSchema = z.strictObject({
  cursor: z.string().min(1).max(200).nullable(),
  changes: z.array(syncChangeSchema).max(MAX_SYNC_CHANGES),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const changeErrorSchema = z.object({
  code: z.enum(CHANGE_ERROR_CODES),
  message: z.string(),
  details: z.array(validationDetailSchema).nullable(),
});
export type ChangeError = z.infer<typeof changeErrorSchema>;

export const syncResultSchema = z.object({
  changeId: idSchema,
  status: z.enum(['accepted', 'rejected']),
  error: changeErrorSchema.nullable(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const weighInSchema = z.object({
  day: istDaySchema,
  weightGrams: z.int(),
  recordedAt: instantSchema,
  updatedAt: instantSchema,
});
export type WeighIn = z.infer<typeof weighInSchema>;

export const syncResponseSchema = z.object({
  results: z.array(syncResultSchema),
  pull: z.object({
    weighIns: z.array(weighInSchema),
    // Always empty in the Skeleton (ADR-0007 rule 3).
    removals: z.array(z.never()),
  }),
  cursor: z.string(),
  hasMore: z.boolean(),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;

// --- Validation details ---

/**
 * Turns a schema failure into error-model details: the field path and an issue name, never the
 * submitted value (invariant #7).
 */
export function validationDetails(error: z.ZodError, input: unknown): ValidationDetail[] {
  return error.issues.flatMap((issue): ValidationDetail[] => {
    const field = formatPath(issue.path);
    switch (issue.code) {
      case 'unrecognized_keys':
        return issue.keys.map((key) => ({
          field: formatPath([...issue.path, key]),
          issue: 'unknown_field',
        }));
      case 'invalid_type':
        return [{ field, issue: isMissing(input, issue.path) ? 'required' : 'invalid_format' }];
      case 'too_big':
        return [{ field, issue: issue.origin === 'array' ? 'too_many' : 'out_of_range' }];
      case 'too_small':
        return [{ field, issue: 'out_of_range' }];
      default:
        return [{ field, issue: 'invalid_format' }];
    }
  });
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) =>
      typeof key === 'number' ? `[${key}]` : `${index === 0 ? '' : '.'}${String(key)}`,
    )
    .join('');
}

function isMissing(input: unknown, path: readonly PropertyKey[]): boolean {
  let current = input;
  for (const key of path) {
    if (typeof current !== 'object' || current === null || !(key in current)) return true;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current === undefined || current === null;
}
