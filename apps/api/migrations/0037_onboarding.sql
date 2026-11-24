-- First sign-in onboarding (D-124, docs/plans/onboarding.md, REQ-ACC-013).
-- `onboarded_at` is when the user finished the welcome flow, null until then. Every account that exists
-- when this runs has already been using the app, so each is marked finished now and never sees the flow;
-- only an account made after this migration starts with null. The API sets it once (it never clears it).
-- The Coach application's shared tables are not touched: this adds one nullable column to app.users.

alter table app.users add column onboarded_at timestamptz;

update app.users set onboarded_at = now() where onboarded_at is null;
