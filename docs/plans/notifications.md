# Plan: notifications on the phone (local reminders, goal and nudge alerts, an in-app bell)

- Status: **Built, steps 1 to 4 (2026-11-24), waiting for the owner's approval and answers to the open questions below.** Nothing is merged; the real notification module has not run on a phone yet (tests use a fake phone).
- Owner: Project owner (D-01)
- Requirements: REQ-NOT-001 to REQ-NOT-007 (new, proposed below; to be added to `docs/product/requirements.md` on approval), REQ-ACC-011 and Settings (REQ-ACC-001 to REQ-ACC-003 for where the switches live), REQ-NFR-004 (offline), REQ-ROLE-016 (the server Notifications list: post-MVP, not built here)
- Decision: D-122 (to be recorded on approval; next free number, confirm); ADR-0014 (Proposed)
- Invariants touched: #4 (non-AI logging always works: reminders never block logging), #5 (Asia/Kolkata), #6 (units: no weights in notification text), #7 (sensitive data out of logs and fixtures)
- Branch: `fitsphere-notification`
- Scope: the **client app only** (Personal Training User, D-20). No Coach, no Head Coach, no messaging, no server-sent push. Brings a *phone-only* slice of the Notifications list and of push into the MVP, which `mvp-scope.md` lists as post-MVP: that needs the owner's word (Q-A).

## Which notification points are in this plan
Numbers are the rows of the competitor table the owner shared.

| Row | Notification | Plan |
|---|---|---|
| 4 | Scheduled workout reminder | **Slice 1.** The user's own days and time (there is no training plan to schedule from). |
| 5 | Meal and food-logging reminders | **Slice 1.** Per meal (breakfast, lunch, dinner, snack), skipped once that meal has food. |
| 8 | Goal progress, goal completed | **Slice 1, "completed" only:** a daily nutrition target reached; the weekly workouts target reached. No "progress" pings, no adjustment suggestions. |
| 24 | Inactive for X days (client side) | **Slice 1.** X chosen by the user, 2 to 7 days, default 3. |
| (D-85) | Measurements due | **Slice 1.** Same rule as Home's "Due" badge (more than 7 days). |
| 17 | Channels: in-app bell and push | **Slice 1.** Bell and *local* (on-device) notifications. Remote push stays post-MVP (ADR-0004). Email stays for the release (Resend). |
| 18 | On/off per type | **Slice 1.** |
| 19 | Send a test notification | **Slice 1.** |
| 20 | Mark read or unread (one or all), filter by category | **Slice 1.** |
| 21 | Tap opens the item | **Slice 1.** Opens the right tab or screen. "Reply" does not apply. |
| 7 | Hourly "move" reminders, activity tips | **Later.** Easy to add on the same scheduler; held back because hourly alerts annoy and need quiet hours first. |
| 16 | Periodic stats summary | **Later.** First as a card in the bell list, email once Resend exists. |
| 1, 2, 3, 6, 9 to 15, 22, 23 | Messaging, plans from a coach, coach-side alerts, community | **Not possible:** they need messaging, a coach, or communities, none of which exist (D-20). The list's `source` field leaves room for them. |

## What the user sees
1. **A bell** in the header beside the existing controls, with a count of unread. It opens **Notifications**: a list, newest first, grouped by day; unread in bold with a dot.
2. **Notifications screen:** filter chips **All, Reminders, Goals, Nudges**; tap a row to mark it read and open what it is about; a row's menu has Mark as unread; **Mark all as read** at the top. Rows older than 90 days are removed (the phone keeps 90 days, ADR-0007 rule 1).
3. **Settings › Notifications** (new row under Settings):
   - Master switch **Notifications**. Turning it on the first time asks the phone's permission (Android 13 and later, iPhone), in context, never at launch. If the phone refuses, the screen says so and offers "Open phone settings"; the bell list still works.
   - **Reminders:** Workout reminder (days of the week, time); Meal reminders (one switch and time for each meal); Measurements due.
   - **Goals:** Daily target reached; Weekly workouts target reached.
   - **Nudges:** Inactivity (switch, and after how many days).
   - **Send a test notification.**
   - Each type has its own switch, **off until the user turns it on**, apart from the phone's own setting.
4. **Text rules (lock-screen safe):** short, no numbers from the user's body or food, no weights, no names. Examples (wording for the owner to approve, Q-F): "Time to log lunch.", "Workout time. Open FitSphere to start.", "You reached today's protein target.", "It's been 3 days. Log something small today?", "Measurements are due."
5. A reminder is **not fired** when it would be pointless: the meal already has food, today's workout already exists, the target is already reached. A user can always keep logging with no notification at all (invariant #4).
6. Quiet hours (default 22:00 to 07:00) and **at most 4 notifications a day** apply to every type except the test (Q-C).

