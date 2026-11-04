import {
  isOwnQuantity,
  MEAL_ITEM_GRAMS_MAX,
  MEAL_ITEM_MEASURES_MAX,
  MEAL_ITEM_PORTIONS_MAX,
  MEAL_ITEM_SERVINGS_MAX,
  myFoodValueMax,
  OWN_UNIT_COUNT_MAX,
  OWN_UNIT_COUNT_MIN,
  PACKAGED_SERVING_LABEL,
  type BarcodeProduct,
  type Dish,
  type Food,
  type MealItem,
  type MyFoodSetData,
  type MyFoodUnit,
  type PackagedFood,
} from '@fitsphere/shared';
import { formatMeasures, formatOwnUnits, formatServings } from './meals';
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

/** The item for a new amount: each value × `to` / `from`, from the values it already has. */
function rescaled(item: MealItem, amount: MealItem['amount'], from: number, to: number): MealItem {
  const scale = (value: number | null) => (value === null ? null : Math.round((value * to * 100) / from) / 100);
  return {
    ...item,
    amount,
    kcal: scale(item.kcal) ?? 0,
    proteinG: scale(item.proteinG) ?? 0,
    carbsG: scale(item.carbsG),
    fatG: scale(item.fatG),
    fibreG: scale(item.fibreG),
  };
}

/** The same item for another amount, from the values it already has. */
export function withGrams(item: MealItem, grams: number): MealItem {
  if (item.amount.unit !== 'g') return item;
  return rescaled(item, { unit: 'g', value: grams }, item.amount.value, grams);
}

/** Portions of a dish go up and down in halves, from 0.5 to 10 (MVP default, D-26). */
export const PORTION_STEP = 0.5;
export const PORTIONS_MIN = PORTION_STEP;
export const PORTIONS_MAX = MEAL_ITEM_PORTIONS_MAX;

/** Half a portion (or unit) more or fewer, kept from 0.5 to `max`. */
export function stepPortions(portions: number, direction: 1 | -1, max = PORTIONS_MAX): number {
  return Math.min(max, Math.max(PORTIONS_MIN, portions + direction * PORTION_STEP));
}

/** A value for one portion × the portions, in exact hundredths: values have two decimals and portions are halves. */
function forPortions(perPortion: number, portions: number): number {
  return Math.round((Math.round(perPortion * 100) * Math.round(portions * 2)) / 2) / 100;
}

/** A dish (D-28), eaten in `portions`; its values are always estimated. */
export function itemFromDish(dish: Dish, portions: number): MealItem {
  return {
    source: 'dish',
    ref: dish.code,
    name: dish.name,
    amount: { unit: 'portion', value: portions },
    kcal: forPortions(dish.kcal, portions),
    proteinG: forPortions(dish.proteinG, portions),
    carbsG: forPortions(dish.carbsG, portions),
    fatG: forPortions(dish.fatG, portions),
    fibreG: forPortions(dish.fibreG, portions),
    estimated: true,
  };
}

/** The same dish for another number of portions, from the values it already has. */
export function withPortions(item: MealItem, portions: number): MealItem {
  if (item.amount.unit !== 'portion') return item;
  return rescaled(item, { unit: 'portion', value: portions }, item.amount.value, portions);
}

/** One household unit of a listed food and the grams it holds, as the owner measured it (D-36). */
export type FoodUnit = Food['measures'][number];

/** Units × the grams one holds, to hundredths of a gram. */
function gramsOfUnits(gramsPerUnit: number, count: number): number {
  return Math.round(gramsPerUnit * count * 100) / 100;
}

/** The most units one item can hold: 10, in halves, and no more than 2,000 g (D-36). */
export function unitsMax(gramsPerUnit: number): number {
  return Math.min(MEAL_ITEM_MEASURES_MAX, Math.floor((MEAL_ITEM_GRAMS_MAX / gramsPerUnit) * 2) / 2);
}

/** A listed food eaten in household units (D-36): its values are for the grams they come to. */
export function itemFromFoodUnits(food: Food, unit: FoodUnit, count: number): MealItem {
  const grams = gramsOfUnits(unit.grams, count);
  return { ...itemFromFood(food, 1), amount: { unit: 'measure', measure: unit.measure, value: count, grams }, ...valuesFor(food, grams) };
}

function valuesFor(food: Food, grams: number) {
  return {
    kcal: forGrams(food.kcal, grams),
    proteinG: forGrams(food.proteinG, grams),
    carbsG: forGrams(food.carbsG, grams),
    fatG: forGrams(food.fatG, grams),
    fibreG: forGrams(food.fibreG, grams),
  };
}

