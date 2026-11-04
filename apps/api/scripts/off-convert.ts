// npm run off:convert -w @fitsphere/api -- <en.openfoodfacts.org.products.csv.gz>: reads Open Food
// Facts' data export (tab-separated, gzipped; kept outside the repository) a line at a time and writes
// its packaged foods sold in India to data/foods/off-india-products.csv, which foods:import loads
// (D-48; ADR-0009; docs/data/food-list-sources.md). Writes nothing else.
import { createReadStream, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import type { PackagedFood } from '@fitsphere/shared';
import { toCsv } from '../src/foods/csv.ts';
import { exportColumns, PACKAGED_HEADER, packagedFromRow, packagedRow, type ExportColumns, type Skipped } from '../src/foods/offIndia.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give the export: npm run off:convert -w @fitsphere/api -- D:/fitsphere-data/off-2026-11-04/en.openfoodfacts.org.products.csv.gz');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const lines = createInterface({ input: createReadStream(input).pipe(createGunzip()), crlfDelay: Infinity });
let columns: ExportColumns | null = null;
let read = 0;
let india = 0;
const kept = new Map<string, PackagedFood>();
const skipped: Record<Skipped | 'twice', number> = { barcode: 0, name: 0, values: 0, energy: 0, twice: 0 };
for await (const line of lines) {
  const fields = line.split('\t');
  if (!columns) {
    columns = exportColumns(fields);
    continue;
  }
  read += 1;
  const result = packagedFromRow(columns, fields);
  if (result === null) continue;
  india += 1;
  if (typeof result === 'string') skipped[result] += 1;
  else if (kept.has(result.barcode)) skipped.twice += 1;
  else kept.set(result.barcode, result);
}

const foods = [...kept.values()].sort((a, b) => a.barcode.localeCompare(b.barcode));
writeFileSync(path.join(root, 'data/foods/off-india-products.csv'), toCsv([[...PACKAGED_HEADER], ...foods.map(packagedRow)]));
console.log(
  `Read ${read} products; ${india} sold in India. Wrote ${foods.length}, ${foods.filter((food) => food.servingGrams !== null).length} with a serving in grams. ` +
    `Left out: ${skipped.values} with values missing or out of range, ${skipped.energy} whose energy does not match, ${skipped.name} without a usable name, ` +
    `${skipped.barcode} without a usable barcode, ${skipped.twice} listed twice.`,
);
