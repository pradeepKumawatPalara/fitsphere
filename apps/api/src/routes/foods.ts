import { createHash } from 'node:crypto';
import { API_BASE_PATH, foodsQuerySchema, validationDetails, type DishPortionUnit, type FoodMeasure, type FoodsResponse } from '@fitsphere/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { ApiError } from '../errors.ts';

// GET /v1/foods (ADR-0006 rule 1): FitSphere's food list, for the phone to cache and search
// offline, with the approved dishes and their values for one portion (D-28), and each food's
// approved household units with the grams one holds (D-36). Reference data, the same for every
// signed-in user. Rows hidden until checked are left out, and so are the recipes' ingredients and
// grams. The version changes whenever any value in the list changes.
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
    const dishes = await deps.db.query<{
      code: string;
      name: string;
      portion_unit: DishPortionUnit;
      kcal: string;
      protein_g: string;
      carbs_g: string;
      fat_g: string;
      fibre_g: string;
    }>('select code, name, portion_unit, kcal, protein_g, carbs_g, fat_g, fibre_g from app.dishes order by code');
    const measures = await deps.db.query<{ source: string; code: string; measure: FoodMeasure; grams: string }>(
      `select source, code, measure, grams from app.food_measures
       order by source, code, array_position(array['teaspoon', 'tablespoon', 'katori', 'glass', 'piece'], measure)`,
    );
    const measuresOf = new Map<string, { measure: FoodMeasure; grams: number }[]>();
    for (const row of measures.rows) {
      const key = `${row.source} ${row.code}`;
      measuresOf.set(key, [...(measuresOf.get(key) ?? []), { measure: row.measure, grams: Number(row.grams) }]);
    }
    const version = foodListVersion({ foods: rows, dishes: dishes.rows, measures: measures.rows });
    if (parsed.data.version === version) return { version, items: null, dishes: null } satisfies FoodsResponse;

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
        measures: measuresOf.get(`${row.source} ${row.code}`) ?? [],
      })),
      dishes: dishes.rows.map((row) => ({
        code: row.code,
        name: row.name,
        portionUnit: row.portion_unit,
        kcal: Number(row.kcal),
        proteinG: Number(row.protein_g),
        carbsG: Number(row.carbs_g),
        fatG: Number(row.fat_g),
        fibreG: Number(row.fibre_g),
      })),
    };
    return body;
  });
}

/** A short hash of every value the phone receives, so any change gives a new version. */
function foodListVersion(list: { foods: object[]; dishes: object[]; measures: object[] }): string {
  return createHash('sha256').update(JSON.stringify(list)).digest('base64url').slice(0, 22);
}