/** The same item for another number of units, from the values and grams it already has. */
export function withUnits(item: MealItem, count: number): MealItem {
  if (item.amount.unit !== 'measure') return item;
  const grams = gramsOfUnits(gramsPerUnitOf(item.amount), count);
  return rescaled(item, { ...item.amount, value: count, grams }, item.amount.grams, grams);
}

/** The grams one unit, or one serving, of an item holds. */
export function gramsPerUnitOf(amount: Extract<MealItem['amount'], { unit: 'measure' | 'serving' }>): number {
  return amount.grams / amount.value;
}

/** One serving of a USDA food, as USDA labels it, and its grams (D-39). */
export type FoodServing = Food['portions'][number];

/** The most servings one item can hold: 10, in halves, and no more than 2,000 g (D-39). */
export function servingsMax(gramsPerServing: number): number {
  return Math.min(MEAL_ITEM_SERVINGS_MAX, Math.floor((MEAL_ITEM_GRAMS_MAX / gramsPerServing) * 2) / 2);
}

/** A USDA food eaten in its servings (D-39): its values are for the grams they come to. */
export function itemFromServings(food: Food, serving: FoodServing, count: number): MealItem {
  const grams = gramsOfUnits(serving.grams, count);
  return { ...itemFromFood(food, 1), amount: { unit: 'serving', label: serving.label, value: count, grams }, ...valuesFor(food, grams) };
}

/** A packaged food's name, with its brand (D-48), as a product found by its barcode is named. */
export function packagedName(food: Pick<PackagedFood, 'name' | 'brand'>): string {
  return (food.brand ? `${food.name} (${food.brand})` : food.name).slice(0, 120);
}

/** A packaged food sold in India (D-48), eaten in `grams`: logged as a product found by its barcode. */
export function itemFromPackaged(food: PackagedFood, grams: number): MealItem {
  return {
    source: 'barcode',
    ref: food.barcode,
    name: packagedName(food),
    amount: { unit: 'g', value: grams },
    kcal: forGrams(food.kcal, grams),
    proteinG: forGrams(food.proteinG, grams),
    carbsG: forGrams(food.carbsG, grams),
    fatG: forGrams(food.fatG, grams),
    fibreG: food.fibreG === null ? null : forGrams(food.fibreG, grams),
    estimated: false,
  };
}

/** `count` servings of a packaged food, as its label gives one in grams, counted in halves (D-48). */
export function itemFromPackagedServings(food: PackagedFood & { servingGrams: number }, count: number): MealItem {
  const grams = gramsOfUnits(food.servingGrams, count);
  return { ...itemFromPackaged(food, grams), amount: { unit: 'serving', label: PACKAGED_SERVING_LABEL, value: count, grams } };
}

/** The same item for another number of servings, from the values and grams it already has. */
export function withServings(item: MealItem, count: number): MealItem {
  if (item.amount.unit !== 'serving') return item;
  const grams = gramsOfUnits(gramsPerUnitOf(item.amount), count);
  return rescaled(item, { ...item.amount, value: count, grams }, item.amount.grams, grams);
}

/**
 * Whether two items are the same listed food (D-34): the same source and code, in the same unit (the
 * same household unit, D-36). A food the user entered has no code, so it is never the same as
 * another.
 */
export function sameFood(a: MealItem, b: MealItem): boolean {
  const sameUnit =
    a.amount.unit === b.amount.unit &&
    (a.amount.unit !== 'measure' || (b.amount.unit === 'measure' && a.amount.measure === b.amount.measure)) &&
    (a.amount.unit !== 'serving' || (b.amount.unit === 'serving' && a.amount.label === b.amount.label));
  return a.source !== 'own' && a.ref !== null && a.source === b.source && a.ref === b.ref && sameUnit;
}

/**
 * Whether two lists hold the same foods in the same amounts, in any order: a logged meal already in
 * the saved meals (REQ-SAVED-001; the owner's phone test, 2026-11-04). Values follow from the foods
 * and amounts, so they are not compared.
 */
