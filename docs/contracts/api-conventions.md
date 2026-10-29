# API Conventions

- Status: Draft — written for the Skeleton slice
- Owner: Project owner (D-01)
- Last updated: 2026-10-29 (Home and daily tracking slice, step 2: steps, sleep, measurements and
  targets through sync; D-23). 2026-10-28 (D-20: self-access only in the MVP; Resend with the
  Release slice)
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
| `POST /v1/sync` | Send queued changes; receive changes for the phone | Own data; Personal Training User role turned on to write any change | REQ-NFR-004, REQ-HOME-006, REQ-MEAS-*, REQ-ROLE-007, REQ-LOG-007, REQ-NUT-004, REQ-SAVED-001, ADR-0007 |
| `GET /v1/users/{userId}/weigh-ins` | Read weigh-ins online: the user's own older history, or a trainee's | The user. Post-MVP (D-20): also their coach with an active link, or a Head Coach the trainee allows; read-only | REQ-PRG-001, REQ-NFR-001; post-MVP REQ-ROLE-005, REQ-ROLE-013 |
| `GET /v1/foods` | FitSphere's food list, for the phone to cache and search offline | Signed in, with an account (reference data, the same for everyone) | REQ-LOG-007, REQ-ACC-005, ADR-0006 |

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
  | `meal.set` | `id`, `day`, `mealType`, `tags`, `items`, `recordedAt` | Creates the meal, or replaces the whole meal with this `id`. 1 to 30 items; each item's fields and limits are in the data model (`meals`). The server computes the totals; a change that sends them is refused as an unknown field |
  | `meal.delete` | `id`, `deletedAt` | Deletes the meal. A meal the server never had is accepted and changes nothing |
  | `savedMeal.set` | `id`, `name`, `mealType`, `tags`, `items`, `savedAt` | A copy of a meal, with no day. Name 1 to 60 characters |
  | `savedMeal.delete` | `id`, `deletedAt` | Deletes the saved meal |
  | `target.set` | `kind`, `value`, `setAt` | `kind` is `calories`, `protein`, `steps`, `weekly_workouts` or `body_weight`; `value` in that kind's range (data model, `targets`). Who set it is the caller; a change that names anyone is refused as an unknown field (invariant #2) |

- An `id` in a meal or saved-meal change is made on the phone and names only the caller's own
  meal: the same `id` from another user creates or changes that user's own (invariant #1).
- `meal.set` checks its `day` as below; the delete changes have no day.
- The four types with a `day` set the user's value for that IST day. The day must be a valid day
  not later than today in IST (`DAY_IN_FUTURE` otherwise), and a value already stored for the day
  is replaced (Q-030 MVP default); for measurements the whole entry is replaced.
- `target.set` sets the user's current target of that kind, replacing the old one (Q-014 MVP
  default, D-23).

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
    "targets": [
      { "kind": "calories", "value": 2000, "setByUserId": "0f8e5a1c-…", "setAt": "…", "updatedAt": "…" }
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
- **Pull:** the user's own weigh-ins, steps, sleep, measurements and meals for the last 90 IST
  days, and their current targets and saved meals (ADR-0007 rule 1). With `cursor: null`, all of
  them; otherwise only those changed since the cursor. All the lists share one change sequence, so
  one cursor covers them, and entries are returned in the order they changed. At most 500 entries
  per response, across the lists; when `hasMore` is `true`, the phone calls again with the new
  cursor and no changes.
- `meals` and `savedMeals` entries are `{ "deleted": false, … }` with the content and the
  server's `totals`, or `{ "deleted": true, "id", … }` for one the user deleted, which the phone
  then removes.
- `setByUserId` is the FitSphere ID of whoever set the target. In the MVP it is always the user
  (D-20), and the app shows "Set by you". It is `null` only once that person's account is deleted
  (backlog E-02).
- **Re-checked every time:** every change is authorized when it arrives, never when it was
  queued (invariant #1, D-10).
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

### `GET /v1/foods`
Query: `version` (optional), the version of the list the phone already holds.

`200`:
```json
{
  "version": "Qm9VZx1…",
  "items": [
    { "source": "ifct2017", "code": "T013", "name": "Ghee", "foodGroup": "Edible Oils and Fats",
      "aliases": [], "proteinG": 0, "fibreG": 0, "fatG": 100, "carbsG": 0, "kcal": 900, "kcalEstimated": true }
  ]
}
```
- Values are per 100 g edible portion. Rows hidden until checked are left out.
- `version` changes whenever any value the phone receives changes. When the query's `version` is
  already current, `items` is `null`, so the phone downloads the list only when it changed.
- The list is reference data, not personal, and is the same for every signed-in user. Where its
  values are shown, the app shows the IFCT acknowledgement (D-25).

## Sign-in flows (Supabase Auth, ADR-0004)
The app talks to Supabase Auth for these; the FitSphere API is not involved until account setup.

| Flow | Behaviour | Requirements |
|---|---|---|
| Sign up | Email, password and a required "I am 18 or older" box. Afterwards the app always shows the neutral sign-up text, whatever Supabase returns | REQ-ACC-010, D-11, D-18 |
| Verify email | The link in the email confirms the address, then opens the app, which asks the user to sign in. An unverified account cannot sign in. Links expire within 24 hours | REQ-ACC-010; Q-080 MVP default |
| Sign in | Email and password. Then `GET /v1/me`, and `POST /v1/me` if the account is not set up | REQ-ACC-010 |
| Forgot password | The app always shows the neutral reset text. The link opens the app on a "Set a new password" screen | REQ-ACC-010, D-11 |
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
