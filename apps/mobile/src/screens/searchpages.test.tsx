import type { Food } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// D-73 (the owner, 2026-11-11: "End User should not feel like ... he should be wait too much than loads
// ... Initial screen must be filled by the result"): the results list shows the first 200 rows and adds
// 200 more from the results already found as its end comes near. Synthetic foods, made-up values.

const FOODS: Food[] = Array.from({ length: 450 }, (_, i) => ({
  source: 'ifct2017',
  code: `T${String(i + 1).padStart(3, '0')}`,
  name: `Test bread ${String(i + 1).padStart(3, '0')}`,
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 8,
  fibreG: 2,
  fatG: 3,
  carbsG: 48,
  kcal: 250,
  kcalEstimated: false,
  measures: [],
  portions: [],
}));

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  await replaceFoods(db, server.state.foodsVersion, FOODS);
}

const rows = () => screen.queryAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel as string);
const row = (n: number) => `Test bread ${String(n).padStart(3, '0')}, 250 kcal per 100 g`;

async function search(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Search foods'), text);
  await waitFor(() => expect(rows()[0]).toBe(row(1)));
}

/**
 * Scrolls the list near the end of its content, as the phone reports it: a list 700 high whose rows
 * fill `height`. The tests have no screen, so the sizes are given.
 */
async function scrollNearEnd(height: number) {
  const list = screen.getByTestId('food-results');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } } });
  await fireEvent(list, 'contentSizeChange', 400, height);
  await fireEvent.scroll(list, {
    nativeEvent: { contentOffset: { x: 0, y: height - 750 }, contentSize: { width: 400, height }, layoutMeasurement: { width: 400, height: 700 } },
  });
}

async function openSearch() {
  mockParams = { day: '2026-10-28', slot: 'breakfast' };
  await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
}

describe('D-73 the results list in pages', () => {
  it('fills the first screen with the best matches at once', async () => {
    await openSearch();
    await search('bread');

    expect(rows()).toHaveLength(15);
    expect(rows().at(-1)).toBe(row(15));
  });

  it('adds 200 rows from the results found each time the end comes near, until every match is listed', async () => {
    await openSearch();
    await search('bread');

    // At the end of the first 200 rows, the next 200 are added, and drawn as the list goes on.
    await scrollNearEnd(12800);
    await waitFor(() => expect(rows().at(-1)).toBe(row(200)));
    await scrollNearEnd(12800);
    await waitFor(() => expect(rows().at(-1)).toBe(row(400)));
    // Then the last 50.
    await scrollNearEnd(12850);
    await waitFor(() => expect(rows().at(-1)).toBe(row(450)));
  });

  it('starts a new search at its first 200 rows', async () => {
    await openSearch();
    await search('bread');
    await scrollNearEnd(12800);
    await waitFor(() => expect(rows().at(-1)).toBe(row(200)));
    await scrollNearEnd(12800);
    await waitFor(() => expect(rows().at(-1)).toBe(row(400)));
    await scrollNearEnd(12850);
    await waitFor(() => expect(rows().at(-1)).toBe(row(450)));

    await search('test');
    // The list's end, with no more rows drawn than before, adds none: the list shows all it holds.
    await scrollNearEnd(12850);

    await waitFor(() => expect(rows().at(-1)).toBe(row(200)));
  });
});
