import type { BarcodeProduct, Food } from '@fitsphere/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { DeviceEventEmitter, Keyboard, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { AuthProvider } from '../auth/AuthProvider';
import { FormScreen } from '../components/FormScreen';
import { Text } from '../components/ui';
import { replaceFoods } from '../local/store';
import { useSync } from '../sync/SyncProvider';
import { renderInApp } from '../testing/appHarness';
import { deps, fakeApi, fakeAuthClient, fakeSession } from '../testing/fakes';
import { ChangePasswordScreen } from './ChangePasswordScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { HomeScreen } from './HomeScreen';
import { LogMealScreen } from './LogMealScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
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
// No camera here: the barcode is typed. BarcodeCamera has its own tests.
jest.mock('../components/BarcodeCamera', () => ({ BarcodeCamera: () => null }));

beforeEach(() => {
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  Object.assign(mockParams, { day: '2026-10-28', id: '' });
});

// Every field keeps room for its text and stays above the keyboard (REQ-ACC-001).
// - A field that grows (flex: 1) may only grow along a row: in a column its flex basis is 0, so it
//   gets just its padding and border, and Android clips the typed text and the placeholder out of
//   sight. That hid the Search foods text.
// - Every field sits in a FormScreen or a Sheet (a KeyboardAvoidingView): Android doesn't move an
//   edge-to-edge screen or sheet for the keyboard.

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

const FOODS: Food[] = [
  { source: 'ifct2017', code: 'A019', name: 'Wheat flour, atta', foodGroup: 'Cereals and Millets', aliases: [], proteinG: 10.57, fibreG: 11.36, fatG: 1.53, carbsG: 64.17, kcal: 320, kcalEstimated: false, measures: [] },
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
        if (fiber.type === KeyboardAvoidingView || fiber.type === FormScreen) avoidsKeyboard = true;
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
    // As Field: a box 54 tall, radius 4, a 1.5 outline (the search icon beside the text), text 17.
    expect(screen.getByLabelText('Search foods').parent).toHaveStyle({ minHeight: 54, borderRadius: 4, borderWidth: 1.5 });
    expect(screen.getByLabelText('Search foods')).toHaveStyle({ fontSize: 17 });
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

  it('Log meal: the barcode sheet, its digits and its grams', async () => {
    await renderInApp(
      <>
        <SyncState />
        <LogMealScreen />
      </>,
      undefined,
      async (_db, server) => {
        server.state.barcodes[BARCODE] = PRODUCT;
      },
    );
    await synced();

    await fireEvent.press(await screen.findByRole('button', { name: 'Scan barcode' }));
    expect(screen.getByLabelText('Barcode digits')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Barcode digits'), BARCODE);
    await fireEvent.press(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByLabelText('Grams eaten')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
    await synced();
  });

  it('Reset password', async () => {
    // As the link in the email opens it, with its one-time code.
    await renderForm(ResetPasswordScreen);

    expect(await screen.findByLabelText('New password')).toBeOnTheScreen();
    expect(fieldProblems()).toEqual([]);
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
    await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
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

// A form screen's main button stays above the keyboard (REQ-ACC-001), also when the screen opens
// with the keyboard already up: Sign up opens from Sign in's footer while typing, and React
// Native's KeyboardAvoidingView, which reacts only to a keyboard opened after the screen appears,
// left Sign up's button behind it. The phone is the owner's size, with 3-button navigation: the
// screen sits under the header, from 88 to 915 on screen, and the keyboard's top edge is at 560.
const SCREEN_TOP = 88;
const SCREEN_BOTTOM = 915;
const KEYBOARD_TOP = 560;
const NAVIGATION_BAR = 48;

type Measurable = { measureInWindow(done: (x: number, y: number, width: number, height: number) => void): void };
type Element = ReturnType<typeof screen.getByText>;

async function keyboard(event: 'keyboardDidShow' | 'keyboardDidHide') {
  const screenY = event === 'keyboardDidShow' ? KEYBOARD_TOP : SCREEN_BOTTOM;
  await act(async () => {
    DeviceEventEmitter.emit(event, {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: { screenX: 0, screenY, width: 412, height: SCREEN_BOTTOM - screenY },
    });
  });
}

async function renderForm(Screen: ComponentType) {
  const client = fakeAuthClient();
  // Reset password opens from the link in the email, with its one-time code.
  mockParams.code = 'one-time-code';
  client.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: fakeSession() }, error: null });
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 0, right: 0, bottom: NAVIGATION_BAR, left: 0 }}>
      <AuthProvider deps={deps(client, fakeApi({}).fetchImpl)}>
        <Screen />
      </AuthProvider>
    </SafeAreaInsetsContext.Provider>,
  );
}

