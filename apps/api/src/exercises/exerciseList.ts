// FitSphere's exercise list (D-50; docs/data/exercise-list-sources.md): data/exercises/exercise-list.csv,
// each exercise with its code, name, the group shown beside it, how it is logged, the 2024 Adult
// Compendium of Physical Activities' activity code and MET when the Compendium lists the activity, and
// other names to search by; data/exercises/speed-mets.csv, the Compendium's activities by speed for
// running, walking and cycling; and the exercise library's review sheet (D-67),
// docs/data/exercise-library-sheet.csv: the owner's file of exercises by category and sub-group, which
// adds exercises and gives exercises their places; and the library's details, each row's muscles,
// equipment, how-to steps and more (D-81, ./exerciseDetails.ts). Each file is checked whole first; any
// problem refuses all of it, naming the line. The import replaces app.exercises, app.exercise_speed_mets
// and app.exercise_details whole, in one transaction.
import {
  EXERCISE_GROUPS,
  EXERCISE_LOG_TYPES,
  EXERCISE_NAME_MAX,
  EXERCISE_SUB_GROUPS,
  exerciseNameKey,
  type ExerciseGroup,
  type ExerciseLogType,
  type ExercisePlace,
  type ListedExercise,
} from '@fitsphere/shared';
import type pg from 'pg';
import { parseCsv } from '../foods/csv.ts';
import type { ExerciseDetail } from './exerciseDetails.ts';

export const EXERCISE_LIST_HEADER: readonly string[] = ['code', 'name', 'group', 'log_type', 'compendium_code', 'met', 'aliases'];
export const SPEED_METS_HEADER: readonly string[] = ['exercise_code', 'from_kmh', 'compendium_code', 'met'];
/** The exercise library's review sheet, docs/data/exercise-library-sheet.csv (D-67). */
export const EXERCISE_LIBRARY_HEADER: readonly string[] = [
  'row',
  'category',
  'sub_group',
  'name',
  'status',
  'code',
  'group',
  'log_type',
  'why',
  'compendium_code',
  'met',
  'aliases',
  'near_duplicate',
  'note',
];

const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COMPENDIUM_CODE = /^\d{5}$/;
/** A MET as the Compendium prints it, with one decimal. */
const MET = /^\d{1,2}\.\d$/;
/** A speed in km/h, with one decimal. */
const KMH = /^\d{1,2}\.\d$/;
/** What a library row's status may say besides `new` (D-67). */
const REPEAT = /^repeat of row \d+$/;
const IN_OUR_LIST = /^in our list as .+, gets this place$/;

export class ExerciseListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExerciseListError';
  }
}

/** One exercise's fields as a file writes them. */
type ExerciseFields = { code: string; name: string; group: string; logType: string; compendiumCode: string; met: string; aliasText: string };

/**
 * Checks one exercise: its code is new to `codes`, its group and type are known, its Compendium code
 * and MET go together, and no other exercise has its name or any of its other names, as the phone
 * matches them (`owners`, which it adds to). Any problem is `refuse`d.
 */
function checkedExercise(
  { code, name, group, logType, compendiumCode, met, aliasText }: ExerciseFields,
  codes: Set<string>,
  owners: Map<string, string>,
  refuse: (problem: string) => never,
): ListedExercise {
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
  return {
    code,
    name,
    group: group as ExerciseGroup,
    logType: logType as ExerciseLogType,
    aliases,
    compendiumCode: compendiumCode === '' ? null : compendiumCode,
    met: met === '' ? null : Number(met),
    speedMets: [],
    places: [],
    details: null,
  };
}

/** Parses and checks the whole list; any problem refuses all of it. */
export function readExerciseList(text: string): ListedExercise[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== EXERCISE_LIST_HEADER.join(',')) {
    throw new ExerciseListError(`The exercise list's header must be: ${EXERCISE_LIST_HEADER.join(',')}`);
  }
  const codes = new Set<string>();
  // Every name and other name, as matched on the phone, and the exercise it belongs to.
  const owners = new Map<string, string>();
  return rows.map((fields, index) => {
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`Line ${index + 2}: ${problem}`);
    };
    if (fields.length !== EXERCISE_LIST_HEADER.length) refuse(`${fields.length} fields, not ${EXERCISE_LIST_HEADER.length}`);
    const [code, name, group, logType, compendiumCode, met, aliasText] = fields as [string, string, string, string, string, string, string];
    return checkedExercise({ code, name, group, logType, compendiumCode, met, aliasText }, codes, owners, refuse);
  });
}

/**
 * Reads the exercise library's review sheet (D-67) onto `list`, FitSphere's own. A row whose status is
 * `new` adds an exercise, checked as the list's are, in its category and sub-group; a `repeat of row N`
 * or an `in our list as …, gets this place` row adds its category and sub-group to the exercise of its
 * code. Every category is one of EXERCISE_SUB_GROUPS, with one of its sub-groups, or none when it has
 * none; a Compendium code has one MET everywhere. Any problem refuses the whole sheet, naming its line.
 */
