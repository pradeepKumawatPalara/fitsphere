# Architecture Decision Records

Statuses: **Proposed** · **Accepted** · **Rejected** · **Superseded**.
Accepted ADRs are historical records — never rewrite them; add a new ADR that supersedes.
Template: [`ADR-template.md`](ADR-template.md). Process: `docs/pre-development-guide.md` §6.

## Index

| ADR | Decision | Status | Depends on |
|---|---|---|---|
| ADR-0001 | Client platform and framework (native iOS/Android vs cross-platform e.g. Flutter / React Native vs web/PWA) | Not drafted | Q-051, Q-053, Q-055, C-007 |
| ADR-0002 | Backend language/runtime and hosting model | Not drafted | Q-053, Q-049 |
| ADR-0003 | Primary database and data-residency approach | Not drafted | Q-049, Q-055, Q-018 |
| ADR-0004 | Authentication and role/hierarchy authorization model | Not drafted | Q-006, Q-009, Q-047, C-002 |
| ADR-0005 | AI meal-parsing provider and consent enforcement | Not drafted | C-004, Q-038, Q-040, Q-049 |
| ADR-0006 | Food database, barcode and (if any) health-data integrations | Not drafted | Q-015, Q-039 |

Recommended order: ADR-0001 → 0002 → 0003 → 0004, then 0005/0006 before the features that
need them. Each is drafted as **Proposed** and accepted only by the decision owner.
