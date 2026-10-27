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
| ADR-0001 | [Mobile client framework](ADR-0001-mobile-client-framework.md) (native iOS/Android vs cross-platform e.g. Flutter / React Native vs web/PWA) | Proposed | Q-020, Q-051, Q-052, Q-053, Q-055, Q-068, Q-076, A-001, C-007, REQ-NFR-004 |
| ADR-0002 | Backend language/runtime and hosting model | Missing | Q-049, Q-050, Q-053, Q-055 |
| ADR-0003 | Primary database and data-residency approach | Missing | Q-010, Q-014, Q-018, Q-030, Q-048, Q-049, Q-053, Q-055, Q-064, Q-072, REQ-NFR-004 |
| ADR-0004 | Authentication and role/hierarchy authorization model | Missing | Q-006, Q-007, Q-008, Q-009, Q-010, Q-021, Q-047, Q-053, Q-058, Q-059, Q-070, Q-075, Q-078, Q-079, C-002 |
| ADR-0005 | AI meal-parsing provider and consent enforcement | Missing | Q-038, Q-040, Q-049, Q-053, Q-063, Q-065, C-004, C-005 |
| ADR-0006 | Food database, barcode and (if any) health-data integrations | Missing | Q-015, Q-039, Q-049, Q-053, Q-063 |
| ADR-0007 | Offline storage, sync and conflict resolution (D-04); decided inputs below | Missing | Q-055, Q-075, Q-077, REQ-NFR-004 |

Recommended order: ADR-0001 → 0002 → 0003 → 0004, then 0007 before offline logging is built
and 0005/0006 before the features that need them. Each is drafted as **Proposed** and accepted
only by the decision owner.

## Inputs already decided
- **ADR-0007** (D-10): every change queued offline is re-authorized on the server at sync time;
  health data stored on the device is encrypted. See threat model items T-02 and T-03.
