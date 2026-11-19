// A spoken meal's foods found in the phone's food list (D-115, ADR-0010). The AI names each food,
// its quantity, unit and preparation, never nutrition; here each name is searched as Search foods
// searches it (the first food listed is the one), and its amount built as the food's page builds it
// (`spokenItemOf`), so a food said and the same food searched have the same values. A food the list
// doesn't have is "Not in our food list". Offline, on the phone's copy of the list.
import type { MealItem, ParsedMealItem, SpokenUnit } from '@fitsphere/shared';
import { spokenItemOf, type FoodResult } from './components/FoodDetail';
import type { SearchResult } from './components/FoodSearchSheet';
import { getFood } from './local/store';
import type { SqlDb } from './local/sql';
import type { SearchAmount } from './searchAmount';

export type FoundFood = {
  said: ParsedMealItem;
  /** The food as its page opens it, to change the amount before adding. */
  result: FoodResult;
  item: MealItem;
  /** No amount said, or one the food can't be measured in: the page's opening amount, to check. */
  assumed: boolean;
  /** One of several foods of the name: listed unticked, the user ticks the one eaten (the owner, 2026-11-18). */
  several: boolean;
};

export type FoodListSearch = (db: SqlDb, text: string) => Promise<{ results: SearchResult[] }>;

/** The most options listed for one food said; "Search" shows the rest. */
export const MAX_CHOICES = 20;

export type SpokenMeal = { found: FoundFood[]; missing: ParsedMealItem[] };

/** The food built with the amount said (null when it can't be built). */
async function buildChosen(db: SqlDb, said: ParsedMealItem, option: SearchResult, several: boolean): Promise<FoundFood | null> {
  const { amount, otherUnits } = amountSaid(said);
  const result = await wholeFood(db, option);
  const made = result ? spokenItemOf(result, amount, otherUnits) : null;
  return result && made ? { said, result, ...made, several } : null;
}

/** Grams in one of each weight or volume the AI may say (a millilitre taken as a gram, as Search foods does). */
const WEIGHTS: Partial<Record<SpokenUnit, number>> = { g: 1, kg: 1000, ml: 1, l: 1000 };
/**
 * Other names of a measure, tried after the one said: the AI says katori for a bowl (D-115). A piece
 * or a serving is also tried as a bare count, as "2 roti" typed is (D-96): a roti's measure is "Roti".
 */
const OTHER_UNITS: Partial<Record<SpokenUnit, readonly (string | null)[]>> = {
  katori: ['bowl'],
  cup: ['mug'],
  teaspoon: ['spoon'],
  tablespoon: ['spoon'],
  piece: [null],
  serving: [null],
};

/** The amount said, as an amount typed with a search (D-96) reads it; null when none was said. */
export function amountSaid(said: Pick<ParsedMealItem, 'quantity' | 'unit'>): { amount: SearchAmount | null; otherUnits: readonly (string | null)[] } {
  if (said.quantity === null) return { amount: null, otherUnits: [] };
  if (said.unit === null) return { amount: { count: said.quantity, unit: null }, otherUnits: [] };
  const grams = WEIGHTS[said.unit];
  if (grams !== undefined) return { amount: { count: Math.round(said.quantity * grams), unit: 'g' }, otherUnits: [] };
  return { amount: { count: said.quantity, unit: said.unit }, otherUnits: OTHER_UNITS[said.unit] ?? [] };
}

/** A food of the list is read whole before its amount is built (D-73); one no longer listed is none. */
async function wholeFood(db: SqlDb, result: SearchResult): Promise<FoodResult | null> {
  if (result.kind !== 'food') return result;
  const food = await getFood(db, result.food.source, result.food.code);
  return food ? { kind: 'food', food } : null;
}

export async function findSpokenFoods(db: SqlDb, said: readonly ParsedMealItem[], search: FoodListSearch): Promise<SpokenMeal> {
  const found: FoundFood[] = [];
  const missing: ParsedMealItem[] = [];
  for (const food of said) {
    // "boiled egg" first, when a way of cooking was said, then the name alone.
    const searches = food.preparation ? [`${food.preparation} ${food.name}`, food.name] : [food.name];
    let built: FoundFood[] = [];
    for (const text of searches) {
      const { results } = await search(db, text);
      const options = results.slice(0, MAX_CHOICES);
      const made: FoundFood[] = [];
      for (const option of options) {
        const one = await buildChosen(db, food, option, options.length > 1);
        if (one) made.push(one);
      }
      // Several foods of the name: none is ticked for the user; only one, as before.
      built = made.length === 1 ? [{ ...made[0]!, several: false }] : made;
      if (built.length > 0) break;
    }
    if (built.length > 0) found.push(...built);
    else missing.push(food);
  }
  return { found, missing };
}
