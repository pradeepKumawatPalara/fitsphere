// npm run food-units:convert -w @fitsphere/api -- <Indian_Food_Database_CONSOLIDATED.xlsx>: reads the
// Default Unit and Allowed Units of the owner's consolidated food database (kept outside the repository,
// in D:\fitsphere-data) for the foods FitSphere has, and writes docs/data/food-units-sheet.csv; adds the
// other base foods' rows of a dish as estimated dishes of their own to docs/data/dish-estimates-sheet.csv
// ("Idli (Urad Dal)"); and writes the drinks whose ml it fixed to docs/data/food-units-ml-fixes.csv
// (D-102; docs/plans/food-units.md). foods:import loads them. Writes nothing else; running it again on
// the same file changes nothing more.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONSOLIDATED_SHEETS } from '../src/foods/consolidated.ts';
import { parseCsv, toCsv } from '../src/foods/csv.ts';
import { readDishEstimatesSheet } from '../src/foods/dishEstimates.ts';
import { convertFoodUnits } from '../src/foods/foodUnits.ts';
import { readHomeFoodsSheet } from '../src/foods/homeFoods.ts';
import { readIfctCsv } from '../src/foods/ifct.ts';
import { readIndbCsv } from '../src/foods/indb.ts';
import { readPackagedCsv, readPackagedNameFixes, withExtraPackaged, withNameFixes } from '../src/foods/offIndia.ts';
import type { ImportedPortion } from '../src/foods/usda.ts';
import { readXlsxRows } from '../src/foods/xlsx.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give the workbook: npm run food-units:convert -w @fitsphere/api -- "D:/fitsphere-data/Indian_Food_Database_CONSOLIDATED (1).xlsx"');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const workbook = readFileSync(input);
const estimatesText = read('docs/data/dish-estimates-sheet.csv');
const homeText = read('docs/data/home-foods-sheet.csv');
const indb = readIndbCsv(read('data/foods/indb-foods.csv'), read('data/foods/indb-portions.csv'));
const packaged = withNameFixes(
  withExtraPackaged(readPackagedCsv(read('data/foods/off-india-products.csv')), readPackagedCsv(read('data/foods/off-india-extra.csv'))),
  readPackagedNameFixes(read('docs/data/packaged-name-fixes.csv')),
).foods;

const servings = new Map<string, { label: string; grams: number }[]>();
const addServings = (source: string, portions: readonly ImportedPortion[]) => {
  for (const portion of portions) {
    const key = `${source} ${portion.code}`;
    servings.set(key, [...(servings.get(key) ?? []), { label: portion.label, grams: portion.grams }]);
  }
};
addServings('indb', indb.portions);
addServings('home', readHomeFoodsSheet(homeText).portions);
addServings('dish_estimate', readDishEstimatesSheet(estimatesText).portions);

const { unitsSheet, estimatesSheet, mlFixes, report } = convertFoodUnits({
  dishes: readXlsxRows(workbook, CONSOLIDATED_SHEETS.dishes),
  packaged: readXlsxRows(workbook, CONSOLIDATED_SHEETS.packaged),
  generic: readXlsxRows(workbook, CONSOLIDATED_SHEETS.generic),
  ifct: readIfctCsv(read('data/foods/ifct2017-foods.csv')),
  indb: indb.foods,
  servings,
  estimatesSheet: parseCsv(estimatesText),
  homeSheet: parseCsv(homeText),
  packagedServings: new Map(packaged.map((food) => [food.barcode, food.servingGrams])),
  readOn: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
});
// The sheets are checked as foods:import reads them before anything is written.
readDishEstimatesSheet(toCsv(estimatesSheet));
writeFileSync(path.join(root, 'docs/data/food-units-sheet.csv'), toCsv(unitsSheet));
writeFileSync(path.join(root, 'docs/data/dish-estimates-sheet.csv'), toCsv(estimatesSheet));
writeFileSync(path.join(root, 'docs/data/food-units-ml-fixes.csv'), toCsv(mlFixes));

const list = (items: readonly string[], most = 40) =>
  items.length === 0 ? ' none' : `\n  ${items.slice(0, most).join('\n  ')}${items.length > most ? `\n  … and ${items.length - most} more` : ''}`;
console.log(`Units for ${unitsSheet.length - 1} foods (${report.units} units): ${Object.entries(report.foods).map(([source, n]) => `${source} ${n}`).join(', ')}.`);
console.log(`Rows whose food FitSphere does not have: dishes ${report.unmatched.dishes}, packaged ${report.unmatched.packaged}, generic ${report.unmatched.generic}; dish names two foods share: ${report.ambiguous}.`);
console.log(`R2, other base foods' rows made dishes of their own: ${report.anotherBaseAdded.length}; held with a problem:${list(report.anotherBaseHeld)}`);
console.log(`R3, packaged foods keeping their label's serving: ${report.labelServingKept}.`);
console.log(`R5, drinks whose ml was fixed: ${report.mlFixed}; liquids that are not drinks, reported only: ${report.mlNotADrink}.`);
console.log(`Units left out (over 2,000 g, named oz, a name too long):${list(report.unitsLeftOut)}`);
