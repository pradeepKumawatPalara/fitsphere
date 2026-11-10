import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EXERCISE_LIBRARY_HEADER,
  EXERCISE_LIST_HEADER,
  ExerciseListError,
  readExerciseLibrary,
  readExerciseList,
  readSpeedMets,
  SPEED_METS_HEADER,
} from './exerciseList.ts';

// The exercise list (D-50): FitSphere's own names and types, with the 2024 Adult Compendium's MET; and
// the exercise library (D-67): the owner's file of exercises by category and sub-group.

const LIST = readFileSync(new URL('../../../../data/exercises/exercise-list.csv', import.meta.url), 'utf8');
const SPEEDS = readFileSync(new URL('../../../../data/exercises/speed-mets.csv', import.meta.url), 'utf8');
const LIBRARY = readFileSync(new URL('../../../../docs/data/exercise-library-sheet.csv', import.meta.url), 'utf8');
const HEADER = EXERCISE_LIST_HEADER.join(',');
const RUNNING = 'running,Running,cardio,distance_time,12145,10.5,run;outdoor run';

function refusal(...rows: string[]): string {
  try {
    readExerciseList([HEADER, ...rows].join('\n'));
  } catch (error) {
    if (error instanceof ExerciseListError) return error.message;
    throw error;
  }
  throw new Error('expected the list to be refused');
}

describe('D-50 the exercise list', () => {
  it('reads every exercise of data/exercises/exercise-list.csv', () => {
    const list = readExerciseList(LIST);
    // 334 until D-67, when the library replaced 47 of them.
    expect(list).toHaveLength(287);
    expect(list.find((exercise) => exercise.code === 'running')).toEqual({
      code: 'running',
      name: 'Running',
      group: 'cardio',
      logType: 'distance_time',
      aliases: ['run', 'outdoor run'],
      compendiumCode: '12145',
      met: 10.5,
      speedMets: [],
      places: [],
    });
    expect(list.find((exercise) => exercise.code === 'kabaddi')).toMatchObject({ compendiumCode: null, met: null, aliases: [] });
    expect(list.find((exercise) => exercise.code === 'dumbbell-incline-bench-press')).toMatchObject({ group: 'dumbbell', logType: 'weight_reps' });
    expect(list.find((exercise) => exercise.code === 'diamond-push-up')).toMatchObject({ group: 'bodyweight', logType: 'reps' });
  });

  it('refuses a wrong header, and a row of the wrong length', () => {
    expect(() => readExerciseList(`code,name\n${RUNNING}`)).toThrow(ExerciseListError);
    expect(refusal('running,Running,cardio')).toBe('Line 2: 3 fields, not 7');
  });

  it('refuses a bad or repeated code, and an unknown group or log type', () => {
    expect(refusal(RUNNING.replace('running,', 'Running Fast,'))).toMatch(/^Line 2: the code "Running Fast"/);
    expect(refusal(RUNNING, RUNNING.replace('Running,', 'Jogging,').replace('run;outdoor run', ''))).toBe('Line 3: the code running is already used');
    expect(refusal(RUNNING.replace(',cardio,', ',gym,'))).toMatch(/^Line 2: the group "gym"/);
    expect(refusal(RUNNING.replace(',distance_time,', ',laps,'))).toMatch(/^Line 2: the log type "laps"/);
  });

  it('takes the Compendium code and MET together, 5 digits and one decimal', () => {
    expect(readExerciseList([HEADER, 'kabaddi,Kabaddi,sport,time_only,,,'].join('\n'))[0]).toMatchObject({ compendiumCode: null, met: null });
    expect(refusal(RUNNING.replace(',10.5,', ',,'))).toBe('Line 2: the Compendium code and the MET go together');
    expect(refusal(RUNNING.replace(',12145,', ',1214,'))).toBe('Line 2: the Compendium code "1214" must be 5 digits');
    for (const met of ['10', '10.55', '0.0', 'ten']) {
      expect(refusal(RUNNING.replace(',10.5,', `,${met},`))).toMatch(/^Line 2: the MET /);
    }
  });

  it('refuses a name or other name used twice, even written differently', () => {
    const jogging = 'jogging,Jogging,cardio,distance_time,12020,7.5,';
    expect(refusal(RUNNING, jogging.replace(/,$/, ',Run'))).toBe(`Line 3: the other name "Run" is also running's`);
    expect(refusal(RUNNING, jogging.replace('Jogging,', 'RUN-NING,'))).toBe(`Line 3: the name is also running's`);
    expect(refusal(RUNNING.replace('run;outdoor run', 'run;running'))).toBe('Line 2: the other name "running" is the name again');
    expect(refusal(RUNNING.replace('Running,', `${'x'.repeat(81)},`))).toMatch(/^Line 2: the name must be 1 to 80 characters/);
    expect(refusal(RUNNING.replace('run;outdoor run', 'run; outdoor run'))).toMatch(/^Line 2: the other name " outdoor run" must be/);
  });
});

