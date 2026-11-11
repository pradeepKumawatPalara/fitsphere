import { describe, expect, it } from 'vitest';
import { FoodListError } from './ifct.ts';
import { unitInServing, withSingleUnits } from './servingUnits.ts';

// D-76: a serving that holds several things also gives one of them, by dividing its grams.
describe('D-76 the single unit inside a serving', () => {
  it('reads a count of things, a plate of pieces and a fraction', () => {
    expect(unitInServing('2 slices', 56)).toEqual({ label: 'Slice', grams: 28 });
    expect(unitInServing('3 biscuits', 16)).toEqual({ label: 'Biscuit', grams: 5.33 });
    expect(unitInServing('2 pcs', 10.8)).toEqual({ label: 'Piece', grams: 5.4 });
    expect(unitInServing('2 pieces', 24)).toEqual({ label: 'Piece', grams: 12 });
    expect(unitInServing('Plate (4 pc)', 60)).toEqual({ label: 'Piece', grams: 15 });
    expect(unitInServing('Handful (15 pc)', 20)).toEqual({ label: 'Piece', grams: 1.33 });
    expect(unitInServing('1/4 cup', 30)).toEqual({ label: 'Cup', grams: 120 });
    expect(unitInServing('2 sandwiches', 300)).toEqual({ label: 'Sandwich', grams: 150 });
    expect(unitInServing('4 cookies', 40)).toEqual({ label: 'Cookie', grams: 10 });
  });

  it('gives nothing for a serving of one, or a name it cannot read', () => {
    for (const label of ['Slice', 'Tea cup', 'Plate', 'Pack (dry)', 'Plate (1 pc)', 'Serving', '1 slice', '2', 'Two slices']) {
      expect(unitInServing(label, 50)).toBeNull();
    }
  });

  it('adds each unit after the food’s own servings, once, and keeps the servings as they are', () => {
    const portions = [
      { code: 'home-toast', seq: 1, label: '2 slices', grams: 56 },
      { code: 'est-bajji', seq: 1, label: 'Plate (4 pc)', grams: 60 },
      { code: 'indb-tea', seq: 1, label: 'Tea cup', grams: 210.5 },
      { code: 'both', seq: 1, label: '2 slices', grams: 50 },
      { code: 'both', seq: 2, label: 'slice', grams: 26 },
    ];
    expect(withSingleUnits(portions)).toEqual([
      ...portions,
      { code: 'home-toast', seq: 2, label: 'Slice', grams: 28 },
      { code: 'est-bajji', seq: 2, label: 'Piece', grams: 15 },
    ]);
  });

  it('refuses a serving named oz, in any case', () => {
    for (const label of ['oz', 'Oz', ' OZ ']) {
      expect(() => withSingleUnits([{ code: 'x', seq: 1, label, grams: 28 }])).toThrow(FoodListError);
    }
  });
});
