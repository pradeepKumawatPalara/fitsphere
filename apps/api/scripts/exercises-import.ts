// npm run exercises:import -w @fitsphere/api: loads data/exercises/exercise-list.csv, FitSphere's
// exercise list (D-50; docs/data/exercise-list-sources.md), into app.exercises on DATABASE_URL. Checks
// the whole file first and imports nothing if any row is wrong. Running it again gives the same table.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { importExercises, readExerciseList } from '../src/exercises/exerciseList.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in apps/api/.env (runbook, "Configuration names").');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '../../..');
const list = readExerciseList(readFileSync(path.join(root, 'data/exercises/exercise-list.csv'), 'utf8'));

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const total = await importExercises(client, list);
  const estimated = list.filter((exercise) => exercise.met !== null).length;
  console.log(`Imported ${total} exercises, ${estimated} with a Compendium MET for estimating calories burned.`);
} finally {
  await client.end();
}
