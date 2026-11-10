import { MEAL_TYPES, type MealItem, type MealType, type TargetKind } from '@fitsphere/shared';
import type { ThemeColors } from './theme';

// Insight (REQ-NUT-005, REQ-NUT-006; D-70): a meal's or the whole day's calories, its protein,
// carbs, fat and fibre against the daily targets, and the foods that gave the most. Read from the
// meals already on the phone; nothing here is stored or sent. The targets are daily: there is no
// budget per meal (the owner, 2026-11-10).

/** What Insight shows: the whole day, or one of its meals. */
export type InsightScope = 'day' | MealType;
export const INSIGHT_SCOPES: readonly InsightScope[] = ['day', ...MEAL_TYPES];

export function asInsightScope(value: string | undefined): InsightScope {
  return INSIGHT_SCOPES.find((scope) => scope === value) ?? 'day';
}

type Meal = { mealType: MealType; items: readonly MealItem[] };

/** The grams nutrients, each with its target kind and its colour (as the Eaten summary). */
export const INSIGHT_NUTRIENTS = [
  { key: 'proteinG', label: 'Protein', target: 'protein', colour: 'protein' },
  { key: 'carbsG', label: 'Carbs', target: 'carbs', colour: 'carbs' },
  { key: 'fatG', label: 'Fat', target: 'fat', colour: 'fat' },
  { key: 'fibreG', label: 'Fibre', target: 'fibre', colour: 'fiber' },
] as const satisfies readonly { key: keyof MealItem; label: string; target: TargetKind; colour: keyof ThemeColors }[];
export type InsightNutrient = (typeof INSIGHT_NUTRIENTS)[number];

/** What Top foods can rank by: the calories first, then the four nutrients. */
export const TOP_FOOD_KEYS = [
  { key: 'kcal', label: 'Calories' },
  ...INSIGHT_NUTRIENTS.map(({ key, label }) => ({ key, label })),
] as const satisfies readonly { key: keyof MealItem; label: string }[];
export type TopFoodKey = (typeof TOP_FOOD_KEYS)[number]['key'];

