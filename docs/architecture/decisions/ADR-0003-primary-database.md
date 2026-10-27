# ADR-0003: Primary database

- Status: **Proposed**
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-ROLE-* (links, permissions, switching), REQ-PLAN-*, REQ-LOG-*, REQ-PRG-* (weekly aggregates), REQ-NFR-001, NFR-003, NFR-004, NFR-005
- Related constraints/decisions: C-003, C-006, C-008; D-07 (unassign, never delete), D-09 (India, IST), D-10/D-11 (links, consent, switching), D-13 (author of each change), D-15 (20M aspiration)
- Related ADRs: ADR-0002 (decided together); ADR-0007 (device storage and sync) builds on it
- Supersedes: None

## Context
This decides where FitSphere's **permanent record** lives (D-14: "the server is the
permanent record"). The phone keeps a copy for offline use (ADR-0007), but the server
database is the source of truth.

The data is strongly **relational** — records point to each other and rules depend on
those connections:
- users ↔ roles; Coach ↔ trainee links and Head Coach ↔ Coach links, each with a start,
  end and status; one active coach per trainee and one Head Coach per coach (D-11);
- per-trainee Head Coach permission answers with timestamps (REQ-ROLE-013);
- plans, options and ingredients; targets with an author and time (D-13);
- daily entries (meals, weight, steps, sleep, measurements, workouts) per user per IST day;
- invitations with expiry; consent records; admin access log;
- references to media files: meal photos now; voice recordings and videos in a future
  release (owner request, 2026-10-27).

Some operations must happen **all-or-nothing**: switching Head Coach ends the old link,
creates the new link and issues fresh permission requests together (D-11). Progress needs
weekly totals and averages (REQ-PRG-*).

## Decision criteria
1. **Must:** relationships and rules such as "one active coach per trainee" enforced by the
   database itself.
2. **Must:** all-or-nothing changes (transactions) across several records.
3. **Must:** efficient date-range totals and averages for Progress.
4. **Must:** managed hosting in Mumbai with a free development tier.
5. **Must:** growth path toward millions of users; data portable to other providers.
6. **Should:** works with the hybrid backend in ADR-0002 and with an offline-sync approach
   (ADR-0007).
7. **Should:** encryption at rest and backups available as standard.

## Options considered

### Option A — PostgreSQL, managed by Supabase (Mumbai)
- Benefits: relational, with constraints, transactions and fast date-range queries; the
  most widely used open-source relational database — can be moved to any cloud's managed
  PostgreSQL later (portability); comes with ADR-0002's Supabase choice; Mumbai region;
  free tier for development; daily backups on Pro.
- Costs and risks: free tier is 500 MB, pauses after a week idle and has no backups; very
  large tables (meal entries for millions of users) need partitioning and indexing work
  later.
- Fit: meets 1–7.

### Option B — Firestore (Google, document database)
- Benefits: built-in offline sync in its SDK; automatic scaling.
- Costs and risks: no joins or database-enforced relationships — "one active coach per
  trainee", link switching and counts-only views must be enforced in code; aggregates
  (weekly averages) need extra bookkeeping; billed per document read, which grows with
  history screens; strong lock-in.
- Fit: meets 4 (partly); weak on 1, 2 (limited), 3, 5 (portability), 6.

### Option C — MongoDB Atlas (document database)
- Benefits: flexible documents; a free shared cluster for development; good tooling.
- Costs and risks: same relational-fit problems as B, though with better aggregation;
  multi-document transactions exist but relational integrity is not its strength.
- Fit: partial on 1, 2; meets 3, 5 (partly).

## Decision
Pending approval.

## Recommended option
**Option A — PostgreSQL, managed by Supabase, in the Mumbai region.**

Design rules that follow (to be detailed in `docs/contracts/data-model.md`):
- Store timestamps in UTC, plus a separate **IST day** field chosen by the user
  (invariant #5, REQ-LOG-002).
- Store each measure in one canonical unit (invariant #6).
- Links are rows with status and start/end dates; never deleted (D-07). A database rule
  allows only one active coach link per trainee and one active Head Coach link per coach.
- Every plan/target change records author and time (D-13).
- Large time-based tables (meal entries, weigh-ins) are designed so they can be
  partitioned by month later without changing the app.
- **Media files (photos now; audio and video in a future release) are never stored in the
  database.** One `media` record per file holds only: owner, the entry it belongs to, type
  (photo / audio / video), storage location key, size, duration, created time, status, and
  a removal date if retention removes it. The file itself lives in object storage
  (ADR-0002, future ADR-0008). This keeps the database small, fast and cheap even when
  users upload many large files, and lets media move to a cheaper storage provider by
  updating location keys only.
- A `media` record can instead point to an **external link** (e.g. a YouTube video) with
  the provider name, for the low-cost option described in ADR-0002. Media is view-only in
  the app, so records also track a smaller "viewing copy" (thumbnail or reduced-quality
  version) where one exists.

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
1. **Development:** Supabase Free (500 MB). $0.
2. **Launch:** Supabase Pro — 8 GB database included, then $0.125/GB; daily backups. From $25/month.
3. **Growth:** larger compute; indexes tuned to real queries; read replica for Progress and
   coach dashboards; monthly partitions for entry tables.
4. **Millions of users:** dedicated managed PostgreSQL (Supabase large plans or a cloud
   provider's Mumbai PostgreSQL); archive old raw entries while keeping weekly summaries.
   Plan this with a capacity model before reaching it.
No step requires changing the app's data model or rewriting the API.

## Consequences and accepted trade-offs
- Easier: correct permissions, safe switching, Progress queries, moving providers.
- Harder: offline sync from a relational database needs a deliberate design (ADR-0007).
- Accepted: free tier unsuitable for real user data (no backups, pausing) — move to Pro
  before launch (shared with ADR-0002).

## Validation plan
In the first slice: create tables for users, links and weigh-ins; prove with tests that
(a) a second active coach link for one trainee is rejected, (b) switching is all-or-nothing,
(c) a weekly-average query on 10,000 synthetic entries returns quickly. Record results here.

## Rejected approach: storing files inside the database
Putting photos, audio or video directly in PostgreSQL would quickly exhaust the database
size (500 MB free, 8 GB on Pro), make backups slow and large, and cost several times more
per GB than object storage. Rejected for all media types.

## Revisit conditions
- Database size reaches 80% of the plan.
- ADR-0007 finds no workable offline-sync approach with PostgreSQL.
- Progress queries become slow after indexing.
- Legal advice (Q-049) changes data-location requirements.

## References (checked 2026-10-27)
- Supabase pricing (database size, backups, pausing): https://supabase.com/pricing
- Supabase regions (Mumbai): https://supabase.com/docs/guides/platform/regions
- Project: owner-decisions-2026-10-27.md, invariants #1, #5, #6; ADR-0002