import type { Food, PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// D-96 (the owner, 2026-11-12, QA-18): Search foods finds the food when an amount is typed with it ("2
// roti", "half plate biryani", "150 g paneer"), and its page opens on that amount; a search naming
// several foods offers each to search. Synthetic foods and made-up values.

const food = (source: Food['source'], code: string, name: string, portions: Food['portions'] = []): Food => ({
  source,
  code,
  name,
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 8,
  fibreG: 2,
  fatG: 3,
  carbsG: 48,
  kcal: 250,
  kcalEstimated: source !== 'ifct2017',
  measures: [],
  portions,
});
const ROTI = food('indb', 'T701', 'Test roti', [{ label: 'Roti', grams: 40 }]);
const BIRYANI = food('dish_estimate', 'est-test-biryani', 'Test biryani', [{ label: 'Plate', grams: 250 }]);
const PANEER = food('ifct2017', 'T702', 'Test paneer');
const STAR: PackagedFood = { barcode: '8901234500301', name: 'Test 5 Star', brand: 'Test Sweets', kcal: 480, proteinG: 4, carbsG: 60, fatG: 24, fibreG: null, servingGrams: 40 };
const SEVEN: PackagedFood = { ...STAR, barcode: '8901234500302', name: '7 Up', brand: 'Test Drinks', kcal: 40, proteinG: 0, carbsG: 10, fatG: 0 };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = [ROTI, BIRYANI, PANEER];
  server.state.packaged = [STAR, SEVEN];
  await replaceFoods(db, server.state.foodsVersion, [ROTI, BIRYANI, PANEER], [], [STAR, SEVEN]);
}

async function openSearch() {
  mockParams = { day: '2026-10-28', slot: 'lunch' };
  await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
}

const box = () => screen.getByLabelText('Search foods');
const rows = () => screen.queryAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel as string);

async function searchAndOpen(text: string, name: RegExp) {
  await fireEvent.changeText(box(), text);
  await waitFor(() => expect(rows().some((row) => name.test(row))).toBe(true));
  await fireEvent.press(screen.getAllByRole('button', { name })[0]!);
}

describe('D-96 an amount typed with a food', () => {
  it('"2 roti" finds the roti, and its page opens on 2 rotis', async () => {
    await openSearch();
    await searchAndOpen('2 roti', /^Test roti/);

    expect(await screen.findByLabelText('Quantity: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Roti (40 g)')).toBeOnTheScreen();
  });

  it('"half plate biryani" opens on half a plate; "150 g paneer" on 150 grams', async () => {
    await openSearch();
    await searchAndOpen('half plate biryani', /^Test biryani/);
    expect(await screen.findByLabelText('Quantity: 0.5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Plate (250 g)')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));
    await searchAndOpen('150 g paneer', /^Test paneer/);
    expect(await screen.findByLabelText('Grams eaten')).toHaveDisplayValue('150');
  });

  it('a measure the food does not have leaves its page as usual', async () => {
    await openSearch();
    await searchAndOpen('2 cup roti', /^Test roti/);

    expect(await screen.findByLabelText('Quantity: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Measure: Roti (40 g)')).toBeOnTheScreen();
  });

  it('a number in the food’s name is not an amount: "5 star" lists the product first and opens it as usual', async () => {
    await openSearch();
    await searchAndOpen('5 star', /^Test 5 Star/);

    expect(await screen.findByLabelText('Grams eaten')).toHaveDisplayValue('100');
  });

  it('"7 up" finds the drink: nothing is found without the 7, so it is searched as typed', async () => {
    await openSearch();
    await searchAndOpen('7 up', /^7 Up/);

    expect(await screen.findByLabelText('Grams eaten')).toHaveDisplayValue('100');
  });
});

describe('D-96 a search naming several foods', () => {
  it('offers each food to search when no one food has every word, and searches the one chosen', async () => {
    await openSearch();
    await fireEvent.changeText(box(), 'test biryani with raita and salad');

    expect(await screen.findByText('No one food has all of these. Search each:')).toBeOnTheScreen();
    expect(screen.queryByText(/No foods found/)).toBeNull();
    for (const each of ['test biryani', 'raita', 'salad']) expect(screen.getByRole('button', { name: each })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'test biryani' }));

    expect(box()).toHaveDisplayValue('test biryani');
    await waitFor(() => expect(rows()).toEqual([expect.stringMatching(/^Test biryani/)]));
  });

  it('says "No foods found" when the search names one food that is not listed', async () => {
    await openSearch();
    await fireEvent.changeText(box(), 'xyzzy pie');
    expect(await screen.findByText(/No foods found/)).toBeOnTheScreen();
  });
});
