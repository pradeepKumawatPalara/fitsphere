# ADR-0002: Backend architecture and hosting

- Status: **Accepted** by the project owner on 2026-10-27 (D-17), together with ADR-0003. The
  owner's D-16 confirmations (5-minute viewing links, the upload-link limitation, the scope of
  the retention rule, phase-1 public links for meal photos only) were applied in the same
  change, before acceptance.
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-ROLE-* (links, invitations, permissions), REQ-ACC-004/010, REQ-LOG-005, REQ-LOG-006, REQ-LOG-009, REQ-LOG-010, REQ-TRN-001, REQ-NFR-001, REQ-NFR-002, REQ-NFR-003, REQ-NFR-004, REQ-NFR-005, REQ-NFR-006
- Related constraints/decisions: C-002, C-003, C-004, C-008; D-01 (solo), D-03 (Node preference, free first), D-09 (India only), D-10…D-16, D-17 (accepted); R-003, R-004, R-005; ADR-0001 (React Native + Expo, TypeScript)
- Related ADRs: ADR-0003 (database) is decided together with this one. ADR-0004 (sign-in provider and authorization), ADR-0005 (AI), ADR-0007 (offline sync) and ADR-0008 (media storage, audio/video release) build on it
- Supersedes: None

## Context
FitSphere needs a server that:
- signs users in (email + password, verification, reset — REQ-ACC-010). The sign-in provider
  is decided in ADR-0004 (D-16);
