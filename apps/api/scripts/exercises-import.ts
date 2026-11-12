// npm run exercises:import -w @fitsphere/api: loads data/exercises/exercise-list.csv, FitSphere's
// exercise list (D-50; docs/data/exercise-list-sources.md), and docs/data/exercise-library-sheet.csv,
// the exercise library by category and sub-group (D-67), into app.exercises on DATABASE_URL, with
// data/exercises/speed-mets.csv, the Compendium's activities by speed, into app.exercise_speed_mets, and
// docs/data/exercise-library-details.csv, each library row's muscles, equipment, how-to steps and more
// (D-81), into app.exercise_details.
// Checks every file whole first and imports nothing if any row is wrong. Running it again gives the
// same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { readExerciseDetails } from '../src/exercises/exerciseDetails.ts';
import { importExercises, readExerciseLibrary, readExerciseList, readSpeedMets } from '../src/exercises/exerciseList.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const library = readFileSync(path.join(root, 'docs/data/exercise-library-sheet.csv'), 'utf8');
const list = readSpeedMets(
  readFileSync(path.join(root, 'data/exercises/speed-mets.csv'), 'utf8'),
  readExerciseLibrary(library, readExerciseList(readFileSync(path.join(root, 'data/exercises/exercise-list.csv'), 'utf8'))),
);
const details = readExerciseDetails(readFileSync(path.join(root, 'docs/data/exercise-library-details.csv'), 'utf8'), library, list);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const total = await importExercises(client, list, details);
  const estimated = list.filter((exercise) => exercise.met !== null).length;
  const banded = list.filter((exercise) => exercise.speedMets.length > 0).length;
  const placed = list.filter((exercise) => exercise.places.length > 0).length;
  console.log(
    `Imported ${total} exercises, ${estimated} with a Compendium MET for estimating calories burned, ${banded} with speed bands, ` +
      `${placed} in the library's categories; the details of ${details.length} library rows ` +
      `(${details.filter((detail) => detail.videoUrl !== null).length} with a video).`,
  );
} finally {
  await client.end();
}
