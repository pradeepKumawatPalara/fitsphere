// npm run foods:import -w @fitsphere/api: loads data/foods/ifct2017-foods.csv into app.foods on
// DATABASE_URL (ADR-0006 rule 1; docs/data/food-list-sources.md). Checks the whole file first and
// imports nothing if any row is wrong. Running it again gives the same table.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { importFoods } from '../src/foods/importFoods.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const file = path.resolve(import.meta.dirname, '../../../data/foods/ifct2017-foods.csv');
const foods = readIfctCsv(readFileSync(file, 'utf8'));

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const result = await importFoods(client, foods);
  console.log(
    `Imported ${result.total} foods: ${result.hidden} hidden until checked, ${result.estimated} with estimated kcal.`,
  );
} finally {
  await client.end();
}
