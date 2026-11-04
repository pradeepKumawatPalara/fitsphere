// npm run usda:convert -w @fitsphere/api -- <FNDDS JSON file>: turns USDA FoodData Central's FNDDS
// download (FoodData_Central_survey_food_json_2024-10-31.zip, unzipped; kept outside the repository)
// into data/foods/usda-fndds-foods.csv and data/foods/usda-fndds-portions.csv, which foods:import
// loads (docs/plans/more-foods.md, D-39; docs/data/food-list-sources.md). Writes nothing else.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toCsv } from '../src/foods/csv.ts';
import { convertFndds } from '../src/foods/usda.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give the unzipped FNDDS JSON file: npm run usda:convert -w @fitsphere/api -- D:/fitsphere-data/usda-fndds-2024-10-31/extracted/surveyDownload.json');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const { foods, portions, skipped } = convertFndds(JSON.parse(readFileSync(input, 'utf8')));
writeFileSync(path.join(root, 'data/foods/usda-fndds-foods.csv'), toCsv(foods));
writeFileSync(path.join(root, 'data/foods/usda-fndds-portions.csv'), toCsv(portions));
console.log(`Wrote ${foods.length - 1} foods and ${portions.length - 1} servings. Left out ${skipped.length}: ${skipped.join('; ') || 'none'}.`);
