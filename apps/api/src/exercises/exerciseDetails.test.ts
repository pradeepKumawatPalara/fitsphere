import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../foods/csv.ts';
import { convertExerciseDetails, EXERCISE_DETAILS_HEADER, LIBRARY_FILE_HEADER, readExerciseDetails } from './exerciseDetails.ts';
import { ExerciseListError, readExerciseLibrary, readExerciseList } from './exerciseList.ts';

// The exercise library's details (D-81): each row's muscles, equipment, tags, how-to steps, what to
// watch for and video address, from the owner's file, kept row by row against the review sheet.

const LIBRARY = readFileSync(new URL('../../../../docs/data/exercise-library-sheet.csv', import.meta.url), 'utf8');
const DETAILS = readFileSync(new URL('../../../../docs/data/exercise-library-details.csv', import.meta.url), 'utf8');
const LIST = readExerciseLibrary(LIBRARY, readExerciseList(readFileSync(new URL('../../../../data/exercises/exercise-list.csv', import.meta.url), 'utf8')));
const [, FIRST = []] = parseCsv(DETAILS);

/** The details file with only these lines (as fields), header first. */
function file(...lines: string[][]): string {
  return toCsv([[...EXERCISE_DETAILS_HEADER], ...lines]);
}

/** Row 1 (Barbell Flat Bench Press) with some fields changed, by column name. */
function first(changes: Partial<Record<(typeof EXERCISE_DETAILS_HEADER)[number], string>>): string[] {
  return EXERCISE_DETAILS_HEADER.map((column, at) => changes[column] ?? FIRST[at] ?? '');
}

function refusal(text: string): string {
  try {
    readExerciseDetails(text, LIBRARY, LIST);
  } catch (error) {
    if (error instanceof ExerciseListError) return error.message;
    throw error;
  }
  throw new Error('expected the details to be refused');
}

