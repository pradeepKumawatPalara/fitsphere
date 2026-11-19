import { AI_CONSENT_TEXT, AI_CONSENT_TEXT_VERSION, type BarcodeEstimateResponse } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ day: '2026-10-28' }), usePreventRemove: () => () => undefined }));

// The camera is replaced by a button that "scans" one barcode; BarcodeCamera has its own tests.
jest.mock('../components/BarcodeCamera', () => {
  const { Button } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BarcodeCamera: ({ onScanned }: { onScanned(barcode: string): void }) => (
      <Button title="Fake scan" onPress={() => onScanned('8901234567895')} />
    ),
  };
});

// A barcode found nowhere: the user names the product, our own list is searched first, then an AI
// estimate (ADR-0010's amendment, D-117; REQ-LOG-007, REQ-ACC-004). Made-up product, synthetic values.

const BARCODE = '8901234567895';
const NAME = 'Zorblax Crunch Bar';
const ESTIMATE: BarcodeEstimateResponse = { name: 'Zorblax Crunch Bar', brand: 'Zorblax', kcal: 430, proteinG: 9, carbsG: 60, fatG: 17, fibreG: 3 };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function render(before: (db: SqlDb, server: FakeServer) => Promise<void> = async () => undefined) {
  const result = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db, server) => {
    server.state.barcodeEstimate = ESTIMATE;
    await before(db, server);
  });
  await fireEvent.press(await screen.findByRole('button', { name: 'Scan barcode' }));
  // The barcode is in neither Open Food Facts nor our table: not found.
  await fireEvent.press(screen.getByRole('button', { name: 'Fake scan' }));
  await screen.findByText('This product isn’t in Open Food Facts yet. Type its name and AI will estimate the values.');
  return result;
}

const consented = async (_db: SqlDb, server: FakeServer) => {
  server.state.aiConsent = { consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: NOW.toISOString() };
};

async function nameIt() {
  await fireEvent.changeText(screen.getByLabelText('Product name'), NAME);
  await fireEvent.press(screen.getByRole('button', { name: 'Search with AI' }));
}

describe('REQ-LOG-007 a barcode found nowhere: name it, then an estimate', () => {
  it('opens the name box at once, beside Enter your own food, which still works without AI (invariant #4)', async () => {
    await render();
    expect(screen.getByLabelText('Product name')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search with AI' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Enter your own food' }).length).toBeGreaterThan(0);
  });

  it('Search with AI waits for a name of 2 or more characters', async () => {
    await render();
    await fireEvent.changeText(screen.getByLabelText('Product name'), 'Z');
    expect(screen.getByRole('button', { name: 'Search with AI' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Product name'), NAME);
    expect(screen.getByRole('button', { name: 'Search with AI' })).toBeEnabled();
  });

  it('Search our food list is the other choice: with no match in our list it goes on to the estimate', async () => {
    const { server } = await render(consented);
    await fireEvent.changeText(screen.getByLabelText('Product name'), NAME);
    await fireEvent.press(screen.getByRole('button', { name: 'Search our food list' }));
    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(server.state.barcodeEstimateBodies).toEqual([{ barcode: BARCODE, name: NAME }]);
  });

  it('never consented: the consent text names OpenAI and nothing is sent until Agree', async () => {
    const { server } = await render();
    await nameIt();

    expect(await screen.findByText(AI_CONSENT_TEXT)).toBeOnTheScreen();
    expect(AI_CONSENT_TEXT).toContain('OpenAI');
    expect(server.state.barcodeEstimateBodies).toEqual([]);

    await fireEvent.press(screen.getByRole('button', { name: 'Agree and estimate' }));
    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(server.state.aiConsent).toMatchObject({ consented: true, textVersion: AI_CONSENT_TEXT_VERSION });
  });

  it('consent already given: only the barcode and the typed name are sent, and the estimate opens editable and marked', async () => {
    const { server } = await render(consented);
    await nameIt();

    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(screen.getByText('Estimated by AI from the name, not read from a label. Check the pack and change what is off.')).toBeOnTheScreen();
    expect(server.state.barcodeEstimateBodies).toEqual([{ barcode: BARCODE, name: NAME }]);
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('Zorblax Crunch Bar (Zorblax)');
    expect(screen.getByDisplayValue('430')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByDisplayValue('430'), '410');
    expect(screen.getByDisplayValue('410')).toBeOnTheScreen();
  });

  it('Add logs the food as an estimate and keeps it as the user’s own My food', async () => {
    const { db } = await render(consented);
    await nameIt();
    await screen.findByRole('header', { name: 'Check the estimate' });

    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '70');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Snack' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save snack' }));
    expect(await screen.findByText(/^Snack saved · /)).toBeOnTheScreen();

    const [row] = await db.getAllAsync<{ items: string }>('SELECT items FROM meals', []);
    const [item] = JSON.parse(row!.items) as { source: string; name: string; estimated: boolean; ref: string | null }[];
    expect(item).toMatchObject({ source: 'own', name: 'Zorblax Crunch Bar (Zorblax)', estimated: true });
    expect(item!.ref).not.toBeNull();
  });

  it('Not now keeps AI off: no estimate is asked for, and your own food is still offered', async () => {
    const { server } = await render();
    await nameIt();
    await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));

    expect(await screen.findByText(/AI is off, so there is no estimate/)).toBeOnTheScreen();
    expect(server.state.barcodeEstimateBodies).toEqual([]);
    expect(screen.getAllByRole('button', { name: 'Enter your own food' }).length).toBeGreaterThan(0);
  });

  it('the estimate failing: "not available right now", with your own food offered and nothing logged', async () => {
    const { server } = await render(consented);
    server.state.barcodeEstimate = null;
    await nameIt();

    expect(await screen.findByText('Barcode lookup isn’t available right now. Try again later, or enter your own food.')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Enter your own food' }).length).toBeGreaterThan(0);
  });
});
