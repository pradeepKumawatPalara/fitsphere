# ADR-0007: Offline storage and sync

- Status: **Accepted** by the project owner on 2026-10-27 under the D-18 pre-approval. The check
  against the requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to ADR-0003
  found only small inconsistencies, which the existing decisions already settled. They were
  fixed in the same change, before acceptance.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-NFR-004, REQ-NFR-006, REQ-ROLE-013, REQ-DATE-*, REQ-LOG-*, REQ-MEAS-*, REQ-TRN-*
- Related decisions: D-04 (offline + named warnings), D-10 (re-authorize at sync), D-13 (delete trainee data on link end), D-14 (server is the record; encryption invisible; 30-day clear of drafts and others' data only; own unsynced entries never cleared), D-15 (3-day draft reminder), D-16 (media cache rules), D-18 (MVP; coach view); threats T-02, T-03, T-06
- Builds on: ADR-0001 (Expo), ADR-0002 (Node API), ADR-0003 (PostgreSQL — revisit condition depends on this ADR)

## Context
Users must log weight, steps, sleep, measurements, workouts and meals without internet;
the app syncs later. The server re-checks permission for every queued change. Data on the
phone is encrypted without the user noticing. Phone storage holds a **copy**; the server
is the permanent record.

## Options considered
- **A — Own simple sync:** local SQLite database on the phone (Expo SQLite) + an
  "outbox" of changes. Each change gets an ID created on the phone. When online, the app
  sends the outbox to one Node API sync endpoint; the API re-authorizes and applies each
  change once (the ID prevents duplicates) and replies accepted/rejected. The app then
  pulls changes since its last sync point, plus a list of things to remove (ended links,
  deleted photos).
- **B — A sync product (e.g. PowerSync, a Supabase partner):** ready-made sync between
  PostgreSQL and phone SQLite. Adds a service and its pricing/limits (not checked here) and
  its own permission model alongside ours.
- **C — Another local-database library with custom sync (e.g. WatermelonDB):** similar
  work to A with an extra library to learn.

## Decision
**A — own simple sync**, with the rules under "Recommended option". Accepted by the project
owner on 2026-10-27 under the D-18 pre-approval. For the MVP it answers Q-075 (rule 2) and
Q-077 (rule 6). It is a workable offline-sync approach with PostgreSQL, so the revisit
condition shared by ADR-0002 and ADR-0003 is not triggered; the validation steps confirm this.

Accepted while one point was still open: the encryption method on the phone, verified in the
first slice with a fallback defined (rule 5).

## Recommended option
**A — own simple sync**, because MVP data is small and mostly "add an entry", and all
FitSphere rules (re-authorize, removals on link end, 30-day clear, encryption) stay in our
own tested code.

Rules:
1. **What is stored on the phone:** the user's own data for the last 90 days, their current
   plans and targets, and the food list (ADR-0006). On a coach's or Head Coach's phone: for
   each trainee they may see (permission matrix; a Head Coach only for trainees who allow
   it — REQ-ROLE-013), current plans and targets and the last 30 days of the data in the
   coach view (D-18, Q-059). Older history is loaded from the server when viewed online
   ("needs internet" message offline). The full history stays on the server and can be
   viewed on any phone, including a new one after sign-in (D-14). Only entries already
   synced age out of the phone.
2. **Conflicts:** the user's own entries — one value per day for weight, steps, sleep and
   measurements, a new entry replacing the old (Q-030 default); otherwise last write wins.
   Plans and targets edited by Coach and Head Coach — the change the server receives last
   wins, and the label shows its author and time (D-13; answers Q-075 for the MVP — finer
   handling is post-MVP). Rejected changes:
   - a change to someone else's data that the server refuses (e.g. the link ended) is
     shown to the user and removed from the outbox;
   - a rejected change to the user's own data is shown for the user to fix or discard,
     and is never removed automatically (D-14).
3. **Removals:** each sync returns a removal list: data of trainees whose link ended or
   whose Head Coach permission was withdrawn (REQ-ROLE-013), deleted photos (REQ-LOG-006),
   external links now hidden (REQ-LOG-010) and data of deleted accounts (Q-048 default).
   The phone deletes those records and cached photos (D-13, D-16).
4. **30-day clear:** if the app has not synced for 30 days, it clears unfinished drafts
   (after the 3-day reminder) and other people's data; never the user's own unsynced
   entries, including photos not yet uploaded (D-14, D-15; ADR-0002 rule 7). The check runs
   when the app starts or returns to the foreground, before any data is shown (MVP default).
   A phone whose app is never opened keeps its encrypted copy (residual risk, T-06).
5. **Encryption:** the local database and cached photos are encrypted with a key kept in
   the phone's secure storage — no password for the user. Verify whether Expo SQLite's
   encryption option works in the first slice; fallback: encrypt sensitive fields with
   that key. If encryption would break a feature, raise it to the owner (D-14).
6. **Needs-internet steps** show a named warning (D-04). For the MVP this refines the D-04
   split (answers Q-077):
   - **Needs internet:** sign-up and first sign-in; password change and reset; account
     deletion; AI reading; food search beyond the cached list; barcode lookup; invitations,
     accept/decline, remove and leave; Head Coach permission answers; plan and target edits
     by coaches and Head Coaches; history older than the phone holds; viewing a photo not
     yet cached.
   - **Works offline, synced later:** weight, steps, sleep, measurements, workouts, meals
     from the cached food list, Saved or the diet plan ("Log this option"), typed or spoken
     meal text kept as a draft for AI reading, and photos waiting to upload.
7. **Dates and units on the phone:** an entry made offline stores the IST day the user chose
   and a UTC timestamp (invariant #5); the phone works out "today" in Asia/Kolkata, not in its
   own time zone. Values are stored in canonical units (invariant #6).

## Why alternatives were rejected
B adds a vendor and a second permission system for an MVP that doesn't need it.
C adds a library without removing the custom sync work.

## Counterfactual
If real-time collaboration or large offline datasets become needed, B becomes attractive.

## Validation plan (first slices)
1. Airplane mode: log weight and a meal, restart the app, reconnect → both appear on the
   server once (no duplicates).
2. Remove a coach link while the coach's phone is offline → on reconnect, the trainee's data
   and cached photos are removed from that phone, and a change for that trainee sent to the
   sync endpoint is rejected (T-02). (Coaches' plan edits need internet, rule 6, so this
   tests the server check directly.)
3. A trainee withdraws Head Coach permission → the Head Coach's phone removes that trainee's
   data on its next sync.
4. A change to the user's own data that the server rejects stays on the phone until the user
   fixes or discards it.
5. With the phone set to another country's time zone, an entry still gets the IST day the
   user chose.
6. Inspect the phone's database file: unreadable without the key.

*D-20 (2026-10-28):* the MVP has no Coach or Head Coach, so steps 2 and 3 run post-MVP with
links (backlog B-19, B-20). The decision is unchanged.

Record each result, with its date, under "Validation results". A failed step that the rules
above cannot fix triggers the revisit conditions; changing the decision needs a new ADR that
supersedes this one.

## Validation results
Automated tests in Skeleton steps 5 to 10, run on 2026-10-28 on the PC (PostgreSQL 17, synthetic data); CI runs them on every pull request. Device and Supabase checks are recorded here once the owner has run them.
- **Step 1, server and phone logic — passed in automated tests:** a change sent twice is applied
  once and gets the same reply; a sync that fails or has no connection keeps the outbox and
  sends it again (`sync.test.ts`, `apps/mobile/src/sync/syncClient.test.ts`).
- **Step 1, weight on the phone — partly passed on 2026-10-29** (Skeleton step 10's phone check
  3; OnePlus Nord CE4, step 10's development build, API through a Quick Tunnel; owner's report).
  A weight saved earlier was still shown after the app was reopened. With airplane mode on and
  Wi-Fi off, saved weights were still shown, and a second weight was saved and shown on the
  phone. After reconnecting, the sync status showed synced. **Pending, deferred to before the
  release by D-22** (backlog SC-06; accepted risk R-006): force-stop and reopen while offline
  (USB + adb), then log out and sign in to confirm that the server holds exactly one value for
  the day. Until then, the offline entry is not confirmed on the server.
- **Step 4, logic — passed in automated tests:** a rejected change stays, with its code, until a
  new value for the day replaces it or the user discards it, and is never pruned
  (`store.test.ts`, `home.test.tsx`). Phone check 4 of step 10: pending, deferred to before the
  release by D-22 (backlog SC-03).
- **Step 5, logic — passed in automated tests:** the IST day comes from the UTC clock (shared
  date tests under `Asia/Kolkata` and `America/Los_Angeles`; the API accepts a day that is
  already "today" at 00:10 IST). Phone check 5 of step 10: dropped for the MVP, which serves
  India only (D-22, D-09); post-MVP, backlog B-25.
- **Step 6:** the app stops when SQLCipher is missing and never sets a key on a plain database
  (`database.test.ts`). The start-up check and the unreadable file are step 8's phone checks:
  pending, deferred to before the release by D-22 (backlog SC-08 and SC-07).
- **Step 1, extended to steps, sleep, measurements and targets — passed in automated tests on
  2026-10-29** (Home and daily tracking slice, steps 2 and 3, D-23; PC with PostgreSQL 17,
  synthetic data):
  - each change type is applied once by its `changeId`;
  - the pull pages across the five kinds with one cursor;
  - the 90-day window applies to day data, never to targets;
  - on the phone, the outbox life cycle, pruning and the rule that a waiting change holds back
    only its own kind and key (`daily-tracking.test.ts`, `dailyStore.test.ts`,
    `syncClient.test.ts`);
  - local schema version 2 keeps a version 1 database's data and clears its cursor.

  **Pending, in the slice's batched phone checks:** offline steps, sleep, measurements and a
  target sync after reconnecting, and come back after log out and sign in (plan check 6).
- **Step 4, extended — passed in automated tests on 2026-10-29:** rejected steps, sleep,
  measurements and targets stay until fixed or discarded, each with its own text
  (`tiles.test.tsx`, `measurements.test.tsx`, `dailyStore.test.ts`).
- **Steps 1 and 4, extended to workouts — passed in automated tests on 2026-10-29** (Training
  slice, D-29; PC with PostgreSQL 17, synthetic data):
  - entries keyed by an ID made on the phone, several a day; `workout.set` applied once by its
    `changeId`, replacing the whole workout;
  - deletions as `workout.delete`, kept on the server as an empty row and pulled as deleted, so the
    phone removes its copy, except while a change for it is waiting;
  - the 90-day window and paging across kinds; self-access with the same workout ID and
    `changeId`;
  - on the phone, the outbox life cycle, pruning, a rejected save or deletion kept until discarded,
    and local schema version 6 keeping the earlier data and clearing the cursor
    (`workouts.test.ts`, `workoutStore.test.ts`, `syncClient.test.ts`, `workout.test.tsx`,
    `training.test.tsx`).

  **Pending, in the slice's batched phone checks:** a workout started and logged offline syncs
  after reconnecting, and comes back after log out and sign in (plan check 6).

## Revisit conditions
Sync bugs grow costly to maintain; real-time features required; device storage problems.

## Open questions and handling
| Question | Handling |
|---|---|
| Q-055 offline | Answered (D-04) — implemented by this ADR |
| Q-077 offline split | Answered for the MVP (D-18): rule 6 |
| Q-075 simultaneous edits | MVP default (D-18): the change the server receives last wins (rule 2); finer handling is post-MVP |
| Q-030 two entries on one day | Answered for the MVP (D-18): the new entry replaces the old (rule 2) |
| T-06 30-day clear when the app is not opened | Runs on app start or return to the foreground (rule 4); residual risk stays in T-06 |
| Device encryption method | Verified in first slice; fallback defined |

## References
- Project: owner-decisions D-04, D-10, D-13…D-16, D-18; mvp-scope.md
