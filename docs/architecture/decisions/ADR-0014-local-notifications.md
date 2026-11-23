# ADR-0014: Notifications on the phone are local (scheduled on the device) with an in-app list, not server push

- Status: **Proposed** (drafted 2026-11-23; waiting for the owner, D-122 to be recorded on approval)
- Date: 2026-11-23
- Decision owner: Project owner
- Related requirements: REQ-NOT-001 to REQ-NOT-007 (proposed in `docs/plans/notifications.md`), REQ-NFR-004, REQ-ROLE-016
- Related constraints: C-004 (no AI needed), C-005, C-006 (India time), C-008 (cost); invariants #4, #5, #6, #7
- Supersedes: None. **Extends** ADR-0004 (rule 6, "Push notifications: Expo's push service"), which stays the choice for *server-sent* push and the server Notifications list, both still post-MVP (D-18, D-20). Amends `docs/product/mvp-scope.md` to bring a phone-only list and local reminders into the MVP, only once approved.

## Context
The owner wants notifications in the client app. The app is the Personal Training User view only (D-20): there is no
messaging, no Coach, no Head Coach, no community, and the Notifications list and push are listed as post-MVP because
they exist for invitations, links and permission requests (REQ-ROLE-016).

What the client app can notify about by itself is what only the phone knows: the time (workout, meals), the user's own
logs (a meal already logged, days without a log, measurements due) and the user's own targets (a target reached).
Nothing needs another person or a server to trigger it. The phone already keeps 90 days of data in SQLite and works
offline (ADR-0007), the API runs on Cloud Run for the beta (D-101), and the owner pays per build (EAS free plan, D-19).

Known: Expo's `expo-notifications` schedules local notifications and shows the phone's permission prompt; it is a native
module (a new development build). Android 13 and later and iPhone ask permission; iOS keeps at most 64 pending local
notifications. Unknown: how reliably each Android maker's battery saver delivers a scheduled notification (checked on
the owner's phone before release).