## How it works (see ADR-0014)
- **Local only.** The phone schedules notifications with `expo-notifications` and the operating system fires them. No server, no device token, no change to the API (the phone and Cloud Run API are untouched).
- **Rolling schedule.** The phone keeps the next 7 days of one-time notifications (at most 40 pending, under iOS's limit of 64) and rebuilds them when the app opens or comes to the foreground, and whenever a setting or a relevant log changes (a meal logged cancels that meal's reminder for today; an inactivity alert is moved to "X days from now" at every open).
- **Time zone.** Times are Asia/Kolkata wall clock, computed to absolute instants (+05:30, no daylight saving), never the phone's zone (invariant #5).
- **The list is the record.** The operating system can fire a notification while the app is closed, and the app only learns of it later. So the bell list is filled when the app opens or resumes: every scheduled item whose time has passed, and that was not made pointless, becomes a row. Goal rows are made when the app sees the target reached (after a log, or on open). Nothing is lost if push is off or refused.
- **Stored on this phone only.** New SQLite tables, not synced (like `workout_pill_corner`); cleared on sign-out, deleted with the account on this phone. They hold no health values, only the kind, the text, the screen to open, and times.

## Phone data (phone schema version bump, next free number at build)
- `notifications`: `id`, `kind`, `category` (reminder, goal, nudge), `title`, `body`, `route` (a screen and its date, no values), `source` (`local` now), `created_at`, `read_at`, `dedupe_key` (one row per kind and day).
- `notification_settings`: one row per `kind`: `enabled`, `time`, `days`, `threshold_days`; plus the master switch and quiet hours in `sync_meta`.
- No migration on the server. No change to `app.users` or the Cloud Run deploy.

## Native, builds and releases
- `expo-notifications` is a native module: **a new EAS development build is needed, and a new APK for the beta**. **Tell the owner before building (D-19).** Steps 1 and 2 are JavaScript only and run on the current development build; the scheduler needs the new build to fire real notifications.
- Android: a notification channel per category; `POST_NOTIFICATIONS` permission (Android 13+); inexact alarms are enough, so no exact-alarm permission. Battery savers on some phones can delay a notification: documented in the runbook.
- iPhone: the permission prompt and the 64-pending limit; **no iOS build without the owner's word (D-19, D-104).**

## Steps (one branch `fitsphere-notification`; one commit or pull request per step as the owner prefers)
1. **Foundation, no native code.** Phone tables, the notification store, the bell and Notifications screen (read, unread, all, filter, tap to open), Settings › Notifications with switches and times. A developer-only "add a sample" to see the list. Tests.
2. **Scheduler and permission.** Add `expo-notifications` (and its `app.json` plugin and channels); the rolling schedule, permission flow, "Send a test notification". **New build, announced first.**
3. **Reminders.** Workout, meals (with skip rules), measurements due. Tests for the schedule with a fake clock.
4. **Goals and nudges.** Daily target reached, weekly workouts target reached, inactivity. Quiet hours and the daily cap.
5. **Close-out.** Docs (requirements, mvp-scope amendment, runbook, risks, backlog for the "later" rows), the phone checks below.

## Requirements proposed
- REQ-NOT-001 The bell and Notifications list: read and unread, mark all, filter by category, tap to open.
- REQ-NOT-002 Reminders: workout days and time, meals, measurements due; each skipped when pointless.
- REQ-NOT-003 Goal alerts: a daily nutrition target reached; the weekly workouts target reached.
- REQ-NOT-004 Inactivity nudge after X days.
- REQ-NOT-005 Per-type switches, times, quiet hours, a daily cap, and a test notification, apart from the phone's own settings.
- REQ-NOT-006 Notification text carries no health values; the phone's permission is asked in context.
- REQ-NOT-007 Notifications work offline and never depend on AI or on a server.

