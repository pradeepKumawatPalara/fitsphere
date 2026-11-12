// The exercise library's details (D-81): for each row of the owner's file (D-67), an exercise in one
// category and sub-group, its primary muscle, the muscles worked, the equipment, the tags for an
// exercise card, up to three how-to steps, what to watch for and a video's address.
//
// `convertExerciseDetails` turns the file's tab "All Exercises" into docs/data/exercise-library-details.csv,
// row by row against the review sheet (docs/data/exercise-library-sheet.csv), so each row names the same
// category, sub-group and exercise as the sheet's line of that number. `readExerciseDetails` reads that
// CSV for the import and checks it whole: any problem refuses all of it, naming the line. Each row keeps
// the values as the file writes them; nothing is corrected here.
import type { ListedExercise } from '@fitsphere/shared';
import { parseCsv } from '../foods/csv.ts';
import { EXERCISE_LIBRARY_HEADER, ExerciseListError } from './exerciseList.ts';

/** The owner's file's tab with every row (the other tabs hold the same rows by category). */
export const LIBRARY_FILE_SHEET = 'All Exercises';
/** That tab's header, as the file writes it (2026-11-11). */
export const LIBRARY_FILE_HEADER: readonly string[] = [
  '#',
  'Category (Equipment / Discipline)',
  'Sub-Group',
  'Exercise',
  'Primary Muscle',
  'Muscles Worked',
  'Equipment',
  'Tags (card chips)',
  'How To – Step 1',
  'How To – Step 2',
  'How To – Step 3',
  'Watch For',
  'Video URL',
];
/** docs/data/exercise-library-details.csv (D-81). */
export const EXERCISE_DETAILS_HEADER: readonly string[] = [
  'row',
  'category',
  'sub_group',
  'name',
  'primary_muscle',
  'muscles_worked',
  'equipment',
  'tags',
  'how_to_1',
  'how_to_2',
  'how_to_3',
  'watch_for',
  'video_url',
];

/** How the file lists several muscles or tags in one cell: "Chest · Front delts · Triceps". */
export const DETAIL_LIST_SEPARATOR = ' · ';
/** The file's sub-group for a category with none; the review sheet leaves it empty. */
const NO_SUB_GROUP = 'All';
/** D-67's seven renames, so no two names clash: the file's name, then the review sheet's. */
const RENAMED: ReadonlyMap<string, string> = new Map([
  ['Warrior I (Virabhadrasana I)', 'Warrior 1 (Virabhadrasana I)'],
  ['Warrior II (Virabhadrasana II)', 'Warrior 2 (Virabhadrasana II)'],
  ['Warrior III (Virabhadrasana III)', 'Warrior 3 (Virabhadrasana III)'],
  ['Criss-Cross', 'Criss-Cross (Pilates)'],
  ['Jackknife', 'Jackknife (Pilates)'],
  ['Hip Circles', 'Hip Circles (Pilates)'],
  ['Swimming', 'Swimming (Pilates)'],
]);

const ROW = /^[1-9]\d{0,5}$/;
const LABEL_MAX = 40;
const LIST_MAX = 12;
const TEXT_MAX = 300;
const URL_MAX = 500;

/** One row of the library with its details, as app.exercise_details keeps it. */
export type ExerciseDetail = {
  /** The library's row number (the file's "#"). */
  row: number;
  /** The exercise of the list the row is, as the review sheet says. */
  exerciseCode: string;
  category: string;
  /** Null for a category with no sub-groups. */
  subGroup: string | null;
  primaryMuscle: string;
  musclesWorked: string[];
  equipment: string;
  tags: string[];
  /** One to three steps, in order. */
  howTo: string[];
  watchFor: string;
  videoUrl: string | null;
};

type LibraryLine = { category: string; subGroup: string; name: string; code: string };

/** The review sheet's lines by row number. The import has already checked the sheet itself. */
function libraryLines(libraryText: string): Map<number, LibraryLine> {
  const [header, ...rows] = parseCsv(libraryText);
  if (header?.join(',') !== EXERCISE_LIBRARY_HEADER.join(',')) {
    throw new ExerciseListError(`The exercise library's header must be: ${EXERCISE_LIBRARY_HEADER.join(',')}`);
  }
  const lines = new Map<number, LibraryLine>();
  for (const [row = '', category = '', subGroup = '', name = '', , code = ''] of rows) {
    lines.set(Number(row), { category, subGroup, name, code });
  }
  return lines;
}

/**
 * The file's tab "All Exercises" (`fileRows`, its header first) as the rows of
 * docs/data/exercise-library-details.csv, header first, in row order, with the review sheet's category,
 * sub-group and name; `missing` lists the sheet's rows the file has no row for. Refuses a header other
 * than LIBRARY_FILE_HEADER, a row the sheet does not have or has with another category, sub-group or
 * name (other than D-67's renames), and a row given twice.
 */
