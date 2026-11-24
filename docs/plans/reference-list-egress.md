# Reference lists: answer "no change" without reading them (plan)

- Status: **Accepted**. The owner chose Option 3 in chat on 2026-11-24 ("go with option 3, write the
  plan doc"), then "go ahead, build it". Built on branch `fix/reference-list-egress`.
- Owner: Project owner (D-01)
- Last updated: 2026-11-24
- Decision: D-126 (proposed as D-122 and migration 0037; both numbers were taken on `main` meanwhile, by
  Speak your meal's estimate and onboarding)
- Builds on: the food list kept on the phone for search offline (ADR-0006 rule 1, D-28), the exercise
  list (D-50), sync (ADR-0007), the API as the only path to the data (ADR-0002); the Free plan's
  monthly egress and its review trigger (R-005, C-008)
- Requirements: the routes' own, unchanged for the phone (`GET /v1/foods`: REQ-LOG-007, REQ-ACC-005;
  `GET /v1/exercises`: REQ-TRN-003); free tiers first (REQ-NFR-003, C-008)
- Server: one migration (`0038_reference_lists.sql`) and the two list routes. Phone: no change, no
  schema change, no new build. Contracts: both routes' query and responses unchanged.

## What was found (2026-11-24)
- **Egress:** 11 GB in a month on the Supabase Free plan, all through the shared pooler. The plan's
  limit is 5 GB, and R-005 asks the owner to review Supabase Pro once egress goes over 4 GB.
- **What `pg_stat_statements` shows:** each of the lists' full-table queries ran about 1,600 to 2,400
  times. Rows returned per call: `food_portions` 26,300, `packaged_food_portions` 15,540,
  `packaged_foods` 9,729, `foods` 9,371, `exercises` 2,119, `exercise_details` 2,019,
  `exercise_speed_mets` 87.
- **The cause:** `GET /v1/foods` reads six tables whole and `GET /v1/exercises` three, to compute the
  list's version, a hash of every row (`apps/api/src/routes/foods.ts`, `exercises.ts`). Only then does
  the route compare that version with the one the phone holds. A phone that is current gets
  `items: null`, but the API has already read about 5.5 MB from the database. That figure is an
  estimate: 11 GB ÷ about 2,000 calls.
- **How often the phone asks:** for both lists after every sync that reaches the server
  (`apps/mobile/src/sync/SyncProvider.tsx`). The phone syncs when the app starts, when it returns to
  the foreground, when its connection comes back, and after every save. With Health Connect, a
  foreground often syncs twice: its import saves the day's steps while the first sync is still running.
- **No help from memory:** nothing on the server keeps the lists in memory. Cloud Run runs with
  `--min-instances 0 --max-instances 2`, and the PC API restarts on every file save (`node --watch`).
- **Who writes these tables:** only `foods:import` and `exercises:import`, plus migration 0013 once.
  The roughly 25 runs of `delete from app.packaged_foods` and `app.usda_foods` are the owner's
  `foods:import` runs. Those writes are not the egress.

## Options considered
| Option | Why not chosen |
|---|---|
| 1. Keep the lists in the API's memory for a time | Every cold start and every PC restart is still a full read; an import shows only after the time runs out. Likely several GB a month still |
| 2. The import scripts write a version row | A change made outside the scripts (a migration, an edit in the dashboard) leaves the version stale, and phones silently keep old data |
| **3. A version kept by triggers, stored in the database (chosen)** | |
| 4. The phone checks the lists less often | Needs a new APK (there are no over-the-air updates), and the server still reads everything on each call. Kept as a follow-up |
| 5. Publish the lists as a file | Changes ADR-0002, raises Legal's questions on the food data (R-007, R-009, L-13), and needs a phone change and a new build |
| The database computes the hash itself | Every sync would scan about 70,000 rows on the Free plan's small database |
| Supabase Pro | Not approved (C-008), and it would pay for waste |

## How it works
### The database (`0038_reference_lists.sql`)
- **The table `app.reference_lists`:** `name` (`foods` or `exercises`, primary key), `generation`
  (bigint, from 1) and `version` (text; null until the API has computed it). The migration inserts the
  two rows.
- **The trigger function `app.reference_list_changed()`:** adds 1 to the generation of the list named
  in its argument and sets that list's version to null.
- **Triggers:** statement-level, after insert, update, delete or truncate.
  - `foods`: `app.foods`, `app.dishes`, `app.food_measures`, `app.food_portions`,
    `app.packaged_foods` and `app.packaged_food_portions`, the six tables `GET /v1/foods` reads.
  - `exercises`: `app.exercises`, `app.exercise_speed_mets` and `app.exercise_details`.
  - None on `usda_foods`, `usda_food_portions` or `food_portion_history`: the phone never receives
    them.
- **The effect:** any change marks the list as changed: `foods:import`, `exercises:import`, a
  migration, or an edit in the dashboard. The import scripts do not change.

### The API (both routes, one shared helper)
A new helper, `apps/api/src/routes/referenceList.ts`, serves both routes. `foods.ts` and `exercises.ts`
each keep their SQL, their body and their hash in a build function. For each request:

1. **Read the list's row:** `select generation, version from app.reference_lists where name = $1`.
   One row, well under 100 bytes.
2. **The stored version equals the phone's:** answer `items: null` (and `dishes` and `packaged` null
   for the food list) with no other query. This is nearly every call.
