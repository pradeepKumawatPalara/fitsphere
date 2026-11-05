import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXERCISE_LIST_HEADER, ExerciseListError, readExerciseList } from './exerciseList.ts';

// The exercise list (D-50): FitSphere's own names and types, with the 2024 Adult Compendium's MET.

const LIST = readFileSync(new URL('../../../../data/exercises/exercise-list.csv', import.meta.url), 'utf8');
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
    expect(list).toHaveLength(334);
    expect(list.find((exercise) => exercise.code === 'running')).toEqual({
      code: 'running',
      name: 'Running',
      group: 'cardio',
      logType: 'distance_time',
      aliases: ['run', 'outdoor run'],
      compendiumCode: '12145',
      met: 10.5,
    });
    expect(list.find((exercise) => exercise.code === 'kabaddi')).toMatchObject({ compendiumCode: null, met: null, aliases: [] });
    expect(list.find((exercise) => exercise.code === 'dumbbell-bench-press')).toMatchObject({ group: 'dumbbell', logType: 'weight_reps' });
    expect(list.find((exercise) => exercise.code === 'push-up')).toMatchObject({ group: 'bodyweight', logType: 'reps' });
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