export function convertExerciseDetails(fileRows: readonly (readonly string[])[], libraryText: string): { rows: string[][]; missing: number[] } {
  const [header, ...rows] = fileRows;
  if (header?.map((cell) => cell.trim()).join('|') !== LIBRARY_FILE_HEADER.join('|')) {
    throw new ExerciseListError(`The tab "${LIBRARY_FILE_SHEET}" must start with: ${LIBRARY_FILE_HEADER.join(', ')}`);
  }
  const lines = libraryLines(libraryText);
  const converted = new Map<number, string[]>();
  rows.forEach((cells, index) => {
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`${LIBRARY_FILE_SHEET}, line ${index + 2}: ${problem}`);
    };
    const padded = LIBRARY_FILE_HEADER.map((_, at) => (cells[at] ?? '').trim());
    if (padded.every((cell) => cell === '')) return;
    const [number, category, subGroup, name, ...details] = padded as [string, string, string, string, ...string[]];
    if (!ROW.test(number)) refuse(`the row number "${number}" must be a whole number above 0`);
    const row = Number(number);
    const line = lines.get(row) ?? refuse(`row ${row} is not in the review sheet`);
    if (converted.has(row)) refuse(`row ${row} is given twice`);
    const sameSubGroup = subGroup === line.subGroup || (subGroup === NO_SUB_GROUP && line.subGroup === '');
    const sameName = name === line.name || RENAMED.get(name) === line.name;
    if (category !== line.category || !sameSubGroup || !sameName) {
      refuse(`row ${row} is ${name} in ${category} › ${subGroup}, but the review sheet has ${line.name} in ${line.category} › ${line.subGroup || 'no sub-group'}`);
    }
    converted.set(row, [String(row), line.category, line.subGroup, line.name, ...details]);
  });
  const missing = [...lines.keys()].filter((row) => !converted.has(row)).sort((a, b) => a - b);
  const sorted = [...converted.entries()].sort(([a], [b]) => a - b).map(([, fields]) => fields);
  return { rows: [[...EXERCISE_DETAILS_HEADER], ...sorted], missing };
}

/**
 * Parses and checks docs/data/exercise-library-details.csv against the review sheet (`libraryText`) and
 * the list read from it (`exercises`): each line names a row of the sheet, once, with the sheet's
 * category, sub-group and name, and gives that row's exercise its details. A muscle, the equipment or a
 * tag is 1 to 40 characters; 1 to 12 muscles and tags; step 1 is needed, then step 2, then step 3, each
 * at most 300 characters, as is what to watch for; a video's address is blank or starts with https://
 * or http://. Any problem refuses the whole file, naming its line.
 */
export function readExerciseDetails(text: string, libraryText: string, exercises: readonly ListedExercise[]): ExerciseDetail[] {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(',') !== EXERCISE_DETAILS_HEADER.join(',')) {
    throw new ExerciseListError(`The exercise details' header must be: ${EXERCISE_DETAILS_HEADER.join(',')}`);
  }
  const lines = libraryLines(libraryText);
  const byCode = new Map(exercises.map((exercise) => [exercise.code, exercise]));
  const seen = new Set<number>();
  return rows.map((fields, index) => {
    const refuse = (problem: string): never => {
      throw new ExerciseListError(`Exercise details, line ${index + 2}: ${problem}`);
    };
    if (fields.length !== EXERCISE_DETAILS_HEADER.length) refuse(`${fields.length} fields, not ${EXERCISE_DETAILS_HEADER.length}`);
    const [number, category, subGroup, name, primaryMuscle, muscles, equipment, tags, step1, step2, step3, watchFor, videoUrl] =
      fields as [string, string, string, string, string, string, string, string, string, string, string, string, string];
    if (!ROW.test(number)) refuse(`the row "${number}" must be a whole number above 0`);
    const row = Number(number);
    const line = lines.get(row) ?? refuse(`row ${row} is not in the exercise library's review sheet`);
    if (seen.has(row)) refuse(`row ${row} is given twice`);
    seen.add(row);
    if (category !== line.category || subGroup !== line.subGroup || name !== line.name) {
      refuse(`row ${row} of the review sheet is ${line.name} in ${line.category} › ${line.subGroup || 'no sub-group'}`);
    }
    const exercise = byCode.get(line.code) ?? refuse(`${line.code} is not in the exercise list`);
    const label = (value: string, what: string): string => {
      if (value === '' || value.trim() !== value || value.length > LABEL_MAX) {
        refuse(`${what} must be 1 to ${LABEL_MAX} characters, with no spaces at either end`);
      }
      return value;
    };
    const list = (value: string, what: string): string[] => {
      const items = value.split(DETAIL_LIST_SEPARATOR).map((item) => label(item, `each of ${what}`));
      if (items.length > LIST_MAX) refuse(`${what} must list at most ${LIST_MAX}`);
      return items;
    };
    const sentence = (value: string, what: string): string => {
      if (value === '' || value.trim() !== value || value.length > TEXT_MAX) {
        refuse(`${what} must be 1 to ${TEXT_MAX} characters, with no spaces at either end`);
      }
      return value;
    };
    if (step2 === '' && step3 !== '') refuse('step 3 needs step 2');
    const howTo = [sentence(step1, 'step 1'), ...[step2, step3].filter((step) => step !== '').map((step, at) => sentence(step, `step ${at + 2}`))];
    if (videoUrl !== '' && (!/^https?:\/\/\S+$/.test(videoUrl) || videoUrl.length > URL_MAX || !URL.canParse(videoUrl))) {
      refuse(`the video's address "${videoUrl}" must start with https:// (at most ${URL_MAX} characters), or be blank`);
    }
    return {
      row,
      exerciseCode: exercise.code,
      category,
      subGroup: subGroup === '' ? null : subGroup,
      primaryMuscle: label(primaryMuscle, 'the primary muscle'),
      musclesWorked: list(muscles, 'the muscles worked'),
      equipment: label(equipment, 'the equipment'),
      tags: list(tags, 'the tags'),
      howTo,
      watchFor: sentence(watchFor, 'what to watch for'),
      videoUrl: videoUrl === '' ? null : videoUrl,
    };
  });
}