## Tests
- Store and list: add, dedupe by key and day, mark read and unread, mark all, filter, 90-day removal, cleared on sign-out.
- Schedule (fake clock, never a real notification): Asia/Kolkata times from a phone in another zone; the 7-day window; the cap of 40; a logged meal removes today's reminder; inactivity moves forward on open; quiet hours push or drop; the daily cap of 4.
- Triggers: target reached once per day; weekly target once per week; measurements due matches Home's rule.
- Settings screen: master switch asks permission once; refused shows "Open phone settings" and keeps the bell; each switch saves; test notification.
- Text: no body, name or number appears in any notification text (snapshot of every template).
- Navigation: a tap opens the right screen and date.
- Authorization: nothing here reads another user's data (the data never leaves the phone).
- Phone checks (on the new build, backlog IDs to be assigned): a reminder fires at its time with the app closed, after a restart, with the phone in battery saver, with permission refused, after sign-out (none fire).

## Risks
- Battery savers delay or drop local notifications on some Android phones; a reminder may be late. Accepted for the MVP; documented.
- Lock-screen text can be seen by others; kept free of health values (REQ-NOT-006).
- The list is filled when the app opens, not at the moment the notification fires.
- Legal's review (Q-049) should include the notification texts and "inactive for X days".

## Open questions
- **Q-A (needs the owner):** Bring a phone-only Notifications list and local push into the MVP, amending `mvp-scope.md`? (D-20 and D-18 list "Notifications list" and "push" as post-MVP; this plan treats them as the *server* kinds and builds only the local one.)
- **Q-B:** All types off until the user turns them on (proposed), or on with default times (breakfast 08:30, lunch 13:00, dinner 20:00, workout 18:00)?
- **Q-C:** Quiet hours 22:00 to 07:00 and a cap of 4 a day: right?
- **Q-D:** Lock-screen text with no health values (proposed): agree?
- **Q-E:** The workout reminder is the user's own days and time (there is no training plan): agree?
- **Q-F:** Wording of every notification.
- **Q-G:** Android first, iPhone with the iOS release?
- **Q-H:** Keep 90 days in the list, as the phone keeps its data?
- **Q-I:** Which daily targets count for "Daily target reached": calories, protein, carbs, fat, fibre, steps? (Proposed: calories and protein only, to avoid several alerts a day.)

## As built (steps 1 to 4, 2026-11-24)
Where the build differs from the text above. The owner confirms or changes each.
- **Choices in one JSON text, not a `notification_settings` table:** every reminder, goal, nudge setting is in `sync_meta` (`notification_settings`); the master switch in `notifications_enabled`; the day the app was last opened in `last_open_day`. Only the `notifications` table is new (migration 25, phone schema version 25). Simpler and needs no schema change to add a setting.
- **Design D:** each card has an action button and an X (dismiss). "Mark as unread" (the plan's row menu) is not built.
- **Daily target reached means the protein target** (Q-I: calories is a ceiling, not a goal). Text: "You reached today's target."
- **The nudge counts opening the app as activity** and moves to "X days from the last open" at every open; it is listed when it came due while the app was closed.
- **Quiet hours (10:00 pm to 7:00 am) and the cap of 4 a day are fixed** (the proposal, Q-C); the settings screen says so and has no control for them. They apply to the schedule, the list and a goal shown now; not to the test.
- **Goal alerts only while the app is open:** nothing can be scheduled for a goal not yet reached, so one logged on the phone shows then; the phone cannot tell while the app is closed.
- **The list is filled when the app opens** for a reminder that fired while it was closed (a reminder not yet due is not in the list).
- **Signing out clears the schedule** (a signed-out phone fires nothing of the last user's).
- **Android:** the permission `POST_NOTIFICATIONS`, three channels (Reminders, Goals, Nudges), inexact times; the plugin `expo-notifications` in `app.json`. **A new development build is needed; the owner is told before any build (D-19).** No iOS build without the owner's word.

## Phone checks (backlog N-01 to N-10), on the new build, before the release
Not run: they need a build that has `expo-notifications`. Deferred, not passed (risk R-006's rule).
- N-01 Turn notifications on in Settings › Notifications: the phone asks its permission once, then "Notifications are on".
- N-02 Refuse the permission: the card says so and offers Open phone settings; the bell list still works.
- N-03 "Send a test notification": it arrives in a few seconds; a tap opens the list.
- N-04 Switch lunch on two minutes ahead: with the app closed, it arrives at that time (India's clock), and a tap opens Log meal on lunch.
- N-05 Log lunch first: no lunch reminder arrives that day.
- N-06 Restart the phone: tomorrow's reminders still arrive.
- N-07 Battery saver on: note whether a reminder is late (accepted risk R-020).
- N-08 Reach today's protein target with Daily target on: a notification shows at once, and one row in the list.
- N-09 Set a reminder at 11:00 pm: none arrives.
- N-10 Sign out: nothing arrives afterwards.