/** The view lifted above the keyboard: the screen's outermost view, which knows its own layout. */
function liftedView(): Element {
  const [view] = screen.container.queryAll((element) => element.type === 'View' && typeof element.props.onLayout === 'function');
  if (!view) throw new Error('No view that knows its own layout');
  return view;
}

/** Lays the screen out under the header, as the phone does. */
async function layOut() {
  await fireEvent(liftedView(), 'layout', {
    persist() {},
    nativeEvent: { layout: { x: 0, y: 0, width: 412, height: SCREEN_BOTTOM - SCREEN_TOP } },
  });
}

function paddingBottom(element: Element): number {
  return Number(StyleSheet.flatten(element.props.style)?.paddingBottom ?? 0);
}

/** Where the button's footer ends on screen, above its own padding, once the screen is lifted. */
function footerBottom(button: Element): number {
  const lifted = liftedView();
  let footer = button;
  while (footer.parent && footer.parent !== lifted) footer = footer.parent;
  return SCREEN_BOTTOM - paddingBottom(lifted) - paddingBottom(footer);
}

/** Whether an element scrolls with the form rather than sitting in the fixed footer. */
function scrolls(element: Element): boolean {
  for (let parent = element.parent; parent; parent = parent.parent) if (parent.type === 'RCTScrollView') return true;
  return false;
}

describe('REQ-ACC-001 a form screen keeps its main button above the keyboard', () => {
  let measure: jest.SpyInstance | undefined;

  beforeEach(() => {
    expect(Keyboard.isVisible()).toBe(false);
    // Where the screen sits on the phone's screen.
    measure = jest
      .spyOn(View.prototype as unknown as Measurable, 'measureInWindow')
      .mockImplementation((done) => done(0, SCREEN_TOP, 412, SCREEN_BOTTOM - SCREEN_TOP));
  });

  afterEach(async () => {
    await keyboard('keyboardDidHide');
    measure?.mockRestore();
  });

  const FORMS: [string, ComponentType, string][] = [
    ['Sign in', SignInScreen, 'Sign in'],
    ['Sign up', SignUpScreen, 'Sign up'],
    ['Forgot password', ForgotPasswordScreen, 'Send reset link'],
    ['Reset password', ResetPasswordScreen, 'Set password'],
    ['Change password', ChangePasswordScreen, 'Change password'],
  ];

  it.each(FORMS)('%s: opened with the keyboard already up', async (_, Screen, title) => {
    await keyboard('keyboardDidShow');
    expect(Keyboard.isVisible()).toBe(true);

    await renderForm(Screen);
    await layOut();

    const button = await screen.findByRole('button', { name: title });
    expect(scrolls(button)).toBe(false);
    // 16 above the keyboard, the footer's own space; the navigation bar is behind the keyboard.
    expect(footerBottom(button)).toBe(KEYBOARD_TOP - 16);
  });

  it.each(FORMS)('%s: the keyboard opens and closes', async (_, Screen, title) => {
    await renderForm(Screen);
    await layOut();
    const button = await screen.findByRole('button', { name: title });
    expect(footerBottom(button)).toBe(SCREEN_BOTTOM - 16 - NAVIGATION_BAR);

    await keyboard('keyboardDidShow');
    expect(footerBottom(button)).toBe(KEYBOARD_TOP - 16);

    await keyboard('keyboardDidHide');
    expect(footerBottom(button)).toBe(SCREEN_BOTTOM - 16 - NAVIGATION_BAR);
  });
});
