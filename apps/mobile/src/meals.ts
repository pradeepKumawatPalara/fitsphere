import { SAVED_MEAL_NAME_MAX, type DishPortionUnit, type FoodMeasure, type MealItem, type MealTag, type MealType } from '@fitsphere/shared';
import { formatInteger } from './format';

// Display helpers for meals (REQ-NUT-*, REQ-LOG-*). English only (Q-054).

export const MEAL_TYPE_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

export const MEAL_TAG_LABELS: Record<MealTag, string> = {
  before_training: 'Before training',
  dessert: 'Dessert',
};

/** e.g. 1234.6 → "1,235 kcal". */
export function formatKcal(kcal: number): string {
  return `${formatInteger(Math.round(kcal))} kcal`;
}

/** Grams with one decimal, or a dash when unknown (REQ-NUT-002). */
export function formatGrams(grams: number | null): string {
  return grams === null ? '–' : `${(Math.round(grams * 10) / 10).toFixed(1)} g`;
}

/** e.g. "60 g", "1.5 portions" or "1 glass (258 g)". */
export function formatAmount(amount: MealItem['amount']): string {
  if (amount.unit === 'g') return `${formatInteger(amount.value)} g`;
  if (amount.unit === 'measure') return `${formatMeasures(amount.value, amount.measure)} (${formatUnitGrams(amount.grams)})`;
  return formatPortions(amount.value);
}

/** e.g. "1 portion", "2.5 portions". */
export function formatPortions(portions: number): string {
  return `${portions} ${portions === 1 ? 'portion' : 'portions'}`;
}

/** A household unit's names (D-36), and its size when it has one. */
export const MEASURE_NAMES: Record<FoodMeasure, { one: string; many: string; size: string | null }> = {
  teaspoon: { one: 'teaspoon', many: 'teaspoons', size: '5 ml' },
  tablespoon: { one: 'tablespoon', many: 'tablespoons', size: '15 ml' },
  katori: { one: 'katori', many: 'katoris', size: '200 ml' },
  glass: { one: 'glass', many: 'glasses', size: '250 ml' },
  piece: { one: 'piece', many: 'pieces', size: null },
};

/** e.g. "1 glass", "2.5 teaspoons". */
export function formatMeasures(count: number, measure: FoodMeasure): string {
  const names = MEASURE_NAMES[measure];
  return `${count} ${count === 1 ? names.one : names.many}`;
}

/** The grams units came to, e.g. "258 g" or "9.2 g". */
export function formatUnitGrams(grams: number): string {
  const tenths = Math.round(grams * 10) / 10;
  return `${Number.isInteger(tenths) ? formatInteger(tenths) : String(tenths)} g`;
}

/** What one portion of a dish is (D-26 answer 3, amended): one piece, or one 200 ml katori. */
export const PORTION_UNIT_LABELS: Record<DishPortionUnit, string> = {
  piece: 'piece',
  katori: 'katori (200 ml)',
};

/** A short line naming a meal's foods, e.g. "Wheat flour, atta + 2 more". */
export function describeItems(items: readonly Pick<MealItem, 'name'>[]): string {
  const [first, ...rest] = items;
  if (!first) return '';
  return rest.length === 0 ? first.name : `${first.name} + ${rest.length} more`;
}

/** The name "Save to my meals" suggests, within the 60-character limit (MVP default, D-26). */
export function suggestedSavedName(items: readonly Pick<MealItem, 'name'>[]): string {
  const name = describeItems(items);
  return name.length <= SAVED_MEAL_NAME_MAX ? name : `${name.slice(0, SAVED_MEAL_NAME_MAX - 1).trimEnd()}…`;
}