- enforces the link-and-permission rules on every request (invariant #1): accepted links,
  per-trainee Head Coach permission, counts-only views, ending links, re-checking offline
  changes at sync time;
- checks AI consent on the server immediately before each AI call (invariant #3, C-004);
- sends invitation emails and push notifications (Q-082, Q-083);
- stores meal photos as compressed viewable copies, and links to content users keep on other
  sites (D-16);
- logs every admin access (REQ-NFR-005);
- serves users in India (D-09), with India's DPDP Act 2023 the likely applicable law (Q-049).

It is built and run by one developer (D-01), costs nothing during development (C-008), and
phase 1 runs on free plans (D-16). It must be able to grow toward an aspiration of 20 million
users without a rewrite (D-15). The owner knows JavaScript/Node (D-03); the app is TypeScript
(ADR-0001).

## Decision criteria
1. **Must:** authorization rules live on the server and are testable as ordinary code; the app
   has no other path to the data.
2. **Must:** free during development and phase 1 (D-16); known, gradual costs after that.
3. **Must:** a hosting region in India (Mumbai) is available.
4. **Must:** a growth path toward millions of users without rewriting the app.
5. **Must:** data encrypted in transit and at rest (REQ-NFR-002).
6. **Should:** TypeScript/Node, sharing types with the app.
7. **Should:** little server maintenance for one person (managed services).
8. **Should:** low lock-in — parts can be moved to another provider.

## Options considered

### Option A — Supabase only (app talks to the database directly)
Supabase provides a managed PostgreSQL database, sign-in, file storage and small server
functions. The app reads and writes the database directly; access rules are written as
database policies ("row level security").
- Benefits: least code to start; free plan; Mumbai region available; built-in sign-in.
- Costs and risks: FitSphere's rules (permission per trainee, counts-only Head Coach view,
  ending links, re-authorizing offline changes, consent before AI) would mostly be database
  policies. These are harder to write, read and test than application code, and a mistake
  exposes health data. Server functions run on Deno, not Node.
- Fit: meets 2, 3, 5, 7; weak on 1; partial on 6, 8.

### Option B — Own Node.js API + Supabase for database and file storage (hybrid)
A TypeScript Node.js API is the **only** way the app reads or writes data. Supabase provides
the managed PostgreSQL database (ADR-0003) and photo storage in Mumbai. Sign-in is decided in
ADR-0004; Supabase Auth is one candidate.
- **The API really is the only path.** Supabase's auto-generated Data API is turned off with
  the project setting **Enable Data API**; with it off, "none of the auto-generated REST
  endpoints respond, regardless of grants or RLS" (Supabase docs, "Hardening the Data API").
  Supabase's docs do not say whether its sign-in and file storage keep working with the Data
  API off, so the validation plan checks it. If something FitSphere needs stops working, the
  fallback is to leave the Data API on but expose no app table: switch off **Automatically
  expose new tables** and revoke default privileges from the `anon` and `authenticated` roles
  (same docs). Database policies stay as a second safety layer, not the main one.
- The API connects to PostgreSQL directly. Supabase's docs recommend its connection pooler in
  transaction mode for serverless hosts such as Cloud Run; confirm in validation.
- Benefits:
  - All business and permission rules in one TypeScript codebase, covered by normal
    automated tests (the authorization test suite the review asked for).
  - Uses the owner's Node skills; shares types with the app.
  - The API holds no state, so more copies can run as users grow.
  - Standard PostgreSQL — the database can move to another provider later without changing
    the app.
  - Supabase encrypts all customer data at rest (AES-256) and in transit (TLS) (Supabase
    security page).
- Costs and risks:
  - More to build than Option A: an API layer, deployment, and monitoring.
  - The API needs a host. Candidates (official pages, checked 2026-10-27):
    - **Google Cloud Run (Mumbai, asia-south1):** for request-based billing, the first
      2 million requests, 180,000 vCPU-seconds and 360,000 GiB-seconds each month are free,
      applied as a spending discount at Tier 1 prices; asia-south1 is a Tier 1 region. "A
      Google Cloud billing account is required to access the Google Cloud Free Tier" — the
      owner decides whether to create one, with a budget alert (Q-087).
    - **Render free web service:** spins down after 15 minutes without traffic and takes
      about a minute to start again — acceptable for development only, not for users.
  - If ADR-0004 picks Supabase Auth, its cost grows per monthly active user (see "Growth
    path").
- Fit: meets 1, 2, 3, 4, 5, 6; good on 7 and 8.

### Option C — Firebase (Firestore database, Firebase Auth, Cloud Functions)
- Benefits: popular with mobile apps; good offline support in its own SDK; Mumbai region.
- Costs and risks: Cloud Functions need the pay-as-you-go Blaze plan (Firebase docs).
  Firestore is a document database — the link/permission/counts model is relational and
  awkward to query there (ADR-0003). Pricing is per document read and write, which grows
  quickly with dashboards and history screens; the free Spark plan allows 1 GiB stored and
  50,000 reads, 20,000 writes and 20,000 deletes per day (Firebase docs). High lock-in.
- Fit: meets 3; weak on 1, 2, 4 (cost), 8; 5 not assessed.

### Option D — Self-managed server (Node API + own PostgreSQL on a rented virtual server)
- Benefits: lowest monthly cost at small scale; full control.
- Costs and risks: one person must handle security patches, encryption, backups, failover and
  scaling of a server holding health data. High operational risk.
- Fit: meets 1, 6, 8; fails 7; risky on 4 and 5.

## Decision
**Option B — a TypeScript Node.js API (one modular application) that is the only path to the
data, with Supabase PostgreSQL and file storage in the Mumbai region, on the Free plan in
phase 1 (D-16); Supabase's Data API turned off; the API hosted on Google Cloud Run in Mumbai
once Q-087 is settled.** Accepted by the project owner on 2026-10-27 (D-17), together with
ADR-0003. The sign-in provider is not part of this decision; ADR-0004 decides it, and Supabase
Auth is only a candidate.

Accepted while these were still open (D-17): Q-049, Q-050, Q-082, Q-083 and Q-087, plus Q-064
and Q-089, both partly answered. "Open questions and how each is handled" below says how each
is handled. The owner accepted risks R-004 and R-005 (D-17). The validation steps run in the
first slice.

## Recommended option
**Option B — a TypeScript Node.js API (as one modular application, not microservices), with
Supabase providing PostgreSQL and file storage in the Mumbai region, on the Free plan in phase 1
(D-16, accepted risk R-005).** Supabase's Data API is turned off, so the Node API is the only
path to the data.

Host the API on Google Cloud Run in Mumbai once Q-087 is settled. Until then the API runs on the
developer's PC against the Free project, with synthetic data only (invariant #7). The sign-in
provider is chosen in ADR-0004; Supabase Auth is a candidate because it comes with the same
project.

## Why this option wins
It is the only option that keeps FitSphere's most important and most complex rules —
who may see whose health data — in ordinary, testable TypeScript code, while still using
managed services so one person does not run servers. It is free during development and
phase 1, and built from standard parts (Node, PostgreSQL, containers) that can each be moved.

## Why alternatives were rejected
- **A:** puts the riskiest logic in database policies that are hard to test; a policy
  mistake leaks health data.
- **C:** functions need a paid plan; per-read pricing and a document database fit the
  relational permission model poorly; strongest lock-in.
- **D:** too much server operation and security work for one developer.

## Counterfactual
- **A** would win if the permission rules were simple (e.g. users only see their own data).
- **C** would win if the data were mostly per-user documents with no cross-user permissions.
- **D** would win with a dedicated operations person and very tight budgets at large scale.

## Growth path toward 20 million users (aspiration, D-15)
List prices from the providers' official pages, checked 2026-10-27. They exclude AI, email,
push and app-store fees. Stages match ADR-0003.

| Stage | When | What runs | Approx. server cost |
|---|---|---|---|
| 0. Development and phase 1 | Now (D-16) | Supabase Free: 500 MB database, 1 GB files, 5 GB egress plus a separate 5 GB cached egress per month, 50,000 monthly active users; **no backups; pauses after 1 week of inactivity** (R-005). API on the developer's PC, then Cloud Run's free tier (Q-087) | $0 |
| 1. First paid stage | When an R-005 trigger is hit and the owner approves (C-008) | Supabase Pro, from $25/month: 8 GB disk (then $0.125/GB), 100 GB files (then $0.0213/GB-month), 250 GB egress (then $0.09/GB) and 250 GB cached egress (then $0.03/GB), 100,000 monthly active users (then $0.00325 each), daily backups kept 7 days. Or, instead, a separate backup while staying on Free | From ~$25/month + usage |
| 2. Growth (100,000s of users) | As usage grows | Larger database compute; more API copies. If ADR-0004 picks Supabase Auth, sign-in is billed at $0.00325 per monthly active user above 100,000 (1 million ≈ $2,925/month for sign-in alone) | Rises with users — owner review |
| 3. Millions of users | Only after a capacity and cost model | Possibly move sign-in to a cheaper or self-run service and/or the database to a dedicated managed PostgreSQL (e.g. a cloud provider's Mumbai region); keep the same API and data model | **Not estimated.** A capacity and cost model is required before this stage; start it when monthly active users reach 250,000 |

Owner-review triggers for moving from stage 0 to stage 1 (D-16, R-005):
- database over 400 MB;
- files over 800 MB;
- monthly active users near 50,000;
- monthly egress over 4 GB — Supabase counts uncached and cached egress separately, 5 GB each,
  so both are watched;
- any pause;
- any data-loss incident.

Capacity note (D-16): at about 200 KB per photo, the 1 GB of free file storage holds about
5,000 photos, fewer once thumbnails are counted. The 800 MB trigger is about 4,000 photos — for
example, 50 users each saving one photo a day reach it in about 80 days.

Key point: **at millions of users, per-user sign-in pricing can become a large cost.** The
design keeps sign-in replaceable: the API uses its own user IDs and talks to sign-in through
one module.

## Media files: photos now; audio and video in a future release
Phase 1 stores meal photos only. Storing voice recordings and videos is future scope (D-16),
decided in **ADR-0008**; the rules below keep it possible without rework.

Design rules (apply from phase 1):
1. **Media never goes in the database.** Files live in object storage; the database keeps
   only a small record pointing to each file (ADR-0003).
2. **Shrink on the phone before upload.** A meal photo becomes a compressed viewable copy of
   about 200 KB (phone-viewable quality) plus a small thumbnail for lists (D-16), with location
   data (GPS) removed. Phase 1 voice recordings are transcribed and then deleted, not stored
   (D-16). Limits for future audio and video: Q-090.
3. **The phone uploads directly to storage, with permission from the API.** The API checks the
   link and permission rules (invariant #1), then issues a short-lived link. Files don't pass
   through the API, so API costs stay low, and authorization stays on the server.
   - Viewing (download) links expire after **at most 5 minutes** (D-16; Supabase lets the
     caller set the expiry in seconds). The app never stores a viewing link; it asks the API
     again.
   - Upload links are valid for 2 hours (Supabase docs; no shorter option is documented).
     They allow uploading one file to one path and give no viewing access. Accepted by the
     owner as a known limitation (D-16).
   - Links are kept out of logs (invariant #7). Threat T-08.
4. **One storage module.** The API talks to storage through one module using the common
   S3-style interface, so the provider can be changed without changing the app.
5. **Retention (D-16, Q-089).** A user's own media is never fully deleted automatically while
   the account exists; an original may be replaced by a viewing-quality copy. Phase 1 keeps
   only the viewing copy, so no retention rule runs in phase 1. This rule covers automatic
   retention only: a user may delete their own meal photo or label image, and it is then
   really removed — the file and its thumbnail from storage, and cached copies from other
   phones at their next sync (D-16, REQ-LOG-006, A-004). Account deletion: Q-048.
6. **AI consent.** Storing a photo needs no AI consent; sending it to AI does. Consent is
   checked on the server immediately before each AI call (invariant #3, C-004), not when an
   upload link is issued.
7. **Photos cached on the phone follow the device rules** (D-10, D-13, D-14; REQ-NFR-004,
   REQ-NFR-006). Viewed photos are cached so repeat views use no egress. The cache is
   encrypted; when a link ends, the former coach's or Head Coach's app deletes that trainee's
   cached photos on its next sync; other people's cached photos are cleared after 30 days
   without a sync. A user's own photo saved offline and not yet uploaded is an unsynced entry
   and is never cleared automatically (D-14). Detailed design: ADR-0007.
8. **External links** are stored as links, never fetched or copied by FitSphere — see below.

Provider plan:
- **Phase 1 (photos):** Supabase Storage in Mumbai, Free plan (1 GB).
- **When media grows (audio/video release):** decide in **ADR-0008 (media storage)**.
  Candidates (official pages, checked 2026-10-27):

  | Provider | Storage | Downloads (egress) | Free allowance | Location |
  |---|---|---|---|---|
  | Supabase Storage | $0.0213/GB-month after 100 GB on Pro | $0.09/GB after 250 GB on Pro ($0.03/GB for cached egress) | 1 GB files, 5 GB egress + 5 GB cached egress (Free plan) | Mumbai |
  | Cloudflare R2 | $0.015/GB-month | Free | 10 GB-month storage, 1 million Class A and 10 million Class B operations per month | No India option: jurisdictions are EU, FedRAMP and US only; location hints (e.g. Asia-Pacific) are "best effort and not a guarantee" |
  | Backblaze B2 | From $6.95/TB-month | Free up to 3× average monthly stored data, then $0.01/GB | First 10 GB | No India region (US East, US West, EU Central, CA East) |

  Example at 10 TB stored, list prices, storage only: Supabase ≈ $211/month, Cloudflare R2 ≈
  $150/month, Backblaze B2 ≈ $70/month. Videos are watched repeatedly, so download fees
  matter as much as storage — R2 and B2 are much cheaper there.
- **Video specifics** (converting formats, streaming smoothly on slow mobile networks) need
  their own comparison in ADR-0008; a plain storage bucket may not be enough.
- **Trade-off to settle with Legal (Q-091, Q-049):** the cheapest providers have no India
  location; Supabase Storage does.

### View-only media (D-16)
Users view photos — and later play audio and video — in the app; there is no download feature
(REQ-NFR-006).
- Watching or viewing still transfers the file to the phone, so egress fees apply each time
  media is viewed. Lists use the thumbnail, and viewed photos are cached on the phone (rule 7),
  so repeat views are free.
- View-only is not copy protection: anyone can take a screenshot or screen recording. Privacy
  relies on who is allowed to view (invariant #1), not on hiding a download button.

### External links: YouTube and other public links (D-16)
FitSphere stores only the link — near-zero storage and streaming cost.
- **Coaches** add exercise how-to videos as YouTube links, unlisted or public (REQ-TRN-001;
  answers Q-041).
- **Users** may add public links to their own content instead of uploading. In phase 1 this is
  for meal photos only (D-16, confirmed); links to their own videos come with the audio/video
  release. Before saving, the app shows a privacy warning the user must confirm (REQ-LOG-010).
- **When a link between people ends,** the API stops returning the trainee's external links to
  the former coach or Head Coach. FitSphere cannot revoke access to the content itself or
  delete it — the exception in invariant #1, accepted risk R-004, threat T-09; Legal to confirm
  (Q-049).

YouTube settings (YouTube Help, checked 2026-10-27):

| Setting | Who can watch | Embedding |
|---|---|---|
| Private | Only the uploader and people they choose — up to 50 email addresses, each needing a Google account; the URL cannot be shared | An embedded video stops working once it is made private |
| Unlisted | Anyone who has the link; it can be forwarded | Embedded unlisted videos keep playing |

So links shown in FitSphere must be unlisted or public. Uploading to YouTube from the app (via
YouTube's API, with quotas and Google sign-in) is not in phase 1; evaluate it in ADR-0008.

## Logging, monitoring and owner access
- API logs and monitoring exclude health, body and meal data, media and external links, and
  tokens (invariant #7, REQ-NFR-002). They record only request facts such as route, status,
  timing and user ID. Where logs are stored is checked against Q-049.
- The owner uses two-factor sign-in on Supabase (available in account settings, Supabase docs)
  and Google Cloud, never browses user data in the dashboards, and makes any needed access
  through the logged admin path (D-16, REQ-NFR-005). Dashboard access does not appear in the
  admin access log — accepted risk R-003.

## Open questions and how each is handled
| ID | Question | Status | How this ADR handles it | Blocks acceptance? |
|---|---|---|---|---|
| Q-041 | Exercise how-to format | Answered (D-16) | Coach-provided YouTube links; FitSphere stores links only | No |
| Q-049 | DPDP obligations, data residency, external links | Open (Legal) | All data stays in Mumbai; Legal confirms before real users (C-003), including the external-link approach (R-004) | No — blocks real users, not this choice |
| Q-050 | Performance and availability targets | Open | No target assumed; cold starts measured in validation; revisit condition | No |
| Q-053 | Team, skills, budget | Answered (D-01, D-03, C-008) | One modular TypeScript application on managed services | No |
| Q-055 | Offline logging | Answered (D-04) | Queued changes re-authorized by the API at sync; sync design in ADR-0007 | No |
| Q-064 | Are meal photos kept? | Partly answered (D-16) | Compressed ~200 KB copy plus thumbnail, or an external link; a user may delete their own photo or label image, and it is really removed (rule 5). Whether label images are kept by default, and whether deleting a meal deletes its photo, are data-model details that don't change hosting | No |
| Q-082 | Email service and sender domain | Open | Sign-in emails are verified in ADR-0004 (SPF, DKIM, DMARC — D-13); the invitation email service is chosen before invitations are built | No |
| Q-083 | Push notification service | Open | Expo push checked in the first slice (ADR-0001) | No |
| Q-087 | Cloud Run billing account | Open (fact checked: a billing account is required for the free tier) | API runs on the developer's PC until the owner approves the billing account and a budget alert | No — blocks deploying to Cloud Run |
| Q-088 | Backups before Pro | Answered (D-16) | Free plan, no backups, accepted risk R-005 with review triggers | No |
| Q-089 | Media retention | Partly answered (D-16) | Rule 5; remaining periods with Legal and in ADR-0008 | No |
| Q-092 | Which videos may use YouTube links | Answered (D-16) | "External links" above | No |

Confirmed by the owner before acceptance (D-16): the 5-minute maximum for viewing links; the
2-hour upload links as a known limitation; phase-1 public links for meal photos only; "never
fully delete" applying to automatic retention only.

## Consequences and accepted trade-offs
- Easier: testing permission rules; moving providers; one language end to end.
- Media storage can be switched to a cheaper provider later without app changes (rule 4).
- Harder: more code than a database-only backend; the API must be deployed and monitored.
  With the Data API off, the API reaches the database through a direct (pooled) connection
  rather than Supabase's data client.
- Accepted (D-16, R-005): phase 1 runs on the Free plan with **no backups**, so data lost on the
  server cannot be restored — this conflicts with D-14 ("the server is the permanent record").
  The project pauses after 1 week of inactivity; the owner resumes it from the dashboard
  ([`runbook.md`](../../operations/runbook.md)). Supabase Pro is a later stage, reviewed when a
  trigger is hit and approved by the owner (C-008).
- Accepted (D-16, R-004): content added as an external link stays viewable by anyone who has
  the link after a link between people ends.
- Accepted: dependence on Supabase for the database and file storage until stage 3, and on
  Supabase Auth only if ADR-0004 chooses it.

## Validation in the first slice (D-17)
In the first implementation slice, with synthetic data only (invariant #7):
1. Create the Supabase project in Mumbai on the Free plan. Turn on two-factor sign-in for the
   owner's Supabase and Google Cloud accounts.
2. Turn off **Enable Data API**. Confirm that the auto-generated REST endpoints return nothing,
   and that Storage upload and viewing links (and Supabase Auth, if ADR-0004 is considering it)
   still work. If not, apply the fallback in Option B and record which one was used.
3. Connect the API to PostgreSQL through the connection pooler. Once Q-087 is settled, deploy a
   minimal API to Cloud Run (Mumbai) and measure cold-start time from an Android phone.
4. Write the first authorization tests: a coach cannot read another coach's trainee; after a
   link ends, the former coach gets none of the trainee's data or external links.
5. Upload a photo: confirm a ~200 KB copy and a thumbnail, location data removed, and that the
   viewing link stops working after 5 minutes.
6. Confirm that API logs contain no health data, media links or tokens.

*D-20 (2026-10-28):* the MVP has no links, so step 4's cases run post-MVP with links (backlog
B-19). The MVP's first authorization tests cover self-access and "no other user's data". The
decision is unchanged.

Record each result, with its date, under "Validation results". A failed step that the
documented fallback does not fix triggers the revisit conditions; changing the decision needs a
new ADR that supersedes this one.

## Validation results
Automated tests in Skeleton steps 5 to 10, run on 2026-10-28 on the PC (PostgreSQL 17, synthetic data); CI runs them on every pull request. Device and Supabase checks are recorded here once the owner has run them.
- **Step 4 (MVP form, D-20) — passed in automated tests:** a user reads their own weigh-ins
  (`200`); another user, and an unknown user ID, get the same `404`; no token, an expired token or
  another key get `401`; a second user's sync never changes or returns the first user's
  weigh-ins, even with the same day and change ID (`test/integration/sync.test.ts`,
  `weigh-ins.test.ts`). The link cases wait for B-19.
- **Step 6 — passed in automated tests:** the log holds one line per request with the route
  pattern, and no token, email address, weight value, query value or body
  (`test/integration/logs.test.ts`). Media links do not exist yet.
- **Step 2, REST part — passed on `fitsphere-dev`, 2026-10-28 (owner):** with **Enable Data
  API** off, the REST root, `app.users` and `app.weigh_ins` answered HTTP 404 (`PGRST125`) with
  no data to the publishable key (`npm run check:data-api`). Skeleton step 6's phone checks, which
  prove that Supabase Auth works with the Data API off, are pending: deferred to before the
  release by D-22 (backlog SC-09). Storage waits for media, after the Skeleton.
- **Step 3, PC part — passed, 2026-10-28:** the migration and `npm run db:growth` reached
  `fitsphere-dev` from the PC through the session pooler (`DATABASE_URL`). The API uses the same
  address; its first queries through it come with step 6's account setup. The Cloud Run part
  waits for Q-087.
- **Step 1:** not recorded yet (Mumbai region, Free plan, two-factor sign-in on the owner's
  Supabase and Google Cloud accounts). Step 5 runs with media, after the Skeleton.
- **Rule 4, documentation — read 2026-10-29 (Meal logging slice):** Supabase's S3 compatibility
  page says "Storage supports presigning a URL using query parameters … using AWS Signature
  Version 4", once the S3 connection is enabled in Storage's settings, and lists PutObject,
  GetObject, DeleteObject and HeadObject as supported. It names no expiry limits. The API's one
  storage module presigns upload links for **10 minutes** and viewing links for **5 minutes**.
  Rule 3's "Upload links are valid for 2 hours" described Supabase's own upload links, which are
  not used, so the limitation accepted in D-16 is narrower in practice; no decision changes.
- **Steps 2 (Storage part) and 5 — automated parts passed, real-project checks pending:** the
  link lifetimes, keys made of IDs, self-access and deletion are covered by
  `apps/api/src/storage/mediaStorage.test.ts` and `test/integration/media.test.ts`; shrinking on
  the phone by `apps/mobile/src/photos/takePhoto.test.ts`. Against `fitsphere-dev`, `npm run
  check:storage` (with the Data API off) and the slice's phone checks (size, thumbnail, no
  location data) are the owner's, not run yet.
- **Step 6, media links — passed in automated tests:** links are returned in response bodies
  only, which the log never contains, and the request line holds the route pattern only
  (`test/integration/logs.test.ts`).

## Revisit conditions
- An R-005 trigger is hit: database over 400 MB; files over 800 MB; monthly active users near
  50,000; monthly egress over 4 GB; any pause; any data-loss incident.
- Monthly active users reach 250,000 — build the capacity and cost model before stage 3.
- Monthly active users approach 100,000, if ADR-0004 chooses Supabase Auth (sign-in pricing
  changes).
- Cloud Run cold starts are noticeably slow for users (Q-050).
- The Data API cannot be turned off without breaking a Supabase service FitSphere needs.
- ADR-0007 finds no workable offline-sync approach with this backend and PostgreSQL (shared
  with ADR-0003).
- Legal advice (Q-049) requires a specific hosting setup, or rejects the external-link
  approach (R-004).
- Supabase or Google Cloud pricing or free tiers change materially.

## References (official pages, checked 2026-10-27)
- Supabase pricing (plans, limits, pausing, backups): https://supabase.com/pricing
- Supabase regions (South Asia — Mumbai, ap-south-1): https://supabase.com/docs/guides/platform/regions
- Supabase, Hardening the Data API: https://supabase.com/docs/guides/database/hardening-data-api
- Supabase, Securing your API: https://supabase.com/docs/guides/api/securing-your-api
- Supabase, Connecting to Postgres: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Storage signed links: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl and https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- Supabase security (encryption at rest and in transit): https://supabase.com/security
- Supabase account two-factor sign-in: https://supabase.com/docs/guides/platform/multi-factor-authentication
- Supabase free project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Cloud Run pricing and free tier: https://cloud.google.com/run/pricing
- Cloud Run locations and pricing tiers: https://docs.cloud.google.com/run/docs/locations
- Google Cloud Free Tier (billing account required): https://docs.cloud.google.com/free/docs/free-cloud-features
- Render free tier: https://render.com/docs/free
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/ and data location: https://developers.cloudflare.com/r2/reference/data-location/
- Backblaze B2 pricing: https://www.backblaze.com/cloud-storage/pricing and regions: https://www.backblaze.com/docs/cloud-storage-data-regions
- YouTube privacy settings: https://support.google.com/youtube/answer/157177 and https://support.google.com/youtube/answer/9230970
- Firebase Cloud Functions (Blaze plan): https://firebase.google.com/docs/functions ; pricing: https://firebase.google.com/pricing ; Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Project: owner-decisions-2026-10-27.md (D-01, D-03, D-09, D-14, D-15, D-16), ADR-0001, project invariants
