import type { Food, PackagedFood } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { BindValue, SqlDb } from '../local/sql';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// D-72 (the owner, 2026-11-11): Search foods searches less often. It waits for a pause in typing, runs
// one search at a time, and with one or two characters finds only the foods named by them. Synthetic
// foods and products, made-up values.

const food = (code: string, name: string): Food => ({
  source: 'ifct2017',
  code,
  name,
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
});
const packaged = (barcode: string, name: string, brand: string | null): PackagedFood => ({
  barcode,
  name,
  brand,
  kcal: 400,
  proteinG: 20,
  carbsG: 50,
  fatG: 10,
  fibreG: null,
  servingGrams: null,
});
const FOODS = [food('T001', 'Test bread, white'), food('T002', 'Test quinoa, raw')];
const PACKAGED = [packaged('8900000000011', 'Q', null), packaged('8900000000012', 'Test whey', 'Z.Y.')];

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function withFoods(db: SqlDb, server: FakeServer) {
  server.state.foods = FOODS;
  server.state.packaged = PACKAGED;
  await replaceFoods(db, server.state.foodsVersion, FOODS, [], PACKAGED);
}

async function openSearch() {
  mockParams = { day: '2026-10-28', slot: 'breakfast' };
  const { db } = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, withFoods);
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  return db;
}

const box = () => screen.getByLabelText('Search foods');
const rows = () => screen.queryAllByRole('button', { name: /kcal per/ }).map((row) => row.props.accessibilityLabel as string);

describe('D-72 Search foods searches less often', () => {
  it('searches a word typed quickly once, when typing pauses, not at each letter', async () => {
    const db = await openSearch();
    // The words each search of the food list looked for.
    const searched: BindValue[] = [];
    const read = db.getAllAsync.bind(db);
    jest.spyOn(db, 'getAllAsync').mockImplementation((source, params) => {
      // The word looked for anywhere in a name ("%bread%"), wherever the query has it (D-92 put the
      // everyday food's test, "% bread %" and "@bread", before it).
      if (source.includes('FROM foods WHERE source = ?')) searched.push(params.find((param) => typeof param === 'string' && /^%[^ ].*[^ ]%$/.test(param)) ?? null);
      return read(source, params);
    });

    for (const text of ['b', 'br', 'bre', 'brea', 'bread']) await fireEvent.changeText(box(), text);

    await waitFor(() => expect(rows()).toEqual(['Test bread, white, 250 kcal per 100 g']));
    expect([...new Set(searched)]).toEqual(['%bread%']);
  });

  it('lists with one or two characters only the foods named by them, under a line asking for three', async () => {
    await openSearch();

    await fireEvent.changeText(box(), 'q');
    expect(screen.getByText('Type 3 letters or more to search all foods.')).toBeOnTheScreen();
    // The product named Q, not the quinoa.
    await waitFor(() => expect(rows()).toEqual(['Q, 400 kcal per 100 g']));
    expect(screen.queryByText(/No foods found/)).toBeNull();

    // A brand named by them, ignoring its dots.
    await fireEvent.changeText(box(), 'zy');
    await waitFor(() => expect(rows()).toEqual(['Test whey, Z.Y., 400 kcal per 100 g']));

    // Three letters search by part of a word again, and the line goes.
    await fireEvent.changeText(box(), 'qui');
    await waitFor(() => expect(rows()).toEqual(['Test quinoa, raw, 250 kcal per 100 g']));
    expect(screen.queryByText('Type 3 letters or more to search all foods.')).toBeNull();
  });

  it('says "No foods found" only once the search for the text is done', async () => {
    await openSearch();

    await fireEvent.changeText(box(), 'xyzzy');
    expect(screen.queryByText(/No foods found/)).toBeNull();

    expect(await screen.findByText(/No foods found/)).toBeOnTheScreen();
  });

  it('clears the results at once when the box is emptied', async () => {
    await openSearch();
    await fireEvent.changeText(box(), 'bread');
    await waitFor(() => expect(rows()).toHaveLength(1));

    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));

    expect(rows()).toEqual([]);
  });
});
