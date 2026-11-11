import type { Food, PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { getEntry, replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { pickAmount } from '../testing/foodPage';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// D-78 (the owner, 2026-11-11, after "Amul" listed "55% Dark Chocolate" three times, then "Milk Bikis"
// four): Search foods shows each branded product once. Synthetic products and made-up values, not real
// ones.

const ghee = (barcode: string, name: string, brand: string, more: Partial<PackagedFood> = {}): PackagedFood => ({
  barcode,
  name,
  brand,
  kcal: 897,
  proteinG: 0,
  carbsG: 0,
  fatG: 99.7,
  fibreG: null,
  servingGrams: null,
  ...more,
});
const LABEL_GHEE: Food = {
  source: 'brand_label',
  code: 'test-dairy-pure-ghee',
  name: 'Test Dairy Pure Ghee',
  foodGroup: 'Test Dairy',
  aliases: ['Test Dairy'],
  proteinG: 0,
  fibreG: null,
  fatG: 99.7,
  carbsG: 0,
  kcal: 897,
  kcalEstimated: false,
  measures: [],
  portions: [{ label: '1 serving', grams: 13.5 }],
};
// Open Food Facts' copies of the brand label's product, as volunteers typed them.
const GHEE_COPIES = [
  ghee('8900000000101', 'Test Dairy Pure Ghee 500ml', 'Test Dairy', { fibreG: 0 }),
  ghee('8900000000102', 'TEST DAIRY PURE GHEE', 'TEST DAIRY', { servingGrams: 905 }),
  ghee('8900000000103', 'Pure ghee (1 ltr)', 'Test Dairy', { kcal: 890 }),
];
// A product only Open Food Facts has: the first copy in the order has no serving, the second has one.
const PANEER_COPIES = [
  ghee('8900000000201', 'Malai Paneer', 'Test Farm', { kcal: 312, proteinG: 20, carbsG: 4, fatG: 24 }),
  ghee('8900000000202', 'Malai paneer', 'TEST FARM', { kcal: 312, proteinG: 20, carbsG: 4, fatG: 24, fibreG: 0, servingGrams: 50 }),
];

// A product whose copies were saved with no brand (as three Milk Bikis were): 8900011… is its
// company's barcodes; another company's product of the same name stays apart.
const RUSK_COPIES = [
  ghee('8900011000011', 'Milk Rusk', 'Test Bakes', { kcal: 454, proteinG: 7, carbsG: 75, fatG: 14 }),
  ghee('8900011000028', 'Milk Rusk', '', { kcal: 459, proteinG: 7.4, carbsG: 77.1, fatG: 13.5 }),
  ghee('8900011000035', 'milk rusk', '', { kcal: 498, proteinG: 7, carbsG: 68, fatG: 22 }),
  ghee('8900011000042', 'TEST BAKES Milk Rusk', '', { kcal: 454, proteinG: 7, carbsG: 75, fatG: 14 }),
  ghee('8900022000014', 'Milk Rusk', '', { kcal: 300, proteinG: 7, carbsG: 50, fatG: 8 }),
].map((food) => ({ ...food, brand: food.brand || null }));

const PACKAGED = [...GHEE_COPIES, ...PANEER_COPIES, ...RUSK_COPIES];

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = [LABEL_GHEE];
  server.state.packaged = PACKAGED;
  await replaceFoods(db, server.state.foodsVersion, [LABEL_GHEE], [], PACKAGED);
}

async function search(text: string) {
  mockParams = { day: '2026-10-28', slot: 'breakfast' };
  const { db } = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
  return db;
}

const rows = () => screen.queryAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel as string);

describe('D-78 Search foods shows each branded product once', () => {
  it('lists a brand label and its Open Food Facts copies as one row, opening the brand label', async () => {
    await search('ghee');

    await waitFor(() => expect(rows()).toEqual(['Pure Ghee, Test Dairy, 897 kcal per 100 g']));
    await fireEvent.press(screen.getByRole('button', { name: 'Pure Ghee, Test Dairy, 897 kcal per 100 g' }));
    expect(await screen.findByText('Brand label')).toBeOnTheScreen();
  });

  it('lists the copies saved with no brand in their brand’s row, by the barcode’s company or the brand in the name', async () => {
    await search('rusk');

    await waitFor(() => expect(rows()).toEqual(['Milk Rusk, Test Bakes, 454 kcal per 100 g', 'Milk Rusk, 300 kcal per 100 g']));
  });

  it('shows a copy with its own serving, so a meal logged by it carries that barcode and serving', async () => {
    const db = await search('paneer');

    await waitFor(() => expect(rows()).toEqual(['Malai paneer, TEST FARM, 312 kcal per 100 g']));
    await fireEvent.press(screen.getByRole('button', { name: 'Malai paneer, TEST FARM, 312 kcal per 100 g' }));
    await pickAmount({ measure: 'Serving (50 g)', quantity: '1' });
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save breakfast' }));
    expect(await screen.findByText(/^Breakfast saved · /)).toBeOnTheScreen();

    const [meal] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
    expect((await getEntry(db, 'meal', meal!.id))?.items).toEqual([
      expect.objectContaining({ source: 'barcode', ref: '8900000000202', amount: { unit: 'serving', label: 'Serving', value: 1, grams: 50 } }),
    ]);
  });
});
