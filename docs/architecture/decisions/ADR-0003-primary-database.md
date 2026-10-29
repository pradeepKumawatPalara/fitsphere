# ADR-0003: Primary database

- Status: **Accepted** by the project owner on 2026-10-27 (D-17), together with ADR-0002. The
  owner's D-16 confirmations (the scope of the retention rule, users deleting their own photos)
  were applied in the same change, before acceptance.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-ROLE-* (links, permissions, switching), REQ-PLAN-*, REQ-LOG-*, REQ-PRG-* (weekly aggregates), REQ-NFR-001, REQ-NFR-002, REQ-NFR-003, REQ-NFR-004, REQ-NFR-005, REQ-NFR-006
- Related constraints/decisions: C-003, C-006, C-008; D-07 (unassign, never delete), D-09 (India, IST), D-10/D-11 (links, consent, switching), D-13 (author of each change), D-14 (server is the permanent record), D-15 (20M aspiration), D-16 (Free plan, media), D-17 (accepted); R-005
- Related ADRs: ADR-0002 (decided together); ADR-0004 (sign-in and authorization); ADR-0007 (device storage and sync) and ADR-0008 (media storage, audio/video release) build on it
- Supersedes: None

## Context
This decides where FitSphere's **permanent record** lives (D-14: "the server is the permanent
record"). The phone keeps a copy for offline use (ADR-0007), but the server database is the
source of truth. In phase 1 that database runs on a free plan without backups (D-16, accepted
risk R-005), which weakens the D-14 promise until backups are added.

The data is strongly **relational** — records point to each other and rules depend on
those connections:
- users ↔ roles; Coach ↔ trainee links and Head Coach ↔ Coach links, each with a start,
  end and status; one active coach per trainee and one Head Coach per coach (D-11);
- per-trainee Head Coach permission answers with timestamps (REQ-ROLE-013);
- plans, options and ingredients; targets with an author and time (D-13);
- daily entries (meals, weight, steps, sleep, measurements, workouts) per user per IST day;
- invitations with expiry; consent records; admin access log (REQ-NFR-005);
- references to media: meal photos now — a compressed copy and a thumbnail, or an external
  link (D-16). Voice recordings are not stored in phase 1; audio and video come in a future
  release.

Some operations must happen **all-or-nothing**: switching Head Coach ends the old link,
creates the new link and issues fresh permission requests together (D-11). Progress needs
weekly totals and averages (REQ-PRG-*).

## Decision criteria
1. **Must:** relationships and rules such as "one active coach per trainee" enforced by the
   database itself.
2. **Must:** all-or-nothing changes (transactions) across several records.
3. **Must:** efficient date-range totals and averages for Progress.
4. **Must:** managed hosting in Mumbai with a free tier usable for development and phase 1
   (D-16).
5. **Must:** growth path toward millions of users; data portable to other providers.
6. **Must:** data encrypted at rest and in transit (REQ-NFR-002).
7. **Should:** works with the hybrid backend in ADR-0002 and with an offline-sync approach
   (ADR-0007).
8. **Should:** backups available once the owner approves them (phase 1 runs without — R-005).

## Options considered

### Option A — PostgreSQL, managed by Supabase (Mumbai)
- Benefits: relational, with constraints, transactions and fast date-range queries; the most
  widely used open-source relational database — can be moved to any cloud's managed PostgreSQL
  later (portability); comes with ADR-0002's Supabase choice; Mumbai region; free tier; all
  customer data encrypted at rest (AES-256) and in transit (TLS) (Supabase security page);
  daily backups kept 7 days on Pro.
- Costs and risks: the Free plan has a 500 MB database, pauses after 1 week of inactivity and
  has no backups — phase 1 runs on it (D-16, R-005). Very large tables (meal entries for
  millions of users) need partitioning and indexing work later.
- Fit: meets 1–7; 8 only on Pro or with a separate backup.

