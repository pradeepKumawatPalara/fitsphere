import type { Food, PackagedFood } from '@fitsphere/shared';
import { nameMatcher } from '../local/store';
import { inSearchOrder } from './FoodSearchSheet';

// Search foods puts a food named exactly as the search first; the rest keep their order (D-51; the
// owner's phone test, 2026-11-05); before and after them alike, the best matches first (D-66). Both
// in one pass since D-75. Synthetic foods.

function food(name: string, source: Food['source'] = 'ifct2017'): { kind: 'food'; food: Food } {
  return {
    kind: 'food',
    food: { source, code: name, name, foodGroup: 'Test', aliases: [], proteinG: 1, fibreG: 1, fatG: 1, carbsG: 1, kcal: 21, kcalEstimated: false, measures: [], portions: [] },
  };
}

function packaged(name: string, brand: string | null): { kind: 'packaged'; food: PackagedFood } {
  return { kind: 'packaged', food: { barcode: '8901234567890', name, brand, kcal: 250, proteinG: 8, carbsG: 50, fatG: 2, fibreG: null, servingGrams: null } };
}

const names = (results: ReturnType<typeof inSearchOrder>) => results.map((result) => (result.kind === 'dish' ? result.dish.name : result.food.name));

describe('D-51 an exact match first', () => {
  it('moves the foods named exactly as the search to the top, keeping the rest in order', () => {
    // An INDB name with a comma is not a plain food (D-91), so the exact match comes first.
    const results = [food('Bread, white', 'indb'), food('Brown bread', 'indb'), packaged('Bread', 'Test Bakers'), food('Bread pakora', 'indb')];

    expect(names(inSearchOrder('bread', results))).toEqual(['Bread', 'Bread, white', 'Brown bread', 'Bread pakora']);
  });

  it('ignores case, spaces and punctuation, and knows a packaged food by its brand and name together', () => {
    const results = [food('Rice, raw, milled'), food('Rice flakes'), packaged('Sandwich Bread', 'Test Bakers')];

    expect(names(inSearchOrder('  RICE flakes ', results))).toEqual(['Rice flakes', 'Rice, raw, milled', 'Sandwich Bread']);
    expect(names(inSearchOrder('test bakers sandwich bread', results))).toEqual(['Sandwich Bread', 'Rice, raw, milled', 'Rice flakes']);
  });

  it('leaves the order as it is when nothing matches exactly, or nothing is typed', () => {
    const results = [food('Bread, white'), food('Brown bread', 'indb')];

    expect(inSearchOrder('brea', results)).toEqual(results);
    expect(inSearchOrder('   ', results)).toEqual(results);
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

    expect(names(inSearchOrder('dal', results))).toEqual(['Moong dal', 'Mixed dal', 'Dalia test', 'Refined oil', 'Test vindaloo', 'Test baati']);
  });

  it('D-75 puts the exact matches first, then the rest, each in the four groups and each group in its order', () => {
    // Synthetic foods in the order by source.
    const results = [
      food('Dalia test', 'brand_label'),
      packaged('Dal', 'Test Mills'),
      food('Test vindaloo', 'indb'),
      food('Moong dal', 'indb'),
      hidden('Test baati', ['dal baati'], 'ifct2017'),
      food('Dal'),
    ];

    expect(names(inSearchOrder('dal', results))).toEqual(['Dal', 'Dal', 'Moong dal', 'Dalia test', 'Test vindaloo', 'Test baati']);
    // The same without an exact match: only the groups.
    expect(names(inSearchOrder('dal', results.filter((result) => result.food.name !== 'Dal')))).toEqual([
      'Moong dal',
      'Dalia test',
      'Test vindaloo',
      'Test baati',
    ]);
  });

  it('counts the worst word, and two words typed together where the name has them apart', () => {
    expect(nameMatcher('moong dal')('Moong dal')).toBe(0);
    expect(nameMatcher('moong dal')('Moong daliya')).toBe(1);
    expect(nameMatcher('dalmakhani')("Test Maker's Dal-Makhani")).toBe(0);
    expect(nameMatcher('haldirams')("Haldiram's Bhujia")).toBe(0);
    expect(nameMatcher('dal')('Chicken Vindaloo')).toBe(2);
    expect(nameMatcher('dal')('Baati (baked)')).toBe(3);
  });

  it('D-86 reads any mark typed as a space, and leaves out a word of marks alone', () => {
    expect(nameMatcher('paneer!')('Paneer tikka')).toBe(0);
    expect(nameMatcher('#biryani')('Veg biryani')).toBe(0);
    expect(nameMatcher('aloo & gobi')('Aloo gobi')).toBe(0);
    expect(nameMatcher('egg+white')('Egg white, boiled')).toBe(0);
    expect(nameMatcher('oatsalmonds')('Oats + Almonds!')).toBe(0);
    // An exact match ignores the marks too (D-51).
    expect(names(inSearchOrder('paneer!', [food('Paneer tikka'), food('Paneer')]))).toEqual(['Paneer', 'Paneer tikka']);
  });

  it('D-91 lists the plain food first: IFCT’s, then the others; never a brand’s or a packaged product', () => {
    // Synthetic foods in the order by source.
    const results = [
      food('Banana', 'brand_label'),
      packaged('Banana', 'Test Protein'),
      packaged('Banana chips', null),
      food('Banana shake', 'indb'),
      food('Banana (1 medium)', 'dish_estimate'),
      food('Banana, Apple Mash', 'dish_estimate'),
      food('Banana, ripe, robusta'),
      food('Bananas'),
    ];

    expect(names(inSearchOrder('banana', results))).toEqual([
      // Plain: IFCT's "Banana, …" first, then the estimate's "Banana (…)".
      'Banana, ripe, robusta',
      'Banana (1 medium)',
      // Then the exact matches, a brand's or a packaged one (D-51), then the rest (D-66).
      'Banana',
      'Banana',
      'Banana chips',
      'Banana shake',
      'Banana, Apple Mash',
      'Bananas',
    ]);
    // Typed with marks or in capitals, the same.
    expect(names(inSearchOrder('BANANA!', results))[0]).toBe('Banana, ripe, robusta');
    // Nothing plain: the order as before.
    expect(names(inSearchOrder('banana chips', results))[0]).toBe('Banana chips');
  });

  it('D-92 lists the everyday food the search names before all, the plain foods next', () => {
    const everyday = (name: string, source: Food['source']) => {
      const result = food(name, source);
      return { ...result, food: { ...result.food, everyday: true as const } };
    };
    // Synthetic foods in the order by source.
    const results = [packaged('Rice', 'Test Mills'), food('Rice, raw, milled'), everyday('Boiled rice (Uble chawal)', 'indb'), food('Rice kheer', 'indb')];

    expect(names(inSearchOrder('rice', results))).toEqual(['Boiled rice (Uble chawal)', 'Rice, raw, milled', 'Rice', 'Rice kheer']);
  });

  it('D-92 lists the packs of a dry or ready-to-cook form last, unless the search asks for one or names their brand', () => {
    // Synthetic foods in the order by source.
    const results = [
      packaged('Dosa Idli Batter', 'Test Dairy'),
      packaged('Rice Dosa Mix', 'Test Mills'),
      packaged('Dosa Flour', 'Test Mills'),
      packaged('Masala Dosa', 'Test Foods'),
      food('Mix veg dosa', 'home'),
      food('Masala dosa', 'indb'),
      food('Plain dosa', 'dish_estimate'),
    ];

    expect(names(inSearchOrder('dosa', results))).toEqual([
      'Dosa Flour',
      'Masala Dosa',
      'Mix veg dosa',
      'Masala dosa',
      'Plain dosa',
      // The batter and the mix last; a home-style food named "Mix veg" is no pack.
      'Dosa Idli Batter',
      'Rice Dosa Mix',
    ]);
    // Asked for: in their places.
    expect(names(inSearchOrder('dosa batter', results))[0]).toBe('Dosa Idli Batter');
    // A search for the brand lists its packs as they come.
    expect(names(inSearchOrder('test mills', results)).slice(0, 2)).toEqual(['Rice Dosa Mix', 'Dosa Flour']);
  });

  it('D-88 ignores accents, in the words and the exact match', () => {
    expect(nameMatcher('cafe')('Café latte')).toBe(0);
    expect(nameMatcher('jalapeño')('Jalapeno chips')).toBe(0);
    expect(names(inSearchOrder('testle koko krunch', [food('Koko Krunch cereal'), packaged('Koko Krunch', 'Testlé')]))).toEqual(['Koko Krunch', 'Koko Krunch cereal']);
  });
});
