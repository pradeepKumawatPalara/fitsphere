-- Home-style foods in the food list (D-59; REQ-LOG-007; docs/data/home-foods-sheet.csv): everyday
-- forms of daily foods as eaten at home (a bread slice, butter toast, bread omelette), with typical
-- values an AI tool estimated from its general knowledge, approved by the owner, as source `home`
-- (ADR-0006 rule 1: the source recorded per item), flagged `llm` (app.foods.flag, D-53), with their
-- serving in app.food_portions. A row may give no dietary fibre: unknown is kept as null, not 0, as
-- for a brand label.
alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check check (source in ('ifct2017', 'indb', 'brand_label', 'home'));

alter table app.foods drop constraint foods_fibre_known;
alter table app.foods add constraint foods_fibre_known check (fibre_g is not null or source in ('brand_label', 'home'));
