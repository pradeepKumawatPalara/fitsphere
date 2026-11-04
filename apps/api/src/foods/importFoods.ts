// Writes the food list into app.foods (ADR-0006 rule 1): IFCT 2017's foods, and USDA's FNDDS foods
// with their servings in app.food_portions (D-39); the approved dishes into app.dishes (D-28); and
// the approved household units into app.food_measures (D-36). One transaction each: every row is
// inserted or updated by its code, and rows no longer in the file are removed, so running it again
// gives the same table.
import type pg from 'pg';
import type { ImportedDish } from './dishes.ts';
import { IFCT_SOURCE, type ImportedFood } from './ifct.ts';
import type { ImportedMeasure } from './measures.ts';
import type { ImportedPortion } from './usda.ts';

export type ImportResult = { total: number; hidden: number; estimated: number };

/** The foods of one source; its foods no longer in the file are removed. */
export async function importFoods(client: pg.ClientBase, foods: ImportedFood[], source: string = IFCT_SOURCE): Promise<ImportResult> {
  await client.query('begin');
  try {
    for (const food of foods) {
      await client.query(
        `insert into app.foods (source, code, name, food_group, protein_g, fibre_g, fat_g, carbs_g, kcal,
           kcal_source, estimated, needs_review, hidden, note, aliases)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (source, code) do update set
           name = excluded.name, food_group = excluded.food_group, protein_g = excluded.protein_g,
           fibre_g = excluded.fibre_g, fat_g = excluded.fat_g, carbs_g = excluded.carbs_g, kcal = excluded.kcal,
           kcal_source = excluded.kcal_source, estimated = excluded.estimated, needs_review = excluded.needs_review,
           hidden = excluded.hidden, note = excluded.note, aliases = excluded.aliases, updated_at = now()`,
        [
          source,
          food.code,
          food.name,
          food.foodGroup,
          food.proteinG,
          food.fibreG,
          food.fatG,
          food.carbsG,
          food.kcal,
          food.kcalSource,
          food.estimated,
          food.needsReview,
          food.hidden,
          food.note,
          food.aliases,
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

/** Makes app.food_portions hold exactly a source's servings. Run after importFoods for that source. */
export async function importPortions(client: pg.ClientBase, source: string, portions: ImportedPortion[]): Promise<number> {
  await client.query('begin');
  try {
    await client.query('delete from app.food_portions where source = $1', [source]);
    for (const { code, seq, label, grams } of portions) {
      await client.query('insert into app.food_portions (source, code, seq, label, grams) values ($1, $2, $3, $4, $5)', [
        source,
        code,
        seq,
        label,
        grams,
      ]);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  }
  return portions.length;
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
