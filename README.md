# FitSphere

Coach-led fitness app: clients log food, body metrics and workouts against coach-set targets.

## Status
Building the first slice, the Skeleton ([`docs/plans/skeleton-slice.md`](docs/plans/skeleton-slice.md)):
an npm workspaces monorepo with the API in `apps/api` and shared code in `packages/shared`; the
Expo app comes in `apps/mobile`. The MVP comes first
([`docs/product/mvp-scope.md`](docs/product/mvp-scope.md), D-18). Approved stack (ADR-0001 to
ADR-0007): React Native with Expo; a TypeScript Node.js API; Supabase PostgreSQL, file storage and
sign-in in Mumbai; Gemini for AI meal reading; FitSphere's own food list plus Open Food Facts;
offline sync with Expo SQLite. Details and what is still open:
[`CLAUDE.md`](CLAUDE.md#current-phase).

## Where to start
- Claude Code instructions: [`CLAUDE.md`](CLAUDE.md)
- Documentation index: [`docs/README.md`](docs/README.md)
- Process guide this repo follows: [`docs/pre-development-guide.md`](docs/pre-development-guide.md)

## Setup
[`docs/operations/runbook.md`](docs/operations/runbook.md#local-setup): tools, the Supabase
development project, local `.env` files, and the commands to install, check and run the code.
