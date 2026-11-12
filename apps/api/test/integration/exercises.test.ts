import { readFileSync } from 'node:fs';
import type { ExercisesResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readExerciseDetails } from '../../src/exercises/exerciseDetails.ts';
import { importExercises, readExerciseLibrary, readExerciseList, readSpeedMets } from '../../src/exercises/exerciseList.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';
import { connect } from './database.ts';

// The exercise-list import into PostgreSQL and GET /v1/exercises (D-50), with the exercise library's
// exercises and places (D-67) and each library row's details (D-81).

const LIBRARY = readFileSync(new URL('../../../../docs/data/exercise-library-sheet.csv', import.meta.url), 'utf8');
const LIST = readSpeedMets(
  readFileSync(new URL('../../../../data/exercises/speed-mets.csv', import.meta.url), 'utf8'),
  readExerciseLibrary(LIBRARY, readExerciseList(readFileSync(new URL('../../../../data/exercises/exercise-list.csv', import.meta.url), 'utf8'))),
);
const DETAILS = readExerciseDetails(
  readFileSync(new URL('../../../../docs/data/exercise-library-details.csv', import.meta.url), 'utf8'),
  LIBRARY,
  LIST,
);

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  client = await connect();
  await importExercises(client, LIST, DETAILS);
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
  await client.end();
});