## Decision criteria
1. Works offline, with no server and no AI (C-005, invariant #4).
2. No new health data leaves the phone; notification text safe on a lock screen (invariant #7).
3. Day and time rules use Asia/Kolkata (invariant #5).
4. Small, reviewable, no new paid service or always-on server (C-008).
5. A path to server push and coach notifications later without rework (D-20).
6. Respects the user: per-type switches, permission asked in context, quiet hours, a daily cap.

## Options considered
### Option A — Local notifications plus an in-app list on the phone
- Benefits: no server, token, scheduler or cost; works offline; data stays on the phone; all of the client's possible
  rows (workout and meal reminders, goals, inactivity, measurements due) are possible; one new native module.
- Costs and risks: the phone fires a notification with the app closed, so the list is filled when the app next opens;
  battery savers may delay a notification; the 64-pending limit on iPhone forces a rolling window; cannot react to events
  on a server or another user.
- Fit against constraints: meets 1 to 4 and 6; 5 by a `source` field on the list.
- Evidence and uncertainty: documented behaviour of `expo-notifications`; Android delivery on real phones is a phone check.

### Option B — Server-sent push now (Expo push service, ADR-0004)
- Benefits: reaches the phone even when the app was not opened; same path coach and messaging need later; the list can
  live on the server.
- Costs and risks: a device-token table with a migration, token cleanup on logout, a scheduler (Cloud Run scales to zero,
  so Cloud Scheduler or similar, a new paid service), health-adjacent timing data on the server and in Expo and Google
  (FCM), Legal's review (Q-049), the server's time-zone logic, and the beta's API must be deployed first. All of it for
  rows that only need the phone's clock.
- Fit against constraints: fails 1 and 4, strains 2; meets 5.
- Evidence and uncertainty: ADR-0004's validation step for push was deferred post-MVP.

### Option C — In-app bell only, no operating-system notifications
- Benefits: JavaScript only, no new build, no permission.
- Costs and risks: nothing reaches a user who has not opened the app, which is the whole point of a reminder.
- Fit against constraints: meets 1 to 4; fails the user's need.

### Option D — Local now, remote push ready (A with a prepared seam)
- Same as A, with the list's rows carrying `source` (`local` now; `server` later) and the Notifications screen reading
  one list, so Coach-era server notifications join it later. Nothing server-side is built.
- Costs: one extra column; a little care in naming.

## Decision
**Pending approval.** Recommended: **Option D**, that is Option A with the `source` field.

If approved:
1. Reminders and alerts are **scheduled on the phone** with `expo-notifications`. No new endpoint, migration, token or
   Cloud Run change.
2. A **rolling window**: the next 7 days of one-time notifications, at most 40 pending, rebuilt when the app opens or
   resumes and when a setting or a relevant log changes. No repeating triggers (so a logged meal can cancel today's reminder).
3. Times are **Asia/Kolkata** wall clock turned into absolute instants (+05:30, no daylight saving).
4. The **in-app list** (SQLite on the phone, not synced, cleared on sign-out, 90 days) is the record. It is filled when
   the app opens or resumes from the schedule (items whose time has passed and were not made pointless) and from goal checks.
5. **Text carries no health values**: no weights, calories, counts or names, only the kind of event.
6. **Permission asked in context**, when the user first turns Notifications on; a refusal leaves the bell list working.
7. **Per-type switches, all off until the user turns them on**; quiet hours (default 22:00 to 07:00) and at most 4 a day
   (both pending the owner's answers, plan Q-B and Q-C).
8. ADR-0004's server push, invitations and the server Notifications list are unchanged and stay post-MVP.

## Why this option wins
Every row the client app can send depends on the phone's clock, logs or targets, so a server adds cost, privacy surface
and a deploy for no gain. It keeps the invariants (offline, India time, no health values off the phone), uses the
approved offline stack (ADR-0007), and leaves a clear way to add server notifications later through `source`.

## Why alternatives were rejected
- **B** adds tokens, a scheduler, Expo and Google in the path, a migration and Legal's review, all for reminders the phone
  can fire alone. It is the right path for coach and messaging notifications, so it is deferred, not rejected.
- **C** cannot remind anyone who has not opened the app.

## Counterfactual
Option B becomes better when a notification must come from another person or a server event (a coach's message, a plan
assigned, a link request: REQ-ROLE-016), or when reminders must work on a phone where local scheduling proves unreliable.

## Consequences and accepted trade-offs
- Easier: reminders with no backend; the whole feature ships on the phone.
- Harder: a **new development build and APK** (D-19) and an iOS build later; a rolling window to maintain; tests with a fake clock.
- Accepted: late or missing notifications under some battery savers; the list can lag until the app opens; text is generic
  by design, so it says less than a user might expect.
- A user on two phones sees each phone's own settings and list.
- When the Coach view arrives, server notifications are added through `source` and the same screen.

## Validation plan
1. Step 2 of the plan: schedule a test notification on the owner's phone, app closed, after a restart and with the
   battery saver on (Android; iPhone with the iOS release).
2. Fake-clock tests for the Asia/Kolkata times, the 7-day window, the 40 cap, quiet hours, the daily cap and the skip rules.
3. A test that every notification template contains no number or name.
4. Phone checks for permission refused, sign-out (no notification fires afterwards) and a tap opening the right screen.

## Revisit conditions
- Coach, messaging or any notification from another user is built: add server push under ADR-0004.
- More than a few percent of scheduled notifications are late or lost on the owner's and testers' phones.
- Users ask for alerts when the app has not been opened for days beyond what the rolling window covers.
- The iPhone limit of 64 pending becomes a constraint.

## Open questions and handling
Plan Q-A to Q-I (`docs/plans/notifications.md`). Q-A, scope against `mvp-scope.md`, blocks building; the others have the
proposed defaults above (D-18).

## References
- `docs/plans/notifications.md`; `docs/ADR-0004`: `docs/architecture/decisions/ADR-0004-accounts-auth-and-notifications.md`
- ADR-0007 (offline storage and sync); `docs/product/mvp-scope.md`; REQ-ROLE-016
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
