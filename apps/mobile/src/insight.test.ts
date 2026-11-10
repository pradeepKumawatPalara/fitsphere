import type { MealItem, MealType } from '@fitsphere/shared';
import {
  asInsightScope,
  formatInsightGrams,
  kcalByMeal,
  missingNote,
  nutrientLines,
  percentOf,
  scopeKcal,
  topFoods,
} from './insight';

// Insight's numbers (REQ-NUT-005, REQ-NUT-006; D-70). Synthetic foods and values only.

function item(name: string, ref: string | null, values: { kcal: number; p: number; c: number | null; f: number | null; fi: number | null }, amount: MealItem['amount'] = { unit: 'g', value: 100 }): MealItem {
  return {
    source: ref === null ? 'own' : 'ifct2017',
    ref,
    name,
    amount,
    kcal: values.kcal,
    proteinG: values.p,
    carbsG: values.c,
    fatG: values.f,
    fibreG: values.fi,
    estimated: false,
  };
}

const POHA = item('Synthetic poha', 'S001', { kcal: 250, p: 5, c: 44, f: 6, fi: 3 }, { unit: 'g', value: 180 });
const TEA = item('Synthetic tea', 'S002', { kcal: 70, p: 3, c: 10, f: 2, fi: 0 }, { unit: 'g', value: 150 });
const EGG = item('Synthetic egg', 'S003', { kcal: 78, p: 6, c: 1, f: 5, fi: 0 }, { unit: 'portion', value: 1 });
const ROTI = item('Synthetic roti', 'S004', { kcal: 330, p: 11, c: 58, f: 4, fi: 8 }, { unit: 'measure', measure: 'piece', value: 3, grams: 120 });
const DAL = item('Synthetic dal', 'S005', { kcal: 160, p: 9, c: 20, f: 4, fi: 4 }, { unit: 'portion', value: 1 });
const RAITA = item('Synthetic raita', null, { kcal: 40, p: 2, c: 4, f: 2, fi: null }, { unit: 'own', name: 'katori', value: 1 });

const meal = (mealType: MealType, ...items: MealItem[]) => ({ mealType, items });
const DAY = [meal('breakfast', POHA, TEA), meal('breakfast', EGG), meal('lunch', ROTI, DAL, RAITA)];

describe('REQ-NUT-005 a meal and the day', () => {
  it('a scope from the route: the day, or a meal; anything else is the day', () => {
    expect(asInsightScope('lunch')).toBe('lunch');
    expect(asInsightScope('day')).toBe('day');
    expect(asInsightScope('supper')).toBe('day');
    expect(asInsightScope(undefined)).toBe('day');
  });

  it('each meal type’s kcal, both breakfasts together; a meal with nothing logged is null', () => {
    expect(kcalByMeal(DAY)).toEqual({ breakfast: 398, lunch: 530, snack: null, dinner: null });
    expect(scopeKcal(DAY, 'breakfast')).toBe(398);
    expect(scopeKcal(DAY, 'day')).toBe(928);
    expect(scopeKcal(DAY, 'snack')).toBe(0);
  });

  it('protein, carbs, fat and fibre for the meal and the day, against the daily targets', () => {
    const lines = nutrientLines(DAY, 'lunch', { protein: 110, carbs: 250, fat: 60 });
    expect(lines.map((line) => [line.nutrient.label, line.amount, line.dayAmount, line.target])).toEqual([
      ['Protein', 22, 36, 110],
      ['Carbs', 82, 137, 250],
      ['Fat', 10, 23, 60],
      ['Fibre', 12, 15, null],
    ]);
  });

  it('names a food with no value for a nutrient once, and a nutrient no food has a value for is null', () => {
    const lines = nutrientLines([meal('snack', RAITA, RAITA)], 'snack', {});
    const fibre = lines.find((line) => line.nutrient.key === 'fibreG')!;
    expect(fibre.amount).toBeNull();
    expect(fibre.missing).toEqual(['Synthetic raita']);
    expect(missingNote(fibre.missing, 'Fibre')).toBe('Synthetic raita has no fibre value.');
    expect(missingNote(['A', 'B', 'C'], 'Fibre')).toBe('A, B and C have no fibre value.');
  });
});

describe('REQ-NUT-006 top foods', () => {
  it('ranks a meal’s foods by kcal, largest first, with the total for their shares', () => {
    const { foods, total, missing } = topFoods(DAY, 'lunch', 'kcal');
    expect(foods.map((food) => [food.name, food.value])).toEqual([
      ['Synthetic roti', 330],
      ['Synthetic dal', 160],
      ['Synthetic raita', 40],
    ]);
    expect(total).toBe(530);
    expect(missing).toEqual([]);
    expect(percentOf(330, total)).toBe(62);
  });

  it('a tie keeps the order the foods were logged in; a food that gave none is not listed', () => {
    const { foods } = topFoods(DAY, 'day', 'fatG');
    expect(foods.map((food) => food.name)).toEqual([
      'Synthetic poha',
      'Synthetic egg',
      'Synthetic roti',
      'Synthetic dal',
      'Synthetic tea',
      'Synthetic raita',
    ]);
    expect(topFoods(DAY, 'breakfast', 'fibreG').foods.map((food) => food.name)).toEqual(['Synthetic poha']);
  });

  it('leaves out and names a food with no value for it', () => {
    const { foods, missing } = topFoods(DAY, 'lunch', 'fibreG');
    expect(foods.map((food) => food.name)).toEqual(['Synthetic roti', 'Synthetic dal']);
    expect(missing).toEqual(['Synthetic raita']);
  });

  it('on the day, the same food eaten in two meals is one food: its values and amounts added, its meals named in order', () => {
    const dinnerRoti = { ...ROTI, amount: { unit: 'measure' as const, measure: 'piece' as const, value: 2, grams: 80 }, kcal: 220, proteinG: 7 };
    const dinnerRotiInGrams = { ...ROTI, amount: { unit: 'g' as const, value: 40 }, kcal: 110, proteinG: 4 };
    const { foods } = topFoods([meal('dinner', dinnerRoti), ...DAY, meal('dinner', dinnerRotiInGrams)], 'day', 'proteinG');
    const roti = foods[0]!;
    expect(roti.name).toBe('Synthetic roti');
    expect(roti.value).toBe(22);
    expect(roti.mealTypes).toEqual(['lunch', 'dinner']);
    expect(roti.amounts).toEqual([
      { unit: 'measure', measure: 'piece', value: 5, grams: 200 },
      { unit: 'g', value: 40 },
    ]);
    expect(foods.filter((food) => food.name === 'Synthetic roti')).toHaveLength(1);
  });

  it('a food the user entered is the same food by its name', () => {
    const { foods } = topFoods([meal('lunch', RAITA), meal('dinner', { ...RAITA, name: ' synthetic RAITA ' })], 'day', 'kcal');
    expect(foods).toHaveLength(1);
    expect(foods[0]!.value).toBe(80);
  });
});

describe('Insight’s numbers', () => {
  it('grams with one decimal at most, a dash when unknown', () => {
    expect(formatInsightGrams(25)).toBe('25 g');
    expect(formatInsightGrams(3.46)).toBe('3.5 g');
    expect(formatInsightGrams(1_000)).toBe('1,000 g');
    expect(formatInsightGrams(null)).toBe('–');
  });

  it('whole percentages, 0 of nothing', () => {
    expect(percentOf(25, 110)).toBe(23);
    expect(percentOf(28, 25)).toBe(112);
    expect(percentOf(5, 0)).toBe(0);
  });
});