3. **Otherwise, get the list for that generation.** It comes from the API's memory when held there;
   if not, it is built once:
   - **One moment in time:** the build runs in a single read-only, repeatable-read transaction, so the
     generation and the rows come from the same moment. Inside it: the generation again, then
     today's queries, unchanged.
   - **The version:** today's hash, unchanged. A phone that is current now stays current after the
     deploy and downloads nothing.
   - **Kept in memory:** the body, as JSON and gzipped, together with its generation. That is about
     7 MB for the food list, one copy per list, replaced at the next generation.
   - **One build at a time:** requests that arrive during a build wait for it, so there is one build,
     not one per request.
   - **Written back:** `update app.reference_lists set version = $1 where name = $2 and
     generation = $3`, so the version is stored only if nothing changed meanwhile.
     - It runs in its own short transaction with a lock timeout of 2 seconds, because an import holds
       the row until it commits.
     - It runs after the reply. A failure is ignored; the next request tries again.
   - **Logged:** one line per build, giving the list, its generation and the time taken. Never any
     values.
4. **Answer:** if the phone's version equals the built one, `items: null`. Otherwise the body, gzipped
   when the phone accepts gzip (`sendLargeJson`), as today.

### What it costs afterwards (an estimate)
- **Each sync:** two one-row reads, a few hundred bytes.
- **Full reads:** once after each change of a list, when the first request computes and stores the
  version. A second Cloud Run instance builds once more only if it serves a phone that is behind. A
  cold start reads nothing whole while the phones are current.
- **In total:** about 25 imports a month × at most two builds × about 5.5 MB ≈ **0.1 to 0.3 GB a
  month**, down from about 11 GB.

## Unchanged
- **The routes:** `GET /v1/foods` and `GET /v1/exercises` keep the same query, the same responses and
  the same versions (api-conventions).
