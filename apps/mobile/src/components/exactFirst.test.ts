import type { Food, PackagedFood } from '@fitsphere/shared';
import { exactFirst } from './FoodSearchSheet';

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
