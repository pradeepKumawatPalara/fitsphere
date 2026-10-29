# Test Strategy

- Status: Accepted — agreed with the Skeleton plan, which the owner approved on 2026-10-28
- Owner: Project owner (D-01)
- Last updated: 2026-10-28 (D-20: self-access authorization; push and iOS checks moved to the
  backlog)
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
| Authorization suite | The permission matrix, case by case, through the API. In the MVP: self-access and "anyone else" (D-20) | As integration |
| Database | Constraints and transactions in ADR-0003's validation | As integration |
| App components | Screens and hooks with Supabase and the API replaced by fakes | Code only |
| Device checks (manual) | What only a phone or the real Supabase project can show: offline behaviour, encryption, emails, the Data API switch | The owner's Android phone with an EAS development build (no emulator, D-19), the Supabase development project |

Tokens in automated tests are signed by a test key that the test run creates; the API under test
trusts only that key. Automated tests never call Supabase.

## What the Skeleton must test

### Authorization (self-access in the MVP, D-20)
The MVP has no links, so the suite covers self-access and "no other user's data" (D-20). For
`GET /v1/users/{userId}/weigh-ins`:

| Caller | Expected |
|---|---|
| The user themselves | `200` |
| Another signed-in user, with an account set up | `404` |
| Any signed-in user, for a user ID that does not exist | `404`, the same as for another user |
| No token, or an expired token, or one signed by another key | `401` |
| Signed in, account not set up | `403 ACCOUNT_SETUP_REQUIRED` |

Also:
- no route lets anyone write another user's weigh-ins;
- a second user's sync never changes or returns the first user's weigh-ins, even with the same
  day and `changeId`;
- the same for steps, sleep, measurements and targets, even with the same day, kind and
  `changeId` (Home and daily tracking slice, D-23);
- logging a weight, steps, sleep or measurements, or setting a target, without the Personal
  Training User role is rejected (`ROLE_NOT_ENABLED`);
