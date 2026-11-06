import type { Food, PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { brandOf, groupBrands } from '../components/FoodSearchSheet';
import type { FoodResult } from '../components/FoodDetail';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

// Search results without source tags (D-61; the canvas's option C, chosen by the owner on 2026-11-06):
// a branded food's brand under its name, and the branded foods of one name as one row that opens to
// list them, a brand each. Synthetic products and values, not real ones.

const packaged = (barcode: string, name: string, brand: string | null, kcal: number): PackagedFood => ({
  barcode,
  name,
  brand,
  kcal,
  proteinG: 8,
  carbsG: 48,
  fatG: 2,
  fibreG: null,
  servingGrams: null,
});
const label = (code: string, brand: string, product: string, kcal: number): Food => ({
  source: 'brand_label',
  code,
  name: `${brand} ${product}`,
  foodGroup: brand,
  aliases: [brand],
  proteinG: 9,
  fibreG: 5,
  fatG: 3,
  carbsG: 45,
  kcal,
  kcalEstimated: false,
  measures: [],
  portions: [],
});
const INDB_TOAST: Food = {
  source: 'indb',
  code: 'BFP901',
  name: 'Test bread toast',
  foodGroup: 'Indian recipes (INDB)',
  aliases: [],
  proteinG: 9.43,
  fibreG: 2.3,
  fatG: 3.59,
  carbsG: 49.2,
  kcal: 267,
  kcalEstimated: true,
  measures: [],
  portions: [{ label: 'Slice', grams: 28 }],
};
const LABELS = [label('alpha-multigrain-bread', 'Alpha Bakers', 'Multigrain Bread', 250), label('beta-multigrain-bread', 'Beta Ovens', 'Multigrain Bread', 255), label('alpha-sandwich-bread', 'Alpha Bakers', 'Sandwich Bread', 250)];
const PACKAGED = [packaged('8900000000001', 'Bread', 'Gamma Foods', 244), packaged('8900000000002', 'Bread', 'Delta Bakes', 274), packaged('8900000000003', 'Bread', 'Epsilon', 220), packaged('8900000000004', 'Garlic bread', null, 330)];

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  const foods = [...LABELS, INDB_TOAST];
  server.state.foods = foods;
  server.state.packaged = PACKAGED;
  await replaceFoods(db, server.state.foodsVersion, foods, [], PACKAGED);
}

async function search(text: string) {
  mockParams = { day: '2026-10-28', slot: 'breakfast' };
  await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
}

describe('D-61 brands and names', () => {
  const result = (food: Food): FoodResult => ({ kind: 'food', food });

  it('takes a brand label’s brand off its name, and a packaged food’s when its name starts with it', () => {
    expect(brandOf(result(LABELS[0]!))).toEqual({ brand: 'Alpha Bakers', product: 'Multigrain Bread' });
    expect(brandOf({ kind: 'packaged', food: packaged('1', 'Gamma Foods Bread', 'Gamma Foods', 244) })).toEqual({ brand: 'Gamma Foods', product: 'Bread' });
    expect(brandOf({ kind: 'packaged', food: PACKAGED[3]! })).toBeNull();
    expect(brandOf(result(INDB_TOAST))).toBeNull();
  });

  it('makes one row of a name several brands have, where the first was; the rest keep their places', () => {
    const results: FoodResult[] = [
      { kind: 'packaged', food: PACKAGED[0]! },
      result(LABELS[0]!),
      result(INDB_TOAST),
      { kind: 'packaged', food: PACKAGED[1]! },
      result(LABELS[2]!),
      result(LABELS[1]!),
    ];

    const rows = groupBrands(results);

    expect(rows.map((row) => (row.kind === 'one' ? `one:${row.result.kind === 'dish' ? row.result.dish.name : row.result.food.name}` : `${row.name}×${row.members.length}`))).toEqual([
      'Bread×2',
      'Multigrain Bread×2',
      'one:Test bread toast',
      'one:Alpha Bakers Sandwich Bread',
    ]);
  });

  it('keeps a row for each when one brand’s product comes from two sources', () => {
    const asLabel = label('gamma-foods-bread', 'Gamma Foods', 'Bread', 244);
    const rows = groupBrands([{ kind: 'packaged', food: PACKAGED[0]! }, result(asLabel)]);

    expect(rows.map((row) => row.kind)).toEqual(['one', 'one']);
  });
});

describe('D-61 Search foods without tags', () => {
  it('shows a name’s brands as one row, its brand count and energy range, no source tags', async () => {
    await search('bread');

    const bread = await screen.findByRole('button', { name: 'Bread, 3 brands, 220 to 274 kcal per 100 g' });
    expect(bread.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByText('220–274 kcal per 100 g', { exact: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Multigrain Bread, 2 brands, 250 to 255 kcal per 100 g' })).toBeOnTheScreen();
    // A name one brand has: the brand under the name.
    expect(screen.getByRole('button', { name: 'Sandwich Bread, Alpha Bakers, 250 kcal per 100 g' })).toBeOnTheScreen();
    // A packaged food with no brand, and an INDB recipe: the name and the energy only.
    expect(screen.getByRole('button', { name: 'Garlic bread, 330 kcal per 100 g' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Test bread toast, 267 kcal per 100 g, estimated' })).toBeOnTheScreen();
    for (const tag of ['Packaged', 'Brand label', 'INDB', 'My food']) expect(screen.queryByText(tag)).toBeNull();
  });

  it('opens a name’s brands, each opening its page, and closes them again', async () => {
    await search('bread');

    await fireEvent.press(await screen.findByRole('button', { name: 'Bread, 3 brands, 220 to 274 kcal per 100 g' }));
    expect(screen.getByRole('button', { name: 'Bread, 3 brands, 220 to 274 kcal per 100 g' }).props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByRole('button', { name: 'Bread, Gamma Foods, 244 kcal per 100 g' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bread, Delta Bakes, 274 kcal per 100 g' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bread, Epsilon, 220 kcal per 100 g' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Bread, Delta Bakes, 274 kcal per 100 g' }));
    // The food's own page still says where it comes from.
    expect(await screen.findByText('Packaged')).toBeOnTheScreen();
    expect(screen.getByText('Delta Bakes · Per 100 g: 274 kcal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Bread, 3 brands, 220 to 274 kcal per 100 g' }));
    expect(screen.queryByRole('button', { name: 'Bread, Gamma Foods, 244 kcal per 100 g' })).toBeNull();
  });
});
