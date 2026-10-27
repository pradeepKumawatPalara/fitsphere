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
| ADR-0002 | [Backend architecture and hosting](ADR-0002-backend-and-hosting.md) (backend language/runtime and hosting model; media storage rules) — recommended: own TypeScript Node.js API with Supabase (PostgreSQL, file storage) in Mumbai on the Free plan in phase 1 (D-16), API on Google Cloud Run; sign-in provider decided in ADR-0004 | Proposed | Q-041, Q-049, Q-050, Q-053, Q-055, Q-064, Q-082, Q-083, Q-087, Q-088, Q-089, Q-092 |
| ADR-0003 | [Primary database](ADR-0003-primary-database.md) (and data-residency approach) — recommended: PostgreSQL managed by Supabase in Mumbai | Proposed | Q-010, Q-014, Q-018, Q-030, Q-048, Q-049, Q-053, Q-055, Q-064, Q-072, Q-088, Q-089, REQ-NFR-004 |
| ADR-0004 | Authentication and role/hierarchy authorization model, including the sign-in provider (D-16) | Missing | Q-006, Q-007, Q-008, Q-009, Q-010, Q-021, Q-047, Q-053, Q-058, Q-059, Q-070, Q-075, Q-078, Q-079, Q-082, Q-085, C-002 |
| ADR-0005 | AI meal-parsing provider and consent enforcement | Missing | Q-038, Q-040, Q-049, Q-053, Q-063, Q-065, C-004, C-005 |
| ADR-0006 | Food database, barcode and (if any) health-data integrations | Missing | Q-015, Q-039, Q-049, Q-053, Q-063 |
| ADR-0007 | Offline storage, sync and conflict resolution (D-04); decided inputs below | Missing | Q-055, Q-075, Q-077, REQ-NFR-004 |
| ADR-0008 | Media storage (audio/video release) — planned slot named in ADR-0002; audio and video are future scope | Missing | Q-049, Q-089, Q-090, Q-091, Q-092 |

Recommended order: ADR-0001 → 0002 → 0003 → 0004, then 0007 before offline logging is built,
0005/0006 before the features that need them, and 0008 before the audio/video release. Each is
drafted as **Proposed** and accepted only by the decision owner.

ADR-0002 and ADR-0003 were drafted together on 2026-10-27 and are **Proposed**: neither is
accepted, and no backend, database or hosting choice is approved until the owner accepts them.

ADR-0001 was accepted while Q-020, Q-052, Q-068 and Q-083 were still open (D-12); the ADR says
how each is handled. Its validation checks run in the first slices.

## Inputs already decided
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
  days without a sync (REQ-NFR-006).
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
