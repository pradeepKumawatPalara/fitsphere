-- The Indian Nutrient Databank's recipes in the food list (D-46; REQ-LOG-011;
-- docs/data/food-list-sources.md): INDB joins IFCT 2017 and USDA's FNDDS (ADR-0006 rule 1: the
-- source recorded per item), each recipe with its one serving in app.food_portions, as USDA's foods.
-- Every INDB value is estimated: INDB computed it from the recipe's ingredients. No new table.
alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check check (source in ('ifct2017', 'usda_fndds', 'indb'));
