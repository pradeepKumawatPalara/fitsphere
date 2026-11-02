import type { Food } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { replaceFoods } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { HomeScreen } from './HomeScreen';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ day: '2026-10-28' }) }));

// Every field keeps room for its text (REQ-ACC-001). A field that grows (flex: 1) may only grow
// along a row: in a column its flex basis is 0, so it gets just its padding and border, and
// Android clips the typed text and the placeholder out of sight. That hid the Search foods text.

const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false },
];

/** The fields on screen that grow in a column, so would have no height for their text. */
function fieldsWithoutRoom(): string[] {
  return screen.container
    .queryAll((element) => element.type === 'TextInput')
    .filter((field) => {
      const grows = (StyleSheet.flatten(field.props.style)?.flex ?? 0) > 0;
      const direction = field.parent ? StyleSheet.flatten(field.parent.props.style)?.flexDirection : undefined;
      return grows && direction !== 'row' && direction !== 'row-reverse';
    })
    .map((field) => String(field.props.accessibilityLabel));
}

describe('REQ-ACC-001 every field has room for its text', () => {
  it('Log meal: Search foods, its grams step and Enter your own food', async () => {
    await renderInApp(<LogMealScreen />, undefined, async (db, server) => {
      server.state.foods = FOODS;
      await replaceFoods(db, server.state.foodsVersion, FOODS);
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
    expect(screen.getByLabelText('Search foods')).toBeOnTheScreen();
    expect(fieldsWithoutRoom()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    expect(screen.getByLabelText('Grams eaten')).toBeOnTheScreen();
    expect(fieldsWithoutRoom()).toEqual([]);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enter your own food' }));
    expect(screen.getByLabelText('Food name')).toBeOnTheScreen();
    expect(fieldsWithoutRoom()).toEqual([]);
  });

  it('Home: the weight sheet and the measurements sheet with More measurements', async () => {
    await renderInApp(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Weight:/ }));
    expect(screen.getByLabelText('Weight in kg')).toBeOnTheScreen();
    expect(fieldsWithoutRoom()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Add measurements' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));
    expect(screen.getByLabelText('Notes')).toBeOnTheScreen();
    expect(fieldsWithoutRoom()).toEqual([]);
  });
});
