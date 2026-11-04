# Architecture Decision Records

Statuses: **Proposed** · **Accepted** · **Rejected** · **Superseded**. An ADR that has not been
written yet is listed as **Missing**, as defined in [`docs/README.md`](../../README.md#status-definitions).
Accepted ADRs are historical records — never rewrite them; add a new ADR that supersedes.
Template: [`ADR-template.md`](ADR-template.md). Process: `docs/pre-development-guide.md` §6.

## Index

This table is the single record of each ADR's dependencies. Each Q- item's **Blocks** column in
[`constraints-and-assumptions.md`](../constraints-and-assumptions.md) names the same ADRs.
Answered Q- items stay listed: they record what the decision rests on.

| ADR | Decision | Status | Depends on |
|---|---|---|---|
| ADR-0001 | [Mobile client framework](ADR-0001-mobile-client-framework.md) (native iOS/Android vs cross-platform e.g. Flutter / React Native vs web/PWA) — chosen: React Native with Expo | Accepted (D-12) | Q-020, Q-051, Q-052, Q-053, Q-055, Q-068, Q-076, Q-083, A-001, C-007, REQ-NFR-004 |
| ADR-0002 | [Backend architecture and hosting](ADR-0002-backend-and-hosting.md) (backend language/runtime and hosting model; media storage rules) — chosen: own TypeScript Node.js API with Supabase (PostgreSQL, file storage) in Mumbai on the Free plan in phase 1 (D-16), API on Google Cloud Run; sign-in provider decided in ADR-0004 | Accepted (D-17) | Q-041, Q-049, Q-050, Q-053, Q-055, Q-064, Q-082, Q-083, Q-087, Q-088, Q-089, Q-092 |
| ADR-0003 | [Primary database](ADR-0003-primary-database.md) (and data-residency approach) — chosen: PostgreSQL managed by Supabase in Mumbai | Accepted (D-17) | Q-010, Q-014, Q-018, Q-030, Q-048, Q-049, Q-053, Q-055, Q-064, Q-072, Q-088, Q-089, REQ-NFR-004 |
| ADR-0004 | [Accounts, sign-in, authorization and notifications](ADR-0004-accounts-auth-and-notifications.md) — chosen: Supabase Auth behind one access module in the Node API; email through Resend from a domain FitSphere owns; Expo push (FCM on Android); owner-only logged admin commands, no admin screens | Accepted (D-18) | Q-006, Q-007, Q-008, Q-009, Q-010, Q-021, Q-047, Q-048, Q-053, Q-058, Q-059, Q-066, Q-070, Q-073, Q-075, Q-078, Q-079, Q-080, Q-082, Q-083, Q-085, C-002, C-008 |
| ADR-0005 | [AI meal reading](ADR-0005-ai-meal-reading.md) and consent enforcement — chosen: Gemini 3.1 Flash-Lite on the paid tier, through one AI module; voice recognised on the phone only (D-18) | Accepted (D-18) | Q-038, Q-040, Q-049, Q-053, Q-062, Q-063, Q-064, Q-065, Q-087, C-004, C-005, C-008 |
| ADR-0006 | [Food data](ADR-0006-food-data.md): search, barcode and (if any) health-data integrations — chosen: FitSphere's own food list, cached on the phone, plus Open Food Facts for barcodes; no health-platform sync in the MVP | Accepted (D-18) | Q-015, Q-039, Q-049, Q-053, Q-063 |
| ADR-0007 | [Offline storage, sync and conflict resolution](ADR-0007-offline-storage-and-sync.md) (D-04) — chosen: Expo SQLite on the phone, an outbox and one sync endpoint in the Node API; decided inputs below | Accepted (D-18) | Q-030, Q-055, Q-059, Q-075, Q-077, REQ-NFR-004 |
| ADR-0008 | Media storage (audio/video release) — planned slot named in ADR-0002; audio and video are future scope | Missing | Q-049, Q-089, Q-090, Q-091, Q-092 |
| ADR-0009 | [Packaged food search](ADR-0009-packaged-food-search.md) — chosen: Open Food Facts' data export, its products sold in India, in their own table and on the phone, searchable by name and brand; amends ADR-0006 rule 2 | Accepted (D-48) | Q-049, C-005, C-008, D-47 |

Recommended order: ADR-0001 → 0002 → 0003 → 0004, then 0007 before offline logging is built,
0005/0006 before the features that need them, and 0008 before the audio/video release. Each is
drafted as **Proposed** and accepted only by the decision owner.

ADR-0002 and ADR-0003 were accepted together on 2026-10-27 (D-17). These were still open at
the time:
- ADR-0002: Q-049, Q-050, Q-082, Q-083 and Q-087;
- ADR-0003: Q-014, Q-030 and Q-048;
- both: Q-064 and Q-089, each partly answered.

Each ADR's "Open questions and how each is handled" table says how each is handled. Their
validation steps run in the first slice. Their revisit conditions include ADR-0007 finding no
workable offline-sync approach with PostgreSQL. The sign-in provider is not part of either
decision (ADR-0004).

ADR-0001 was accepted while Q-020, Q-052, Q-068 and Q-083 were still open (D-12); the ADR says
how each is handled. Its validation checks run in the first slices.

ADR-0004 to ADR-0007 were accepted together on 2026-10-27 under the owner's D-18 pre-approval.
Checking them against the requirements, invariants, threat model, D-01 to D-18 and ADR-0001 to
ADR-0003 found one conflict that touched privacy: in ADR-0005, the phone's speech service could
receive the voice before the server's consent check (invariant #3). The owner answered it before
acceptance (on-device recognition only), together with Q-059 (what a coach sees). Small
inconsistencies were fixed in the ADRs in the same change. These were still open at the time:
- ADR-0004: Q-049, Q-066 and whether sign-up must use the invited address (T-05). The owner
  answered Q-066 and T-05 later the same day (D-18 answers 12 and 13);
- ADR-0005: Q-040, Q-049 and Q-087;
- ADR-0006: the licence of the food-list source, and Q-049 (ODbL);
- ADR-0007: the encryption method on the phone, verified in the first slice.

Each ADR's open-questions table says how each is handled, and each ADR's validation steps run in
the first slices. ADR-0007 is a workable offline-sync approach with PostgreSQL, so the revisit
condition shared by ADR-0002 and ADR-0003 is not triggered.

## Inputs already decided
- **All ADRs** (D-18): build the MVP in [`mvp-scope.md`](../../product/mvp-scope.md) first. For
  an open question that does not block safety or privacy, pick the simplest option that keeps
  every invariant and record it as an MVP default; never weaken the invariants, owner decisions,
  privacy rules or accepted ADRs without the owner.
- **ADR-0002 and ADR-0003** (D-15): FitSphere aims to support up to 20 million users in the long
  term — an aspiration, not a proven capacity target. Phase 1 starts on free tiers (C-008). Each
  of these ADRs must explain how the chosen backend or database can grow toward that number
  without a rewrite, and what it would cost at each stage.
- **ADR-0002 and ADR-0003** (D-16):
  - Phase 1 runs on the Supabase Free plan with no backups (accepted risk R-005). Supabase Pro
    is a later stage, reviewed by the owner when an R-005 trigger is hit, and needs owner
    approval (C-008).
  - A capacity and cost model is required before stage 3 of the growth path; start it at
    250,000 monthly active users. No figures are invented for that stage.
  - Encryption at rest is a Must (REQ-NFR-002). Supabase's auto-generated Data API is switched
    off or denies all app tables, so the Node API is the only path to the data.
  - Media: view-only; photos stored as a compressed ~200 KB copy plus a thumbnail; voice audio
    deleted once transcribed; a user's own media never fully deleted while the account exists;
    media links have a short maximum expiry (T-08); external links allowed after a privacy
    warning (REQ-LOG-010, R-004, T-09).
  - Links are never deleted except as the delete-account flow decides (Q-048). API logs and
    monitoring exclude health data (invariant 7). AI consent is checked immediately before each
    AI call (invariant 3).
- **ADR-0004** (D-16): decides the sign-in provider; Supabase Auth is a candidate named in
  ADR-0002. It must verify neutral sign-up and reset messages with equal timing (REQ-ACC-010,
  T-01) and email from a sender domain with SPF, DKIM and DMARC (Q-082, D-13).
- **ADR-0007** (D-16): photos cached on the device follow the device rules — encrypted, deleted
  for a trainee on the next sync after the link ends, other people's photos cleared after 30
  days without a sync (REQ-NFR-006). When a user deletes their own photo, phones that cached it
  delete it on their next sync, so it is really removed (REQ-LOG-006).
- **ADR-0007** (D-10): every change queued offline is re-authorized on the server at sync time;
  health data stored on the device is encrypted. See threat model items T-02 and T-03.
- **ADR-0007** (D-13): when a link ends, the former coach's or Head Coach's app deletes that
  trainee's data from the device on its next sync. See threat model item T-06.
- **ADR-0007** (D-14, see REQ-NFR-004):
  - The server is the permanent record. No device rule ever deletes a user's full history; on
    sign-in, even years later, the app restores it from the server.
  - Encryption on the phone is invisible to the user: no extra passwords, no lost features,
    offline logging still works. If an encryption choice would break a feature, raise it as a
    question instead of applying it.
  - After 30 days without a sync, clear only unfinished drafts and other people's data copied
    onto a coach's or Head Coach's phone; cleared trainee data comes back on the next sync if
    the link is still active.
  - Never auto-delete the user's own entries waiting to sync; they stay until synced.
- **ADR-0007** (D-15): three days before an unfinished draft is cleared, the app shows a
  reminder: "You have an unfinished meal entry. It will be removed in 3 days."
