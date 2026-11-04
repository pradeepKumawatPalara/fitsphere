import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.ts';
import { FoodListError } from './ifct.ts';
import { convertFndds, portionLabel, readUsdaCsv, skippedPortion } from './usda.ts';

// USDA FoodData Central's FNDDS for the food list (docs/plans/more-foods.md, D-39). A synthetic
// download in USDA's JSON shape; the real files are converted by `npm run usda:convert`.

function nutrients(kcal: number, protein: number, carbs: number, fat: number, fibre: number) {
  return [
    { nutrient: { name: 'Energy', unitName: 'kcal' }, amount: kcal },
    { nutrient: { name: 'Protein', unitName: 'g' }, amount: protein },
    { nutrient: { name: 'Carbohydrate, by difference', unitName: 'g' }, amount: carbs },
    { nutrient: { name: 'Total lipid (fat)', unitName: 'g' }, amount: fat },
    { nutrient: { name: 'Fiber, total dietary', unitName: 'g' }, amount: fibre },
  ];
}

const DOWNLOAD = {
  SurveyFoods: [
    {
      foodCode: 51101000,
      description: 'Bread, white',
      wweiaFoodCategory: { wweiaFoodCategoryDescription: 'Yeast breads' },
      foodNutrients: nutrients(267, 9.432, 49.2, 3.59, 2.3),
      foodPortions: [
        { portionDescription: '1 medium or regular slice', gramWeight: 28, sequenceNumber: 2 },
        { portionDescription: '1 small or thin/very thin slice', gramWeight: 24, sequenceNumber: 1 },
        { portionDescription: 'Quantity not specified', gramWeight: 28, sequenceNumber: 3 },
        { portionDescription: '1 oz', gramWeight: 28.35, sequenceNumber: 4 },
        { portionDescription: '1 cubic inch', gramWeight: 2.8, sequenceNumber: 5 },
        { portionDescription: 'Guideline amount per fl oz of beverage', gramWeight: 30, sequenceNumber: 6 },
        { portionDescription: '1 cup (8 fl oz)', gramWeight: 40, sequenceNumber: 7 },
        { portionDescription: '1 medium or regular slice', gramWeight: 30, sequenceNumber: 8 },
        { portionDescription: '1 loaf', gramWeight: 2500, sequenceNumber: 9 },
      ],
    },
    { foodCode: 11000000, description: 'Milk, human', foodNutrients: [], foodPortions: [] },
  ],
};

describe('D-39 converting USDA FNDDS', () => {
  it('keeps the five values per 100 g, rounded to two decimals, and leaves out a food without them', () => {
    const { foods, skipped } = convertFndds(DOWNLOAD);

    expect(foods).toEqual([
      ['food_code', 'name', 'category', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'],
      ['51101000', 'Bread, white', 'Yeast breads', '267', '9.43', '49.2', '3.59', '2.3'],
    ]);
    expect(skipped).toEqual(['Milk, human']);
  });

  it('keeps the metric servings in USDA’s order, once each, up to 2,000 g', () => {
    const { portions } = convertFndds(DOWNLOAD);

    expect(portions).toEqual([
      ['food_code', 'seq', 'description', 'grams'],
      ['51101000', '1', '1 small or thin/very thin slice', '24'],
      ['51101000', '2', '1 medium or regular slice', '28'],
      ['51101000', '3', '1 cup (8 fl oz)', '40'],
    ]);
  });

  it('names a serving without its leading "1", and leaves out ounces, cubic inches and no quantity', () => {
    expect(portionLabel('1 medium or regular slice')).toBe('Medium or regular slice');
    expect(portionLabel('Guideline amount per sandwich')).toBe('Guideline amount per sandwich');
    expect(portionLabel('2 slices')).toBe('2 slices');
    for (const description of ['Quantity not specified', '1 oz', '1 fl oz', '3 oz, boneless', 'Guideline amount per fl oz of beverage', '1 cubic inch']) {
      expect(skippedPortion(description)).toBe(true);
    }
    for (const description of ['1 cup (8 fl oz)', '1 bottle (16.9 fl oz or 500 ml)', '1 tablespoon']) {
      expect(skippedPortion(description)).toBe(false);
    }
  });

  it('refuses a file that is not an FNDDS download', () => {
    expect(() => convertFndds({ FoundationFoods: [] })).toThrow(FoodListError);
  });
});

describe('D-39 reading the USDA files for foods:import', () => {
  const converted = convertFndds(DOWNLOAD);
  const foodsCsv = toCsv(converted.foods);
  const portionsCsv = toCsv(converted.portions);

  it('reads the files the converter writes, the servings by their label', () => {
    const { foods, portions } = readUsdaCsv(foodsCsv, portionsCsv);

    expect(foods).toEqual([
      expect.objectContaining({ code: '51101000', name: 'Bread, white', foodGroup: 'Yeast breads', kcal: '267', proteinG: '9.43', kcalSource: 'published', estimated: false, hidden: false }),
    ]);
    expect(portions).toEqual([
      { code: '51101000', seq: 1, label: 'Small or thin/very thin slice', grams: 24 },
      { code: '51101000', seq: 2, label: 'Medium or regular slice', grams: 28 },
      { code: '51101000', seq: 3, label: 'Cup (8 fl oz)', grams: 40 },
    ]);
  });

  it.each([
    ['a wrong header', foodsCsv.replace('fibre_g', 'fiber_g'), portionsCsv],
    ['a code that is not 8 digits', foodsCsv.replace('51101000,', '5110100,'), portionsCsv],
    ['a value over 1,000 kcal per 100 g', foodsCsv.replace(',267,', ',1001,'), portionsCsv],
    ['a serving of a food not in the list', foodsCsv, portionsCsv.replace('51101000,1,', '51101001,1,')],
    ['a serving over 2,000 g', foodsCsv, portionsCsv.replace(',24\n', ',2001\n')],
    ['a serving in ounces', foodsCsv, portionsCsv.replace('1 small or thin/very thin slice', '1 oz')],
  ])('refuses the whole import for %s', (_case, foods, portions) => {
    expect(() => readUsdaCsv(foods, portions)).toThrow(FoodListError);
  });

  it('writes CSV fields with commas or quotes in quotes, which the reader reads back', () => {
    const rows = [['a', 'b, c', 'd "e"']];
    expect(toCsv(rows)).toBe('a,"b, c","d ""e"""\n');
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('D-39 the committed USDA files', () => {
  it('read whole: 5,431 foods with 14,738 servings, none in ounces', async () => {
    const { readFileSync } = await import('node:fs');
    const read = (name: string) => readFileSync(new URL(`../../../../data/foods/${name}`, import.meta.url), 'utf8');

    const { foods, portions } = readUsdaCsv(read('usda-fndds-foods.csv'), read('usda-fndds-portions.csv'));

    expect(foods).toHaveLength(5_431);
    expect(portions).toHaveLength(14_738);
    expect(portions.filter((portion) => portion.code === foods.find((food) => food.name === 'Bread, white')?.code).map((p) => p.label)).toContain(
      'Medium or regular slice',
    );
  });
});