/** Each meal's items, in the order the meals were logged, for the scope. */
export function itemsInScope(meals: readonly Meal[], scope: InsightScope): { mealType: MealType; item: MealItem }[] {
  return meals
    .filter((meal) => scope === 'day' || meal.mealType === scope)
    .flatMap((meal) => meal.items.map((item) => ({ mealType: meal.mealType, item })));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The sum of the known values, or null when no item has one (as a meal's totals, D-26). */
function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : round(known.reduce((total, value) => total + value, 0));
}

/** Each meal type's kcal on the day, or null when nothing was logged to it. */
export function kcalByMeal(meals: readonly Meal[]): Record<MealType, number | null> {
  return Object.fromEntries(
    MEAL_TYPES.map((type) => {
      const items = meals.filter((meal) => meal.mealType === type).flatMap((meal) => meal.items);
      return [type, items.length === 0 ? null : (sumKnown(items.map((item) => item.kcal)) ?? 0)];
    }),
  ) as Record<MealType, number | null>;
}

/** The scope's kcal (0 when nothing is logged). */
export function scopeKcal(meals: readonly Meal[], scope: InsightScope): number {
  return sumKnown(itemsInScope(meals, scope).map(({ item }) => item.kcal)) ?? 0;
}

export type NutrientLine = {
  nutrient: InsightNutrient;
  /** Eaten in the scope, or null when no food in it has a value. */
  amount: number | null;
  /** Eaten in the whole day, or null when no food that day has a value. */
  dayAmount: number | null;
  /** The daily target, or null when none is set. */
  target: number | null;
  /** The names of the foods in the scope with no value for it, each once. */
  missing: string[];
};

/** Protein, carbs, fat and fibre in the scope and the day, against the daily targets. */
export function nutrientLines(
  meals: readonly Meal[],
  scope: InsightScope,
  targets: Partial<Record<TargetKind, number>>,
): NutrientLine[] {
  const inScope = itemsInScope(meals, scope);
  const inDay = itemsInScope(meals, 'day');
  return INSIGHT_NUTRIENTS.map((nutrient) => ({
    nutrient,
    amount: sumKnown(inScope.map(({ item }) => item[nutrient.key])),
    dayAmount: sumKnown(inDay.map(({ item }) => item[nutrient.key])),
    target: targets[nutrient.target] ?? null,
    missing: [...new Set(inScope.filter(({ item }) => item[nutrient.key] === null).map(({ item }) => item.name))],
  }));
}

export type TopFood = {
  name: string;
  /** The meals it was eaten in, in the day's order. */
  mealTypes: MealType[];
  /** Its amounts, those in the same unit added together. */
  amounts: MealItem['amount'][];
  value: number;
};

export type TopFoods = {
  /** Largest first; a tie keeps the order the foods were logged in. */
  foods: TopFood[];
  /** The value of every listed food together. */
  total: number;
  /** The names of the foods with no value for it, left out. */
  missing: string[];
};

/** Which food an item is, wherever it was eaten: its source and code, or its name for one the user entered. */
function foodKey(item: MealItem): string {
  return item.ref === null ? `own|${item.name.trim().toLowerCase()}` : `${item.source}|${item.ref}`;
}

function sameUnit(a: MealItem['amount'], b: MealItem['amount']): boolean {
  if (a.unit !== b.unit) return false;
  if (a.unit === 'measure' && b.unit === 'measure') return a.measure === b.measure;
  if (a.unit === 'serving' && b.unit === 'serving') return a.label === b.label;
  if (a.unit === 'own' && b.unit === 'own') return a.name === b.name;
  return true;
}

function addAmounts(amounts: MealItem['amount'][], added: MealItem['amount']): MealItem['amount'][] {
  const index = amounts.findIndex((amount) => sameUnit(amount, added));
  if (index === -1) return [...amounts, added];
  const existing = amounts[index]!;
  const value = round(existing.value + added.value);
  const sum =
    (existing.unit === 'measure' || existing.unit === 'serving') && (added.unit === 'measure' || added.unit === 'serving')
      ? { ...existing, value, grams: round(existing.grams + added.grams) }
      : { ...existing, value };
  return amounts.map((amount, at) => (at === index ? sum : amount));
}

/**
 * The foods that gave the most of `key` in the scope (REQ-NUT-006): the same food eaten more than
 * once is one food, its amounts and values added. A food that gave none is not listed; one with no
 * value for it is left out and named.
 */
export function topFoods(meals: readonly Meal[], scope: InsightScope, key: TopFoodKey): TopFoods {
  const byFood = new Map<string, TopFood>();
  const missing = new Set<string>();
  for (const { mealType, item } of itemsInScope(meals, scope)) {
    const value = item[key];
    if (value === null) {
      missing.add(item.name);
      continue;
    }
    const id = foodKey(item);
    const food = byFood.get(id);
    if (food) {
      food.value = round(food.value + value);
      food.amounts = addAmounts(food.amounts, item.amount);
      if (!food.mealTypes.includes(mealType)) food.mealTypes.push(mealType);
    } else {
      byFood.set(id, { name: item.name, mealTypes: [mealType], amounts: [item.amount], value });
    }
  }
  const listed = [...byFood.values()].filter((food) => food.value > 0);
  // A stable sort: equal values stay in the order they were logged.
  const foods = listed.map((food, order) => ({ food, order })).sort((a, b) => b.food.value - a.food.value || a.order - b.order).map(({ food }) => food);
  const mealOrder = (type: MealType) => MEAL_TYPES.indexOf(type);
  for (const food of foods) food.mealTypes.sort((a, b) => mealOrder(a) - mealOrder(b));
  return { foods, total: round(listed.reduce((sum, food) => sum + food.value, 0)), missing: [...missing] };
}

/** Grams for Insight: one decimal, without a trailing ".0" ("25 g", "3.5 g"); a dash when unknown. */
export function formatInsightGrams(grams: number | null): string {
  if (grams === null) return '–';
  const tenths = Math.round(grams * 10) / 10;
  return `${Number.isInteger(tenths) ? tenths.toLocaleString('en-US') : tenths.toFixed(1)} g`;
}

/** A whole percentage of `whole`, e.g. 23 for 25 of 110. */
export function percentOf(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

/** "Cucumber raita has no fibre value." or "A and B have no fibre value." */
export function missingNote(names: readonly string[], nutrient: string): string {
  const who = names.length === 1 ? `${names[0]} has` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} have`;
  return `${who} no ${nutrient.toLowerCase()} value.`;
}
