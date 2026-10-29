import { OFF_ATTRIBUTION, type BarcodeProduct } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ day: '2026-10-28' }) }));

// The camera is replaced by a button that "scans" one barcode; BarcodeCamera has its own tests.
jest.mock('../components/BarcodeCamera', () => {
  const { Button } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BarcodeCamera: ({ onScanned }: { onScanned(barcode: string): void }) => (
      <Button title="Fake scan" onPress={() => onScanned('8901234567890')} />
    ),
  };
});

// Scan barcode in Log meal (REQ-LOG-007; ADR-0006 rule 2; MVP defaults, D-26). Synthetic products.

const BARCODE = '8901234567890';
const PRODUCT: BarcodeProduct = {
  name: 'Synthetic biscuits',
  brand: 'Synthetic brand',
  kcal: 480,
  proteinG: 7,
  carbsG: 68,
  fatG: 20,
  fibreG: null,
  sourceUrl: `https://world.openfoodfacts.org/product/${BARCODE}`,
};

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function render(before: (db: SqlDb, server: FakeServer) => Promise<void> = async () => undefined) {
  const result = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, before);
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan barcode' }));
  return result;
}

/** The sheet's own "Enter your own food", not the one on the screen behind it. */
function ownFoodInSheet() {
  return screen.getAllByRole('button', { name: 'Enter your own food' }).at(-1)!;
}

const knowsProduct = async (_db: SqlDb, server: FakeServer) => {
  server.state.barcodes[BARCODE] = PRODUCT;
};

beforeEach(() => {
  mockRouter.back.mockClear();
});

describe('REQ-LOG-007 a scanned barcode', () => {
  it('shows the product with Open Food Facts’ attribution, then adds it in grams', async () => {
    const { db } = await render(knowsProduct);

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));

    expect(await screen.findByRole('header', { name: 'Synthetic biscuits (Synthetic brand)' })).toBeOnTheScreen();
    expect(screen.getByText('Per 100 g: 480 kcal · 7.0 g protein')).toBeOnTheScreen();
    expect(screen.getByText(`${OFF_ATTRIBUTION}.`)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '50');
    expect(screen.getByLabelText('Adds 240 kcal and 3.5 g protein')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByLabelText('Synthetic biscuits (Synthetic brand): 50 g, 240 kcal, 3.5 g protein')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Snack' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const [row] = await db.getAllAsync<{ items: string }>('SELECT items FROM meals', []);
    expect(JSON.parse(row!.items)).toEqual([
      {
        source: 'barcode',
        ref: BARCODE,
        name: 'Synthetic biscuits (Synthetic brand)',
        amount: { unit: 'g', value: 50 },
        kcal: 240,
        proteinG: 3.5,
        carbsG: 34,
        fatG: 10,
        fibreG: null,
        estimated: false,
      },
    ]);
  });

  it('ADR-0006 rule 2 sends only the barcode, in the path, with no body', async () => {
    const { server } = await render(knowsProduct);

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));
    await screen.findByText(`${OFF_ATTRIBUTION}.`);

    expect(server.calls.filter((call) => call.path.startsWith('/barcodes'))).toEqual([
      { method: 'GET', path: `/barcodes/${BARCODE}`, body: undefined },
    ]);
  });

  it('can be typed instead: 8 to 14 digits', async () => {
    await render(knowsProduct);

    await fireEvent.changeText(screen.getByLabelText('Barcode digits'), '1234');
    expect(screen.getByText('Enter the 8 to 14 digits under the barcode.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Look up' })).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Barcode digits'), BARCODE);
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('header', { name: 'Synthetic biscuits (Synthetic brand)' })).toBeOnTheScreen();
  });
});

describe('REQ-LOG-007 when the barcode cannot be used, your own food is offered (MVP defaults, D-26)', () => {
  it('not found: enter the values from the label', async () => {
    await render();

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));

    expect(await screen.findByText('This product isn’t in Open Food Facts yet. Enter the values from the label.')).toBeOnTheScreen();
    await fireEvent.press(ownFoodInSheet());
    expect(screen.getByRole('header', { name: 'Enter your own food' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('');
  });

  it('found without kcal or protein: your own food, with the product’s name filled in', async () => {
    await render(async (_db, server) => {
      server.state.barcodes[BARCODE] = { ...PRODUCT, proteinG: null };
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));

    expect(await screen.findByText('Open Food Facts doesn’t have this product’s kcal and protein. Enter them from the label.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    await fireEvent.press(ownFoodInSheet());
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('Synthetic biscuits (Synthetic brand)');
  });

  it('offline: looking up a barcode needs an internet connection', async () => {
    const { server } = await render(knowsProduct);
    server.state.offline = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));

    expect(await screen.findByText('Looking up a barcode needs an internet connection.')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Enter your own food' })).toHaveLength(2);
  });

  it('error model: Open Food Facts not answering is "not available right now", and another scan can follow', async () => {
    const { server } = await render(knowsProduct);
    server.state.barcodesUnavailable = true;

    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));

    expect(await screen.findByText('Barcode lookup isn’t available right now. Try again later, or enter your own food.')).toBeOnTheScreen();
    server.state.barcodesUnavailable = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Scan another barcode' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));
    expect(await screen.findByRole('header', { name: 'Synthetic biscuits (Synthetic brand)' })).toBeOnTheScreen();
  });
});
