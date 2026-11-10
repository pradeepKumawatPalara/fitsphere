-- Estimated dishes in the food list (D-62; REQ-LOG-007; docs/data/dish-estimates-sheet.csv): Indian
-- dishes FitSphere did not list, from the owner's dish database, each with the typical values of its
-- type of dish (a dry sabzi, a dal, a pulao), not values measured for that dish, as source
-- `dish_estimate` (ADR-0006 rule 1: the source recorded per item), flagged `llm` (app.foods.flag,
-- D-53), with their serving in app.food_portions. Every row gives its fibre.
alter table app.foods drop constraint foods_source_check;
alter table app.foods add constraint foods_source_check
  check (source in ('ifct2017', 'indb', 'brand_label', 'home', 'dish_estimate'));
