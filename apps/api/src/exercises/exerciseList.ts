// FitSphere's exercise list (D-50; docs/data/exercise-list-sources.md): data/exercises/exercise-list.csv,
// each exercise with its code, name, the group shown beside it, how it is logged, the 2024 Adult
// Compendium of Physical Activities' activity code and MET when the Compendium lists the activity, and
// other names to search by; and data/exercises/speed-mets.csv, the Compendium's activities by speed for
// running, walking and cycling. Each file is checked whole first; any problem refuses all of it, naming
// the line. The import replaces app.exercises and app.exercise_speed_mets whole, in one transaction.
import {
  EXERCISE_GROUPS,
  EXERCISE_LOG_TYPES,
  EXERCISE_NAME_MAX,
  exerciseNameKey,
  type ExerciseGroup,
  type ExerciseLogType,
  type ListedExercise,
} from '@fitsphere/shared';
import type pg from 'pg';
import { parseCsv } from '../foods/csv.ts';

export const EXERCISE_LIST_HEADER: readonly string[] = ['code', 'name', 'group', 'log_type', 'compendium_code', 'met', 'aliases'];
export const SPEED_METS_HEADER: readonly string[] = ['exercise_code', 'from_kmh', 'compendium_code', 'met'];

const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COMPENDIUM_CODE = /^\d{5}$/;
/** A MET as the Compendium prints it, with one decimal. */
const MET = /^\d{1,2}\.\d$/;
/** A speed in km/h, with one decimal. */
const KMH = /^\d{1,2}\.\d$/;

export class ExerciseListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExerciseListError';
  }
}

/** Parses and checks the whole list; any problem refuses all of it. */
export function readExerciseList(text: string): ListedExercise[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== EXERCISE_LIST_HEADER.join(',')) {
    throw new ExerciseListError(`The exercise list's header must be: ${EXERCISE_LIST_HEADER.join(',')}`);
  }
  const exercises: ListedExercise[] = [];
  const codes = new Set<string>();
  // Every name and other name, as matched on the phone, and the exercise it belongs to.
  const owners = new Map<string, string>();
  rows.forEach((fields, index) => {
    const line = index + 2;
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`Line ${line}: ${problem}`);
    };
    if (fields.length !== EXERCISE_LIST_HEADER.length) refuse(`${fields.length} fields, not ${EXERCISE_LIST_HEADER.length}`);
    const [code, name, group, logType, compendiumCode, met, aliasText] = fields as [string, string, string, string, string, string, string];
    if (!CODE.test(code)) refuse(`the code "${code}" must be lower-case letters and digits joined by hyphens`);
    if (codes.has(code)) refuse(`the code ${code} is already used`);
    codes.add(code);
    if (!(EXERCISE_GROUPS as readonly string[]).includes(group)) refuse(`the group "${group}" is not one of ${EXERCISE_GROUPS.join(', ')}`);
    if (!(EXERCISE_LOG_TYPES as readonly string[]).includes(logType)) {
      refuse(`the log type "${logType}" is not one of ${EXERCISE_LOG_TYPES.join(', ')}`);
    }
    if ((compendiumCode === '') !== (met === '')) refuse('the Compendium code and the MET go together');
    if (compendiumCode !== '' && !COMPENDIUM_CODE.test(compendiumCode)) refuse(`the Compendium code "${compendiumCode}" must be 5 digits`);
    if (met !== '' && (!MET.test(met) || Number(met) <= 0)) refuse(`the MET "${met}" must be a number above 0 with one decimal`);
    const aliases = aliasText === '' ? [] : aliasText.split(';');
    for (const [position, text] of [name, ...aliases].entries()) {
      const what = position === 0 ? 'the name' : `the other name "${text}"`;
      if (text.trim() !== text || text === '' || text.length > EXERCISE_NAME_MAX) {
        refuse(`${what} must be 1 to ${EXERCISE_NAME_MAX} characters, with no spaces at either end`);
      }
      const key = exerciseNameKey(text);
      if (key === '') refuse(`${what} needs a letter or a digit`);
      if (position > 0 && key === exerciseNameKey(name)) refuse(`${what} is the name again`);
      const owner = owners.get(key);
      if (owner !== undefined && owner !== code) refuse(`${what} is also ${owner}'s`);
      owners.set(key, code);
    }
    exercises.push({
      code,
      name,
      group: group as ExerciseGroup,
      logType: logType as ExerciseLogType,
      aliases,
      compendiumCode: compendiumCode === '' ? null : compendiumCode,
      met: met === '' ? null : Number(met),
      speedMets: [],
    });
  });
  return exercises;
}