describe('D-50 speed bands: the faster, the more burned', () => {
  it('gives running, walking and cycling the Compendium\u2019s activities by speed, slowest first', () => {
    const list = readSpeedMets(SPEEDS, readExerciseList(LIST));
    expect(list.filter((exercise) => exercise.speedMets.length > 0).map((exercise) => exercise.code).sort()).toEqual([
      'brisk-walking',
      'cycling',
      'jogging',
      'running',
      'treadmill-running',
      'treadmill-walking',
      'walking',
    ]);
    const running = list.find((exercise) => exercise.code === 'running')!;
    expect(running.speedMets).toHaveLength(18);
    expect(running.speedMets[0]).toEqual({ fromKmh: 4.2, compendiumCode: '12026', met: 3.3 });
    expect(running.speedMets.find((band) => band.compendiumCode === '12050')).toEqual({ fromKmh: 9.7, compendiumCode: '12050', met: 9.3 });
    expect(list.find((exercise) => exercise.code === 'side-plank')?.speedMets).toEqual([]);
  });

  it('refuses a band for an exercise not listed or not logged with a speed, speeds that do not rise, and a bad value', () => {
    const list = readExerciseList(LIST);
    const header = SPEED_METS_HEADER.join(',');
    const read = (...rows: string[]) => () => readSpeedMets([header, ...rows].join('\n'), list);
    expect(read('moonwalking,5.0,12050,9.3')).toThrow('Speed bands, line 2: moonwalking is not in the exercise list');
    expect(read('side-plank,5.0,12050,9.3')).toThrow('side-plank is not logged with a distance or a speed');
    expect(read('running,6.4,12028,6.5', 'running,6.4,12029,7.8')).toThrow("running's bands must start at rising speeds");
    expect(read('running,6,12028,6.5')).toThrow('the speed "6" must be');
    expect(read('running,6.4,1202,6.5')).toThrow('must be 5 digits');
    expect(read('running,6.4,12028,6.55')).toThrow('the MET "6.55"');
    expect(() => readSpeedMets('code,speed\nrunning,6.4', list)).toThrow(ExerciseListError);
  });
});

describe('D-67 the exercise library', () => {
  const list = readExerciseList(LIST);
  const LIBRARY_HEADER = EXERCISE_LIBRARY_HEADER.join(',');
  const SQUAT = '1,Barbell,Legs,Box Squat Deluxe,new,box-squat-deluxe,barbell,weight_reps,lifted,02052,5.0,,,';
  const read = (...rows: string[]) => () => readExerciseLibrary([LIBRARY_HEADER, ...rows].join('\n'), list);

  it('adds the sheet\u2019s new exercises to the list, each with its places, and gives ours theirs', () => {
    const all = readExerciseLibrary(LIBRARY, list);
    expect(all).toHaveLength(2119);
    expect(all.filter((exercise) => exercise.places.length > 0)).toHaveLength(1832 + 187);
    expect(all.find((exercise) => exercise.code === 'push-press')?.places).toEqual([
      { category: 'Barbell', subGroup: 'Shoulders' },
      { category: 'CrossFit / Functional Fitness', subGroup: 'Weightlifting & Loaded' },
    ]);
    expect(all.find((exercise) => exercise.name === 'Smith Machine Hip Thrust')?.places).toEqual([{ category: 'Smith Machine', subGroup: null }]);
    // A new exercise that replaced one of ours keeps our names to be found by.
    expect(all.find((exercise) => exercise.name === 'Standard Push-Up')).toMatchObject({ logType: 'reps', aliases: ['Push-up', 'pushups', 'press-up'] });
    // With no Compendium activity, no MET: calories are typed.
    expect(all.find((exercise) => exercise.name === 'Sled Push (High Handles)')).toMatchObject({ logType: 'weight_time', met: null });
    expect(readSpeedMets(SPEEDS, all).filter((exercise) => exercise.speedMets.length > 0)).toHaveLength(7);
  });

  it('refuses an unknown category or sub-group, a sub-group for a category without any, and an unknown status', () => {
    expect(read(SQUAT.replace(',Barbell,', ',Barbells,'))).toThrow('Exercise library, line 2: the category "Barbells" is not one of the library\'s');
    expect(read(SQUAT.replace(',Legs,', ',Toes,'))).toThrow('the sub-group "Toes" is not one of Barbell\'s');
    expect(read(SQUAT.replace('Barbell,Legs', 'Smith Machine,Legs'))).toThrow('Smith Machine has no sub-groups');
    expect(read(SQUAT.replace(',new,', ',maybe,'))).toThrow('the status "maybe" must be new');
    expect(() => readExerciseLibrary('row,category\n1,Barbell', list)).toThrow(ExerciseListError);
  });

  it('refuses a name another exercise has, a code already used, a place for an exercise not listed, and a Compendium code with another MET', () => {
    expect(read(SQUAT.replace('Box Squat Deluxe', 'Run'))).toThrow("the name is also running's");
    expect(read(SQUAT.replace(',box-squat-deluxe,', ',running,'))).toThrow('the code running is already used');
    expect(read(SQUAT.replace(',new,box-squat-deluxe,', ',repeat of row 9,nothing-here,'))).toThrow('nothing-here is not an exercise');
    expect(read(SQUAT.replace(',5.0,', ',6.0,'))).toThrow('the Compendium code 02052 has the MET 5');
  });

  it('gives an exercise each of its places once', () => {
    const places = readExerciseLibrary(
      [LIBRARY_HEADER, SQUAT, '2,Barbell,Legs,Box Squat Deluxe,repeat of row 1,box-squat-deluxe,,,,,,,,', '3,Smith Machine,,Box Squat Deluxe,repeat of row 1,box-squat-deluxe,,,,,,,,'].join('\n'),
      list,
    ).find((exercise) => exercise.code === 'box-squat-deluxe')?.places;
    expect(places).toEqual([
      { category: 'Barbell', subGroup: 'Legs' },
      { category: 'Smith Machine', subGroup: null },
    ]);
  });
});
