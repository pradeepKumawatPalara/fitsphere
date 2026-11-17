-- AI readings a user a day (D-108, ADR-0005 limits, ADR-0010): POST /v1/ai/meal-parse allows 15 a
-- user an Asia/Kolkata day (invariant #5). One row per user and day; the count is raised in one
-- statement only while under the limit, so two requests at once cannot both pass it, and lowered
-- again when a reading fails. Nothing of the meal text or the answer is kept. Not synced, never sent
-- to the phone. Account data, deleted with the user (REQ-ACC-009). 0031 is held for another branch.
create table app.ai_readings (
  user_id uuid not null references app.users (id) on delete cascade,
  day date not null,
  count integer not null check (count between 0 and 1000),
  primary key (user_id, day)
);

alter table app.ai_readings enable row level security;
