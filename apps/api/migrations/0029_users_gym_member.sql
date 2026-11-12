-- Gym members (D-90): whether the user is a member of a gym. The Coach view, built by another team
-- on this same database, uses app.users too and needs it; this repository keeps the one record of
-- the schema, so the column is added here at that team's request.
--
-- Not null and false for every account, those already here and those made from now on, until
-- something sets it. Nothing in this repository reads or writes it yet: GET /v1/me does not send
-- it, sync does not take it, and the phone neither shows nor stores it. Account data (threat model,
-- "Assets"), deleted with the account (REQ-ACC-009).
alter table app.users add column is_gym_member boolean not null default false;
