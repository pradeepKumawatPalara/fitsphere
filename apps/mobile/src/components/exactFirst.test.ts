import type { Food, PackagedFood } from '@fitsphere/shared';
import { nameMatcher } from '../local/store';
import { bestMatchFirst, exactFirst } from './FoodSearchSheet';

// Search foods puts a food named exactly as the search first; the rest keep their order (D-51; the
// owner's phone test, 2026-11-05). Synthetic foods.

function food(name: string, source: Food['source'] = 'ifct2017'): { kind: 'food'; food: Food } {
  return {
    kind: 'food',
    food: { source, code: name, name, foodGroup: 'Test', aliases: [], proteinG: 1, fibreG: 1, fatG: 1, carbsG: 1, kcal: 21, kcalEstimated: false, measures: [], portions: [] },
  };
}

function packaged(name: string, brand: string | null): { kind: 'packaged'; food: PackagedFood } {
  return { kind: 'packaged', food: { barcode: '8901234567890', name, brand, kcal: 250, proteinG: 8, carbsG: 50, fatG: 2, fibreG: null, servingGrams: null } };
}

const names = (results: ReturnType<typeof exactFirst>) => results.map((result) => (result.kind === 'dish' ? result.dish.name : result.food.name));

describe('D-51 an exact match first', () => {
  it('moves the foods named exactly as the search to the top, keeping the rest in order', () => {
    const results = [food('Bread, white'), food('Brown bread', 'indb'), packaged('Bread', 'Test Bakers'), food('Bread pakora', 'indb')];

    expect(names(exactFirst('bread', results))).toEqual(['Bread', 'Bread, white', 'Brown bread', 'Bread pakora']);
  });

  it('ignores case, spaces and punctuation, and knows a packaged food by its brand and name together', () => {
    const results = [food('Rice, raw, milled'), food('Rice flakes'), packaged('Sandwich Bread', 'Test Bakers')];

    expect(names(exactFirst('  RICE flakes ', results))).toEqual(['Rice flakes', 'Rice, raw, milled', 'Sandwich Bread']);
    expect(names(exactFirst('test bakers sandwich bread', results))).toEqual(['Sandwich Bread', 'Rice, raw, milled', 'Rice flakes']);
  });

  it('leaves the order as it is when nothing matches exactly, or nothing is typed', () => {
    const results = [food('Bread, white'), food('Brown bread', 'indb')];

    expect(exactFirst('brea', results)).toEqual(results);
    expect(exactFirst('   ', results)).toEqual(results);
  });
});

describe('D-66 the best matches first (the owner, 2026-11-10)', () => {
  const hidden = (name: string, aliases: string[], source: Food['source'] = 'home') => {
    const result = food(name, source);
    return { ...result, food: { ...result.food, aliases } };
  };

  it('lists whole words, then word starts, then inside a word, then hidden words only, each group in its order', () => {
    // Synthetic foods in the order by source: a home-style food found by its hidden words first.
    const results = [
      hidden('Test baati', ['dal baati']),
      food('Dalia test', 'brand_label'),
      packaged('Refined oil', 'Dalda'),
      food('Test vindaloo', 'indb'),
      food('Moong dal', 'indb'),
      food('Mixed dal'),
    ];

    expect(names(bestMatchFirst('dal', results))).toEqual(['Moong dal', 'Mixed dal', 'Dalia test', 'Refined oil', 'Test vindaloo', 'Test baati']);
  });

  it('counts the worst word, and two words typed together where the name has them apart', () => {
    expect(nameMatcher('moong dal')('Moong dal')).toBe(0);
    expect(nameMatcher('moong dal')('Moong daliya')).toBe(1);
    expect(nameMatcher('dalmakhani')("Test Maker's Dal-Makhani")).toBe(0);
    expect(nameMatcher('haldirams')("Haldiram's Bhujia")).toBe(0);
    expect(nameMatcher('dal')('Chicken Vindaloo')).toBe(2);
    expect(nameMatcher('dal')('Baati (baked)')).toBe(3);
  });
});
