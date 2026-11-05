// npm run exercises:import -w @fitsphere/api: loads data/exercises/exercise-list.csv, FitSphere's
// exercise list (D-50; docs/data/exercise-list-sources.md), into app.exercises on DATABASE_URL, with
// data/exercises/speed-mets.csv, the Compendium's activities by speed, into app.exercise_speed_mets.
// Checks both files whole first and imports nothing if any row is wrong. Running it again gives the
// same tables.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { importExercises, readExerciseList, readSpeedMets } from '../src/exercises/exerciseList.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const list = readSpeedMets(
  readFileSync(path.join(root, 'data/exercises/speed-mets.csv'), 'utf8'),
  readExerciseList(readFileSync(path.join(root, 'data/exercises/exercise-list.csv'), 'utf8')),
);

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const total = await importExercises(client, list);
  const estimated = list.filter((exercise) => exercise.met !== null).length;
  const banded = list.filter((exercise) => exercise.speedMets.length > 0).length;
  console.log(`Imported ${total} exercises, ${estimated} with a Compendium MET for estimating calories burned, ${banded} with speed bands.`);
} finally {
  await client.end();
}
