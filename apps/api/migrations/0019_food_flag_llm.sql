-- A second value for the server-only flag on a food-list row (D-53): `llm` on the brand labels whose
-- values an AI tool estimated from its general knowledge, not read from any label, approved by the
-- owner on 2026-11-06. Like `scrap` (D-52), it is never sent to the phone and nothing reads it yet.
alter table app.foods drop constraint foods_flag_check;
alter table app.foods add constraint foods_flag_check check (flag is null or flag in ('scrap', 'llm'));
