// npm run indb:convert -w @fitsphere/api -- <INDB.xlsx>: turns the Indian Nutrient Databank's
// INDB.xlsx (from github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-; kept outside the
// repository) into data/foods/indb-foods.csv and data/foods/indb-portions.csv, which foods:import
// loads (D-46; docs/data/food-list-sources.md). Writes nothing else.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { toCsv } from '../src/foods/csv.ts';
import { convertIndb } from '../src/foods/indb.ts';
import { readXlsxRows } from '../src/foods/xlsx.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give INDB.xlsx: npm run indb:convert -w @fitsphere/api -- D:/fitsphere-data/indb-2026-11-04/INDB.xlsx');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const { foods, portions, skipped } = convertIndb(readXlsxRows(readFileSync(input)));
writeFileSync(path.join(root, 'data/foods/indb-foods.csv'), toCsv(foods));
writeFileSync(path.join(root, 'data/foods/indb-portions.csv'), toCsv(portions));
console.log(`Wrote ${foods.length - 1} recipes and ${portions.length - 1} servings. Left out ${skipped.length}: ${skipped.join('; ') || 'none'}.`);
