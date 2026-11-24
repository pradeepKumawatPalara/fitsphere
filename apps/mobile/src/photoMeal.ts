// A photo of a meal, estimated by AI (D-120, ADR-0012). Each food the AI saw comes with its weight and
// its values per 100 g; the food list is not used. Here each becomes a food of the review (a name, the
// grams, the values per 100 g, all of which the user may change) and then a meal item of the user's own
// food in grams, marked estimated, so Log meal and the meal's card show it as an estimate (D-117).
import { MEAL_ITEM_GRAMS_MAX, MY_FOOD_NAME_MAX, type MealItem, type PhotoEstimateItem, type SpokenUnit } from '@fitsphere/shared';
import { itemFromOwn, type LabelValues } from './mealItems';

export type PhotoFood = {
  name: string;
  /** Whole grams of the portion, 1 to 10,000. */
  grams: number;
  /** Per 100 g, one decimal at most. */
  per100: LabelValues;
  /** The amount as the AI saw it ("2 pieces"), for the review's line; null when it was not clear. */
  seen: string | null;
  /** What was unclear, as the AI said. */
  ambiguity: string[];
  /** The user changed the grams or a value: "about" is no longer said of the weight. */
  edited: boolean;
  /** How many of `unit` the grams are (2 roti): the Quantity box's number. 1 "portion" when none was seen. */
  quantity: number;
  /** The measure's word in the singular ("piece", "katori"); "portion" when none was seen. */
  unit: string;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** One and many of each measure word the AI may use. */
const UNIT_WORDS: Record<SpokenUnit, { one: string; many: string }> = {
  g: { one: 'g', many: 'g' },
  kg: { one: 'kg', many: 'kg' },
  ml: { one: 'ml', many: 'ml' },
  l: { one: 'l', many: 'l' },
  piece: { one: 'piece', many: 'pieces' },
  slice: { one: 'slice', many: 'slices' },
  katori: { one: 'katori', many: 'katori' },
  plate: { one: 'plate', many: 'plates' },
  cup: { one: 'cup', many: 'cups' },
  glass: { one: 'glass', many: 'glasses' },
  teaspoon: { one: 'teaspoon', many: 'teaspoons' },
  tablespoon: { one: 'tablespoon', many: 'tablespoons' },
  serving: { one: 'serving', many: 'servings' },
  scoop: { one: 'scoop', many: 'scoops' },
  handful: { one: 'handful', many: 'handfuls' },
};

/** "2 pieces", "1 katori", "250 ml"; null when the AI gave no amount. */
export function seenAmount(quantity: number | null, unit: SpokenUnit | null): string | null {
  if (quantity === null || unit === null) return null;
  const words = UNIT_WORDS[unit];
  const number = String(Math.round(quantity * 100) / 100);
  return `${number} ${quantity === 1 ? words.one : words.many}`;
}

/** The measure word for a quantity: "piece" or "pieces", "portion" or "portions". */
export function unitWordFor(unit: string, quantity: number): string {
  const known = (UNIT_WORDS as Record<string, { one: string; many: string } | undefined>)[unit];
  if (known) return quantity === 1 ? known.one : known.many;
  return quantity === 1 ? unit : `${unit}s`;
}

/** Grams in one of the unit (the Quantity box's step); never 0. */
export function gramsPerUnit(food: Pick<PhotoFood, 'grams' | 'quantity'>): number {
  return food.quantity > 0 ? food.grams / food.quantity : food.grams;
}

/** The foods of an answer, ready for the review. */
export function photoFoodsOf(items: readonly PhotoEstimateItem[]): PhotoFood[] {
  return items.map((item) => ({
    name: item.name.trim().slice(0, MY_FOOD_NAME_MAX),
    grams: Math.min(MEAL_ITEM_GRAMS_MAX, Math.max(1, Math.round(item.grams))),
    per100: {
      kcal: round1(item.kcal),
      proteinG: round1(item.proteinG),
      carbsG: round1(item.carbsG),
      fatG: round1(item.fatG),
      fibreG: item.fibreG === null ? null : round1(item.fibreG),
    },
    seen: seenAmount(item.quantity, item.unit),
    ambiguity: item.ambiguity,
    edited: false,
    quantity: item.quantity !== null && item.unit !== null && item.quantity > 0 ? Math.round(item.quantity * 100) / 100 : 1,
    unit: item.quantity !== null && item.unit !== null && item.quantity > 0 ? UNIT_WORDS[item.unit].one : 'portion',
  }));
}

/** The meal item: the user's own food in grams, its values for that weight, marked estimated. */
export function photoItemOf(food: PhotoFood): MealItem {
  return { ...itemFromOwn({ name: food.name, unit: 'g', ...food.per100 }, food.grams, null), estimated: true };
}

/** "2 pieces · about 80 g", or "80 g" once the user changed the weight; "about 80 g" with no amount seen. */
export function photoLine(food: PhotoFood): string {
  const weight = `${food.edited ? '' : 'about '}${food.grams.toLocaleString('en-US')} g`;
  return food.seen ? `${food.seen} · ${weight}` : weight;
}
