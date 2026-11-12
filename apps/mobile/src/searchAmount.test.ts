import { measureWord, nameHasNumber, readSearch } from './searchAmount';

// D-96 (QA-18 of the search QA report): an amount and filler words typed with a food are not searched
// for; the amount is kept for the food's page, and a search joining several foods names each.

describe('D-96 an amount typed with a food', () => {
  it('reads the amount and its measure, and searches the food', () => {
    expect(readSearch('2 roti')).toEqual({ search: 'roti', amount: { count: 2, unit: null }, foods: [] });
    expect(readSearch('1 cup rice')).toEqual({ search: 'rice', amount: { count: 1, unit: 'cup' }, foods: [] });
    expect(readSearch('half plate biryani')).toEqual({ search: 'biryani', amount: { count: 0.5, unit: 'plate' }, foods: [] });
    expect(readSearch('1/2 katori dal').amount).toEqual({ count: 0.5, unit: 'katori' });
    expect(readSearch('1½ roti').amount).toEqual({ count: 1.5, unit: null });
    expect(readSearch('two samosas')).toMatchObject({ search: 'samosas', amount: { count: 2, unit: null } });
    expect(readSearch('a cup of tea')).toMatchObject({ search: 'tea', amount: { count: 1, unit: 'cup' } });
    expect(readSearch('half a cup of milk')).toMatchObject({ search: 'milk', amount: { count: 0.5, unit: 'cup' } });
    expect(readSearch('2 large eggs')).toMatchObject({ search: 'eggs', amount: { count: 2, unit: null } });
  });

  it('reads grams, kilograms, millilitres and litres as grams, the number stuck to its unit or not, and leaves out pack words', () => {
    expect(readSearch('100g paneer')).toMatchObject({ search: 'paneer', amount: { count: 100, unit: 'g' } });
    expect(readSearch('paneer 100 g')).toMatchObject({ search: 'paneer', amount: { count: 100, unit: 'g' } });
    expect(readSearch('1.5kg atta').amount).toEqual({ count: 1500, unit: 'g' });
    expect(readSearch('250 ml milk').amount).toEqual({ count: 250, unit: 'g' });
    expect(readSearch('amul pure ghee 1 litre tin pack')).toMatchObject({ search: 'amul pure ghee', amount: { count: 1000, unit: 'g' } });
  });

  it('leaves a number or a word that is part of a food’s name: a number after the food, half before a way of cooking', () => {
    expect(readSearch('chicken 65')).toEqual({ search: 'chicken 65', amount: null, foods: [] });
    expect(readSearch('half boiled egg')).toEqual({ search: 'half boiled egg', amount: null, foods: [] });
    expect(readSearch('7up').search).toBe('7up');
    expect(readSearch('50-50 biscuit').search).toBe('50-50 biscuit');
    expect(readSearch('100% whole wheat bread').search).toBe('100% whole wheat bread');
    expect(readSearch('cup noodles').search).toBe('cup noodles');
  });

  it('gives no words to search when the search is only an amount, so it is searched as typed', () => {
    expect(readSearch('2').search).toBe('');
    expect(readSearch('100 g').search).toBe('');
  });

  it('names each food of a search joining several, each part as typed', () => {
    expect(readSearch('chicken biryani with raita and salad')).toEqual({ search: 'chicken biryani raita salad', amount: null, foods: ['chicken biryani', 'raita', 'salad'] });
    expect(readSearch('2 roti, dal + rice').foods).toEqual(['2 roti', 'dal', 'rice']);
    // A + or & inside a word stays in it (D-86 reads it as one).
    expect(readSearch("m&m's")).toEqual({ search: "m&m's", amount: null, foods: [] });
    expect(readSearch('aloo+gobi').search).toBe('aloo+gobi');
    expect(readSearch('aloo & gobi').foods).toEqual(['aloo', 'gobi']);
    expect(readSearch('roti').foods).toEqual([]);
    expect(readSearch('rice and').foods).toEqual([]);
  });

  it('reads a measure’s name as one word, and finds a number in a food’s name', () => {
    expect(['Plate (4 pc)', 'Katori (200 ml)', 'Slices', 'Pcs', 'Grams'].map(measureWord)).toEqual(['plate', 'katori', 'slice', 'piece', 'g']);
    expect(nameHasNumber('Test 5 Star bar', { count: 5, unit: null })).toBe(true);
    expect(nameHasNumber('Test 21 grain bread', { count: 2, unit: null })).toBe(false);
    expect(nameHasNumber('Test 1.5 litre cola', { count: 1.5, unit: null })).toBe(true);
    expect(nameHasNumber('Test 5 Star bar', { count: 5, unit: 'g' })).toBe(false);
  });
});
