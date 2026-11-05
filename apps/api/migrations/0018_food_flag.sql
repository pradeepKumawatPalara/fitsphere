-- A mark on a food-list row kept on the server only (D-52): `scrap` on the brand labels collected from
-- the web (brands' own sites, shops' listings of the product and the owner's files made with another
-- AI tool) and approved by the owner on 2026-11-06; empty for every other food. GET /v1/foods never
-- sends it to the phone, and nothing reads it yet: the owner decides its use later.
alter table app.foods add column flag text;
alter table app.foods add constraint foods_flag_check check (flag is null or flag in ('scrap'));