describe('D-81 the exercise library details file', () => {
  const details = readExerciseDetails(DETAILS, LIBRARY, LIST);

  it('gives every row of the review sheet its details, each to an exercise of the list', () => {
    expect(details).toHaveLength(2090);
    expect(details.map((detail) => detail.row)).toEqual(Array.from({ length: 2090 }, (_, at) => at + 1));
    const codes = new Set(LIST.map((exercise) => exercise.code));
    expect(details.every((detail) => codes.has(detail.exerciseCode))).toBe(true);
    expect(details.filter((detail) => detail.videoUrl !== null)).toHaveLength(0);
  });

  it('keeps a row as the file writes it, muscles and tags as lists and the steps in order', () => {
    expect(details[0]).toEqual({
      row: 1,
      exerciseCode: 'barbell-flat-bench-press',
      category: 'Barbell',
      subGroup: 'Chest',
      primaryMuscle: 'Chest',
      musclesWorked: ['Chest', 'Front delts', 'Triceps'],
      equipment: 'Barbell',
      tags: ['Chest', 'Front delts', 'Triceps', 'Barbell'],
      howTo: [
        'Lie on a flat bench, eyes under the bar, feet planted, grip slightly wider than shoulders.',
        'Unrack, lower the bar under control to mid-chest with elbows about 45° from your body.',
        'Press back up to straight arms over your shoulders.',
      ],
      watchFor: 'Flaring elbows to 90°. Bouncing the bar off the chest. Hips lifting off the bench.',
      videoUrl: null,
    });
  });

  it('keeps each place of an exercise its own details, and a category with no sub-groups none', () => {
    const devilPress = details.filter((detail) => detail.exerciseCode === 'devil-press');
    expect(devilPress.map((detail) => [detail.category, detail.equipment])).toEqual([
      ['Dumbbell', 'Dumbbell'],
      ['Plyometrics / Jumps', 'Bodyweight'],
      ['CrossFit / Functional Fitness', 'Barbell'],
    ]);
    // Two rows of one place for one exercise (two of the file's names are our Treadmill Running).
    expect(details.filter((detail) => detail.exerciseCode === 'treadmill-running').map((detail) => detail.row)).toEqual([1555, 1556]);
    expect(details[595]).toMatchObject({ row: 596, category: 'Smith Machine', subGroup: null });
    // D-67's renames: the review sheet's name.
    expect(details[1860]).toMatchObject({ row: 1861, exerciseCode: 'warrior-1-virabhadrasana-i' });
  });

  it('accepts a video address starting with https:// or http://', () => {
    const [detail] = readExerciseDetails(file(first({ video_url: 'https://www.youtube.com/watch?v=abc123' })), LIBRARY, LIST);
    expect(detail?.videoUrl).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('refuses a row that is not the review sheet’s, or given twice, naming the line', () => {
    expect(refusal('row,category\n')).toMatch(/header must be/);
    expect(refusal(file(first({ row: '9999' })))).toBe("Exercise details, line 2: row 9999 is not in the exercise library's review sheet");
    expect(refusal(file(first({ name: 'Bench Press' })))).toBe('Exercise details, line 2: row 1 of the review sheet is Barbell Flat Bench Press in Barbell › Chest');
    expect(refusal(file(first({ sub_group: 'Back' })))).toMatch(/row 1 of the review sheet is/);
    expect(refusal(file(first({}), first({})))).toBe('Exercise details, line 3: row 1 is given twice');
    expect(refusal(file(first({}).slice(0, 12)))).toBe('Exercise details, line 2: 12 fields, not 13');
  });

  it('refuses missing or long values, a step 3 with no step 2 and an address that is not a web address', () => {
    expect(refusal(file(first({ primary_muscle: '' })))).toMatch(/the primary muscle must be 1 to 40 characters/);
    expect(refusal(file(first({ equipment: 'Barbell ' })))).toMatch(/the equipment must be 1 to 40 characters, with no spaces/);
    expect(refusal(file(first({ muscles_worked: 'Chest ·  · Triceps' })))).toMatch(/each of the muscles worked must be/);
    expect(refusal(file(first({ tags: Array.from({ length: 13 }, (_, at) => `Tag ${at}`).join(' · ') })))).toMatch(/the tags must list at most 12/);
    expect(refusal(file(first({ how_to_1: '' })))).toMatch(/step 1 must be 1 to 300 characters/);
    expect(refusal(file(first({ how_to_2: '' })))).toBe('Exercise details, line 2: step 3 needs step 2');
    expect(refusal(file(first({ watch_for: 'x'.repeat(301) })))).toMatch(/what to watch for must be 1 to 300 characters/);
    expect(refusal(file(first({ video_url: 'www.youtube.com/watch?v=abc123' })))).toMatch(/must start with https:\/\//);
    expect(refusal(file(first({ video_url: 'https://www.youtube.com/watch?v=a b' })))).toMatch(/must start with https:\/\//);
  });

  it('takes only steps 1 and 2 when the third is blank', () => {
    const [detail] = readExerciseDetails(file(first({ how_to_3: '' })), LIBRARY, LIST);
    expect(detail?.howTo).toHaveLength(2);
  });
});

describe('D-81 converting the owner’s file', () => {
  const details = (row: string[]): string[] => [...row, 'Chest', 'Chest · Triceps', 'Barbell', 'Chest · Triceps · Barbell', 'Lie down.', 'Lower.', 'Press.', 'Bouncing.', ''];

  it('writes each row with the review sheet’s category, sub-group and name, in row order, and lists the rows it lacks', () => {
    const { rows, missing } = convertExerciseDetails(
      [
        [...LIBRARY_FILE_HEADER],
        details(['596', 'Smith Machine', 'All', 'Smith Machine Squat']),
        [],
        details(['1861', 'Yoga', 'Standing', 'Warrior I (Virabhadrasana I)']),
        details(['1', 'Barbell', 'Chest', 'Barbell Flat Bench Press']).slice(0, 12),
      ],
      LIBRARY,
    );

    expect(rows.map((row) => row.slice(0, 5))).toEqual([
      ['row', 'category', 'sub_group', 'name', 'primary_muscle'],
      ['1', 'Barbell', 'Chest', 'Barbell Flat Bench Press', 'Chest'],
      ['596', 'Smith Machine', '', 'Smith Machine Squat', 'Chest'],
      ['1861', 'Yoga', 'Standing', 'Warrior 1 (Virabhadrasana I)', 'Chest'],
    ]);
    expect(rows[1]).toHaveLength(13);
    expect(rows[1]?.at(-1)).toBe('');
    expect(missing).toHaveLength(2087);
    expect(missing.slice(0, 3)).toEqual([2, 3, 4]);
  });

  it('refuses another header, a row the review sheet has otherwise, and a row given twice', () => {
    expect(() => convertExerciseDetails([['#', 'Category']], LIBRARY)).toThrow('must start with');
    expect(() => convertExerciseDetails([[...LIBRARY_FILE_HEADER], details(['1', 'Barbell', 'Back', 'Barbell Flat Bench Press'])], LIBRARY)).toThrow(
      'All Exercises, line 2: row 1 is Barbell Flat Bench Press in Barbell › Back, but the review sheet has Barbell Flat Bench Press in Barbell › Chest',
    );
    expect(() => convertExerciseDetails([[...LIBRARY_FILE_HEADER], details(['9999', 'Barbell', 'Chest', 'X'])], LIBRARY)).toThrow('row 9999 is not in the review sheet');
    const row = details(['1', 'Barbell', 'Chest', 'Barbell Flat Bench Press']);
    expect(() => convertExerciseDetails([[...LIBRARY_FILE_HEADER], row, row], LIBRARY)).toThrow('line 3: row 1 is given twice');
  });
});
