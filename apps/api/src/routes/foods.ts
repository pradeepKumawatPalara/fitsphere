import { createHash } from 'node:crypto';
import { API_BASE_PATH, foodsQuerySchema, validationDetails, type FoodsResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { ApiError } from '../errors.ts';

// GET /v1/foods (ADR-0006 rule 1): FitSphere's food list, for the phone to cache and search
// offline. Reference data, the same for every signed-in user. Rows hidden until checked are left
// out. The version changes whenever any value in the list changes.
export function registerFoodsRoute(app: FastifyInstance, deps: { db: Pick<pg.Pool, 'query'> }) {
  app.get(`${API_BASE_PATH}/foods`, { config: { access: 'account' } }, async (request) => {
    const parsed = foodsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw new ApiError('VALIDATION_FAILED', validationDetails(parsed.error, request.query));

    const { rows } = await deps.db.query<{
      source: 'ifct2017';
      code: string;
      name: string;
      food_group: string;
      aliases: string[];
      protein_g: string;
      fibre_g: string;
      fat_g: string;
      carbs_g: string;
      kcal: string;
      estimated: boolean;
    }>(
      `select source, code, name, food_group, aliases, protein_g, fibre_g, fat_g, carbs_g, kcal, estimated
       from app.foods where not hidden order by source, code`,
    );
    const version = foodListVersion(rows);
    if (parsed.data.version === version) return { version, items: null } satisfies FoodsResponse;

    const body: FoodsResponse = {
      version,
      items: rows.map((row) => ({
        source: row.source,
        code: row.code,
        name: row.name,
        foodGroup: row.food_group,
        aliases: row.aliases,
        proteinG: Number(row.protein_g),
        fibreG: Number(row.fibre_g),
        fatG: Number(row.fat_g),
        carbsG: Number(row.carbs_g),
        kcal: Number(row.kcal),
        kcalEstimated: row.estimated,
      })),
    };
    return body;
  });
}

/** A short hash of every value the phone receives, so any change gives a new version. */
function foodListVersion(rows: object[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('base64url').slice(0, 22);
}
