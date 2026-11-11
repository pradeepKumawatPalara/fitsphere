import { createHash } from 'node:crypto';
import {
  API_BASE_PATH,
  exercisesQuerySchema,
  validationDetails,
  type ExerciseDetails,
  type ExerciseGroup,
  type ExerciseLogType,
  type ExercisePlace,
  type ExercisesResponse,
} from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { ApiError } from '../errors.ts';

// GET /v1/exercises (D-50): FitSphere's exercise list, for the phone to cache and search offline, with
// each exercise's group, how it is logged, its Compendium MET, the library's categories and
// sub-groups it is listed under (D-67), and how to do it (D-82): the details of its first place in the
// library (D-81), with the first video address any of its places gives. Reference data, the same for
// every signed-in user. The version changes whenever any value in the list changes.
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
      places: ExercisePlace[];
    }>('select code, name, exercise_group, log_type, aliases, compendium_code, met, places from app.exercises order by code');
    const speeds = await deps.db.query<{ exercise_code: string; from_kmh: string; compendium_code: string; met: string }>(
      'select exercise_code, from_kmh, compendium_code, met from app.exercise_speed_mets order by exercise_code, from_kmh',
    );
    const details = await deps.db.query<{
      exercise_code: string;
      category: string;
      sub_group: string | null;
      primary_muscle: string;
      muscles_worked: string[];
      equipment: string;
      tags: string[];
      how_to: string[];
      watch_for: string;
      video_url: string | null;
    }>(
      `select distinct on (d.exercise_code) d.exercise_code, d.category, d.sub_group, d.primary_muscle, d.muscles_worked,
         d.equipment, d.tags, d.how_to, d.watch_for,
         (select v.video_url from app.exercise_details v
          where v.exercise_code = d.exercise_code and v.video_url is not null order by v.library_row limit 1) as video_url
       from app.exercise_details d
       order by d.exercise_code, d.library_row`,
    );
    const version = createHash('sha256')
      .update(JSON.stringify({ exercises: rows, speeds: speeds.rows, details: details.rows }))
      .digest('base64url')
      .slice(0, 22);
    if (parsed.data.version === version) return { version, items: null } satisfies ExercisesResponse;

    const detailsOf = new Map<string, ExerciseDetails>(
      details.rows.map((row) => [
        row.exercise_code,
        {
          place: { category: row.category, subGroup: row.sub_group },
          primaryMuscle: row.primary_muscle,
          musclesWorked: row.muscles_worked,
          equipment: row.equipment,
          tags: row.tags,
          howTo: row.how_to,
          watchFor: row.watch_for,
          videoUrl: row.video_url,
        },
      ]),
    );

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
        places: row.places,
        details: detailsOf.get(row.code) ?? null,
      })),
    };
    return body;
  });
}