export function readExerciseLibrary(text: string, list: readonly ListedExercise[]): ListedExercise[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== EXERCISE_LIBRARY_HEADER.join(',')) {
    throw new ExerciseListError(`The exercise library's header must be: ${EXERCISE_LIBRARY_HEADER.join(',')}`);
  }
  const exercises = new Map(list.map((exercise) => [exercise.code, { ...exercise, places: [...exercise.places] }]));
  const codes = new Set(exercises.keys());
  const owners = new Map<string, string>();
  const metOf = new Map<string, number>();
  for (const exercise of list) {
    for (const text of [exercise.name, ...exercise.aliases]) owners.set(exerciseNameKey(text), exercise.code);
    if (exercise.compendiumCode !== null && exercise.met !== null) metOf.set(exercise.compendiumCode, exercise.met);
  }
  const subGroups: Readonly<Record<string, readonly string[]>> = EXERCISE_SUB_GROUPS;
  rows.forEach((fields, index) => {
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`Exercise library, line ${index + 2}: ${problem}`);
    };
    if (fields.length !== EXERCISE_LIBRARY_HEADER.length) refuse(`${fields.length} fields, not ${EXERCISE_LIBRARY_HEADER.length}`);
    const [, category, subGroup, name, status, code, group, logType, , compendiumCode, met, aliasText] = fields as [
      string, string, string, string, string, string, string, string, string, string, string, string,
    ];
    const groups = Object.prototype.hasOwnProperty.call(subGroups, category)
      ? subGroups[category]!
      : refuse(`the category "${category}" is not one of the library's`);
    if (groups.length === 0 && subGroup !== '') refuse(`${category} has no sub-groups`);
    if (groups.length > 0 && !groups.includes(subGroup)) refuse(`the sub-group "${subGroup}" is not one of ${category}'s`);
    const place: ExercisePlace = { category, subGroup: subGroup === '' ? null : subGroup };
    if (status === 'new') {
      const exercise = checkedExercise({ code, name, group, logType, compendiumCode, met, aliasText }, codes, owners, refuse);
      if (exercise.compendiumCode !== null && exercise.met !== null) {
        const known = metOf.get(exercise.compendiumCode);
        if (known !== undefined && known !== exercise.met) refuse(`the Compendium code ${exercise.compendiumCode} has the MET ${known}`);
        metOf.set(exercise.compendiumCode, exercise.met);
      }
      exercises.set(code, { ...exercise, places: [place] });
      return;
    }
    if (!REPEAT.test(status) && !IN_OUR_LIST.test(status)) {
      refuse(`the status "${status}" must be new, "repeat of row N" or "in our list as …, gets this place"`);
    }
    const exercise = exercises.get(code) ?? refuse(`${code} is not an exercise of the list or of an earlier row`);
    if (!exercise.places.some((each) => each.category === place.category && each.subGroup === place.subGroup)) {
      exercise.places.push(place);
    }
  });
  return [...exercises.values()];
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

/**
 * Replaces app.exercises with the list, app.exercise_speed_mets with its bands and app.exercise_details
 * with the library's details (D-81), in one transaction; returns how many exercises were imported.
 */
export async function importExercises(
  client: pg.ClientBase,
  exercises: readonly ListedExercise[],
  details: readonly ExerciseDetail[] = [],
): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.exercises');
    await client.query(
      `insert into app.exercises (code, name, exercise_group, log_type, aliases, compendium_code, met, places)
       select code, name, exercise_group, log_type, aliases, compendium_code, met, places
       from jsonb_to_recordset($1::jsonb) as row (code text, name text, exercise_group text, log_type text, aliases text[],
         compendium_code text, met numeric, places jsonb)`,
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
            places: exercise.places,
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
    await client.query(
      `insert into app.exercise_details (library_row, exercise_code, category, sub_group, primary_muscle, muscles_worked, equipment,
         tags, how_to, watch_for, video_url)
       select library_row, exercise_code, category, sub_group, primary_muscle, muscles_worked, equipment, tags, how_to, watch_for, video_url
       from jsonb_to_recordset($1::jsonb) as row (library_row integer, exercise_code text, category text, sub_group text,
         primary_muscle text, muscles_worked text[], equipment text, tags text[], how_to text[], watch_for text, video_url text)`,
      [
        JSON.stringify(
          details.map((detail) => ({
            library_row: detail.row,
            exercise_code: detail.exerciseCode,
            category: detail.category,
            sub_group: detail.subGroup,
            primary_muscle: detail.primaryMuscle,
            muscles_worked: detail.musclesWorked,
            equipment: detail.equipment,
            tags: detail.tags,
            how_to: detail.howTo,
            watch_for: detail.watchFor,
            video_url: detail.videoUrl,
          })),
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
