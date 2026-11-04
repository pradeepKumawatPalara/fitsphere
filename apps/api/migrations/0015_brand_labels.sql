-- Brand labels in the food list (D-49; REQ-LOG-007; docs/data/brand-labels-sheet.csv): packaged
-- Indian foods with the values their brands publish, each read from the brand's own page and approved
-- by the owner, as source `brand_label` (ADR-0006 rule 1: the source recorded per item), with their
-- serving in app.food_portions. A label may give no dietary fibre: unknown is kept as null, not 0,
-- for a brand label only.
alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check check (source in ('ifct2017', 'indb', 'brand_label'));

alter table app.foods alter column fibre_g drop not null;
alter table app.foods add constraint foods_fibre_known check (fibre_g is not null or source = 'brand_label');