/**
 * Reads the speed bands and gives `exercises` with theirs: each band names a listed exercise logged with
 * a distance or a treadmill's speed, and an exercise's bands start at rising speeds, the first at 0 or
 * more. Any problem refuses the whole file.
 */
export function readSpeedMets(text: string, exercises: readonly ListedExercise[]): ListedExercise[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== SPEED_METS_HEADER.join(',')) {
    throw new ExerciseListError(`The speed bands' header must be: ${SPEED_METS_HEADER.join(',')}`);
  }
  const bands = new Map<string, ListedExercise['speedMets']>();
  rows.forEach((fields, index) => {
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`Speed bands, line ${index + 2}: ${problem}`);
    };
    if (fields.length !== SPEED_METS_HEADER.length) refuse(`${fields.length} fields, not ${SPEED_METS_HEADER.length}`);
    const [code, fromKmh, compendiumCode, met] = fields as [string, string, string, string];
    const exercise = exercises.find((each) => each.code === code);
    if (!exercise) refuse(`${code} is not in the exercise list`);
    if (exercise?.logType !== 'distance_time' && exercise?.logType !== 'treadmill') refuse(`${code} is not logged with a distance or a speed`);
    if (!KMH.test(fromKmh)) refuse(`the speed "${fromKmh}" must be a number of km/h with one decimal`);
    if (!COMPENDIUM_CODE.test(compendiumCode)) refuse(`the Compendium code "${compendiumCode}" must be 5 digits`);
    if (!MET.test(met) || Number(met) <= 0) refuse(`the MET "${met}" must be a number above 0 with one decimal`);
    const list = bands.get(code) ?? [];
    if (list.length > 0 && Number(fromKmh) <= list.at(-1)!.fromKmh) refuse(`${code}'s bands must start at rising speeds`);
    bands.set(code, [...list, { fromKmh: Number(fromKmh), compendiumCode, met: Number(met) }]);
  });
  return exercises.map((exercise) => ({ ...exercise, speedMets: bands.get(exercise.code) ?? [] }));
}

/** Replaces app.exercises with the list and app.exercise_speed_mets with its bands, in one transaction; returns how many exercises were imported. */
export async function importExercises(client: pg.ClientBase, exercises: readonly ListedExercise[]): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.exercises');
    await client.query(
      `insert into app.exercises (code, name, exercise_group, log_type, aliases, compendium_code, met)
       select code, name, exercise_group, log_type, aliases, compendium_code, met
       from jsonb_to_recordset($1::jsonb) as row (code text, name text, exercise_group text, log_type text, aliases text[],
         compendium_code text, met numeric)`,
      [
        JSON.stringify(
          exercises.map((exercise) => ({
            code: exercise.code,
            name: exercise.name,
            exercise_group: exercise.group,
            log_type: exercise.logType,
            aliases: exercise.aliases,
            compendium_code: exercise.compendiumCode,
            met: exercise.met,
          })),
        ),
      ],
    );
    await client.query(
      `insert into app.exercise_speed_mets (exercise_code, from_kmh, compendium_code, met)
       select exercise_code, from_kmh, compendium_code, met
       from jsonb_to_recordset($1::jsonb) as row (exercise_code text, from_kmh numeric, compendium_code text, met numeric)`,
      [
        JSON.stringify(
          exercises.flatMap((exercise) =>
            exercise.speedMets.map((band) => ({
              exercise_code: exercise.code,
              from_kmh: band.fromKmh,
              compendium_code: band.compendiumCode,
              met: band.met,
            })),
          ),
        ),
      ],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return exercises.length;
}
