// npm run foods:import -w @fitsphere/api: loads data/foods/ifct2017-foods.csv into app.foods, and the
// approved dishes of docs/data/standard-recipe-sheet.csv into app.dishes, on DATABASE_URL (ADR-0006
// rule 1; D-28; docs/data/food-list-sources.md). Checks both files whole first and imports nothing
// if any row is wrong. Running it again gives the same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readRecipeSheet } from '../src/foods/dishes.ts';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { importDishes, importFoods } from '../src/foods/importFoods.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const foods = readIfctCsv(readFileSync(path.join(root, 'data/foods/ifct2017-foods.csv'), 'utf8'));
const sheet = readRecipeSheet(readFileSync(path.join(root, 'docs/data/standard-recipe-sheet.csv'), 'utf8'), foods);

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
} finally {
  await client.end();
}
