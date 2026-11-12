// Writes the food list into app.foods (ADR-0006 rule 1): IFCT 2017's foods, and INDB's recipes with
// their servings in app.food_portions (D-46); the approved dishes into app.dishes (D-28); and the
// approved household units into app.food_measures (D-36). USDA's FNDDS foods (D-39) go to their
// archive, app.usda_foods and app.usda_food_portions, not to the food list (D-47). One transaction each: every row is
// inserted or updated by its code, and rows no longer in the file are removed, so running it again
// gives the same table.
import type { PackagedFood } from '@fitsphere/shared';
import type pg from 'pg';
import type { ImportedDish } from './dishes.ts';
import { IFCT_SOURCE, type ImportedFood } from './ifct.ts';
import type { ImportedMeasure } from './measures.ts';
import { withSingleUnits } from './servingUnits.ts';
import type { ImportedPortion } from './usda.ts';

export type ImportResult = { total: number; hidden: number; estimated: number };

/**
 * Rows a statement writes. One statement a row took over half an hour for USDA's 20,000 rows on
 * fitsphere-dev, each a round trip to the database (2026-11-04); a thousand at a time takes seconds.
 */
const ROWS_PER_STATEMENT = 1_000;

function batches<T>(rows: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_STATEMENT) result.push(rows.slice(start, start + ROWS_PER_STATEMENT));
  return result;
}