### Option B — Firestore (Google, document database)
- Benefits: built-in offline sync in its SDK; automatic scaling.
- Costs and risks: no joins or database-enforced relationships — "one active coach per
  trainee", link switching and counts-only views must be enforced in code; aggregates (weekly
  averages) need extra bookkeeping; billed per document read, which grows with history screens
  (free Spark plan: 1 GiB stored; 50,000 reads, 20,000 writes and 20,000 deletes per day —
  Firebase docs); strong lock-in.
- Fit: meets 4 (partly); weak on 1, 2 (limited), 3, 5 (portability), 7; 6 not assessed.

### Option C — MongoDB Atlas (document database)
- Benefits: flexible documents; a free shared cluster for development; good tooling.
- Costs and risks: same relational-fit problems as B, though with better aggregation;
  multi-document transactions exist but relational integrity is not its strength.
- Fit: partial on 1, 2; meets 3; 5 partly; 6 not assessed.

## Decision
**Option A — PostgreSQL, managed by Supabase, in the Mumbai region, on the Free plan in phase 1
(D-16, R-005), reached only through the Node API (ADR-0002).** Accepted by the project owner on
2026-10-27 (D-17), together with ADR-0002.

Accepted while these were still open (D-17): Q-014, Q-030, Q-048 and Q-049, plus Q-064 and
Q-089, both partly answered. "Open questions and how each is handled" below says how each is
handled. The owner accepted risk R-005 (D-17). Whether PostgreSQL supports the offline sync in
REQ-NFR-004 is shown in ADR-0007; if not, this ADR is revisited. The validation steps run in the
first slice.

## Recommended option
**Option A — PostgreSQL, managed by Supabase, in the Mumbai region, on the Free plan in phase 1
(D-16, R-005).**

Design rules that follow (to be detailed in `docs/contracts/data-model.md`):
- **Only the Node API reaches the database** (ADR-0002). Supabase's auto-generated Data API is
  turned off, or exposes no app table; database policies stay as a second safety layer.