- **The phone:** its schema, its search offline (ADR-0006 rule 1, invariant #4) and its sync
  (ADR-0007). No new build.
- **The import scripts:** `foods:import` and `exercises:import` are unchanged; each run now also moves
  the generation.
- **A sync during an import:** a phone that syncs while an import is part-way can get a part-changed
  list, and gets the whole one at its next sync, as now.
- **Authorization:** the routes stay "signed in, with an account". The new table holds no user data.

## Documents
- `docs/contracts/data-model.md`: a new section, `reference_lists` (reference data).
- `docs/contracts/api-conventions.md`: one line under each list route. The version is kept in
  `app.reference_lists`, and the list is read only after it changes; responses are unchanged.
- `docs/operations/runbook.md`: the rollout order, `check:pooler`'s new checks, and the check with
  `pg_stat_statements`.
- `docs/architecture/constraints-and-assumptions.md`: under R-005, that egress reached 11 GB (over the
  4 GB trigger) from this cause, and that D-126 fixes it.
- `docs/product/owner-decisions-2026-10-27.md`: D-126. CLAUDE.md: the Current phase entry.

## Tests
- **Integration** (local PostgreSQL, a new `reference-lists.test.ts`). The foods, exercises and
  food-units tests keep passing. The new tests:
  - **The migration:** both rows exist. An insert, update, delete and truncate on each of the nine
    tables moves that list's generation and clears its version, and leaves the other list's alone.
    `usda_foods` and `food_portion_history` move nothing.
  - **Every table has its trigger:** each table the builds read has one, read from the database's
    catalogue. A table added to a list later without a trigger fails this test.
  - **A current phone:** gets `null` with only the one small query, counted by a wrapper around the
    pool.
  - **After an import:** one build, and the version is written back. A new app with empty memory, as
    after a cold start, then answers a current phone with only the small query.
  - **A change by plain SQL** (a food's kcal): a new version and the new value.
  - **The same import twice:** a new generation but the same version; a current phone still gets
    `null`.
  - **Two requests at once:** one build.
  - **The generation moves during a build:** no write-back.
  - **Gzipped and plain bodies:** the same list.
- **Unit:**
  - The helper's memory and its one build at a time, with a fake database.
  - Phones keep their versions: the version of a fixed set of rows equals the value today's code
    gives.
- **`check:pooler`:** the read-only, repeatable-read transaction and the version read go through the
  transaction pooler; the write-back's form is tried inside a transaction that is rolled back.
- **Phone:** none, since nothing on the phone changes.
- **Every check:** lint, type-check, unit and integration.

## Rollout (only when the owner says so)
1. **Before:** note the calls of the lists' queries in `pg_stat_statements` in the Supabase SQL
   editor, or reset them with `select pg_stat_statements_reset();` (the owner's choice):
   ```sql
   select calls, rows, left(query, 70) as query
   from pg_stat_statements
   where query ~ 'app\.(foods|dishes|food_measures|food_portions|packaged_food|exercise|reference_lists)'
   order by calls desc;
   ```
2. **Migrate:** `npm run migrate -w @fitsphere/api` on `fitsphere-dev` (0038). The old API keeps
   working after it.
3. **Deploy:** the API to Cloud Run (runbook, "The API on Cloud Run", step 6), then restart the PC API.
   The new API needs 0038 first: without the table, both routes fail.
4. **After 2 to 3 days:**
   - The full-table queries' calls grow by about the number of builds (the API's build log lines).
   - The small select's calls grow by about the number of syncs.
   - Daily egress on the Supabase usage page falls.

## Built (2026-11-24)
- **Files:** `apps/api/migrations/0038_reference_lists.sql`; `apps/api/src/routes/referenceList.ts` (the
  helper); `foods.ts` and `exercises.ts` (their reads as `buildFoodList` and `buildExerciseList`, their
  hashes as `foodListVersion` and `exerciseListVersion`, the fields in a fixed order); `largeJson.ts`
  (`packJson` packs a body once, `sendLargeJson` sends the packed bytes); `scripts/check-pooler.ts`.
- **Beyond the plan:** no write-back when the version stored at the read is already the one read.
- **Tests:** `src/routes/referenceList.test.ts` and `listVersions.test.ts` (unit),
  `test/integration/reference-lists.test.ts`; `schema.test.ts` lists the new table. The list of
  migrations in `migrate.test.ts` stopped at 0034 on `main` (0035 to 0037 came from other branches, and
  CI on `main` failed on it): it now runs to 0038.

## Risks
- **A table without its trigger:** a table added to a list later without one would leave phones
  missing its changes. The catalogue test fails first.
- **Builds still cost:** each build reads about 5.5 MB, so many imports in a day each cost a build per
  instance.
- **Memory:** about 7 MB per instance for the food list; Cloud Run gives each instance 512 MiB.
- **A write-back during an import:** the import holds the list's row until it commits. A write-back
  waits at most 2 seconds, then gives up, and the reply never waits for it.
- **This month's egress:** it is already over R-005's 4 GB trigger, so the owner's review stands. The
  fix removes the cause, not this month's usage.
- **The beta's Cloud Run API needs the deploy** before beta phones stop costing full reads. Phones need
  nothing.

## Follow-up (not in this plan)
- **Option 4:** the phone checks the lists when the app starts, then at most every few hours, not
  after every sync, and once per sync loop. That means fewer API calls and less battery use. It goes
  with the next planned APK (D-19) and will be proposed separately.
- **Option 5,** if the lists or the users grow a lot: the lists as files. It needs an ADR change and
  Legal's review.