export function sameFoods(a: readonly MealItem[], b: readonly MealItem[]): boolean {
  const key = (item: MealItem) => `${item.source}|${item.ref ?? ''}|${item.name.trim().toLowerCase()}|${JSON.stringify(item.amount)}`;
  const keys = (items: readonly MealItem[]) => items.map(key).sort();
  const [left, right] = [keys(a), keys(b)];
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/**
 * The existing item holding both amounts, its values from the ones it has (as changing its grams);
 * or null when together they would pass the most one food can have (2,000 g, 10 portions, or 10
 * units up to 2,000 g).
 */
export function addAmount(existing: MealItem, added: MealItem): MealItem | null {
  const total = existing.amount.value + added.amount.value;
  if (existing.amount.unit === 'g') return total > MEAL_ITEM_GRAMS_MAX ? null : withGrams(existing, total);
  if (existing.amount.unit === 'measure') return total > unitsMax(gramsPerUnitOf(existing.amount)) ? null : withUnits(existing, total);
  if (existing.amount.unit === 'serving') return total > servingsMax(gramsPerUnitOf(existing.amount)) ? null : withServings(existing, total);
  if (existing.amount.unit === 'own') return null;
  return total > PORTIONS_MAX ? null : withPortions(existing, total);
}

/** The most one food can have, for the prompt that says it would be passed. */
export function amountLimit(item: MealItem): string {
  if (item.amount.unit === 'g') return `${MEAL_ITEM_GRAMS_MAX.toLocaleString('en-US')} g`;
  if (item.amount.unit === 'measure') return formatMeasures(unitsMax(gramsPerUnitOf(item.amount)), item.amount.measure);
  if (item.amount.unit === 'serving') return formatServings(servingsMax(gramsPerUnitOf(item.amount)), item.amount.label);
  if (item.amount.unit === 'own') return formatOwnUnits(OWN_UNIT_COUNT_MAX, item.amount.name);
  return `${PORTIONS_MAX} portions`;
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

/**
 * Your own food's quantity (D-39): whole grams or millilitres from 1 to 2,000, or 0.1 to 100 of
 * another unit with at most one decimal; null when it cannot be used.
 */
export function parseOwnQuantity(text: string, unit: MyFoodUnit): number | null {
  const value = unit === 'g' || unit === 'ml' ? parseWholeNumber(text, 1, MEAL_ITEM_GRAMS_MAX) : parseOneDecimal(text);
  return value !== null && isOwnQuantity(unit, value) ? value : null;
}

/** The rule a quantity of `unit` must meet. */
export function ownQuantityRule(unit: MyFoodUnit): string {
  if (unit === 'g') return GRAMS_RULE;
  if (unit === 'ml') return `Enter whole ml from 1 to ${MEAL_ITEM_GRAMS_MAX.toLocaleString('en-US')}.`;
  return `Enter ${OWN_UNIT_COUNT_MIN} to ${OWN_UNIT_COUNT_MAX}, with at most one decimal.`;
}

/** A value typed for your own food: per 100 g or ml, or per one unit, with at most one decimal. */
export function parseOwnValue(text: string, unit: MyFoodUnit, nutrient: 'kcal' | 'grams'): number | null {
  return parsePer100g(text, myFoodValueMax(unit, nutrient));
}

/**
 * Your own food (D-39): `values` per 100 g or 100 ml, or per one of its other unit, and the quantity
 * eaten in that unit. `ref` is the My food it is saved as, or null.
 */
export function itemFromOwn(food: { name: string; unit: MyFoodUnit } & LabelValues, quantity: number, ref: string | null): MealItem {
  const per100 = food.unit === 'g' || food.unit === 'ml';
  const value = (per: number) => (per100 ? forGrams(per, quantity) : Math.round(per * quantity * 100) / 100);
  return {
    source: 'own',
    ref,
    name: food.name.trim(),
    amount: food.unit === 'g' ? { unit: 'g', value: quantity } : { unit: 'own', name: food.unit, value: quantity },
    kcal: value(food.kcal),
    proteinG: value(food.proteinG),
    carbsG: value(food.carbsG),
    fatG: value(food.fatG),
    fibreG: food.fibreG === null ? null : value(food.fibreG),
    estimated: false,
  };
}

/** A My food (D-39), eaten in its unit. */
export function itemFromMyFood(food: Pick<MyFoodSetData, 'id' | 'name' | 'unit' | 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>, quantity: number): MealItem {
  return itemFromOwn(food, quantity, food.id);
}

/** The same item of your own food for another quantity, from the values it already has. */
export function withOwnQuantity(item: MealItem, quantity: number): MealItem {
  if (item.amount.unit !== 'own') return item;
  return rescaled(item, { ...item.amount, value: quantity }, item.amount.value, quantity);
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