async function getExercises(token: string | null, query = '') {
  return api.app.inject({
    method: 'GET',
    url: `/v1/exercises${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('D-50 exercises:import', () => {
  it('imports every exercise, with its Compendium MET as printed', async () => {
    const { rows } = await client.query<{ total: number; without: number }>(
      `select count(*)::int as total, count(*) filter (where met is null)::int as without from app.exercises`,
    );
    expect(rows[0]).toEqual({ total: 2119, without: 270 });
    const running = await client.query(`select log_type, compendium_code, met::text, aliases from app.exercises where code = 'running'`);
    expect(running.rows).toEqual([{ log_type: 'distance_time', compendium_code: '12145', met: '10.5', aliases: ['run', 'outdoor run'] }]);
    const bands = await client.query(`select count(*)::int as n from app.exercise_speed_mets`);
    expect(bands.rows).toEqual([{ n: 87 }]);
    const pushPress = await client.query(`select places from app.exercises where code = 'push-press'`);
    expect(pushPress.rows).toEqual([
      {
        places: [
          { category: 'Barbell', subGroup: 'Shoulders' },
          { category: 'CrossFit / Functional Fitness', subGroup: 'Weightlifting & Loaded' },
        ],
      },
    ]);
    const placed = await client.query(`select count(*)::int as n from app.exercises where places <> '[]'::jsonb`);
    expect(placed.rows).toEqual([{ n: 2019 }]);
  });

  it('D-81 imports every library row’s details, each place of an exercise with its own', async () => {
    const { rows } = await client.query(`select count(*)::int as total, count(distinct exercise_code)::int as exercises,
      count(video_url)::int as videos from app.exercise_details`);
    expect(rows[0]).toEqual({ total: 2090, exercises: 2019, videos: 0 });
    const bench = await client.query(
      `select exercise_code, category, sub_group, primary_muscle, muscles_worked, equipment, tags, how_to, watch_for, video_url
       from app.exercise_details where library_row = 1`,
    );
    expect(bench.rows).toEqual([
      {
        exercise_code: 'barbell-flat-bench-press',
        category: 'Barbell',
        sub_group: 'Chest',
        primary_muscle: 'Chest',
        muscles_worked: ['Chest', 'Front delts', 'Triceps'],
        equipment: 'Barbell',
        tags: ['Chest', 'Front delts', 'Triceps', 'Barbell'],
        how_to: [
          'Lie on a flat bench, eyes under the bar, feet planted, grip slightly wider than shoulders.',
          'Unrack, lower the bar under control to mid-chest with elbows about 45° from your body.',
          'Press back up to straight arms over your shoulders.',
        ],
        watch_for: 'Flaring elbows to 90°. Bouncing the bar off the chest. Hips lifting off the bench.',
        video_url: null,
      },
    ]);
    const devilPress = await client.query(
      `select category, equipment from app.exercise_details where exercise_code = 'devil-press' order by library_row`,
    );
    expect(devilPress.rows).toEqual([
      { category: 'Dumbbell', equipment: 'Dumbbell' },
      { category: 'Plyometrics / Jumps', equipment: 'Bodyweight' },
      { category: 'CrossFit / Functional Fitness', equipment: 'Barbell' },
    ]);
    const smith = await client.query(`select sub_group from app.exercise_details where library_row = 596`);
    expect(smith.rows).toEqual([{ sub_group: null }]);
  });

  it('D-81 refuses a video address that is not a web address, and the details leave with their exercise', async () => {
    await expect(
      client.query(
        `update app.exercise_details set video_url = 'www.youtube.com/watch?v=abc' where library_row = 1`,
      ),
    ).rejects.toThrow(/check constraint/);
    await importExercises(
      client,
      LIST.filter((exercise) => exercise.code !== 'devil-press'),
      DETAILS.filter((detail) => detail.exerciseCode !== 'devil-press'),
    );
    expect((await client.query(`select count(*)::int as n from app.exercise_details`)).rows[0]?.n).toBe(2087);
    await importExercises(client, LIST, DETAILS);
    expect((await client.query(`select count(*)::int as n from app.exercise_details`)).rows[0]?.n).toBe(2090);
  });

  it('gives the same table when run again, removes an exercise no longer listed, and leaves the table as it was on a failure', async () => {
    await importExercises(client, LIST.filter((exercise) => exercise.code !== 'kabaddi' && exercise.code !== 'cycling'));
    expect((await client.query(`select 1 from app.exercises where code = 'kabaddi'`)).rowCount).toBe(0);
    expect((await client.query(`select 1 from app.exercise_speed_mets where exercise_code = 'cycling'`)).rowCount).toBe(0);

    await expect(importExercises(client, [...LIST.slice(0, 5), { ...LIST[5]!, met: -1 }])).rejects.toThrow();
    expect((await client.query(`select count(*)::int as n from app.exercises`)).rows[0]?.n).toBe(2117);

    await importExercises(client, LIST, DETAILS);
    expect((await client.query(`select count(*)::int as n from app.exercises`)).rows[0]?.n).toBe(2119);
    expect((await client.query(`select count(*)::int as n from app.exercise_details`)).rows[0]?.n).toBe(2090);
  });
});

describe('authorization: GET /v1/exercises', () => {
  it('REQ-NFR-001 no token, an expired token or another key get 401', async () => {
    const user = await api.signUpWithAccount();
    const other = await createTestKeys();
    for (const token of [
      null,
      await signToken(api.keys, user.subject, { expiresAt: Math.floor(Date.now() / 1000) - 1 }),
      await signToken(other.keys, user.subject),
    ]) {
      expect((await getExercises(token)).statusCode).toBe(401);
    }
  });

  it('REQ-ACC-010 signed in without an account gets 403 ACCOUNT_SETUP_REQUIRED', async () => {
    const user = await api.signUp();

    const response = await getExercises(user.token);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ACCOUNT_SETUP_REQUIRED');
  });

  it('D-50 a user with an account gets the list, and nothing more while the version is current', async () => {
    const user = await api.signUpWithAccount();

    const response = await getExercises(user.token);

    expect(response.statusCode).toBe(200);
    const body: ExercisesResponse = response.json();
    expect(body.items).toHaveLength(2119);
    expect(body.items?.find((exercise) => exercise.code === 'standard-push-up')).toEqual({
      code: 'standard-push-up',
      name: 'Standard Push-Up',
      group: 'bodyweight',
      logType: 'reps',
      aliases: ['Push-up', 'pushups', 'press-up'],
      compendiumCode: '02022',
      met: 3.8,
      speedMets: [],
      places: [{ category: 'Bodyweight / Calisthenics', subGroup: 'Push' }],
      details: expect.objectContaining({ place: { category: 'Bodyweight / Calisthenics', subGroup: 'Push' }, primaryMuscle: 'Chest' }),
    });
    expect(body.items?.find((exercise) => exercise.code === 'kabaddi')?.places).toEqual([]);
    expect(body.items?.find((exercise) => exercise.code === 'running')?.speedMets.slice(0, 2)).toEqual([
      { fromKmh: 4.2, compendiumCode: '12026', met: 3.3 },
      { fromKmh: 6.4, compendiumCode: '12028', met: 6.5 },
    ]);
    expect(body.items?.find((exercise) => exercise.code === 'kho-kho')).toMatchObject({ compendiumCode: null, met: null });

    const again = await getExercises(user.token, `?version=${encodeURIComponent(body.version)}`);
    expect(again.json()).toEqual({ version: body.version, items: null });
  });

  it('D-82 sends how to do each exercise, from its first place, with the first video any place gives', async () => {
    const user = await api.signUpWithAccount();
    const first: ExercisesResponse = (await getExercises(user.token)).json();
    const find = (body: ExercisesResponse, code: string) => body.items?.find((exercise) => exercise.code === code);

    expect(find(first, 'dumbbell-shrug')?.details).toEqual({
      place: { category: 'Dumbbell', subGroup: 'Shoulders' },
      primaryMuscle: 'Traps',
      musclesWorked: ['Traps', 'Upper back', 'Forearms'],
      equipment: 'Dumbbell',
      tags: ['Traps', 'Upper back', 'Forearms', 'Dumbbell'],
      howTo: [
        'Stand tall holding the weight with straight arms.',
        'Lift your shoulders straight up towards your ears.',
        'Pause at the top, then lower all the way down.',
      ],
      watchFor: 'Rolling the shoulders in circles. Bending the elbows. Nodding the head forward.',
      videoUrl: null,
    });
    // Devil Press is in three places with three different equipments: the first place's.
    expect(find(first, 'devil-press')?.details).toMatchObject({ place: { category: 'Dumbbell', subGroup: 'Full Body' }, equipment: 'Dumbbell' });
    // Our own Running is in no place of the library.
    expect(find(first, 'running')?.details).toBeNull();

    // A video given only for Devil Press's second place is its video, and the list's version changes.
    await client.query(`update app.exercise_details set video_url = 'https://www.youtube.com/watch?v=devil' where library_row = 1059`);
    try {
      const second: ExercisesResponse = (await getExercises(user.token, `?version=${encodeURIComponent(first.version)}`)).json();
      expect(second.version).not.toBe(first.version);
      expect(find(second, 'devil-press')?.details).toMatchObject({ equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=devil' });
    } finally {
      await client.query(`update app.exercise_details set video_url = null where library_row = 1059`);
    }
  });

  it('REQ-NFR-001 refuses an unknown query field', async () => {
    const user = await api.signUpWithAccount();

    const response = await getExercises(user.token, '?limit=5');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });
});