- a `target.set` change that names who set the target is refused; the server records the caller
  (invariant #2 groundwork);
- the route-listing test fails if a route has no access rule.

**Post-MVP (D-20; backlog B-19 to B-21):** added with links, these cases from ADR-0002 step 4
and ADR-0004 step 4 — their coach, link active: `200`, read-only; their former coach, link
ended: `404`; a coach with no link: `404`; the Head Coach of the user's coach with the answer
"allowed": `200`, read-only; the same Head Coach with "declined", no answer, or after a change
from "allowed" to "declined": `404`; a new Head Coach after a switch, old answers "allowed":
`404`; a Head Coach reading their coach's own weigh-ins: `404` (D-10); a trainee changing a
coach-set target: refused (invariant #2).

### Sync (ADR-0007)
- A change sent twice is applied once, and the second reply matches the first.
- Two changes for the same day: the one received last wins.
- A change for a day later than today in IST is rejected with `DAY_IN_FUTURE`; the others in the
  same request still apply.
- Out-of-range and malformed values are rejected per change, without the value in the error.
- The pull returns only the user's own weigh-ins from the last 90 IST days, pages at 500 with
  `hasMore`, and returns nothing new on a repeat with the latest cursor.
- Steps, sleep, measurements and targets (D-23): each type is accepted and a second value
  replaces the first; out-of-range values and a missing waist value are rejected; the 90-day
  window applies to day data but not to targets; one cursor pages across all five kinds in the
  order they changed.
- On the phone (unit tests): a failed or offline sync keeps the outbox; a rejected change stays
  until the user fixes or discards it; synced entries older than 90 days are removed from the
  phone, pending and rejected ones never.
- On the phone, for steps, sleep, measurements and targets (D-23): the same outbox life cycle per
  kind; a pull never overwrites a waiting change of the same kind and key but does update other
  kinds for that day; targets are never pruned; the update from local schema version 1 keeps the
  weigh-ins and the outbox and clears the cursor.

### Dates and units
- 18:29:59Z is still the same IST day; 18:30:00Z is the next IST day (REQ-DATE-004).
- The shared date tests run twice in CI, with the process time zone set to `Asia/Kolkata` and to
  `America/Los_Angeles`, to prove nothing depends on the machine's time zone.
- Kilograms entered with one decimal convert to grams and back to the same displayed value.
- Hours of sleep with one decimal convert to minutes and back unchanged; centimetres and inches
  with one decimal convert to millimetres and back unchanged (D-23).

### Account and sign-in (REQ-ACC-010, D-18)
- `POST /v1/me` without `ageConfirmed: true` creates nothing and returns
  `AGE_CONFIRMATION_REQUIRED`; with it, the account gets `age_confirmed_at`, the text version and
  the Personal Training User role.
- The email stored comes from the token, even if the body contains another one (the body field
  is refused as unknown).
- The sign-up button stays disabled until "I am 18 or older" is ticked.
- The app shows the same neutral text for every sign-up and reset outcome from Supabase.

### Database (ADR-0003 validation)
Links are post-MVP, but their tables are created in the Skeleton so links can be added later
without rework; (a), (b) and (d) show the schema can hold them (D-20).
- (a) a second active coach link for one trainee is rejected;
- (b) switching is all-or-nothing: a failure after ending the old link leaves it active;
- (c) a weekly-average query over 10,000 synthetic weigh-ins: record the time (no target, Q-050);
- (d) ending a link leaves its row in place;
- the database growth per 10,000 synthetic weigh-ins is measured on the Supabase project and
  recorded, to estimate when the 400 MB trigger is reached (R-005).

### Logs (ADR-0002 step 6, invariant #7)
An integration test captures the API's log output during sign-in-protected requests and a sync,
and fails if it contains the weight value, a measurement value or its notes, a target value, the
token, the email address or a query value.

### Device checks for the Skeleton
Recorded, with the date, under "Validation results" in the ADR named:

| Check | ADR step |
|---|---|
| Blank Expo TypeScript app runs on the owner's Android phone as an EAS development build (D-19) | ADR-0001 step 1 |
| 1,000 rows saved to and read from the local database with the network off | ADR-0001 step 4 |
| A 200-row weight history list scrolls smoothly on the lowest-end Android phone available | ADR-0001 step 6 |
| Data API off: Supabase's auto-generated endpoints return nothing; Supabase Auth still works | ADR-0002 step 2, ADR-0003 (e), ADR-0004 step 3 |
| The API connects through Supabase's connection pooler | ADR-0002 step 3 (Cloud Run part waits for Q-087) |
| Sign-up, reset and sign-in with a registered and an unregistered address, through the app and directly against Supabase Auth: same app text, no revealing Supabase response (Confirm email and Confirm phone both on). The timing part is limited by the built-in sender (team addresses only, 2 emails an hour) and is repeated with Resend in the Release slice (D-20) | ADR-0004 step 2 |
| Account setup is refused while the email is unverified | ADR-0004 step 3, Q-080 |
| SQLCipher is active in the development build (the start-up check passes) | ADR-0007 step 6 |
| An expired token is refused by the API | ADR-0004 step 3 |
| Airplane mode: log a weight, restart the app, reconnect; it reaches the server once | ADR-0007 step 1 (weight part) |
| A rejected own change stays on the phone until fixed or discarded | ADR-0007 step 4 |
| Phone set to another country's time zone: the entry still gets the IST day chosen | ADR-0007 step 5 |
| The phone's database file is unreadable without the key | ADR-0007 step 6 |

Not in the Skeleton: barcode, audio, photos, AI, food data, account deletion (ADR-0001 steps
2–3, ADR-0002 step 5, ADR-0004 steps 1 and 7, ADR-0005, ADR-0006). Each runs in the MVP slice
that builds the feature.

Post-MVP (D-20): the push check (ADR-0001 step 7, backlog B-23), the iOS compile check
(ADR-0001 step 5, B-24), invitations, the push token removed at log out, the link cases and
coach-phone removals (ADR-0002 step 4, ADR-0004 steps 4–6, ADR-0007 steps 2–3; B-18 to B-22).

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

| Check | On the PC | GitHub Actions (pushes to `main` and every pull request) |
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
Approved with the [Skeleton plan](../plans/skeleton-slice.md) on 2026-10-28. The levels and rules
above do not depend on the tools.

| Use | Tool | Where |
|---|---|---|
| Unit, integration, authorization and database tests | Vitest | `packages/shared`, `apps/api` |
| API requests in tests | Fastify's in-process request helper (`inject`); no network | `apps/api` |
| App unit and component tests | Jest with the `jest-expo` preset, and React Native Testing Library | `apps/mobile`, from Skeleton step 2 |
| The phone database in app tests | Node's built-in `node:sqlite`, in memory, behind the expo-sqlite methods the app uses, so the app's SQL runs unchanged; Supabase and the API are fakes | `apps/mobile/src/testing/`, from Skeleton step 8 |
| Lint and types | ESLint with typescript-eslint; for the app also `eslint-plugin-react-hooks` and `eslint-plugin-expo`. TypeScript `~6.0` in strict mode, the version Expo SDK 58 uses | Whole repository |
| Test database | PostgreSQL 17: installed natively on the PC (D-18 answer 14); a service container in CI | `TEST_DATABASE_URL` |
| Device checks | An EAS development build (`development` profile) on the owner's phone; live code through Expo's tunnel; the API through a Cloudflare Quick Tunnel, only while testing (D-19 answer 6), started with Expo by `npm run dev:phone` (D-22 answer 5); `adb` only for checks marked "USB + adb" (D-19) | `apps/mobile/eas.json`, `apps/api/scripts/dev-phone.ts` |
| `dev:phone` helpers: reading the tunnel's address, rewriting `apps/mobile/.env`, the health wait | Vitest; sample addresses are built at run time, so CI's check for committed tunnel addresses stays clean | `apps/api/scripts/` |
| CI | GitHub Actions: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | — |

How to run each check: [runbook](../operations/runbook.md#7-install-the-code-and-run-the-checks).
