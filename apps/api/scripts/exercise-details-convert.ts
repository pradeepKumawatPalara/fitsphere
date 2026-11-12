// npm run exercise-details:convert -w @fitsphere/api -- <Gym_Exercise_Library.xlsx>: turns the tab "All
// Exercises" of the owner's exercise library (from the owner's AI tool; kept outside the repository, in
// D:\fitsphere-data) into docs/data/exercise-library-details.csv, each row's primary muscle, muscles
// worked, equipment, tags, how-to steps, what to watch for and video address, against the review sheet
// docs/data/exercise-library-sheet.csv (D-81; docs/data/exercise-list-sources.md). exercises:import
// loads it. Writes nothing else; run it again when the file changes (a video address added).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { convertExerciseDetails, LIBRARY_FILE_SHEET } from '../src/exercises/exerciseDetails.ts';
import { toCsv } from '../src/foods/csv.ts';
import { readXlsxRows } from '../src/foods/xlsx.ts';

const input = process.argv[2];
if (!input) {
  console.error('Give the library: npm run exercise-details:convert -w @fitsphere/api -- "D:/fitsphere-data/Gym_Exercise_Library (1).xlsx"');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const { rows, missing } = convertExerciseDetails(
  readXlsxRows(readFileSync(input), LIBRARY_FILE_SHEET),
  readFileSync(path.join(root, 'docs/data/exercise-library-sheet.csv'), 'utf8'),
);
writeFileSync(path.join(root, 'docs/data/exercise-library-details.csv'), toCsv(rows));
const videos = rows.slice(1).filter((row) => row.at(-1) !== '').length;
console.log(
  `Wrote the details of ${rows.length - 1} rows, ${videos} with a video address. ` +
    `Rows of the review sheet with none: ${missing.length === 0 ? 'none' : missing.join(', ')}.`,
);
