// npm run foods:import -w @fitsphere/api: loads data/foods/ifct2017-foods.csv and INDB's
// data/foods/indb-foods.csv (with indb-portions.csv) into app.foods and app.food_portions, the
// approved dishes of docs/data/standard-recipe-sheet.csv into app.dishes, and the approved units of
// docs/data/household-measures-sheet.csv into app.food_measures, on DATABASE_URL; and USDA's
// data/foods/usda-fndds-foods.csv (with usda-fndds-portions.csv) into its archive, not the food list;
// Open Food Facts' packaged foods sold in India, data/foods/off-india-products.csv, into
// app.packaged_foods; the approved rows of docs/data/brand-labels-sheet.csv into app.foods and
// app.food_portions as source brand_label; those of docs/data/home-foods-sheet.csv as source home; and
// those of docs/data/dish-estimates-sheet.csv as source dish_estimate, with the packaged products of
// data/foods/off-india-extra.csv added to Open Food Facts' (ADR-0006 rule 1; D-28; D-36; D-39; D-46;
// D-47; D-48; D-49; D-59; D-62; ADR-0009; D-76: each serving that holds several things also gives one of them;
// D-80: the packaged foods named only by their brand renamed or left out as
// docs/data/packaged-name-fixes.csv says; D-89: their brands each written one way, as the approved rows
// of docs/data/brand-names-sheet.csv say; docs/data/food-list-sources.md). Checks every file whole first and imports nothing if
// any row is wrong. Running it again gives the same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readRecipeSheet } from '../src/foods/dishes.ts';
import { DISH_ESTIMATE_SOURCE, readDishEstimatesSheet } from '../src/foods/dishEstimates.ts';
import { HOME_FOOD_SOURCE, readHomeFoodsSheet } from '../src/foods/homeFoods.ts';
import { BRAND_LABEL_SOURCE, readBrandLabelsSheet } from '../src/foods/brandLabels.ts';
import { readBrandNames, withBrandNames } from '../src/foods/brandNames.ts';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { INDB_SOURCE, readIndbCsv } from '../src/foods/indb.ts';
import { importDishes, importFoods, importMeasures, importPackagedFoods, importPortions, importUsdaArchive } from '../src/foods/importFoods.ts';
import { readMeasuresSheet } from '../src/foods/measures.ts';
import { withSingleUnits } from '../src/foods/servingUnits.ts';
import { readPackagedCsv, readPackagedNameFixes, withExtraPackaged, withNameFixes } from '../src/foods/offIndia.ts';
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
const home = readHomeFoodsSheet(readFileSync(path.join(root, 'docs/data/home-foods-sheet.csv'), 'utf8'));
const estimates = readDishEstimatesSheet(readFileSync(path.join(root, 'docs/data/dish-estimates-sheet.csv'), 'utf8'));
// D-80: the names reviewed in docs/data/packaged-name-fixes.csv (a name that was only the brand).
const nameFixes = withNameFixes(
  withExtraPackaged(
    readPackagedCsv(readFileSync(path.join(root, 'data/foods/off-india-products.csv'), 'utf8')),
    readPackagedCsv(readFileSync(path.join(root, 'data/foods/off-india-extra.csv'), 'utf8')),
  ),
  readPackagedNameFixes(readFileSync(path.join(root, 'docs/data/packaged-name-fixes.csv'), 'utf8')),
);
// D-89: each brand written one way, as the approved rows of docs/data/brand-names-sheet.csv say.
const brandNames = withBrandNames(nameFixes.foods, readBrandNames(readFileSync(path.join(root, 'docs/data/brand-names-sheet.csv'), 'utf8')));
const packaged = brandNames.foods;
const indb = readIndbCsv(
  readFileSync(path.join(root, 'data/foods/indb-foods.csv'), 'utf8'),
  readFileSync(path.join(root, 'data/foods/indb-portions.csv'), 'utf8'),
);
// Every serving too, before anything is written: none may be named "oz" (D-76).
for (const portions of [indb.portions, labels.portions, home.portions, estimates.portions]) withSingleUnits(portions);

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
  console.log(`Imported ${indbFoods.total} INDB recipes with ${indbServings.servings} servings (${indbServings.units} single units), all estimated.`);
  const archived = await importUsdaArchive(client, usda.foods, usda.portions);
  console.log(`Kept ${archived} USDA foods in their archive, not in the food list.`);
  const packagedFoods = await importPackagedFoods(client, packaged);
  console.log(
    `Imported ${packagedFoods} packaged foods sold in India, from Open Food Facts. Names reviewed (D-80): ${nameFixes.renamed} renamed, ${nameFixes.removed} left out, ${nameFixes.notFound} no longer listed. Brands written one way (D-89): ${brandNames.rebranded} foods' brand changed (${brandNames.named} given their line at the front of the name), ${brandNames.notFound} approved brands no longer listed.`,
  );
  const labelled = await importFoods(client, labels.foods, BRAND_LABEL_SOURCE);
  const labelServings = await importPortions(client, BRAND_LABEL_SOURCE, labels.portions);
  console.log(
    `Imported ${labelled.total} approved brand labels with ${labelServings.servings} servings (${labelServings.units} single units). Not imported: ${labels.proposed} proposed (waiting for the owner's OK).`,
  );
  const homeFoods = await importFoods(client, home.foods, HOME_FOOD_SOURCE);
  const homeServings = await importPortions(client, HOME_FOOD_SOURCE, home.portions);
  console.log(
    `Imported ${homeFoods.total} approved home-style foods with ${homeServings.servings} servings (${homeServings.units} single units). Not imported: ${home.proposed} proposed (waiting for the owner's OK).`,
  );
  const estimated = await importFoods(client, estimates.foods, DISH_ESTIMATE_SOURCE);
  const estimatedServings = await importPortions(client, DISH_ESTIMATE_SOURCE, estimates.portions);
  console.log(
    `Imported ${estimated.total} estimated dishes with ${estimatedServings.servings} servings (${estimatedServings.units} single units). Not imported: ${estimates.held} held back with a problem.`,
  );
} finally {
  await client.end();
}
