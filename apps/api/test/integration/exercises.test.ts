import { readFileSync } from 'node:fs';
import type { ExercisesResponse } from '@fitsphere/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importExercises, readExerciseList, readSpeedMets } from '../../src/exercises/exerciseList.ts';
import { createTestKeys, signToken } from '../helpers/auth.ts';
import { startTestApi } from './app.ts';
import { connect } from './database.ts';

// The exercise-list import into PostgreSQL and GET /v1/exercises (D-50).

const LIST = readSpeedMets(
  readFileSync(new URL('../../../../data/exercises/speed-mets.csv', import.meta.url), 'utf8'),
  readExerciseList(readFileSync(new URL('../../../../data/exercises/exercise-list.csv', import.meta.url), 'utf8')),
);

let client: pg.Client;
let api: Awaited<ReturnType<typeof startTestApi>>;

beforeAll(async () => {
  client = await connect();
  await importExercises(client, LIST);
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
    expect(rows[0]).toEqual({ total: 334, without: 2 });
    const running = await client.query(`select log_type, compendium_code, met::text, aliases from app.exercises where code = 'running'`);
    expect(running.rows).toEqual([{ log_type: 'distance_time', compendium_code: '12145', met: '10.5', aliases: ['run', 'outdoor run'] }]);
    const bands = await client.query(`select count(*)::int as n from app.exercise_speed_mets`);
    expect(bands.rows).toEqual([{ n: 87 }]);
  });

  it('gives the same table when run again, removes an exercise no longer listed, and leaves the table as it was on a failure', async () => {
    await importExercises(client, LIST.filter((exercise) => exercise.code !== 'kabaddi' && exercise.code !== 'cycling'));
    expect((await client.query(`select 1 from app.exercises where code = 'kabaddi'`)).rowCount).toBe(0);
    expect((await client.query(`select 1 from app.exercise_speed_mets where exercise_code = 'cycling'`)).rowCount).toBe(0);

    await expect(importExercises(client, [...LIST.slice(0, 5), { ...LIST[5]!, met: -1 }])).rejects.toThrow();
    expect((await client.query(`select count(*)::int as n from app.exercises`)).rows[0]?.n).toBe(332);

    await importExercises(client, LIST);
    expect((await client.query(`select count(*)::int as n from app.exercises`)).rows[0]?.n).toBe(334);
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
    expect(body.items).toHaveLength(334);
    expect(body.items?.find((exercise) => exercise.code === 'push-up')).toEqual({
      code: 'push-up',
      name: 'Push-up',
      group: 'bodyweight',
      logType: 'reps',
      aliases: ['pushups', 'press-up'],
      compendiumCode: '02022',
      met: 3.8,
      speedMets: [],
    });
    expect(body.items?.find((exercise) => exercise.code === 'running')?.speedMets.slice(0, 2)).toEqual([
      { fromKmh: 4.2, compendiumCode: '12026', met: 3.3 },
      { fromKmh: 6.4, compendiumCode: '12028', met: 6.5 },
    ]);
    expect(body.items?.find((exercise) => exercise.code === 'kho-kho')).toMatchObject({ compendiumCode: null, met: null });

    const again = await getExercises(user.token, `?version=${encodeURIComponent(body.version)}`);
    expect(again.json()).toEqual({ version: body.version, items: null });
  });

  it('REQ-NFR-001 refuses an unknown query field', async () => {
    const user = await api.signUpWithAccount();

    const response = await getExercises(user.token, '?limit=5');

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });
});
