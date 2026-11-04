// npm run foods:import -w @fitsphere/api: loads data/foods/ifct2017-foods.csv and INDB's
// data/foods/indb-foods.csv (with indb-portions.csv) into app.foods and app.food_portions, the
// approved dishes of docs/data/standard-recipe-sheet.csv into app.dishes, and the approved units of
// docs/data/household-measures-sheet.csv into app.food_measures, on DATABASE_URL; and USDA's
// data/foods/usda-fndds-foods.csv (with usda-fndds-portions.csv) into its archive, not the food list;
// Open Food Facts' packaged foods sold in India, data/foods/off-india-products.csv, into
// app.packaged_foods; and the approved rows of docs/data/brand-labels-sheet.csv into app.foods and
// app.food_portions as source brand_label (ADR-0006 rule 1; D-28; D-36; D-39; D-46; D-47; D-48;
// D-49; ADR-0009; docs/data/food-list-sources.md). Checks every file whole first and imports nothing if
// any row is wrong. Running it again gives the same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readRecipeSheet } from '../src/foods/dishes.ts';
import { BRAND_LABEL_SOURCE, readBrandLabelsSheet } from '../src/foods/brandLabels.ts';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { INDB_SOURCE, readIndbCsv } from '../src/foods/indb.ts';
import { importDishes, importFoods, importMeasures, importPackagedFoods, importPortions, importUsdaArchive } from '../src/foods/importFoods.ts';
import { readMeasuresSheet } from '../src/foods/measures.ts';
import { readPackagedCsv } from '../src/foods/offIndia.ts';
import { readUsdaCsv } from '../src/foods/usda.ts';

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
const labels = readBrandLabelsSheet(readFileSync(path.join(root, 'docs/data/brand-labels-sheet.csv'), 'utf8'));
const packaged = readPackagedCsv(readFileSync(path.join(root, 'data/foods/off-india-products.csv'), 'utf8'));
const indb = readIndbCsv(
  readFileSync(path.join(root, 'data/foods/indb-foods.csv'), 'utf8'),
  readFileSync(path.join(root, 'data/foods/indb-portions.csv'), 'utf8'),
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
  const indbFoods = await importFoods(client, indb.foods, INDB_SOURCE);
  const indbServings = await importPortions(client, INDB_SOURCE, indb.portions);
  console.log(`Imported ${indbFoods.total} INDB recipes with ${indbServings} servings, all estimated.`);
  const archived = await importUsdaArchive(client, usda.foods, usda.portions);
  console.log(`Kept ${archived} USDA foods in their archive, not in the food list.`);
  const packagedFoods = await importPackagedFoods(client, packaged);
  console.log(`Imported ${packagedFoods} packaged foods sold in India, from Open Food Facts.`);
  const labelled = await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
  const labelServings = await importPortions(client, BRAND_LABEL_SOURCE, labels.portions);
  console.log(
    `Imported ${labelled.total} approved brand labels with ${labelServings} servings. Not imported: ${labels.proposed} proposed (waiting for the owner's OK).`,
  );
} finally {
  await client.end();
}
