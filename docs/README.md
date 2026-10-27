# Documentation Index

Owner of this index: Project owner (D-01)
Last updated: 2026-10-27

## Status definitions
- **Missing** — not written yet.
- **Draft** — written, not reviewed. May contain gaps; open questions are listed.
- **In Review** — circulated for comment.
- **Accepted** — approved by its owner; changes need a recorded update.

## Documents

| # | Document | Status | Owner | Purpose |
|--:|---|---|---|---|
| 1 | [`CLAUDE.md`](../CLAUDE.md) | Draft | Project owner | Claude Code entry point |
| 2 | `docs/README.md` (this file) | Draft | Project owner | Index |
| 3 | [`product/product-brief.md`](product/product-brief.md) | Draft | Project owner | Problem, users, scope, non-goals |
| 3a | [`product/glossary.md`](product/glossary.md) | Draft | Project owner | Terms the documents use inconsistently or leave undefined |
| 3b | [`product/owner-decisions-2026-10-27.md`](product/owner-decisions-2026-10-27.md) | Accepted | Project owner | Owner answers to open questions (D-01 to D-18) and follow-ups |
| 3c | [`product/mvp-scope.md`](product/mvp-scope.md) | Accepted | Project owner | What the MVP includes, what is post-MVP, and MVP defaults for open questions (D-18) |
| 3d | [`product/backlog.md`](product/backlog.md) | Draft | Project owner | Post-MVP items and deferred edge cases (D-18) |
| 4 | [`product/requirements.md`](product/requirements.md) | Draft | Project owner | Testable REQ IDs |
| 5 | [`architecture/constraints-and-assumptions.md`](architecture/constraints-and-assumptions.md) | Draft | Project owner | Constraints, assumptions, open questions |
| 6a | [`product/user-journeys.md`](product/user-journeys.md) | Draft | Project owner | Actor journeys |
| 6b | [`../flow.md`](../flow.md) | Draft | Project owner | High-level flows |
| 7 | [`architecture/system-context.md`](architecture/system-context.md) | Draft | Project owner | System boundary, externals, trust boundaries |
| 8 | [`security/data-and-threat-model.md`](security/data-and-threat-model.md) | Draft | Project owner | Data categories, threats, controls |
| 9 | [`architecture/decisions/`](architecture/decisions/README.md) | Draft | Project owner | ADR index and template; ADR-0001 is Accepted (D-12), ADR-0002 and 0003 are Accepted (D-17), ADR-0004 to 0007 are Accepted (D-18), ADR-0008 is a planned slot |
| 10 | `contracts/` | Missing | Project owner | Data, API, error, integration contracts |
| 11 | `quality/test-strategy.md`, `definition-of-done.md` | Missing | Project owner | Verification |
| 12 | [`operations/runbook.md`](operations/runbook.md) | Draft | Project owner | Setup, deploy, recovery; only the paused-project step is written (D-16) |

## Inputs (read-only)
- [`product/source/business-requirements.txt`](product/source/business-requirements.txt) — original BRD.
  `requirements.md` is derived from it and is now the authoritative version.
- [`pre-development-guide.md`](pre-development-guide.md) — the process this repository follows.

## Owners
The project owner (sole developer) owns and approves every document. Legal compliance has a
separate owner, Legal, because it cannot be self-certified (D-01).
