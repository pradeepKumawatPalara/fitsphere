import { createHash } from 'node:crypto';
import {
  API_BASE_PATH,
  exercisesQuerySchema,
  validationDetails,
  type ExerciseGroup,
  type ExerciseLogType,
  type ExercisesResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { ApiError } from '../errors.ts';

// GET /v1/exercises (D-50): FitSphere's exercise list, for the phone to cache and search offline, with
// each exercise's group, how it is logged and its Compendium MET. Reference data, the same for every
// signed-in user. The version changes whenever any value in the list changes.
export function registerExercisesRoute(app: FastifyInstance, deps: { db: Pick<pg.Pool, 'query'> }) {
  app.get(`${API_BASE_PATH}/exercises`, { config: { access: 'account' } }, async (request) => {
    const parsed = exercisesQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));

    const { rows } = await deps.db.query<{
      code: string;
      name: string;
      exercise_group: ExerciseGroup;
      log_type: ExerciseLogType;
      aliases: string[];
      compendium_code: string | null;
      met: string | null;
    }>('select code, name, exercise_group, log_type, aliases, compendium_code, met from app.exercises order by code');
    const speeds = await deps.db.query<{ exercise_code: string; from_kmh: string; compendium_code: string; met: string }>(
      'select exercise_code, from_kmh, compendium_code, met from app.exercise_speed_mets order by exercise_code, from_kmh',
    );
    const version = createHash('sha256')
      .update(JSON.stringify({ exercises: rows, speeds: speeds.rows }))
      .digest('base64url')
      .slice(0, 22);
    if (parsed.data.version === version) return { version, items: null } satisfies ExercisesResponse;

    const speedMetsOf = new Map<string, { fromKmh: number; compendiumCode: string; met: number }[]>();
    for (const row of speeds.rows) {
      const band = { fromKmh: Number(row.from_kmh), compendiumCode: row.compendium_code, met: Number(row.met) };
      speedMetsOf.set(row.exercise_code, [...(speedMetsOf.get(row.exercise_code) ?? []), band]);
    }
    const body: ExercisesResponse = {
      version,
      items: rows.map((row) => ({
        code: row.code,
        name: row.name,
        group: row.exercise_group,
        logType: row.log_type,
        aliases: row.aliases,
        compendiumCode: row.compendium_code,
        met: row.met === null ? null : Number(row.met),
        speedMets: speedMetsOf.get(row.code) ?? [],
      })),
    };
    return body;
  });
}
