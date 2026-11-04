// npm run foods:import -w @fitsphere/api: loads data/foods/ifct2017-foods.csv and USDA's
// data/foods/usda-fndds-foods.csv (with usda-fndds-portions.csv) into app.foods and
// app.food_portions, the approved dishes of docs/data/standard-recipe-sheet.csv into app.dishes, and
// the approved units of docs/data/household-measures-sheet.csv into app.food_measures, on
// DATABASE_URL (ADR-0006 rule 1; D-28; D-36; D-39; docs/data/food-list-sources.md). Checks every file whole first and imports nothing if
// any row is wrong. Running it again gives the same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readRecipeSheet } from '../src/foods/dishes.ts';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { importDishes, importFoods, importMeasures, importPortions } from '../src/foods/importFoods.ts';
import { readMeasuresSheet } from '../src/foods/measures.ts';
import { readUsdaCsv, USDA_SOURCE } from '../src/foods/usda.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const foods = readIfctCsv(readFileSync(path.join(root, 'data/foods/ifct2017-foods.csv'), 'utf8'));
const sheet = readRecipeSheet(readFileSync(path.join(root, 'docs/data/standard-recipe-sheet.csv'), 'utf8'), foods);
const measures = readMeasuresSheet(readFileSync(path.join(root, 'docs/data/household-measures-sheet.csv'), 'utf8'), foods);
const usda = readUsdaCsv(
  readFileSync(path.join(root, 'data/foods/usda-fndds-foods.csv'), 'utf8'),
  readFileSync(path.join(root, 'data/foods/usda-fndds-portions.csv'), 'utf8'),
);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const result = await importFoods(client, foods);
  console.log(
    `Imported ${result.total} foods: ${result.hidden} hidden until checked, ${result.estimated} with estimated kcal.`,
  );
  const dishes = await importDishes(client, sheet.dishes);
  console.log(
    `Imported ${dishes} approved dishes. Not imported: ${sheet.pending.length} pending, ${sheet.blocked.length} blocked (${sheet.blocked.join(', ') || 'none'}).`,
  );
  const units = await importMeasures(client, measures.measures);
  console.log(`Imported ${units} approved household units. Not imported: ${measures.pending} pending.`);
  const usdaFoods = await importFoods(client, usda.foods, USDA_SOURCE);
  const servings = await importPortions(client, USDA_SOURCE, usda.portions);
  console.log(`Imported ${usdaFoods.total} USDA foods with ${servings} servings.`);
} finally {
  await client.end();
}
