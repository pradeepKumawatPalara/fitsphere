# Backlog

- Status: Draft
- Owner: Project owner (D-01)
- Last updated: 2026-10-27

Work that is **not** in the MVP (D-18, [`mvp-scope.md`](mvp-scope.md)). Nothing here is built
until the owner moves it into a release. MVP defaults chosen under D-18 are listed in
[`constraints-and-assumptions.md`](../architecture/constraints-and-assumptions.md#mvp-defaults-d-18),
not here. D- numbers refer to [`owner-decisions-2026-10-27.md`](owner-decisions-2026-10-27.md).

## Post-MVP features
From `mvp-scope.md` section 3, plus items the D-18 answers moved out of the MVP.

| ID | Item | Affects | Notes |
|---|---|---|---|
| B-01 | iOS release | A-001, ADR-0001, C-008 | Waits for an iPhone (D-10, R-001); Apple fee due at release |
| B-02 | "Pre" baseline row and week-details screen in Progress | REQ-PRG-005 | Q-045, Q-046 |
| B-03 | "Eaten before" list in Log meal | REQ-LOG-007 | Saved covers re-logging in the MVP |
| B-04 | Examples section in Log meal (Best, Vague, Say) | REQ-LOG-008 | The tips stay in the MVP |
| B-05 | Audio storage | REQ-LOG-005, ADR-0008, Q-090 | The MVP stores no audio |
| B-06 | Video uploads (other than YouTube links) | REQ-NFR-006, ADR-0008, Q-090, Q-091 | |
| B-07 | Premium plans | REQ-ROLE-001, D-06 | Need payments, a proposed non-goal (Q-003) |
| B-08 | Platform Admin role and admin screens | REQ-NFR-005, D-13, Q-086 | The MVP uses owner-only, logged admin commands (ADR-0004) |
| B-09 | Multiple time zones; users outside India | REQ-ACC-006, REQ-DATE-004, D-09 | |
| B-10 | Other invitation channels (SMS, WhatsApp) | REQ-ROLE-008, D-11 | |
| B-11 | Backups and Supabase Pro | R-005, C-008, ADR-0002, ADR-0003 | Reviewed when an R-005 trigger fires (D-16) |
| B-12 | Better handling when a Coach and a Head Coach edit the same plan or target | REQ-ROLE-004, REQ-ROLE-006, Q-075, ADR-0007 | In the MVP the change the server receives last wins |
| B-13 | Web dashboard for coaches | Q-068, A-001, ADR-0001 revisit condition | D-18 |
| B-14 | Health-platform sync for steps and sleep | REQ-HOME-006, Q-015, ADR-0006 | Steps and sleep are typed in for the MVP. Proposed non-goal (Q-003) |
| B-15 | Voice entry on phones that cannot recognise speech on the device | REQ-LOG-005, ADR-0005 | D-18 allows on-device recognition only. Anything else needs the owner (invariant #3) |

## Deferred edge cases
Found while applying D-18. The MVP behaviour applies until an item is picked up.

| ID | Edge case | Source | MVP behaviour until then |
|---|---|---|---|
| E-01 | Asking for the password again before an account is deleted | REQ-ACC-009 | A confirmation step only |
| E-02 | A coach or Head Coach deletes their account: what the "Set by <name>" label shows on plans and targets they set | REQ-ACC-009, REQ-PLAN-001 | The trainee keeps the plans and targets; the label no longer shows the deleted person's name |
| E-03 | Turning off a role that still has active links | REQ-ROLE-001 | The role cannot be turned off until those links have ended |
| E-04 | A wrong or changed phone clock (the 30-day clear, "today") | ADR-0007 | The phone's clock is used, read in Asia/Kolkata |
| E-05 | After a link ends, the old weekly workout, body-weight and steps targets stay read-only, because a user without a coach sets only calorie and protein targets (Q-016) | REQ-ROLE-007, Q-060 | They stay as the former coach left them |
