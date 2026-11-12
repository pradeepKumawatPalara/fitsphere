-- Other names for packaged foods (D-94): the owner's food database (Indian_Food_Database_CONSOLIDATED.xlsx,
-- kept outside the repository) gives some of Open Food Facts' products other names, such as a food's
-- names in Indian languages ("doodh dudh milk paal haalu" for a toned milk). Search foods finds a
-- product by them, as it finds the food list's foods by theirs (app.foods.aliases); they are never
-- shown. Loaded from docs/data/food-aliases-sheet.csv by `foods:import`, which replaces the table whole.
alter table app.packaged_foods
  add column aliases text[] not null default '{}';
