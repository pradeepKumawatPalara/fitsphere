-- The exercise library (D-67; docs/plans/exercise-library.md): the owner's file of 2,090 gym and
-- fitness exercises, by category and sub-group, joins FitSphere's exercise list. Each exercise keeps
-- every category and sub-group the library lists it under, so the phone's exercise sheet can narrow
-- the search by them. An exercise listed in two places (Push Press under Barbell › Shoulders and
-- Olympic Weightlifting › Jerk Family) is one exercise with two places; most of FitSphere's own
-- exercises have none.

-- Each place is {"category": "Barbell", "subGroup": "Chest"}, subGroup null for a category with no
-- sub-groups. Loaded from docs/data/exercise-library-sheet.csv by `npm run exercises:import`.
alter table app.exercises
  add column places jsonb not null default '[]'::jsonb check (jsonb_typeof(places) = 'array');
