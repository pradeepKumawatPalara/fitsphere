# Test Strategy

- Status: Draft — agreed when the owner approves the Skeleton plan
- Owner: Project owner (D-01)
- Last updated: 2026-10-27
- Builds on: [`definition-of-done.md`](definition-of-done.md); contracts in [`../contracts/`](../contracts/);
  the validation steps of ADR-0001 to ADR-0007

How FitSphere is tested: which levels exist, what each must cover, which test data is allowed,
and which checks run on the PC and in GitHub Actions. Feature acceptance criteria stay in
[`requirements.md`](../product/requirements.md); this file says how they are checked.

## Priorities
Most effort goes where a mistake would expose health data or lose a user's entries:
1. **Authorization** — who can read or write whose data (invariant #1, REQ-NFR-001).
2. **Sync and offline** — nothing lost, nothing applied twice, rejected changes kept
   (REQ-NFR-004, ADR-0007, D-14).
3. **Dates and units** — the IST day and canonical units (invariants #5 and #6).
4. **Privacy of logs and errors** — no health data, tokens or email addresses (invariant #7).
5. Screens and layout.

There is no coverage percentage target (Q-050: no numeric targets for the MVP). Instead:
- every API route has authorization tests, enforced by a test that lists all routes;
- every acceptance criterion of a requirement in the slice maps to an automated test or a
  recorded manual check;
- test names start with the REQ ID or ADR step they check, e.g.
  `REQ-HOME-006 rejects a weight above 300 kg`.

## Test levels

| Level | What it covers | Runs against |
|---|---|---|
| Unit | Pure logic: IST dates, unit conversion, shared validation schemas, access-module decisions, outbox logic on the phone | Code only, no network or database |
| Integration | API routes over HTTP with a real PostgreSQL database and the real migrations: account setup, sync, reads | A local or CI PostgreSQL with synthetic data |
| Authorization suite | The permission matrix, case by case, through the API | As integration |
| Database | Constraints and transactions in ADR-0003's validation | As integration |
| App components | Screens and hooks with Supabase and the API replaced by fakes | Code only |
| Device checks (manual) | What only a phone or the real Supabase project can show: offline behaviour, encryption, emails, the Data API switch | Android emulator, a real Android phone, the Supabase development project |

Tokens in automated tests are signed by a test key that the test run creates; the API under test
trusts only that key. Automated tests never call Supabase.

## What the Skeleton must test

### Authorization (ADR-0002 step 4, ADR-0004 step 4)
For `GET /v1/users/{userId}/weigh-ins`:

| Caller | Expected |
|---|---|
| The user themselves | `200` |
| Their coach, link active | `200`, read-only |
| Their former coach, link ended | `404` |
| A coach with no link to the user | `404` |
| Head Coach of the user's coach, trainee's answer "allowed" | `200`, read-only |
| Same Head Coach, answer "declined" or no answer | `404` |
| Same Head Coach after the trainee changes "allowed" to "declined" | `404` |
| A new Head Coach after the coach switched, old answers "allowed" | `404` (answers do not carry over) |
| A Head Coach reading their coach's own weigh-ins | `404` (D-10) |
| No token, or an expired token, or one signed by another key | `401` |
| Signed in, account not set up | `403 ACCOUNT_SETUP_REQUIRED` |

Also:
- no route lets anyone write another user's weigh-ins;
- logging a weight without the Personal Training User role is rejected (`ROLE_NOT_ENABLED`);
- the route-listing test fails if a route has no access rule.

### Sync (ADR-0007)
- A change sent twice is applied once, and the second reply matches the first.
- Two changes for the same day: the one received last wins.
- A change for a day later than today in IST is rejected with `DAY_IN_FUTURE`; the others in the
  same request still apply.
- Out-of-range and malformed values are rejected per change, without the value in the error.
- The pull returns only the user's own weigh-ins from the last 90 IST days, pages at 500 with
  `hasMore`, and returns nothing new on a repeat with the latest cursor.
- On the phone (unit tests): a failed or offline sync keeps the outbox; a rejected change stays
  until the user fixes or discards it; synced entries older than 90 days are removed from the
  phone, pending and rejected ones never.

### Dates and units
- 18:29:59Z is still the same IST day; 18:30:00Z is the next IST day (REQ-DATE-004).
- The shared date tests run twice in CI, with the process time zone set to `Asia/Kolkata` and to
  `America/Los_Angeles`, to prove nothing depends on the machine's time zone.
- Kilograms entered with one decimal convert to grams and back to the same displayed value.

### Account and sign-in (REQ-ACC-010, D-18)
- `POST /v1/me` without `ageConfirmed: true` creates nothing and returns
  `AGE_CONFIRMATION_REQUIRED`; with it, the account gets `age_confirmed_at`, the text version and
  the Personal Training User role.
- The email stored comes from the token, even if the body contains another one (the body field
  is refused as unknown).
- The sign-up button stays disabled until "I am 18 or older" is ticked.
- The app shows the same neutral text for every sign-up and reset outcome from Supabase.

### Database (ADR-0003 validation)
- (a) a second active coach link for one trainee is rejected;
- (b) switching is all-or-nothing: a failure after ending the old link leaves it active;
- (c) a weekly-average query over 10,000 synthetic weigh-ins: record the time (no target, Q-050);
- (d) ending a link leaves its row in place;
- the database growth per 10,000 synthetic weigh-ins is measured on the Supabase project and
  recorded, to estimate when the 400 MB trigger is reached (R-005).

### Logs (ADR-0002 step 6, invariant #7)
An integration test captures the API's log output during sign-in-protected requests and a sync,
and fails if it contains the weight value, the token, the email address or a query value.

### Device checks for the Skeleton
Recorded, with the date, under "Validation results" in the ADR named:

| Check | ADR step |
|---|---|
| Blank Expo TypeScript app runs on the Android emulator on Windows | ADR-0001 step 1 |
| 1,000 rows saved to and read from the local database with the network off | ADR-0001 step 4 |
| An iOS build compiles on EAS (simulator build, no device) | ADR-0001 step 5 |
| A 200-row weight history list scrolls smoothly on the lowest-end Android phone available | ADR-0001 step 6 |
| Data API off: Supabase's auto-generated endpoints return nothing; Supabase Auth still works | ADR-0002 step 2, ADR-0003 (e), ADR-0004 step 3 |
| The API connects through Supabase's connection pooler | ADR-0002 step 3 (Cloud Run part waits for Q-087) |
| Sign-up, reset and sign-in with a registered and an unregistered address, through the app and directly against Supabase Auth: same app text, no revealing Supabase response (Confirm email and Confirm phone both on). The timing part is limited by the built-in sender (team addresses only, 2 emails an hour) and is repeated with Resend in the invitations slice | ADR-0004 step 2 |
| Account setup is refused while the email is unverified | ADR-0004 step 3, Q-080 |
| SQLCipher is active in the development build (the start-up check passes) | ADR-0007 step 6 |
| An expired token is refused by the API | ADR-0004 step 3 |
| Airplane mode: log a weight, restart the app, reconnect; it reaches the server once | ADR-0007 step 1 (weight part) |
| A rejected own change stays on the phone until fixed or discarded | ADR-0007 step 4 |
| Phone set to another country's time zone: the entry still gets the IST day chosen | ADR-0007 step 5 |
| The phone's database file is unreadable without the key | ADR-0007 step 6 |
| A push notification sent through Expo's push service reaches the Android phone (development build, FitSphere's own FCM credentials) | ADR-0001 step 7, D-13 answer 9 |

Not in the Skeleton: barcode, audio, photos, AI, food data, invitations, account deletion, the
push token removed at log out, coach-phone removals (ADR-0001 steps 2–3, ADR-0002 step 5,
ADR-0004 steps 1 and 5–7, ADR-0005, ADR-0006, ADR-0007 steps 2–3). Each runs in the slice that
builds the feature.

## Test data
- **Synthetic only** (invariant #7, REQ-NFR-002). Generated values are made up; no real person's
  health data appears in tests, fixtures, seed files, screenshots or bug reports.
- Email addresses in automated tests use `example.com` or `example.test`. Manual sign-ups on the
  Supabase development project use the owner's own inbox, with made-up health values.
- The Supabase development project holds synthetic data only. No production data is ever copied
  into a development or test database.
- Fixtures build only the rows a test needs, through the same functions the API uses where
  possible.

## Where checks run

| Check | On the PC | GitHub Actions (every push and pull request) |
|---|---|---|
| Lint | Yes | Yes |
| Type-check (each package) | Yes | Yes |
| Unit tests (shared, API, app) | Yes | Yes; shared date tests in two time zones |
| Integration, authorization and database tests | Yes, with a local PostgreSQL | Yes, with a PostgreSQL service container |
| Log-content test | Yes | Yes |
| Device checks | Manual | No |
| Checks against the Supabase project | Manual | No |

CI rules:
- CI uses no secrets and never connects to Supabase in the Skeleton.
- Workflows get read-only repository permissions.
- Official GitHub actions are pinned to a major version; any third-party action is pinned to a
  full commit SHA.
- A red check is fixed before more work is added on top of it.

## Tools
*Proposed in the Skeleton plan; this section is updated when the owner approves it.* The levels
and rules above do not depend on the tools.
