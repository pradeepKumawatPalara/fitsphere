// Writes the IFCT food list into app.foods (ADR-0006 rule 1). One transaction: every row is
// inserted or updated by its code, and rows no longer in the file are removed, so running it again
// gives the same table.
import type pg from 'pg';
import { IFCT_SOURCE, type ImportedFood } from './ifct.ts';

export type ImportResult = { total: number; hidden: number; estimated: number };

export async function importFoods(client: pg.ClientBase, foods: ImportedFood[]): Promise<ImportResult> {
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
          IFCT_SOURCE,
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
      IFCT_SOURCE,
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
