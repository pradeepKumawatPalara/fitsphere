import type { Food, MealItem } from '@fitsphere/shared';
import { addAmount, amountLimit, COUNT_RULE, countMax, countRule, formatCount, itemFromDish, itemFromServings, listMax, OZ_SERVING, parseCount, sameFood, sameFoods, stepPortions } from './mealItems';
import { formatAmount, formatMeasureGrams, formatServings } from './meals';

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

  it('refuses to pass 10,000 g (D-102, was 2,000) or 10 portions', () => {
    expect(addAmount({ ...ATTA, amount: { unit: 'g', value: 9500 } }, { ...ATTA, amount: { unit: 'g', value: 501 } })).toBeNull();
    expect(addAmount({ ...ATTA, amount: { unit: 'g', value: 9500 } }, { ...ATTA, amount: { unit: 'g', value: 500 } })).not.toBeNull();
    expect(addAmount({ ...ATTA, amount: { unit: 'g', value: 1500 } }, { ...ATTA, amount: { unit: 'g', value: 501 } })?.amount).toEqual({ unit: 'g', value: 2001 });
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
    // D-102: as many oz as fit 10,000 g.
    expect(amountLimit(item)).toBe('352.73 oz');
  });

  it('joins oz of the same food only, up to 10,000 g (D-102, was 10 oz)', () => {
    expect(sameFood(OZ_ATTA(1), OZ_ATTA(2))).toBe(true);
    expect(sameFood(OZ_ATTA(1), ATTA)).toBe(false);
    expect(addAmount(OZ_ATTA(1), OZ_ATTA(2))?.amount).toEqual({ unit: 'serving', label: 'oz', value: 3, grams: 85.05 });
    expect(addAmount(OZ_ATTA(9), OZ_ATTA(1.5))?.amount).toEqual({ unit: 'serving', label: 'oz', value: 10.5, grams: 297.68 });
    expect(addAmount(OZ_ATTA(350), OZ_ATTA(3))).toBeNull();
    // Counts typed with decimals add up in hundredths.
    expect(addAmount(OZ_ATTA(0.1), OZ_ATTA(0.2))?.amount.value).toBe(0.3);
  });

  it('a measure’s grams show to two decimals at most', () => {
    expect([28, 28.35, 210.5, 5.333, 1000].map(formatMeasureGrams)).toEqual(['28 g', '28.35 g', '210.5 g', '5.33 g', '1,000 g']);
  });
});

describe('D-102 a quantity typed on a food’s page', () => {
  it('reads more than 0 with at most two decimals, a point or a comma before them', () => {
    expect(['1', '1.5', '0,25', '.5', '0.01', '25', ' 2 ', '1.'].map((text) => parseCount(text, 100))).toEqual([1, 1.5, 0.25, 0.5, 0.01, 25, 2, 1]);
    for (const text of ['0', '0.00', '-1', '1.234', '', '.', 'abc', '1e2', '1.5.2']) expect(parseCount(text, 100)).toBeNull();
    expect(parseCount('77.52', 77.51)).toBeNull();
    expect(parseCount('77.51', 77.51)).toBe(77.51);
  });

  it('says the rule, or the most when past it', () => {
    expect(countRule('0', 10, 129)).toBe(COUNT_RULE);
    expect(countRule('1.234', 10, 129)).toBe(COUNT_RULE);
    expect(countRule('78', 77.51, 129)).toBe('That is more than 10,000 g of this food, the most one food can have. Enter up to 77.51.');
    expect(countRule('11', 10, null)).toBe('Enter up to 10, the most one food can have.');
  });

  it('allows 10,000 g of a unit; its list offers halves to 10', () => {
    expect(countMax(129)).toBe(77.51);
    expect(countMax(4.8)).toBe(2083.33);
    expect(countMax(28.35)).toBe(352.73);
    expect(listMax(129)).toBe(10);
    expect(listMax(1_500)).toBe(6.5);
    expect(formatCount(1.25)).toBe('1.25');
    expect(formatCount(2)).toBe('2');
  });

  it('logs a typed count with the grams it comes to, and says it as typed', () => {
    const food: Food = { source: 'indb', code: 'T001', name: 'Test rice', foodGroup: 'Test', aliases: [], proteinG: 2.5, fibreG: 1.2, fatG: 0.2, carbsG: 26, kcal: 120, kcalEstimated: true, measures: [], portions: [] };
    const item = itemFromServings(food, { label: 'Katori', grams: 129 }, 1.25);
    expect(item.amount).toEqual({ unit: 'serving', label: 'Katori', value: 1.25, grams: 161.25 });
    expect(item.kcal).toBe(193.5);
    expect(formatAmount(item.amount)).toBe('1.25 × katori (161.3 g)');
    const ml = itemFromServings(food, { label: 'ml', grams: 1.03 }, 250);
    expect(formatAmount(ml.amount)).toBe('250 ml (257.5 g)');
    expect(formatServings(1500, 'ml')).toBe('1,500 ml');
  });

  it('a dish’s typed portions give their values in hundredths; halves as before', () => {
    const dish = { code: 'D1', name: 'Test dal', portionUnit: 'katori' as const, kcal: 151.11, proteinG: 7.5, carbsG: 20, fatG: 4, fibreG: 3 };
    expect(itemFromDish(dish, 1.5).kcal).toBe(226.67);
    expect(itemFromDish(dish, 0.25).kcal).toBe(37.78);
  });

  it('a typed count steps by halves in Log meal’s change sheet', () => {
    expect(stepPortions(1.25, 1, countMax(129))).toBe(1.75);
    expect(stepPortions(0.25, -1, countMax(129))).toBe(0.5);
  });
});
