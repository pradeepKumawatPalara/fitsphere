import type { Food, MealItem } from '@fitsphere/shared';
import { addAmount, amountLimit, itemFromServings, OZ_SERVING, sameFood, sameFoods } from './mealItems';
import { formatAmount, formatMeasureGrams } from './meals';

// The same food added twice to one meal (D-34): a listed food is the same by its source and code;
// putting the amounts together keeps within the most one food can have.

const ATTA: MealItem = {
  source: 'ifct2017',
  ref: 'A019',
  name: 'Wheat flour, atta',
  amount: { unit: 'g', value: 60 },
  kcal: 192,
  proteinG: 6.34,
  carbsG: 38.5,
  fatG: 0.92,
  fibreG: 6.82,
  estimated: false,
};
const ROTI: MealItem = { ...ATTA, source: 'dish', ref: 'D001', name: 'Roti', amount: { unit: 'portion', value: 1 }, kcal: 120, proteinG: 3 };
const OWN: MealItem = { ...ATTA, source: 'own', ref: null, name: 'Synthetic bar' };

describe('REQ-SAVED-001 the same foods (a meal already saved)', () => {
  it('the same foods and amounts in any order are the same; another amount or food is not', () => {
    const roti = { ...ATTA, name: 'Roti', ref: 'X1' };
    expect(sameFoods([ATTA, roti], [roti, ATTA])).toBe(true);
    expect(sameFoods([ATTA], [{ ...ATTA, amount: { unit: 'g', value: 61 } }])).toBe(false);
    expect(sameFoods([ATTA], [ATTA, roti])).toBe(false);
    expect(sameFoods([ATTA], [{ ...ATTA, source: 'usda_fndds' }])).toBe(false);
    expect(sameFoods([], [])).toBe(true);
  });
});

describe('D-34 the same food in one meal', () => {
  it('is the same listed food by source and code, in the same unit; an own food never is', () => {
    expect(sameFood(ATTA, { ...ATTA, amount: { unit: 'g', value: 40 } })).toBe(true);
    expect(sameFood(ATTA, { ...ATTA, ref: 'A020' })).toBe(false);
    expect(sameFood(ATTA, { ...ATTA, source: 'barcode' })).toBe(false);
    expect(sameFood(OWN, { ...OWN })).toBe(false);
  });

  it('puts grams together, the values from the ones the item has', () => {
    expect(addAmount(ATTA, { ...ATTA, amount: { unit: 'g', value: 40 } })).toMatchObject({
      amount: { unit: 'g', value: 100 },
      kcal: 320,
      proteinG: 10.57,
    });
  });

  it('puts portions together', () => {
    expect(addAmount(ROTI, { ...ROTI, amount: { unit: 'portion', value: 1.5 } })).toMatchObject({
      amount: { unit: 'portion', value: 2.5 },
      kcal: 300,
    });
  });

  it('refuses to pass 2,000 g or 10 portions', () => {
    expect(addAmount({ ...ATTA, amount: { unit: 'g', value: 1500 } }, { ...ATTA, amount: { unit: 'g', value: 501 } })).toBeNull();
    expect(addAmount({ ...ATTA, amount: { unit: 'g', value: 1500 } }, { ...ATTA, amount: { unit: 'g', value: 500 } })).not.toBeNull();
    expect(addAmount({ ...ROTI, amount: { unit: 'portion', value: 9.5 } }, { ...ROTI, amount: { unit: 'portion', value: 1 } })).toBeNull();
  });
});

describe('D-76 oz, a weight every listed and packaged food may be logged in', () => {
  const OZ_ATTA = (count: number) => ({ ...ATTA, amount: { unit: 'serving' as const, label: 'oz', value: count, grams: Math.round(count * 2835) / 100 } });

  it('is 28.35 g each, its values for the grams it comes to, said as "2 oz"', () => {
    const food: Food = { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [], portions: [] };
    const item = itemFromServings(food, OZ_SERVING, 2);
    expect(item.amount).toEqual({ unit: 'serving', label: 'oz', value: 2, grams: 56.7 });
    expect(item.kcal).toBe(181.44);
    expect(formatAmount(item.amount)).toBe('2 oz (56.7 g)');
    expect(amountLimit(item)).toBe('10 oz');
  });

  it('joins oz of the same food only, up to 10 oz', () => {
    expect(sameFood(OZ_ATTA(1), OZ_ATTA(2))).toBe(true);
    expect(sameFood(OZ_ATTA(1), ATTA)).toBe(false);
    expect(addAmount(OZ_ATTA(1), OZ_ATTA(2))?.amount).toEqual({ unit: 'serving', label: 'oz', value: 3, grams: 85.05 });
    expect(addAmount(OZ_ATTA(9), OZ_ATTA(1.5))).toBeNull();
  });

  it('a measure’s grams show to two decimals at most', () => {
    expect([28, 28.35, 210.5, 5.333, 1000].map(formatMeasureGrams)).toEqual(['28 g', '28.35 g', '210.5 g', '5.33 g', '1,000 g']);
  });
});
