import type { Food, PackagedFood } from '@fitsphere/shared';
import type { FoodResult } from './FoodDetail';
import { onePerProduct, productKey } from './FoodSearchSheet';

// D-78 (the owner, 2026-11-11, after "Amul" listed "55% Dark Chocolate" three times, then "Milk Bikis"
// four): Search foods shows each branded product once, its brand labels and Open Food Facts' barcodes
// together, with its copies saved with no brand, whatever their values: the brand label when there is
// one, otherwise a copy naming its brand, then the energy most copies give, then the copy with the most
// values, then a name without a pack size, then the first. Synthetic products and made-up values, not
// real ones.

let next = 0;
function pk(name: string, brand: string | null, kcal: number, more: Partial<PackagedFood> = {}): { kind: 'packaged'; food: PackagedFood } {
  next += 1;
  return {
    kind: 'packaged',
    food: { barcode: `89000000${String(next).padStart(5, '0')}`, name, brand, kcal, proteinG: 1, carbsG: 1, fatG: 80, fibreG: null, servingGrams: null, ...more },
  };
}

function listed(name: string, source: Food['source'], foodGroup = 'Synthetic group'): { kind: 'food'; food: Food } {
  return {
    kind: 'food',
    food: { source, code: name, name, foodGroup, aliases: [], proteinG: 1, fibreG: null, fatG: 80, carbsG: 1, kcal: 724, kcalEstimated: false, measures: [], portions: [] },
  };
}

/** A brand label as the server names it: the brand, then the product (brandLabelName). */
const label = (brand: string, product: string) => listed(`${brand} ${product}`, 'brand_label', brand);