/** The foods of one source; its foods no longer in the file are removed. */
export async function importFoods(client: pg.ClientBase, foods: ImportedFood[], source: string = IFCT_SOURCE): Promise<ImportResult> {
  await client.query('begin');
  try {
    for (const batch of batches(foods)) {
      await client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal,
           kcal_source, estimated, needs_review, hidden, note, aliases, flag)
         select $1, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal, kcal_source, estimated,
           needs_review, hidden, note, aliases, flag
         from jsonb_to_recordset($2::jsonb) as row (code text, name text, food_group text, protein_g numeric,
           fibre_g numeric, fat_g numeric, carbs_g numeric, kcal numeric, kcal_source text, estimated boolean,
           needs_review boolean, hidden boolean, note text, aliases text[], flag text)
         on conflict (source, code) do update set
           name = excluded.name, food_group = excluded.food_group, protein_g = excluded.protein_g,
           fibre_g = excluded.fibre_g, fat_g = excluded.fat_g, carbs_g = excluded.carbs_g, kcal = excluded.kcal,
           kcal_source = excluded.kcal_source, estimated = excluded.estimated, needs_review = excluded.needs_review,
           hidden = excluded.hidden, note = excluded.note, aliases = excluded.aliases, flag = excluded.flag,
           updated_at = now()`,
        [
          source,
          JSON.stringify(
            batch.map((food) => ({
              code: food.code,
              name: food.name,
              food_group: food.foodGroup,
              protein_g: food.proteinG,
              fibre_g: food.fibreG,
              fat_g: food.fatG,
              carbs_g: food.carbsG,
              kcal: food.kcal,
              kcal_source: food.kcalSource,
              estimated: food.estimated,
              needs_review: food.needsReview,
              hidden: food.hidden,
              note: food.note,
              aliases: food.aliases,
              flag: food.flag ?? null,
            })),
          ),
        ],
      );
    }
    await client.query('delete from app.foods where source = $1 and not (code = any($2::text[]))', [
      source,
      foods.map((food) => food.code),
    ]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return {
    total: foods.length,
    hidden: foods.filter((food) => food.hidden).length,
    estimated: foods.filter((food) => food.estimated).length,
  };
}

/**
 * Makes app.dishes hold exactly the approved dishes: a dish no longer approved is removed, so the
 * phones stop offering it at their next food-list download.
 */
export async function importDishes(client: pg.ClientBase, dishes: ImportedDish[]): Promise<number> {
  await client.query('begin');
  try {
    for (const dish of dishes) {
      await client.query(
        `insert into app.dishes (code, name, portion_unit, kcal, protein_g, carbs_g, fat_g, fibre_g)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (code) do update set
           name = excluded.name, portion_unit = excluded.portion_unit, kcal = excluded.kcal,
           protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
           fibre_g = excluded.fibre_g, updated_at = now()`,
        [dish.code, dish.name, dish.portionUnit, dish.kcal, dish.proteinG, dish.carbsG, dish.fatG, dish.fibreG],
      );
    }
    await client.query('delete from app.dishes where not (code = any($1::text[]))', [dishes.map((dish) => dish.code)]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return dishes.length;
}

/**
 * Makes USDA's archive hold exactly the files' foods and servings (D-47): kept, not served, so a
 * meal logged with a USDA serving before D-47 still checks.
 */
export async function importUsdaArchive(client: pg.ClientBase, foods: ImportedFood[], portions: ImportedPortion[]): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.usda_foods');
    for (const batch of batches(foods)) {
      await client.query(
        `insert into app.usda_foods (code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal)
         select code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal
         from jsonb_to_recordset($1::jsonb) as row (code text, name text, food_group text, protein_g numeric,
           fibre_g numeric, fat_g numeric, carbs_g numeric, kcal numeric)`,
        [
          JSON.stringify(
            batch.map((food) => ({
              code: food.code,
              name: food.name,
              food_group: food.foodGroup,
              protein_g: food.proteinG,
              fibre_g: food.fibreG,
              fat_g: food.fatG,
              carbs_g: food.carbsG,
              kcal: food.kcal,
            })),
          ),
        ],
      );
    }
    for (const batch of batches(portions)) {
      await client.query(
        `insert into app.usda_food_portions (code, seq, label, grams)
         select code, seq, label, grams from jsonb_to_recordset($1::jsonb) as row (code text, seq integer, label text, grams numeric)`,
        [JSON.stringify(batch)],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return foods.length;
}

/**
 * Makes app.packaged_foods hold exactly the file's packaged foods (D-48), with their other names (D-94),
 * in one transaction.
 */
export async function importPackagedFoods(client: pg.ClientBase, foods: readonly PackagedFood[]): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.packaged_foods');
    for (const batch of batches(foods)) {
      await client.query(
        `insert into app.packaged_foods (barcode, name, brand, kcal, protein_g, carbs_g, fat_g, fibre_g, serving_grams, aliases)
         select barcode, name, brand, kcal, protein_g, carbs_g, fat_g, fibre_g, serving_grams, aliases
         from jsonb_to_recordset($1::jsonb) as row (barcode text, name text, brand text, kcal numeric, protein_g numeric,
           carbs_g numeric, fat_g numeric, fibre_g numeric, serving_grams numeric, aliases text[])`,
        [
          JSON.stringify(
            batch.map((food) => ({
              barcode: food.barcode,
              name: food.name,
              brand: food.brand,
              kcal: food.kcal,
              protein_g: food.proteinG,
              carbs_g: food.carbsG,
              fat_g: food.fatG,
              fibre_g: food.fibreG,
              serving_grams: food.servingGrams,
              aliases: food.aliases ?? [],
            })),
          ),
        ],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return foods.length;
}

/**
 * Makes app.food_portions hold exactly a source's servings, and after them the single unit a serving
 * holds several of ("2 slices" also gives "Slice", D-76). Run after importFoods for that source.
 */
export async function importPortions(
  client: pg.ClientBase,
  source: string,
  portions: ImportedPortion[],
): Promise<{ servings: number; units: number }> {
  const rows = withSingleUnits(portions);
  await client.query('begin');
  try {
    await client.query('delete from app.food_portions where source = $1', [source]);
    for (const batch of batches(rows)) {
      await client.query(
        `insert into app.food_portions (source, code, seq, label, grams)
         select $1, code, seq, label, grams from jsonb_to_recordset($2::jsonb) as row (code text, seq integer, label text, grams numeric)`,
        [source, JSON.stringify(batch)],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return { servings: portions.length, units: rows.length - portions.length };
}

/**
 * Makes app.food_measures hold exactly the approved units: a unit no longer approved is removed, so
 * the phones stop offering it at their next food-list download. Run after importFoods.
 */
export async function importMeasures(client: pg.ClientBase, measures: ImportedMeasure[]): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.food_measures');
    for (const { code, measure, grams } of measures) {
      await client.query('insert into app.food_measures (source, code, measure, grams) values ($1, $2, $3, $4)', [
        IFCT_SOURCE,
        code,
        measure,
        grams,
      ]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return measures.length;
}
