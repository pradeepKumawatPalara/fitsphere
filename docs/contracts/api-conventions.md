# API Conventions

- Status: Draft — written for the Skeleton slice
- Owner: Project owner (D-01)
- Last updated: 2026-11-10 (`timer` in `workout.set`, the pull and the workout history, D-71). 2026-11-05 (`GET /v1/exercises` and the exercise's new shape in `workout.set`, D-50). 2026-11-04 (the profile, REQ-ACC-011, D-38). Before that: 2026-10-30 (Settings slice, step 2: `DELETE /v1/me`; D-31). Earlier the same day
  (Settings slice, step 1: `setting.set` and the settings in the pull, and the AI consent routes). 2026-10-29 (Training slice, step 1: workouts through sync, and
  the workout history route; D-29). 2026-10-29 (Home and daily tracking slice, step 2: steps,
  sleep, measurements and targets through sync; D-23). 2026-10-28 (D-20: self-access only in the
  MVP; Resend with the Release slice)
- Builds on: ADR-0002 (the Node API is the only path to the data), ADR-0004 (Supabase Auth, one
  access module), ADR-0007 (one sync endpoint); [`data-model.md`](data-model.md);
  [`error-model.md`](error-model.md)

How the app talks to the FitSphere API, and the endpoints the Skeleton slice needs. D- numbers
refer to [`owner-decisions-2026-10-27.md`](../product/owner-decisions-2026-10-27.md).

## General rules
- **Base path and versions:** every route starts with `/v1`. Adding a field or an endpoint does
  not change the version; removing or changing the meaning of one needs `/v2`.
- **Transport:** HTTPS only, except during local development, when a development build of the
  app calls the API on the developer's PC over plain HTTP ([runbook](../operations/runbook.md#local-setup)).
  The API runs on the PC until Q-087 is settled (ADR-0002).
- **Format:** JSON in UTF-8 with `Content-Type: application/json`. Field names are `camelCase`.
  A field with no value is `null`, not left out. Request bodies are limited to 100 KB.
- **Strict input:** every request body and query is checked against a schema shared by the app
  and the API (`packages/shared`). Unknown fields are refused (`VALIDATION_FAILED`). The API's
  check is the one that counts; the app's is for quick feedback.
- **Types:**

  | Kind | Format | Example |
  |---|---|---|
  | ID | UUID string | `"0f8e5a1c-9b7d-4c1e-8a2b-3c4d5e6f7a8b"` |
  | Day the user chose | `YYYY-MM-DD`, an IST day (invariant #5) | `"2026-10-27"` |
  | Instant | ISO 8601 in UTC with `Z` | `"2026-10-27T02:45:10.123Z"` |
  | Body weight | Whole grams, as an integer (invariant #6) | `70250` |
  | Sleep | Whole minutes, as an integer (invariant #6; D-23) | `450` |
  | Body measurement | Whole millimetres, as an integer (invariant #6; D-23) | `812` |

  The API never accepts or returns kilograms, pounds, hours, centimetres or inches; the app
  converts for display and input.
- **"Today":** the API works out today's IST date from its own UTC clock with a fixed +05:30
  offset (Asia/Kolkata has no daylight saving), using the shared date functions. It never uses
  the server's local time zone (invariant #5, REQ-DATE-004).
- **Lists:** `limit` (default 100, maximum 500) and an opaque `cursor`. The response holds
  `items` and `nextCursor`, which is `null` on the last page.
- **Request IDs:** the API gives every request a new UUID, returns it in the `X-Request-Id`
  header and in error bodies, and writes it to its log.
- **No browser access:** only the mobile app calls the API, so no cross-origin (CORS) access is
  allowed.

## Authentication (ADR-0004)
- The app signs up, signs in, resets passwords and refreshes sessions with Supabase Auth
  directly (ADR-0004 rule 3). Every call to the FitSphere API carries the Supabase access token:
  `Authorization: Bearer <access token>`. The API never sees passwords or refresh tokens.
- The API verifies every token itself, except on `GET /v1/health`:
  - the signature, against the asymmetric signing keys the project publishes at
    `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (Supabase caches that list for up to
    10 minutes, so a new key is published before it is used). The legacy shared-secret method
    is not accepted ([runbook](../operations/runbook.md#5-supabase-development-project));
  - the issuer (the project's Auth URL, `<SUPABASE_URL>/auth/v1`; confirm the exact value from a
    real token in the slice), the audience `authenticated`, `role` = `authenticated`, and the
    expiry;
  - anonymous sessions (`is_anonymous` true) are refused.

  A token that fails any check gets `401 AUTH_REQUIRED`.
- The token's `sub` is looked up in `users.auth_subject` to find the FitSphere user. Until the
  account is set up, every route except `GET /v1/me` and `POST /v1/me` answers
  `403 ACCOUNT_SETUP_REQUIRED`.
- Supabase tokens carry no "email verified" claim. At account setup only, the API reads the
  signed-in user from Supabase Auth with the caller's own token and requires the email to be
  confirmed (`email_confirmed_at` set).
- One module in the API talks to Supabase Auth, so the sign-in provider can be replaced
  (ADR-0002, ADR-0004 rule 3).

## Authorization (invariant #1, ADR-0004 rule 4)
- Every route names its access rule, and every handler calls the **access module** before it
  reads or writes data. The module denies by default.
- The module decides from the database: links, Head Coach permission answers and roles turned
  on. It ignores the app's active role (REQ-ROLE-002).
- Reading another person's data needs an active link, as in the
  [permission matrix](../security/data-and-threat-model.md#permission-matrix). If the caller may
  not see it, the answer is `404 NOT_FOUND`, the same as for data that does not exist.
- A test lists every registered route and fails if one has no access rule or no authorization
  test ([test strategy](../quality/test-strategy.md)).

## Logging (invariant #7, ADR-0002)
- One log line per request: time, request ID, method, route pattern (e.g.
  `/v1/users/:userId/weigh-ins`, never the filled-in path or query), status, duration and the
  FitSphere user ID.
- Never logged: request or response bodies, query values, headers (including
  `Authorization`), tokens, email addresses, health values, or error details that contain
  values. The logger removes these fields by configuration, and a test checks the output.

## Endpoints

| Method and path | Purpose | Access rule | Requirements |
|---|---|---|---|
| `GET /v1/health` | The API is running | None (no token) | — |
| `GET /v1/me` | The signed-in user's account | Signed in | REQ-ACC-010, REQ-ROLE-001 |
| `POST /v1/me` | Set up the FitSphere account after the first sign-in | Signed in, account not yet set up | REQ-ACC-010, D-18 |
| `DELETE /v1/me` | Delete the user's account: their data, files and sign-in account | Signed in; the caller's own account only | REQ-ACC-009, ADR-0004 rule 7 |
| `GET /v1/me/ai-consent` | The user's current AI meal-reading consent | The user, for their own record only | REQ-ACC-004 |
| `PUT /v1/me/ai-consent` | Record a change of AI meal-reading consent | The user, for their own record only | REQ-ACC-004, C-004 |
| `POST /v1/sync` | Send queued changes; receive changes for the phone | Own data; Personal Training User role turned on to write any change | REQ-NFR-004, REQ-HOME-006, REQ-MEAS-*, REQ-ROLE-007, REQ-LOG-007, REQ-NUT-004, REQ-SAVED-001, REQ-TRN-003, REQ-ACC-001…003, ADR-0007 |
| `GET /v1/users/{userId}/weigh-ins` | Read weigh-ins online: the user's own older history, or a trainee's | The user. Post-MVP (D-20): also their coach with an active link, or a Head Coach the trainee allows; read-only | REQ-PRG-001, REQ-NFR-001; post-MVP REQ-ROLE-005, REQ-ROLE-013 |
| `GET /v1/users/{userId}/workouts` | Read workouts online: the user's own history older than the phone holds | The user. Post-MVP (D-20): also their coach with an active link, or a Head Coach the trainee allows; read-only | REQ-TRN-004, REQ-NFR-001 |
| `GET /v1/foods` | FitSphere's food list, for the phone to cache and search offline | Signed in, with an account (reference data, the same for everyone) | REQ-LOG-007, REQ-ACC-005, ADR-0006 |
| `GET /v1/exercises` | FitSphere's exercise list, for the phone to cache and search offline | Signed in, with an account (reference data, the same for everyone) | REQ-TRN-003, D-50 |
| `GET /v1/barcodes/{barcode}` | A packaged product's values per 100 g, from Open Food Facts | Signed in, with an account (reference data, the same for everyone) | REQ-LOG-007, ADR-0006 |
| `POST /v1/users/{userId}/media/{mediaId}/upload` | Links to upload one meal photo's viewing copy and thumbnail straight to storage | The user, for their own photo | REQ-LOG-006, ADR-0002 |
| `GET /v1/users/{userId}/media/{mediaId}` | Links to view one meal photo, valid for at most 5 minutes | The user. Post-MVP (D-20): also their coach with an active link | REQ-LOG-006, REQ-NFR-006, ADR-0002 |

### `GET /v1/health`
`200` with `{ "status": "ok" }`. Says nothing about the database or configuration.

### `GET /v1/me`
`200`:
```json
{
  "user": { "id": "…", "email": "user@example.com", "createdAt": "2026-10-27T02:45:10.123Z" },
  "roles": ["personal"]
}
```
`403 ACCOUNT_SETUP_REQUIRED` when the account is not set up yet.

### `POST /v1/me` — account setup
Request:
```json
{ "ageConfirmed": true, "ageConfirmationTextVersion": "2026-10-27" }
```
- Creates the `users` row: `sub` comes from the verified token, and the email from the Supabase
  Auth user record, never from the body. Records the server time as `age_confirmed_at` and turns
  on the Personal Training User role (MVP default, D-18).
- `ageConfirmed` must be `true`; otherwise `400 AGE_CONFIRMATION_REQUIRED` and no account is
  created (REQ-ACC-010).
- If Supabase Auth does not show the email as confirmed, `403 EMAIL_NOT_VERIFIED` and no account
  is created (Q-080 MVP default).
- `201` with the same body as `GET /v1/me`. Calling it again for a set-up account changes
  nothing and returns `200`.
- The app sends the confirmation the user gave at sign-up. It keeps it in the Supabase user's
  metadata, so a sign-in on another phone does not ask again; if it is missing, the app shows
  the "I am 18 or older" step before calling this endpoint.

### `DELETE /v1/me` — delete account (REQ-ACC-009)
No body. `204` with no body once the account is deleted:
1. the files of every meal photo the user has, deleted ones included, are removed from storage;
2. the user's rows in every table are deleted, with any links and Head Coach permission answers
   (none exist in the MVP, D-20);
3. the Supabase sign-in account is deleted, with the server's secret key (D-31 answer 4).

- The caller's own account only: the path names no user (invariant #1).
- Access is "signed in", not "account set up": a deletion stopped after step 2 is finished by
  calling again, which then deletes only the sign-in account. Calling it for an account already
  deleted answers `204`.
- `503 SERVICE_UNAVAILABLE`, retryable, when the server has no secret key or no storage (nothing is
  deleted), when a file cannot be removed (nothing is deleted), or when Supabase Auth does not
  delete the sign-in account (the data is already gone; call again).
- Logged: the request line with the account's ID, and "account deleted". Never the email address,
  the key or any health data (invariant #7).

### `GET /v1/me/ai-consent` and `PUT /v1/me/ai-consent` (REQ-ACC-004)
`GET` returns the latest record, or `null` when the user has never chosen, which means AI is off
(A-007):
```json
{ "aiConsent": { "consented": true, "textVersion": "2026-10-30", "recordedAt": "2026-10-30T04:00:00.000Z" } }
```
`PUT` records a change and returns the same body:
```json
{ "consented": false, "textVersion": "2026-10-30" }
```
- `textVersion` is the version of the consent text the app showed (`AI_CONSENT_TEXT_VERSION`,
  shared); any other value is `400 VALIDATION_FAILED`, as is a missing or unknown field. The
  server records its own time; every change is kept (Q-065 MVP default; data model,
  `ai_consents`).
- Only the caller's own record: the path names no user, and a body that names one is refused as
  an unknown field (invariant #1).
- Online only: consent is not a sync change, so the time recorded is when the server received
  it (MVP default, D-31). Neither route calls an AI service; the AI module checks the latest
  record immediately before each call (invariant #3, slice 7).
- `401`, `403 ACCOUNT_SETUP_REQUIRED`, and the other whole-request errors as for `GET /v1/me`.

### `POST /v1/sync` (ADR-0007)
Writes go through the outbox and this endpoint, online or offline. When the phone is online,
the outbox is sent straight after saving.

Request:
```json
{
  "cursor": null,
  "changes": [
    {
      "changeId": "5d3c2b1a-0f9e-4d8c-b7a6-958473625140",
      "type": "weighIn.set",
      "data": { "day": "2026-10-27", "weightGrams": 70250, "recordedAt": "2026-10-27T02:45:10.123Z" }
    }
  ]
}
```
- `cursor`: the value from the previous sync, or `null` on the phone's first sync.
- `changes`: 0 to 100 changes, applied in the order sent. `changeId` is a UUID made on the phone.
- Each change is checked on its own. Every type needs the Personal Training User role
  (`ROLE_NOT_ENABLED` otherwise), and its `data` is strict: an unknown or missing field is
  `VALIDATION_FAILED`. The change types:

  | `type` | `data` | Rules |
  |---|---|---|
  | `weighIn.set` | `day`, `weightGrams`, `recordedAt` | Whole grams, 20,000 to 300,000 (Q-028) |
  | `steps.set` | `day`, `steps`, `recordedAt` | Whole steps, 0 to 100,000 (Q-028) |
  | `sleep.set` | `day`, `sleepMinutes`, `recordedAt` | Whole minutes, 0 to 1,440 (Q-028) |
  | `measurements.set` | `day`, `upperWaistMm`, `lowerWaistMm`, `chestMm`, `hipsMm`, `armMm`, `thighMm`, `notes`, `recordedAt` | Both waist values required; the others `null` when not entered. Whole millimetres, 100 to 2,500 (Q-028). `notes` 1 to 500 characters, or `null` |
  | `workout.set` | `id`, `day`, `exercises`, `recordedAt`, `timer` | `id` is a UUID made on the phone. 0 to 30 exercises, each as the data model's `workouts` sets out (D-50). `timer` (D-71) is `{ startedAt, countedSeconds, runningSince, doneAt }`, `countedSeconds` 0 to 86,400, never running and done at once, or `null`; a change without it, from an app before D-71, keeps the timer stored |
  | `workout.delete` | `id`, `deletedAt` | Deletes the user's workout with that ID |
  | `meal.set` | `id`, `day`, `mealType`, `tags`, `items`, `photo`, `recordedAt` | Creates the meal, or replaces the whole meal with this `id`. 1 to 30 items; each item's fields and limits are in the data model (`meals`). The server computes the totals; a change that sends them is refused as an unknown field. `photo` is `{"kind": "photo", "mediaId": …}`, `{"kind": "link", "url": …}`, or null or left out for none; a photo ID already used by another meal, or deleted, is refused (data model, `media`). A dish item must be in portions and name a dish on the list, and every other item must be in grams; otherwise the change is `VALIDATION_FAILED` (D-28) |
  | `meal.delete` | `id`, `deletedAt` | Deletes the meal and its photo. A meal the server never had is accepted and changes nothing |
  | `savedMeal.set` | `id`, `name`, `tags`, `items`, `savedAt` | Foods kept under the user's own name, with no day and no meal (D-69); creates the saved meal or replaces it whole. Name 1 to 60 characters. Its items follow the dish rule of `meal.set`. A `mealType` sent by a phone from before D-69 is accepted and not kept |
  | `savedMeal.delete` | `id`, `deletedAt` | Deletes the saved meal |
  | `target.set` | `kind`, `value`, `setAt` | `kind` is `calories`, `protein`, `carbs`, `fat`, `fibre` (D-70), `steps`, `weekly_workouts` or `body_weight`; `value` in that kind's range (data model, `targets`). Who set it is the caller; a change that names anyone is refused as an unknown field (invariant #2) |
  | `setting.set` | `name`, `value`, `setAt` | `name` is `theme` (`system`, `light` or `dark`), `body_weight_unit` or `lifting_weight_unit` (`kg` or `lb`); a value another name allows is refused (data model, `settings`) |
  | `myFood.set` | `id`, `name`, `unit`, `kcal`, `proteinG`, `carbsG`, `fatG`, `fibreG`, `savedAt` | A My food (REQ-LOG-011, D-39): creates it or replaces it whole. `unit` and the values' limits are in the data model (`my_foods`); `fibreG` may be `null` |
  | `myFood.delete` | `id`, `deletedAt` | Deletes the user's My food with that ID; meals logged from it keep their values |
  | `profile.set` | `name`, `dateOfBirth`, `sex`, `heightMm`, `phone`, `address`, `photoMediaId`, `setAt` | The whole profile (REQ-ACC-011, D-38); each field `null` when empty. `address` is `null` or `{ line1, line2, city, state, pinCode }` with `line2` `null` when empty. A date of birth giving an age under 18 or over 120 on today's IST day, or a field outside its rule (data model, `profiles`), is `VALIDATION_FAILED`. `photoMediaId` names the profile photo; an ID already used, or deleted, is refused (data model, `media`) |

- An `id` in a meal or saved-meal change is made on the phone and names only the caller's own
  meal: the same `id` from another user creates or changes that user's own (invariant #1).
- `meal.set` checks its `day` as below; the delete changes have no day.
- The four types with a `day` set the user's value for that IST day. The day must be a valid day
  not later than today in IST (`DAY_IN_FUTURE` otherwise), and a value already stored for the day
  is replaced (Q-030 MVP default); for measurements the whole entry is replaced.
- `target.set` sets the user's current target of that kind, replacing the old one (Q-014 MVP
  default, D-23).
- `setting.set` sets the user's current value of that setting, replacing the old one; the change
  received last wins, as for targets (MVP default, D-31).
- `profile.set` replaces the user's whole profile; the change received last wins, as for settings.
  A photo the profile no longer names is deleted (D-38). Its photo's files use the media routes,
  as a meal photo's do.
- `workout.set` creates the user's workout with that `id`, or replaces the whole workout; the day
  rules above apply, but a day may hold several workouts. It also restores a deleted workout.
  `workout.delete` keeps the workout's row without its content, so other phones learn of the
  deletion; deleting an `id` the server never had is accepted and changes nothing. A workout `id`
  only ever names the caller's own workout (invariant #1).

Response `200`:
```json
{
  "results": [
    { "changeId": "5d3c2b1a-0f9e-4d8c-b7a6-958473625140", "status": "accepted", "error": null }
  ],
  "pull": {
    "weighIns": [
      { "day": "2026-10-27", "weightGrams": 70250, "recordedAt": "2026-10-27T02:45:10.123Z", "updatedAt": "2026-10-27T02:45:11.004Z" }
    ],
    "steps": [
      { "day": "2026-10-27", "steps": 8432, "recordedAt": "…", "updatedAt": "…" }
    ],
    "sleep": [
      { "day": "2026-10-27", "sleepMinutes": 450, "recordedAt": "…", "updatedAt": "…" }
    ],
    "measurements": [
      { "day": "2026-10-27", "upperWaistMm": 812, "lowerWaistMm": 845, "chestMm": null, "hipsMm": null,
        "armMm": null, "thighMm": null, "notes": null, "recordedAt": "…", "updatedAt": "…" }
    ],
    "workouts": [
      { "deleted": false, "id": "0b9e1d2c-…", "day": "2026-10-27",
        "exercises": [ { "name": "Squat", "sets": 3, "reps": 10, "weightGrams": 40000, "note": null } ],
        "recordedAt": "…", "updatedAt": "…" },
      { "deleted": true, "id": "7c2a9e40-…", "day": "2026-10-26", "updatedAt": "…" }
    ],
    "targets": [
      { "kind": "calories", "value": 2000, "setByUserId": "0f8e5a1c-…", "setAt": "…", "updatedAt": "…" }
    ],
    "settings": [
      { "name": "body_weight_unit", "value": "lb", "setAt": "…", "updatedAt": "…" }
    ],
    "profiles": [
      { "name": "Asha Verma", "dateOfBirth": "1994-06-14", "sex": "female", "heightMm": 1620,
        "phone": "+919876543210", "address": null, "photoMediaId": null, "setAt": "…", "updatedAt": "…" }
    ],
    "removals": []
  },
  "cursor": "opaque-string",
  "hasMore": false
}
```
- `results`: one per change, in the same order. `status` is `accepted` or `rejected`; a
  rejected change carries an `error` with a code from the
  [error model](error-model.md#errors-for-one-sync-change).
- **Once only:** a `changeId` the server has seen before returns its stored result and is not
  applied again (`applied_changes`, data model).
- **Who wins:** for the same day, the change the server receives last wins; `recordedAt` does not
  decide (ADR-0007 rule 2).
- **Pull:** the user's own weigh-ins, steps, sleep, measurements, meals and workouts for the last
  90 IST days, and their current targets, settings, profile and saved meals (ADR-0007 rule 1). With `cursor: null`,
  all of them; otherwise only those changed since the cursor. All the lists share one change
  sequence, so one cursor covers them, and entries are returned in the order they changed. At most
  500 entries per response, across the lists; when `hasMore` is `true`, the phone calls again with
  the new cursor and no changes.
- `meals` and `savedMeals` entries are `{ "deleted": false, … }` with the content and the
  server's `totals`, or `{ "deleted": true, "id", … }` for one the user deleted, which the phone
  then removes. A saved meal has no `mealType` (D-69).
- A deleted workout comes back as `{ "deleted": true, "id", "day", "updatedAt" }`, with no
  content; the phone removes its copy.
- `setByUserId` is the FitSphere ID of whoever set the target. In the MVP it is always the user
  (D-20), and the app shows "Set by you". It is `null` only once that person's account is deleted
  (backlog E-02).
- **Re-checked every time:** every change is authorized when it arrives, never when it was
  queued (invariant #1, D-10).
- `myFoods` entries are `{ "deleted": false, … }` with the food, or `{ "deleted": true, "id",
  "updatedAt" }` for one the user deleted, which the phone then removes (D-39).
- `profiles` holds the user's profile when it changed since the cursor: at most one entry, and
  only ever the caller's own (D-20). The values in the example are synthetic.
- `removals` is always empty in the MVP. Its contents are defined with the first slice that puts
  other people's data on a phone (ADR-0007 rule 3; D-20).
- Adding these lists did not change the version: a phone reads the lists it knows.
- Errors for the whole request: [error model](error-model.md#whole-request-errors). After
  `500` or `503`, or with no connection, the phone keeps the outbox and tries again on the next
  save, when the app starts or comes back to the foreground, and when the connection returns.

### `GET /v1/users/{userId}/weigh-ins`
Query: `from` and `to` (IST days, inclusive, required), `limit`, `cursor`. Sorted by day, oldest
first.

`200`:
```json
{
  "items": [ { "day": "2026-10-01", "weightGrams": 70500, "recordedAt": "…", "updatedAt": "…" } ],
  "nextCursor": null
}
```
- Allowed for the user themselves; their coach while the link is active; and a Head Coach whose
  coach is linked to that trainee, while the trainee's current answer is "allowed"
  (REQ-ROLE-013). Coaches and Head Coaches only read (D-18).
- Anyone else gets `404 NOT_FOUND`, including a former coach after the link ended (D-10,
  REQ-ROLE-005).
- **MVP (D-20):** only the user themselves is allowed; anyone else gets `404`. The coach and Head
  Coach rules above are post-MVP (backlog B-19, B-20) and are added to the access module then;
  the path keeps the user's ID so that no new route is needed. In the Skeleton the app uses this
  route only for the user's own history older than 90 days.

### `GET /v1/users/{userId}/workouts`
Query: `from` and `to` (IST days, inclusive, required), `limit`, `cursor`, as for weigh-ins.
Sorted by day, oldest first; workouts on the same day by `id`. Deleted workouts are left out.

`200`:
```json
{
  "items": [
    { "id": "0b9e1d2c-…", "day": "2026-07-01",
      "exercises": [ { "name": "Squat", "sets": 3, "reps": 10, "weightGrams": 40000, "note": null } ],
      "timer": { "startedAt": "…", "countedSeconds": 3160, "runningSince": null, "doneAt": "…" },
      "recordedAt": "…", "updatedAt": "…" }
  ],
  "nextCursor": null
}
```
- Who may read it follows the permission matrix ("Workouts and Progress"), with the same rules
  as the weigh-ins route above. **MVP (D-20):** only the user themselves; anyone else gets `404`.
- The cursor holds the last day and `id` returned, since a day may hold several workouts; a
  cursor from another route is `VALIDATION_FAILED`.
- The app uses it for the user's own workouts older than the 90 days the phone holds, read online
  (REQ-TRN-004; ADR-0007 rules 1 and 6).
- `timer` is the workout's timer (D-71), or `null` when it was never started.

### `GET /v1/foods`
Query: `version` (optional), the version of the list the phone already holds.

`200`:
```json
{
  "version": "Qm9VZx1…",
  "items": [
    { "source": "ifct2017", "code": "T013", "name": "Ghee", "foodGroup": "Edible Oils and Fats",
      "aliases": [], "proteinG": 0, "fibreG": 0, "fatG": 100, "carbsG": 0, "kcal": 900, "kcalEstimated": true,
      "measures": [{ "measure": "teaspoon", "grams": 4.6 }] }
  ],
  "dishes": [
    { "code": "test_dal", "name": "Test dal", "portionUnit": "katori", "kcal": 138.82, "proteinG": 7.42,
      "carbsG": 19.6, "fatG": 3.05, "fibreG": 3.33 }
  ]
}
```
- `items`: values are per 100 g edible portion. Rows hidden until checked are left out.
- `measures` (D-36): the household units the owner has measured and approved for the food, in the
  order teaspoon, tablespoon, katori, glass, piece, with the grams one holds; empty for most foods.
  A meal item may use only a unit its food has here. The example's grams are synthetic.
- `dishes` (D-28): the approved dishes of the standard-recipe sheet, with their values for one
  portion (`portionUnit`: `piece`, or `katori` of 200 ml). Always estimated. A recipe's
  ingredients and grams are never sent. The example is synthetic.
- `version` changes whenever any value the phone receives changes, dishes and units included. When the
  query's `version` is already current, `items` and `dishes` are `null`, so the phone downloads
  the list only when it changed.
- The list is reference data, not personal, and is the same for every signed-in user. Where its
  values are shown, the app shows the IFCT acknowledgement (D-25).

### `GET /v1/exercises`
Query: `version` (optional), the version of the list the phone already holds.

`200`:
```json
{
  "version": "Xk3pQ0v…",
  "items": [
    { "code": "running", "name": "Running", "group": "cardio", "logType": "distance_time",
      "aliases": ["run", "outdoor run"], "compendiumCode": "12145", "met": 10.5,
      "speedMets": [{ "fromKmh": 4.2, "compendiumCode": "12026", "met": 3.3 },
                    { "fromKmh": 6.4, "compendiumCode": "12028", "met": 6.5 }] }
  ]
}
```
- `group`: shown beside the name. `logType`: how it is logged, which decides the fields the phone
  asks for (D-50): `weight_reps`, `reps`, `time`, `weight_time` in sets; `distance_time`,
  `treadmill`, `cardio_machine`, `time_only` as cardio.
- `compendiumCode`, `met`: the 2024 Adult Compendium of Physical Activities' activity and its MET,
  unchanged, for estimating calories burned; both null when the Compendium lists no such activity.
- `speedMets`: for running, walking and cycling, the Compendium's activities by speed, slowest
  first (example shortened); empty for the others. The phone uses the band starting at the highest
  speed at or below the exercise's, and `met` when the speed is not known.
- `version` changes whenever any value changes; when the query's `version` is already current,
  `items` is `null`.
- Reference data, not personal, the same for every signed-in user. A workout keeps each exercise's
  name, not its code, so a change to the list never changes or refuses a saved workout.

### `GET /v1/barcodes/{barcode}`
`barcode`: 8 to 14 digits (EAN-8, UPC-A, EAN-13, GTIN-14); anything else is `400
VALIDATION_FAILED` with `details: [{"field": "barcode", "issue": "invalid_format"}]`.

`200`:
```json
{
  "barcode": "8901234567890",
  "found": true,
  "product": { "name": "Synthetic biscuits", "brand": "Synthetic brand", "kcal": 480, "proteinG": 7,
               "carbsG": 68, "fatG": 20, "fibreG": null,
               "sourceUrl": "https://world.openfoodfacts.org/product/8901234567890" }
}
```
- When Open Food Facts does not know the barcode: `200` with `found: false` and `product: null`.
- Values are per 100 g; `null` when Open Food Facts gives none
  ([data model](data-model.md#barcode_products--reference-data)). The app adds a product only
  when it has kcal and protein; otherwise the user enters the food from the label.
- Answered from `app.barcode_products` when it can be. Otherwise the API asks Open Food Facts
  (API v3) with the barcode only and FitSphere's User-Agent, `FitSphere/1.0 (<OFF_CONTACT>)`,
  and keeps the answer (ADR-0006 rule 2).
- `503 SERVICE_UNAVAILABLE` when Open Food Facts cannot answer (an error, no answer within 8
  seconds, or no `OFF_CONTACT` configured); the app says lookup is not available right now and
  offers your own food.
- Wherever its values are shown, the app shows Open Food Facts' attribution: "Contains data
  from Open Food Facts, available under the Open Database License."

### `POST /v1/users/{userId}/media/{mediaId}/upload` and `GET /v1/users/{userId}/media/{mediaId}`
Meal photo files (REQ-LOG-006; ADR-0002 rules 3 and 4). The photo exists once a synced meal
names its `mediaId`; until then, and once it is deleted, both answer `404`. In the MVP only the
user themselves is allowed; anyone else gets `404` (D-20).

`200`:
```json
{ "photoUrl": "https://…", "thumbnailUrl": "https://…", "expiresAt": "2026-10-28T03:35:00.000Z" }
```
- `POST …/upload`: each link allows one `PUT` of a JPEG (`Content-Type: image/jpeg`) to its own
  key, for 10 minutes, and gives no viewing access. Asking again gives new links; a second
  upload replaces the file. The bucket refuses anything that is not JPEG or is over 1 MB.
- `GET`: each link allows reading its file for 5 minutes (D-16). The app never stores a link; it
  asks again. Links are never written to logs (invariant #7).
- `503 SERVICE_UNAVAILABLE` while storage is not set up on the API (runbook).

## Sign-in flows (Supabase Auth, ADR-0004)
The app talks to Supabase Auth for these; the FitSphere API is not involved until account setup.

| Flow | Behaviour | Requirements |
|---|---|---|
| Sign up | Email, password and a required "I am 18 or older" box. Afterwards the app always shows the neutral sign-up text, whatever Supabase returns | REQ-ACC-010, D-11, D-18 |
| Verify email | The link in the email confirms the address, then opens the app, which asks the user to sign in. An unverified account cannot sign in. Links expire within 24 hours | REQ-ACC-010; Q-080 MVP default |
| Sign in | Email and password. Then `GET /v1/me`, and `POST /v1/me` if the account is not set up | REQ-ACC-010 |
| Forgot password | The app always shows the neutral reset text. The link opens the app on a "Set a new password" screen | REQ-ACC-010, D-11 |
| Change password | "Change password" in Settings: the current password, checked by signing in again with Supabase Auth, then `updateUser` with the new one (8–72 characters), then the user's other devices are signed out. The API never sees either password. Online only | REQ-ACC-007; MVP default, D-31 |
| Delete account | "Delete account" in Settings, after a confirmation, calls `DELETE /v1/me`; then the phone deletes its local database and signs out. Online only | REQ-ACC-009; MVP default, D-31 |
| Log out | Ends the session on this phone. The local database is deleted; if it holds unsynced entries, the app warns first (data model, "On the phone") | REQ-ACC-008; MVP default, D-18 |

- Session tokens are kept in the phone's secure storage (ADR-0004 rule 3). Expo sets no size
  limit there, so the app handles storage errors instead of assuming a fixed limit.
- The texts are in the [error model](error-model.md#texts-the-app-shows).
- The app's neutral texts hide the answer only on the phone. Anyone can call Supabase Auth
  directly with the publishable key, so Supabase itself must not reveal registration either. Its
  docs say sign-up answers "User already registered" unless both **Confirm email** and **Confirm
  phone** are on, so both are turned on ([runbook](../operations/runbook.md#5-supabase-development-project)).
  ADR-0004 validation step 2 checks sign-up, reset and sign-in this way. If Supabase still
  reveals registration, sign-up and reset move behind the FitSphere API (ADR-0004 rule 2).
- Steps that need internet show a named warning (ADR-0007 rule 6): signing up, the first sign-in,
  and resetting a password.
- In the Skeleton, Supabase's built-in email sender is used. It delivers only to members of the
  project's team, at most 2 emails an hour, so it serves development only. Email from FitSphere's
  own domain through Resend comes with the Release slice, before the MVP release (D-20; ADR-0004
  rule 1, validation step 1).
