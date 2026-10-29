import { MEAL_ITEM_GRAMS_MAX, type BarcodeProduct, type Food, type MealItem } from '@fitsphere/shared';
import { parseOneDecimal, parseWholeNumber } from './format';

// Turning a food and an amount into a meal item (REQ-LOG-007; MVP defaults, D-26). Values are per
// 100 g in the food list and on a label; the item keeps its values for the amount eaten.

/** Whole grams eaten, 1 to 2,000 (MVP default, D-26). */
export function parseGrams(text: string): number | null {
  return parseWholeNumber(text, 1, MEAL_ITEM_GRAMS_MAX);
}

export const GRAMS_RULE = `Enter whole grams from 1 to ${MEAL_ITEM_GRAMS_MAX.toLocaleString('en-US')}.`;

function forGrams(per100g: number, grams: number): number {
  return Math.round(per100g * grams) / 100;
}

/** A listed food (IFCT 2017), eaten in `grams`. */
export function itemFromFood(food: Food, grams: number): MealItem {
  return {
    source: food.source,
    ref: food.code,
    name: food.name,
    amount: { unit: 'g', value: grams },
    kcal: forGrams(food.kcal, grams),
    proteinG: forGrams(food.proteinG, grams),
    carbsG: forGrams(food.carbsG, grams),
    fatG: forGrams(food.fatG, grams),
    fibreG: forGrams(food.fibreG, grams),
    estimated: food.kcalEstimated,
  };
}

/** The same item for another amount, from the values it already has. */
export function withGrams(item: MealItem, grams: number): MealItem {
  if (item.amount.unit !== 'g') return item;
  const scale = (value: number | null) => (value === null ? null : Math.round((value * grams * 100) / item.amount.value) / 100);
  return {
    ...item,
    amount: { unit: 'g', value: grams },
    kcal: scale(item.kcal) ?? 0,
    proteinG: scale(item.proteinG) ?? 0,
    carbsG: scale(item.carbsG),
    fatG: scale(item.fatG),
    fibreG: scale(item.fibreG),
  };
}

/** Values per 100 g typed from a label: kcal, protein, carbs and fat required, fibre optional. */
export type LabelValues = { kcal: number; proteinG: number; carbsG: number; fatG: number; fibreG: number | null };

/** A number per 100 g with at most one decimal, from 0 to `max`; null when it cannot be used. */
export function parsePer100g(text: string, max: number): number | null {
  const value = parseOneDecimal(text);
  return value !== null && value <= max ? value : null;
}

/** Your own food (REQ-LOG-007; "Barcode not found" MVP default): saved with this meal only. */
export function itemFromLabel(name: string, values: LabelValues, grams: number): MealItem {
  return {
    source: 'own',
    ref: null,
    name: name.trim(),
    amount: { unit: 'g', value: grams },
    kcal: forGrams(values.kcal, grams),
    proteinG: forGrams(values.proteinG, grams),
    carbsG: forGrams(values.carbsG, grams),
    fatG: forGrams(values.fatG, grams),
    fibreG: values.fibreG === null ? null : forGrams(values.fibreG, grams),
    estimated: false,
  };
}

/** A packaged product can be added only when Open Food Facts gives its kcal and protein. */
export function hasKcalAndProtein(product: BarcodeProduct): product is BarcodeProduct & { kcal: number; proteinG: number } {
  return product.kcal !== null && product.proteinG !== null;
}

/** The product's name, with its brand when Open Food Facts gives one. */
export function productName(product: BarcodeProduct): string {
  return (product.brand ? `${product.name} (${product.brand})` : product.name).slice(0, 120);
}

/** A packaged product found by its barcode (ADR-0006 rule 2), eaten in `grams`. */
export function itemFromBarcode(barcode: string, product: BarcodeProduct & { kcal: number; proteinG: number }, grams: number): MealItem {
  const optional = (value: number | null) => (value === null ? null : forGrams(value, grams));
  return {
    source: 'barcode',
    ref: barcode,
    name: productName(product),
    amount: { unit: 'g', value: grams },
    kcal: forGrams(product.kcal, grams),
    proteinG: forGrams(product.proteinG, grams),
    carbsG: optional(product.carbsG),
    fatG: optional(product.fatG),
    fibreG: optional(product.fibreG),
    estimated: false,
  };
}
