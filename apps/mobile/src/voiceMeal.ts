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
};

export type SpokenMeal = { found: FoundFood[]; missing: ParsedMealItem[] };

export type FoodListSearch = (db: SqlDb, text: string) => Promise<{ results: SearchResult[] }>;

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
    const { amount, otherUnits } = amountSaid(food);
    // "boiled egg" first, when a way of cooking was said, then the name alone.
    const searches = food.preparation ? [`${food.preparation} ${food.name}`, food.name] : [food.name];
    let built: { result: FoodResult; item: MealItem; assumed: boolean } | null = null;
    for (const text of searches) {
      const first = (await search(db, text)).results[0];
      const result = first ? await wholeFood(db, first) : null;
      const made = result ? spokenItemOf(result, amount, otherUnits) : null;
      built = result && made ? { result, ...made } : null;
      if (built) break;
    }
    if (built) found.push({ said: food, ...built });
    else missing.push(food);
  }
  return { found, missing };
}
