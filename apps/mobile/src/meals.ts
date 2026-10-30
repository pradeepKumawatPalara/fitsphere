import { SAVED_MEAL_NAME_MAX, type DishPortionUnit, type MealItem, type MealTag, type MealType } from '@fitsphere/shared';
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

/** e.g. "60 g" or "1.5 portions". */
export function formatAmount(amount: MealItem['amount']): string {
  if (amount.unit === 'g') return `${formatInteger(amount.value)} g`;
  return formatPortions(amount.value);
}

/** e.g. "1 portion", "2.5 portions". */
export function formatPortions(portions: number): string {
  return `${portions} ${portions === 1 ? 'portion' : 'portions'}`;
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
