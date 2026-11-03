import type { MealItem } from '@fitsphere/shared';
import { addAmount, sameFood } from './mealItems';

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
