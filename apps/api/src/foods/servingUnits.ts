// The one thing a food's serving holds several of, as one more serving of the food (D-76): "2
// slices" of 56 g also gives "Slice" of 28 g, "Plate (4 pc)" of 60 g gives "Piece" of 15 g, and
// "1/4 cup" of 30 g gives "Cup" of 120 g. The grams are the serving's, divided: nothing is guessed.
// A serving of one ("Slice", "Tea cup") already is that unit and gives nothing more.
import { MEAL_ITEM_GRAMS_MAX, OZ_SERVING_LABEL } from '@fitsphere/shared';
import { FoodListError } from './ifct.ts';
import type { ImportedPortion } from './usda.ts';

/** "(4 pc)", "(15 pcs)", "(6 pieces)" at the end of a serving's name. */
const PIECES = /^.+?\s*\((\d+)\s*(?:pc|pcs|pieces?)\)$/i;
/** "2 slices", "3 biscuits", "1/4 cup": a whole number or a fraction, then the thing's name. */
const COUNTED = /^(\d+)(?:\/(\d+))?\s+([a-z][a-z ]*[a-z])$/i;

/** One serving's single unit and its grams, or null when the serving is of one thing. */
export function unitInServing(label: string, grams: number): { label: string; grams: number } | null {
  const text = label.trim();
  const pieces = PIECES.exec(text);
  if (pieces) return each('Piece', grams, Number(pieces[1]));
  const counted = COUNTED.exec(text);
  if (!counted) return null;
  const count = counted[2] === undefined ? Number(counted[1]) : Number(counted[1]) / Number(counted[2]);
  return each(singular(counted[3]!), grams, count);
}

function each(name: string, grams: number, count: number): { label: string; grams: number } | null {
  if (!Number.isFinite(count) || count <= 0 || count === 1) return null;
  const one = Math.round((grams / count) * 100) / 100;
  return one > 0 && one <= MEAL_ITEM_GRAMS_MAX ? { label: name, grams: one } : null;
}

/** "slices" → "Slice", "pcs" → "Piece", "sandwiches" → "Sandwich"; the last word only. */
function singular(words: string): string {
  const parts = words.trim().toLowerCase().split(/\s+/);
  const last = parts.pop()!;
  const one =
    last === 'pc' || last === 'pcs' || last === 'pieces'
      ? 'piece'
      : /(ch|sh|x|ss)es$/.test(last)
        ? last.slice(0, -2)
        : last.endsWith('s') && !last.endsWith('ss')
          ? last.slice(0, -1)
          : last;
  const name = [...parts, one].join(' ');
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * A source's servings, each followed by its single unit when it holds several, numbered after the
 * food's own servings. A unit the food already has by that name (in any case) is not added twice.
 * A serving named "oz" is refused: oz is the weight every food may be logged in (D-76).
 */
export function withSingleUnits(portions: readonly ImportedPortion[]): ImportedPortion[] {
  const named = portions.find((portion) => portion.label.trim().toLowerCase() === OZ_SERVING_LABEL);
  if (named) throw new FoodListError(`${named.code}: a serving may not be named "${named.label}", the weight every food may be logged in (D-76)`);
  const byFood = new Map<string, ImportedPortion[]>();
  for (const portion of portions) byFood.set(portion.code, [...(byFood.get(portion.code) ?? []), portion]);
  const units: ImportedPortion[] = [];
  for (const [code, own] of byFood) {
    const names = new Set(own.map((portion) => portion.label.toLowerCase()));
    let seq = Math.max(...own.map((portion) => portion.seq));
    for (const portion of [...own].sort((a, b) => a.seq - b.seq)) {
      const unit = unitInServing(portion.label, portion.grams);
      if (!unit || names.has(unit.label.toLowerCase())) continue;
      names.add(unit.label.toLowerCase());
      seq += 1;
      units.push({ code, seq, label: unit.label, grams: unit.grams });
    }
  }
  return [...portions, ...units];
}