describe('D-78 each branded product once', () => {
  it('shows a brand label and its Open Food Facts copies as one row, the brand label, where the first copy was', () => {
    const results: FoodResult[] = [
      pk('Test Dairy Butter 500g', 'TEST DAIRY', 724, { fibreG: 0 }),
      listed('Test butter chicken', 'indb'),
      label('Test Dairy', 'Butter'),
      pk('Butter', 'Test Dairy', 724),
      pk('butter (100 g)', 'test dairy', 714.29, { servingGrams: 10 }),
    ];

    expect(onePerProduct(results)).toEqual([results[2], results[1]]);
  });

  it('knows one product whatever the case, marks, spaces, the brand in front or a pack size', () => {
    const key = (name: string, brand: string | null) => productKey(pk(name, brand, 100));
    const same = [
      ["Testiram's Aloo Bhujia 1kg", "Testiram's", 'aloo bhujia', 'Testirams'],
      ['55% Dark Chocolate', 'Test Co', '55 % dark chocolate', 'Test Co'],
      ['Jim Jam', 'Test Co', 'Jimjam 460g', 'TEST CO'],
      ['(TEST CO) Rich Tomato Sauce 485Gram', 'Test Co', 'Rich tomato sauce', 'Test-Co'],
      ['Masti Spiced Buttermilk 200ml', 'Test Co', 'Masti Spiced Buttermilk', 'Test Co'],
      ['Pure Ghee 1 ltr', 'Test Co', 'Pure ghee (500 ml)', 'Test Co'],
      // D-88: accents too.
      ['Munch', 'Testlé', 'Munch', 'testle'],
      ['Crème Wafers', 'Test Co', 'Creme wafers', 'Test Co'],
      // D-89: a company's words, and "The".
      ['Marie Gold', 'Testannia Industries Ltd', 'Marie Gold', 'Testannia'],
      ['Testannia Marie Gold', 'Testannia Industries Ltd', 'Marie gold', 'TESTANNIA'],
      ['Test Cola', 'The Test-Cola Company', 'Test Cola 750ml', 'Test Cola'],
      ['The Test Truth Protein Bar', 'The Test Truth', 'Protein bar', 'Test Truth'],
    ];
    for (const [a, aBrand, b, bBrand] of same) expect(key(a!, aBrand!)).toBe(key(b!, bBrand!));

    // Another brand, or another name, is another product.
    expect(key('Butter', 'Test Dairy')).not.toBe(key('Butter', 'Other Dairy'));
    expect(key('Butter', 'Test Dairy')).not.toBe(key('Butter Cookies', 'Test Dairy'));
    // Numbers that are not a pack size stay part of the name (the brand without its company's "Co", D-89).
    expect(key('5 Star', 'Test Co')).toBe('test|5star');
    expect(key('20-20 Cookies', 'Test Co')).toBe('test|2020cookies');
    expect(key('Wafers 3 layers', 'Test Co')).toBe('test|wafers3layers');
    expect(key('Classic Malt 1.5kg', 'Test Co')).toBe('test|classicmalt');
    // A brand label's brand is its food group.
    expect(productKey(label('Test Co', 'Pure Ghee'))).toBe('test|pureghee');
    // No brand: not a branded product.
    expect(key('Lassi', null)).toBeNull();
    expect(productKey(listed('Butter, salted', 'ifct2017'))).toBeNull();
  });

  it('with no brand label, shows the energy most copies give, then the most values, then a name without a pack size', () => {
    const plain = pk('Test noodles', 'Test Co', 384);
    const sauce = pk('test noodles', 'Test Co', 83, { fibreG: 1, servingGrams: 9 });
    const sized = pk('Test Noodles 280g', 'Test Co', 384.2, { fibreG: 2, servingGrams: 70 });
    const full = pk('Test Noodles', 'TEST CO', 384, { fibreG: 2, servingGrams: 70 });

    // 384 kcal is given by three copies; of them two have both values; of those one has no pack size.
    expect(onePerProduct([plain, sauce, sized, full])).toEqual([full]);
    // The copy is shown as it is: its own barcode, values and serving.
    expect(onePerProduct([sauce, sized, plain, full])[0]).toBe(full);
    // All alike: the first.
    const again = pk('Test noodles', 'Test Co', 384);
    expect(onePerProduct([plain, again])).toEqual([plain]);
    // Two energies given by as many copies: the one with more values.
    expect(onePerProduct([plain, sauce])).toEqual([sauce]);
  });

  it('places a product saved with no brand by its barcode’s company or the brand at the front of its name', () => {
    // Synthetic barcodes: 8901111… is Test Bakes' company, 8902222… another.
    const rusk = pk('Milk Rusk', 'Test Bakes', 454, { barcode: '8901111000011' });
    const sameCompany = pk('Milk Rusk', null, 459, { barcode: '8901111000028' });
    const sameCompanyHigher = pk('milk rusk', null, 498, { barcode: '8901111000035' });
    const brandInName = pk('TEST BAKES Milk Rusk', null, 300, { barcode: '12345670' });
    const otherCompany = pk('Milk Rusk', null, 452, { barcode: '8902222000017' });
    // Same company, but an energy not within a tenth: perhaps another of its products.
    const farEnergy = pk('Milk Rusk', null, 600, { barcode: '8901111000042' });

    expect(onePerProduct([sameCompany, rusk, otherCompany, sameCompanyHigher, brandInName, farEnergy])).toEqual([rusk, otherCompany, farEnergy]);
  });

  it('never places a product with no brand by its name alone, and joins one company’s alike', () => {
    const branded = pk('Mayonnaise', 'Test Foods', 680, { barcode: '8903333000016' });
    const anyMaker = pk('Mayonnaise', null, 680, { barcode: '8904444000015' });
    const short = pk('Mayonnaise', null, 680, { barcode: '12345670' });
    const lassi = pk('Lassi', null, 76, { barcode: '8905555000014' });
    const lassiAgain = pk('Lassi', null, 76, { barcode: '8905555000021' });

    expect(onePerProduct([branded, anyMaker, short, lassi, lassiAgain])).toEqual([branded, anyMaker, short, lassi]);
  });

  it('leaves foods with no brand of other companies, other brands and every other food as they are, in their order', () => {
    const results: FoodResult[] = [
      pk('Lassi', null, 76, { barcode: '8906666000013' }),
      pk('Lassi', null, 76, { barcode: '8907777000012' }),
      pk('Butter', 'Test Dairy', 724),
      pk('Butter', 'Other Dairy', 717),
      listed('Butter, salted', 'ifct2017'),
      listed('Butter, salted', 'ifct2017'),
      { kind: 'dish', dish: { code: 'test_dish', name: 'Test butter dish', portionUnit: 'katori', kcal: 200, proteinG: 5, carbsG: 20, fatG: 10, fibreG: 2 } },
    ];

    expect(onePerProduct(results)).toEqual(results);
    expect(onePerProduct([])).toEqual([]);
  });
});
