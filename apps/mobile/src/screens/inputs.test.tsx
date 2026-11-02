import type { Food } from '@fitsphere/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { Text } from '../components/ui';
import { replaceFoods } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { renderInApp } from '../testing/appHarness';
import { deps, fakeApi, fakeAuthClient } from '../testing/fakes';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { HomeScreen } from './HomeScreen';
import { LogMealScreen } from './LogMealScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { TrainingScreen } from './TrainingScreen';
import { WorkoutScreen } from './WorkoutScreen';

// "Opening" a workout sets the workout screen's route parameter, as in workout.test.
const mockParams: Record<string, string> = {};
const mockRouter = {
  push: jest.fn((path: unknown) => {
    if (typeof path === 'string' && path.startsWith('/workout/')) mockParams.id = path.replace('/workout/', '');
  }),
  replace: jest.fn(),
  back: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));

beforeEach(() => {
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  Object.assign(mockParams, { day: '2026-10-28', id: '' });
});

// Every field keeps room for its text and stays above the keyboard (REQ-ACC-001).
// - A field that grows (flex: 1) may only grow along a row: in a column its flex basis is 0, so it
//   gets just its padding and border, and Android clips the typed text and the placeholder out of
//   sight. That hid the Search foods text.
// - Every field sits in a KeyboardAvoidingView (FormScreen or Sheet): Android doesn't move an
//   edge-to-edge sheet for the keyboard.

const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false },
];

/** The sync's state, so a test can let it settle before going on or ending. */
function SyncState() {
  return <Text>{`Sync: ${useSync().status}`}</Text>;
}

async function synced() {
  await screen.findByText('Sync: synced');
}

/** What is wrong with the fields on screen, e.g. "Search foods: no room for its text". */
function fieldProblems(): string[] {
  return screen.container
    .queryAll((element) => element.type === 'TextInput')
    .flatMap((field) => {
      const label = String(field.props.accessibilityLabel);
      const grows = (StyleSheet.flatten(field.props.style)?.flex ?? 0) > 0;
      const direction = field.parent ? StyleSheet.flatten(field.parent.props.style)?.flexDirection : undefined;
      let avoidsKeyboard = false;
      for (let fiber = field.unstable_fiber; fiber; fiber = fiber.return) {
        if (fiber.type === KeyboardAvoidingView) avoidsKeyboard = true;
      }
      return [
        ...(grows && direction !== 'row' && direction !== 'row-reverse' ? [`${label}: no room for its text`] : []),
        ...(avoidsKeyboard ? [] : [`${label}: not kept above the keyboard`]),
      ];
    });
}

describe('REQ-ACC-001 every field has room for its text and stays above the keyboard', () => {
  it('Log meal: Search foods and its grams step, own food, changing grams, an image link', async () => {
    await renderInApp(
      <>
        <SyncState />
        <LogMealScreen />
      </>,
      undefined,
      async (db, server) => {
        server.state.foods = FOODS;
        await replaceFoods(db, server.state.foodsVersion, FOODS);
      },
    );
    await synced();

    await fireEvent.press(await screen.findByRole('button', { name: 'Enter your own food' }));
    expect(screen.getByLabelText('Food name')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
    // As Field: 48 tall, radius 12, a 1.5 border, text 16.
    expect(screen.getByLabelText('Search foods')).toHaveStyle({ minHeight: 48, borderRadius: 12, borderWidth: 1.5, fontSize: 16 });
    expect(fieldProblems()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Search foods'), 'atta');
    await fireEvent.press(await screen.findByRole('button', { name: 'Wheat flour, atta, 320 kcal per 100 g' }));
    expect(screen.getByLabelText('Grams eaten')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Change Wheat flour, atta' }));
    expect(screen.getByLabelText('New grams')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Add an image link instead' }));
    expect(screen.getByLabelText('Image link')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await synced();
  });

  it('Home: the weight sheet and the measurements sheet with More measurements', async () => {
    await renderInApp(
      <>
        <SyncState />
        <HomeScreen />
      </>,
    );
    await synced();

    await fireEvent.press(await screen.findByRole('button', { name: /^Weight:/ }));
    expect(screen.getByLabelText('Weight in kg')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Add measurements' }));
    await fireEvent.press(screen.getByRole('button', { name: 'More measurements' }));
    expect(screen.getByLabelText('Notes')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await synced();
  });

  it('Workout: the exercise sheet', async () => {
    await renderInApp(
      <>
        <SyncState />
        <TrainingScreen />
        <WorkoutScreen />
      </>,
    );
    await synced();
    await fireEvent.press(await screen.findByRole('button', { name: 'Start an empty workout' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add exercise' }));

    expect(screen.getByLabelText('Exercise name')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await synced();
  });

  it.each([
    ['Sign in', SignInScreen, 'Email'],
    ['Sign up', SignUpScreen, 'Email'],
    ['Forgot password', ForgotPasswordScreen, 'Email'],
    ['Change password', ChangePasswordScreen, 'Current password'],
  ] as [string, ComponentType, string][])('%s', async (_, Screen, field) => {
    // Signed-out screens, rendered as in auth-screens.test.
    await render(
      <AuthProvider deps={deps(fakeAuthClient(), fakeApi({}).fetchImpl)}>
        <Screen />
      </AuthProvider>,
    );

    expect(await screen.findByLabelText(field)).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
  });
});
