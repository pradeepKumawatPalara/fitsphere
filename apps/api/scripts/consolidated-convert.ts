// npm run consolidated:convert -w @fitsphere/api -- <Indian_Food_Database_CONSOLIDATED.xlsx>: turns the
// owner's consolidated food database (kept outside the repository, in D:\fitsphere-data) into
// docs/data/food-aliases-sheet.csv, and adds its dishes and generic foods FitSphere lacks to
// docs/data/dish-estimates-sheet.csv and docs/data/home-foods-sheet.csv (D-94;
// docs/data/food-list-sources.md). foods:import loads them. Writes nothing else; running it again on
// the same file changes nothing more.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONSOLIDATED_SHEETS, convertConsolidated, type ListedFood } from '../src/foods/consolidated.ts';
import { parseCsv, toCsv } from '../src/foods/csv.ts';
import { IFCT_SOURCE, readIfctCsv } from '../src/foods/ifct.ts';
import { INDB_SOURCE, readIndbCsv } from '../src/foods/indb.ts';
import { readPackagedCsv, readPackagedNameFixes, withExtraPackaged, withNameFixes } from '../src/foods/offIndia.ts';
import { readXlsxRows } from '../src/foods/xlsx.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give the workbook: npm run consolidated:convert -w @fitsphere/api -- "D:/fitsphere-data/Indian_Food_Database_CONSOLIDATED.xlsx"');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const workbook = readFileSync(input);
const listed = (source: 'ifct2017' | 'indb') => (food: { code: string; name: string; kcal: string }): ListedFood => ({ source, code: food.code, name: food.name, kcal: Number(food.kcal) });
const packaged = withNameFixes(
  withExtraPackaged(readPackagedCsv(read('data/foods/off-india-products.csv')), readPackagedCsv(read('data/foods/off-india-extra.csv'))),
  readPackagedNameFixes(read('docs/data/packaged-name-fixes.csv')),
).foods;

const { aliases, estimatesSheet, homeSheet, report } = convertConsolidated({
  dishes: readXlsxRows(workbook, CONSOLIDATED_SHEETS.dishes),
  packaged: readXlsxRows(workbook, CONSOLIDATED_SHEETS.packaged),
  generic: readXlsxRows(workbook, CONSOLIDATED_SHEETS.generic),
  ifct: readIfctCsv(read('data/foods/ifct2017-foods.csv')).map(listed(IFCT_SOURCE)),
  indb: readIndbCsv(read('data/foods/indb-foods.csv'), read('data/foods/indb-portions.csv')).foods.map(listed(INDB_SOURCE)),
  estimatesSheet: parseCsv(read('docs/data/dish-estimates-sheet.csv')),
  homeSheet: parseCsv(read('docs/data/home-foods-sheet.csv')),
  barcodes: new Set(packaged.map((food) => food.barcode)),
  readOn: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
});
writeFileSync(path.join(root, 'docs/data/food-aliases-sheet.csv'), toCsv(aliases));
writeFileSync(path.join(root, 'docs/data/dish-estimates-sheet.csv'), toCsv(estimatesSheet));
writeFileSync(path.join(root, 'docs/data/home-foods-sheet.csv'), toCsv(homeSheet));

const list = (items: readonly string[]) => (items.length === 0 ? ' none' : `\n  ${items.join('\n  ')}`);
console.log(`Other names for ${aliases.length - 1} foods: ${Object.entries(report.aliasRows).map(([source, n]) => `${source} ${n}`).join(', ')}.`);
console.log(`Estimated dishes: ${report.heldApproved} held rows approved with the file's values, ${report.heldKept} kept held; ${report.dishesAdded} dishes added, ${report.dishesAddedHeld} added held (rated D only).`);
console.log(`Held because their values do not fit the dish, given the same values again (still held): ${report.heldSameValues.length}.`);
console.log(`Generic foods added as home-style foods: ${report.genericAdded.length}.`);
console.log(`Generic foods FitSphere already has (their other names go to it):${list(report.genericSameAs)}`);
console.log(`Generic foods named exactly as a food FitSphere has (not added; their other names go to it):${list(report.genericSameName)}`);
console.log(`Generic foods added beside a food of the same name but for its brackets:${list(report.genericBeside)}`);
console.log(`Dish names two of FitSphere's foods share (no other names given):${list(report.ambiguous)}`);
console.log(`IFCT rows whose code has another name here:${list(report.ifctNotMatched)}`);
console.log(`Rows that failed a sheet's checks:${list(report.failed)}`);