- Store timestamps in UTC, plus a separate **IST day** field chosen by the user
  (invariant #5, REQ-LOG-002).
- Store each measure in one canonical unit (invariant #6).
- Links are rows with status and start/end dates. Ending a link — by removal, leaving or
  switching — never deletes the row (D-07). Rows are deleted only as the delete-account flow
  decides (Q-048, blocked). A database rule allows only one active coach link per trainee and
  one active Head Coach link per coach (D-11).
- Head Coach permission answers are stored per link with timestamps, so a new Head Coach starts
  with fresh requests (D-11, REQ-ROLE-013).
- Every plan/target change records author and time (D-13).
- Large time-based tables (meal entries, weigh-ins) are designed so they can be partitioned by
  month later without changing the app.
- **Media files are never stored in the database.** One `media` record per file holds only:
  owner, the entry it belongs to, type (photo now; audio and video in a future release),
  storage location keys for the viewing copy and its thumbnail, size, duration (future audio
  and video), created time, status, and whether an original has been replaced by a
  viewing-quality copy. A user's own media is never fully deleted automatically while the
  account exists (D-16, Q-089). That rule covers automatic retention only: a user may delete
  their own meal photo or label image, and then the file, its thumbnail and its `media` record
  are really removed (D-16, REQ-LOG-006, A-004). The files live in object storage (ADR-0002, ADR-0008), so the
  database stays small and media can move to a cheaper provider by updating location keys only.
- A `media` record can instead hold an **external link** (e.g. YouTube) with the site's name
  (D-16, REQ-LOG-010). When a link between people ends, the API stops returning it to the former
  coach or Head Coach; the content itself stays reachable outside FitSphere (R-004).
- Database logging never records health data (invariant #7): statement logging that captures
  values stays off.

## Why this option wins
FitSphere's core is relationships and permissions between people. A relational database
enforces those rules itself, makes link switching safe with transactions, computes Progress
totals directly, and is standard enough to move anywhere as the app grows.

## Why alternatives were rejected
- **B (Firestore):** its offline sync is attractive, but the permission model and
  aggregates fit poorly, per-read pricing grows with history screens, and lock-in is high.
- **C (MongoDB):** flexible, but gives up the database-enforced relationships FitSphere
  relies on, with no offsetting advantage here.

## Counterfactual
A document database would win if most data were independent per-user documents with no
cross-user rules, or if offline sync could only be achieved with Firestore's SDK (to be
checked in ADR-0007).

## Growth path toward 20 million users (aspiration, D-15)
List prices from Supabase's pricing page, checked 2026-10-27. Stages match ADR-0002.
0. **Development and phase 1 (D-16):** Supabase Free — 500 MB database; no backups; pauses
   after 1 week of inactivity (R-005). $0. Owner-review trigger: database over 400 MB (with the
   other R-005 triggers in ADR-0002).
1. **First paid stage — when an R-005 trigger is hit and the owner approves (C-008):**
   Supabase Pro — 8 GB disk included, then $0.125/GB; daily backups kept 7 days. From
   $25/month. Alternatively, a separate backup while staying on Free.
2. **Growth:** larger compute; indexes tuned to real queries; a read replica for Progress and
   coach dashboards; monthly partitions for entry tables. Cost rises with compute size — owner
   review.
3. **Millions of users:** dedicated managed PostgreSQL (Supabase large plans or a cloud
   provider's Mumbai PostgreSQL); old raw entries archived — not deleted (D-14) — while weekly
   summaries stay at hand. **Not estimated:** a capacity and cost model is required before
   this stage; start it when monthly active users reach 250,000.
No step requires changing the app's data model or rewriting the API.

## Open questions and how each is handled
| ID | Question | Status | How this ADR handles it | Blocks acceptance? |
|---|---|---|---|---|
| Q-010 | Meaning of "delete" for a coach or trainee | Answered (D-07) | Ending a link never deletes data or the link row | No |
| Q-014 | Do target changes apply from a date or retroactively? | Open | A data-model detail: targets are stored with an effective date and author, which supports either answer | No |
| Q-018 | Time zone | Answered (D-09) | UTC timestamps plus a separate IST day field | No |
| Q-030 | Two measurements or weigh-ins on one date | Open | A data-model detail (a uniqueness rule or not); does not change the database choice | No |
| Q-048 | Delete-account flow | Open (REQ-ACC-009 blocked) | Rows, including links, are deleted only as this flow decides | No — blocks REQ-ACC-009 |
| Q-049 | DPDP obligations, data residency | Open (Legal) | All data in Mumbai; Legal confirms before real users (C-003) | No — blocks real users |
| Q-053 | Team, skills, budget | Answered (D-01, D-03, C-008) | Managed PostgreSQL; Free plan in phase 1 | No |
| Q-055 | Offline logging | Answered (D-04) | Server is the source of truth; whether PostgreSQL supports the sync design is shown in ADR-0007 (revisit condition) | No — accepted risk |
| Q-064 | Are meal photos kept? | Partly answered (D-16) | `media` record with viewing copy and thumbnail, or external link; a user may delete their own photo or label image, removing the file and its record. Whether label images are kept by default, and whether deleting a meal deletes its photo, stay data-model details | No |
| Q-072 | One coach / one Head Coach | Answered (D-11) | Enforced by a database rule | No |
| Q-088 | Backups before Pro | Answered (D-16) | Free plan without backups, R-005 triggers | No |
| Q-089 | Media retention | Partly answered (D-16) | Never fully deleted automatically while the account exists; the record notes when an original was replaced | No |

## Consequences and accepted trade-offs
- Easier: correct permissions, safe switching, Progress queries, moving providers.
- Harder: offline sync from a relational database needs a deliberate design (ADR-0007).
  Accepted risk: if ADR-0007 finds no workable approach, this ADR is revisited.
- Accepted (D-16, R-005): phase 1 runs on the Free plan with **no backups** — data lost on the
  server cannot be restored, which conflicts with D-14 ("the server is the permanent
  record"). The project pauses after 1 week of inactivity, making the app unavailable until the
  owner resumes it ([`runbook.md`](../../operations/runbook.md)). The 500 MB limit is watched
  through the 400 MB trigger.
- Accepted: dependence on Supabase for hosting the database; the data stays portable because it
  is standard PostgreSQL.

## Validation in the first slice (D-17)
In the first slice, with synthetic data only (invariant #7): create tables for users, links and
weigh-ins; prove with tests that
(a) a second active coach link for one trainee is rejected;
(b) switching is all-or-nothing;
(c) a weekly-average query on 10,000 synthetic entries returns quickly;
(d) ending a link leaves the link row in place;
(e) with the Data API off, no table is reachable through Supabase's auto-generated endpoints
(shared with ADR-0002).
Also measure database growth per 10,000 synthetic entries, to estimate when the 400 MB trigger
will be reached.

Record each result, with its date, under "Validation results". A failed check that optimisation
does not fix triggers the revisit conditions; changing the decision needs a new ADR that
supersedes this one.

## Validation results
Automated tests in Skeleton step 4 (`apps/api/test/integration/schema.test.ts`), run on
2026-10-28 against PostgreSQL 17 on the PC with synthetic data; CI runs them on every pull
request.
- **(a) passed:** a second active coach link for one trainee is refused by the partial unique
  index; a new link is allowed once the old one has ended.
- **(b) passed:** a failure after ending the old link, inside one transaction, leaves the old link
  active; a successful switch ends the old link and starts the new one together.
- **(c) recorded:** weekly averages over 10,000 synthetic weigh-ins for one user took 16.5 ms on
  the PC's PostgreSQL (no target, Q-050). Not yet measured on Supabase.
- **(d) passed:** an ended link keeps its row, with its end time and reason.
- **(e) passed on `fitsphere-dev`, 2026-10-28 (owner):** with **Enable Data API** off,
  `npm run check:data-api` got HTTP 404 (`PGRST125`) and no data from the REST root,
  `app.users` and `app.weigh_ins`, using only the publishable key, as anyone could.
- **Database growth on `fitsphere-dev`, 2026-10-28 (owner, `npm run db:growth`):** PostgreSQL
  17.11, the same major version as on the PC and in CI. 10,000 synthetic weigh-ins for 100
  synthetic users, rolled back afterwards: the `weigh_ins` table and its indexes grew by
  2,544 KB, and the database by 2,616 KB, about 0.26 KB per weigh-in. At that rate weigh-ins
  alone would add 400 MB (the R-005 trigger) at roughly 1.5 million rows. That ignores the
  database's starting size and the other kinds of entries (meals and others, from later
  slices), which are not measured yet.
- Migration `0001_skeleton.sql` was applied to `fitsphere-dev` on 2026-10-28, before these
  checks; `db:growth` ran against its tables.

## Rejected approach: storing files inside the database
Putting photos, audio or video directly in PostgreSQL would quickly exhaust the database
size (500 MB on Free, 8 GB on Pro), make backups slow and large, and cost several times more
per GB than object storage. Rejected for all media types.

## Revisit conditions
- An R-005 trigger is hit, especially database over 400 MB (D-16).
- After moving to Pro, the database reaches 80% of the plan's included disk.
- Monthly active users reach 250,000 — build the capacity and cost model before stage 3.
- ADR-0007 finds no workable offline-sync approach with PostgreSQL.
- Progress queries become slow after indexing.
- Legal advice (Q-049) changes data-location requirements.

## References (official pages, checked 2026-10-27)
- Supabase pricing (database size, backups, pausing): https://supabase.com/pricing
- Supabase regions (Mumbai): https://supabase.com/docs/guides/platform/regions
- Supabase security (encryption at rest and in transit): https://supabase.com/security
- Supabase, Hardening the Data API: https://supabase.com/docs/guides/database/hardening-data-api
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Project: owner-decisions-2026-10-27.md (D-07, D-11, D-13, D-14, D-15, D-16), invariants #1,
  #5, #6, #7; ADR-0002
