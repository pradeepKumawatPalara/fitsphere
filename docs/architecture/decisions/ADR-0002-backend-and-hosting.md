# ADR-0002: Backend architecture and hosting

- Status: **Proposed**
- Date: 2026-10-27
- Decision owner: Project owner
- Related requirements: REQ-ROLE-* (links, invitations, permissions), REQ-ACC-004/010, REQ-LOG-009, REQ-NFR-001, NFR-003, NFR-004, NFR-005
- Related constraints/decisions: C-002, C-003, C-004, C-008; D-01 (solo), D-03 (Node preference, free first), D-09 (India only), D-10…D-15; ADR-0001 (React Native + Expo, TypeScript)
- Related ADRs: ADR-0003 (database) is decided together with this one; ADR-0004 (auth details), ADR-0005 (AI), ADR-0007 (offline sync) and a future ADR-0008 (media storage) build on it
- Supersedes: None

## Context
FitSphere needs a server that:
- signs users in (email + password, verification, reset — REQ-ACC-010);
- enforces the link-and-permission rules on every request (invariant #1): accepted links,
  per-trainee Head Coach permission, counts-only views, ending links, re-checking offline
  changes at sync time;
- checks AI consent on the server before any AI call (C-004);
- sends invitation emails and push notifications (Q-082, Q-083);
- stores meal photos;
- logs every admin access (REQ-NFR-005);
- serves users in India (D-09), with India's DPDP Act 2023 the likely applicable law (Q-049).

It is built and run by one developer (D-01), costs nothing during development (C-008), and
must be able to grow toward an aspiration of 20 million users without a rewrite (D-15).
The owner knows JavaScript/Node (D-03); the app is TypeScript (ADR-0001).

## Decision criteria
1. **Must:** authorization rules live on the server and are testable as ordinary code.
2. **Must:** free during development; known, gradual costs after launch.
3. **Must:** a hosting region in India (Mumbai) is available.
4. **Must:** a growth path toward millions of users without rewriting the app.
5. **Should:** TypeScript/Node, sharing types with the app.
6. **Should:** little server maintenance for one person (managed services).
7. **Should:** low lock-in — parts can be moved to another provider.

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
- Fit: meets 2, 3, 6; weak on 1; partial on 5, 7.

### Option B — Own Node.js API + Supabase for database, sign-in and file storage (hybrid)
A TypeScript Node.js API is the **only** way the app reads or writes data. Supabase provides
the managed PostgreSQL database (ADR-0003), sign-in and photo storage in Mumbai. Database
policies are kept as a second safety layer, not the main one.
- Benefits:
  - All business and permission rules in one TypeScript codebase, covered by normal
    automated tests (the authorization test suite the review asked for).
  - Uses the owner's Node skills; shares types with the app.
  - The API holds no state, so more copies can run as users grow.
  - Standard PostgreSQL — the database can move to another provider later without changing
    the app.
- Costs and risks:
  - More to build than Option A: an API layer, deployment, and monitoring.
  - The API needs a host. Candidates (checked 2026-10-27):
    - **Google Cloud Run (Mumbai, asia-south1):** free tier of 2 million requests and
      180,000 vCPU-seconds per month for request-based services; scales to zero when idle;
      Mumbai is in the pricing tier used for the free allowance. Likely needs a billing
      account (card) — set budget alerts. *(Confirm — Q-087.)*
    - **Render free web service:** sleeps after 15 minutes idle and takes about a minute to
      wake — acceptable for development only, not for users.
  - Supabase Auth cost grows per active user (see "Growth path").
- Fit: meets 1, 3, 4, 5; meets 2 at development stage; good on 6 and 7.

### Option C — Firebase (Firestore database, Firebase Auth, Cloud Functions)
- Benefits: popular with mobile apps; good offline support in its own SDK; Mumbai region.
- Costs and risks: server functions require the paid pay-as-you-go plan (Firebase docs).
  Firestore is a document database — the link/permission/counts model is relational and
  awkward to query there (ADR-0003). Pricing is per document read/write, which grows quickly
  with dashboards and history screens. A 2026 secondary source reports the free Firestore
  quota was cut (25,000 reads and 10,000 writes per day) — *unverified on Google's site*.
  High lock-in.
- Fit: meets 3; weak on 1, 2, 4 (cost), 7.

### Option D — Self-managed server (Node API + own PostgreSQL on a rented virtual server)
- Benefits: lowest monthly cost at small scale; full control.
- Costs and risks: one person must handle security patches, backups, failover and scaling of
  a server holding health data. High operational risk.
- Fit: meets 1, 5, 7; fails 6; risky on 4.

## Decision
Pending approval.

## Recommended option
**Option B — a TypeScript Node.js API (as one modular application, not microservices),
with Supabase providing PostgreSQL, sign-in and file storage in the Mumbai region.**
Host the API on Google Cloud Run in Mumbai, subject to Q-087. During early development
the API can also run on the developer's PC against the free Supabase project.

## Why this option wins
It is the only option that keeps FitSphere's most important and most complex rules —
who may see whose health data — in ordinary, testable TypeScript code, while still using
managed services so one person does not run servers. It is free during development and
built from standard parts (Node, PostgreSQL, containers) that can each be moved.

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
Costs below are list prices checked 2026-10-27 and exclude AI, email, push and store fees.

| Stage | What runs | Approx. server cost |
|---|---|---|
| 0. Development | Supabase Free (500 MB database, 1 GB files, 50,000 monthly active users; **pauses after 1 week idle; no backups**); API on PC or Cloud Run free tier | $0 |
| 1. Launch / early users | Supabase Pro (from $25/month: 8 GB database, 100 GB files, 100,000 monthly active users, daily backups kept 7 days); Cloud Run likely within free tier | ~$25/month + usage |
| 2. Growth (100,000s of users) | Larger database compute; more API copies; sign-in billed at $0.00325 per monthly active user above 100,000 (e.g. 1 million MAU ≈ $2,900/month for sign-in alone) | Rises with users — review |
| 3. Millions of users | Move sign-in to a cheaper or self-run service and/or the database to a dedicated managed PostgreSQL (e.g. a cloud provider's Mumbai region); keep the same API and data model | Needs a capacity and cost model before this stage |

Key point: **at millions of users, per-user sign-in pricing becomes a large cost.** The design
keeps that replaceable: the API uses its own user IDs and talks to sign-in through one module.

## Media files: photos now; audio and video in a future release
The owner plans to store food photos, voice recordings and user-uploaded videos, at the
lowest reasonable cost (owner request, 2026-10-27). Audio and video are **future scope**;
the design below keeps them possible without rework.

Design rules (apply from phase 1):
1. **Media never goes in the database.** Files live in object storage; the database keeps
   only a small record pointing to each file (ADR-0003).
2. **Shrink on the phone before upload.** Photos are resized and compressed; audio uses a
   compressed format; videos (future) have a maximum length and resolution set by the owner.
   This is the single biggest cost saving.
3. **The phone uploads directly to storage, with permission from the API.** The API checks
   links, permission and consent, then gives the phone a short-lived upload or download link.
   Files don't pass through the API, so API costs stay low, and authorization stays on the
   server (invariant #1).
4. **One storage module.** The API talks to storage through one module using the common
   S3-style interface, so the provider can be changed without changing the app.
5. **Lifecycle rules.** Old originals can be shrunk, moved to cheaper storage or deleted
   automatically, according to the retention decision (Q-089).
6. **Privacy.** Remove location data (GPS) from photos before upload; meal media may show
   faces or homes. Sending media to AI still requires AI consent (C-004).

Provider plan:
- **Phase 1 (photos):** Supabase Storage in Mumbai — already part of Option B; 1 GB free,
  100 GB included on Pro, then $0.0213/GB-month; downloads above 250 GB/month cost $0.09/GB.
- **When media grows (audio/video release):** decide in a new **ADR-0008 (media storage)**.
  Candidates checked 2026-10-27:

  | Provider | Storage | Downloads (egress) | Free allowance | Location |
  |---|---|---|---|---|
  | Supabase Storage | $0.0213/GB-month after 100 GB on Pro | $0.09/GB after 250 GB | 1 GB (Free plan) | Mumbai |
  | Cloudflare R2 | $0.015/GB-month | **Free** | 10 GB, 1M uploads, 10M reads per month | Not India-specific — confirm for Q-049 |
  | Backblaze B2 | about $0.007/GB-month ($6.95/TB) | Free up to 3× stored data, then $0.01/GB | 10 GB | Not India-specific — confirm for Q-049 |

  Example at 10 TB stored, list prices, storage only: Supabase ≈ $211/month, Cloudflare R2 ≈
  $150/month, Backblaze B2 ≈ $70/month. Videos are watched repeatedly, so download fees
  matter as much as storage — R2 and B2 are much cheaper there.
- **Video specifics** (converting formats, streaming smoothly on slow mobile networks) need
  their own comparison in ADR-0008; a plain storage bucket may not be enough.
- **Trade-off to settle with Legal (Q-049):** the cheapest providers don't offer an
  India-only location; Supabase Storage does.

### View-only media (owner input, 2026-10-27)
Users upload photos, audio and video and can **view or play** them in the app; there is no
"download" feature.
- This removes a download button, but **watching or listening still transfers the file to
  the phone**, so download (egress) fees still apply each time media is viewed. To keep
  them low: serve a smaller viewing copy (thumbnail for photos, reduced-quality stream for
  video) rather than the original, and cache on the device so repeat views are free.
- View-only is not copy protection: anyone can screen-record. Privacy relies on who is
  allowed to view (invariant #1), not on hiding the download button.

### Low-cost option: video hosted on YouTube, FitSphere stores only the link
The owner proposed letting users upload videos to YouTube and paste the link. FitSphere
would store no video at all — **near-zero storage and streaming cost**. Facts checked
2026-10-27 (secondary source; confirm on YouTube Help):

| YouTube setting | Who can watch | Play inside FitSphere? | Fit |
|---|---|---|---|
| Private | Only Google accounts the uploader invites (about 50 per video), signed in | **No** — private videos can't be embedded | Poor: coach must be invited by email and watch in YouTube |
| Unlisted | **Anyone who has the link**; can be forwarded | Yes, if embedding is allowed | Works, but weak privacy |

Assessment:
- **Good fit for non-personal content**, e.g. exercise how-to videos made by coaches
  (REQ-TRN-001). These are not personal health data; unlisted or public YouTube links are a
  cheap, sensible choice there.
- **Risky for trainees' personal videos** (body, progress, workout form): an unlisted link
  works for anyone it reaches; FitSphere cannot delete the video when an account is deleted
  or a link ends (D-10); the video sits on the user's own Google account outside our
  control; and DPDP consent and deletion duties (Q-049) are hard to meet. Use only if Legal
  agrees and users are clearly told.
- FitSphere would only store and play links; uploading to YouTube from the app (via
  YouTube's API) would add quotas, Google sign-in and API terms — evaluate in ADR-0008.
Final choice is made in **ADR-0008**, based on the future requirements.

## Consequences and accepted trade-offs
- Easier: testing permission rules; moving providers; one language end to end.
- Media storage can be switched to a cheaper provider later without app changes (rule 4).
- Harder: more code than a database-only backend; the API must be deployed and monitored.
- Accepted: the free Supabase project pauses when idle and has no backups — fine for
  development only. **Before any real user data, move to Supabase Pro** (first recurring
  server cost) or set up separate backups.
- Accepted: dependence on Supabase Auth until stage 3.

## Validation plan
In the first implementation slice:
1. Create the Supabase project in Mumbai; sign up, verify email, sign in, reset password.
2. Deploy a minimal API to Cloud Run (Mumbai); measure cold-start time from an Android phone.
3. Write the first authorization tests: a coach cannot read another coach's trainee.
Record results here.

## Revisit conditions
- Monthly active users approach 100,000 (sign-in pricing changes).
- Database approaches 80% of the plan's size.
- Cloud Run cold starts are noticeably slow for users.
- Legal advice (Q-049) requires a specific hosting setup.
- Supabase or Google Cloud pricing changes materially.

## New open questions
Recorded in [`constraints-and-assumptions.md`](../constraints-and-assumptions.md#hosting-and-media).
- **Q-087:** Does the Cloud Run free tier need a billing account/card? If so, set a
  budget alert (e.g. ₹500/month) before deploying.
- **Q-088:** Backups before Pro: is "no real users on the Free plan" acceptable, or do we
  need our own scheduled database export?
- **Q-089:** Media retention: how long to keep original photos, audio and (future) videos,
  and whether to keep only a small copy after a period? 1 GB free storage fills quickly.
- **Q-090:** Future audio/video limits: maximum recording length, video length and
  resolution, and per-user storage quota (possibly tied to future premium plans).
- **Q-091:** Can media be stored outside India (cheaper providers), or must it stay in
  India? (Legal, links to Q-049.)
- **Q-092:** Which videos may use YouTube links: coach how-to videos only, or also
  trainees' personal videos? (Project owner + Legal.)

## References (checked 2026-10-27)
- Supabase pricing: https://supabase.com/pricing
- Supabase regions (South Asia — Mumbai): https://supabase.com/docs/guides/platform/regions
- Cloud Run pricing and free tier: https://cloud.google.com/run/pricing
- Render free tier: https://render.com/docs/free
- Cloudflare R2 pricing (secondary source): https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/ — confirm on Cloudflare's site
- Backblaze B2 pricing: https://backblaze.com/cloud-storage/pricing
- YouTube private vs unlisted (secondary source): https://swarmify.com/blog/youtube-unlisted-vs-private/ — confirm on YouTube Help
- Firebase Cloud Functions requires Blaze: https://firebase.google.com/docs/functions/faq-and-troubleshooting
- Firebase Spark quota change (secondary, unverified): https://rohitraj.tech/en/notes/supabase-vs-firebase-india-mvp-2026
- Project: owner-decisions-2026-10-27.md (D-01, D-03, D-09, D-15), ADR-0001, project invariants