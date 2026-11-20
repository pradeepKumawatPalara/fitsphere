import { AI_CONSENT_TEXT_VERSION, type Food, type FoodLookupResponse, type ParsedMealItem, type PhotoEstimateItem } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { formatKcal } from '../meals';
import { photoFoodsOf, photoItemOf } from '../photoMeal';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ day: '2026-10-28', slot: 'lunch' }),
  usePreventRemove: () => () => undefined,
}));

// The recogniser's presence is the test's to decide: a photo must work without it.
const mockSpeech = { can: false };
jest.mock('../speech', () => ({
  ...jest.requireActual('../speech'),
  speechEngine: () => ({
    canListen: () => mockSpeech.can,
    permission: async () => 'granted',
    requestPermission: async () => true,
    listen: () => () => undefined,
    stop: () => undefined,
    abort: () => undefined,
    installedLanguages: async () => null,
    downloadLanguage: async () => true,
  }),
}));

// The picker and the shrinking are photos/takePhoto's own tests: here it hands back one made-up picture.
const PICTURE = 'QUJD'.repeat(40);
const mockPick = jest.fn();
jest.mock('../photos/takePhoto', () => ({
  ...jest.requireActual('../photos/takePhoto'),
  pickPhoto: (source: 'camera' | 'library') => mockPick(source),
}));

// D-120 (ADR-0012; REQ-LOG-006, REQ-LOG-009): a photo of a meal is sent at once, with no consent step;
// the AI names each food and estimates its weight and values; the food list is not used. The foods are
// reviewed, each can be checked and changed, and are added as estimated foods of the user's own. A user
// who switched AI reading off is not read; any other failure says "No data available". Voice and typed
// words keep their consent and the food list ("Look up online" is tested at the foot, through typed words).
// Synthetic foods and values, a made-up picture.

const seen = (name: string, quantity: number | null, unit: PhotoEstimateItem['unit'], grams: number, kcal: number): PhotoEstimateItem => ({
  spokenWords: `${name} on the plate`,
  name,
  quantity,
  unit,
  grams,
  kcal,
  proteinG: 5,
  carbsG: 14,
  fatG: 1.8,
  fibreG: null,
  ambiguity: [],
});
// 4 x 5 + 4 x 14 + 9 x 1.8 = 92.2 kcal per 100 g.
const ROTI = seen('Test roti', 2, 'piece', 80, 92);
const DAL = seen('Test dal', 1, 'katori', 150, 92);
const answer = (...items: PhotoEstimateItem[]) => ({ items });

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function openLogMeal(setUp: (server: FakeServer) => void = () => undefined) {
  const app = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db: SqlDb, server) => {
    // The list holds a food named like the photo's: it must not be used.
    const listed: Food = {
      source: 'indb',
      code: 'P01',
      name: 'Test roti',
      foodGroup: 'Synthetic group',
      aliases: [],
      proteinG: 6,
      fibreG: 2,
      fatG: 3,
      carbsG: 30,
      kcal: 180,
      kcalEstimated: true,
      measures: [],
      portions: [{ label: 'Roti', grams: 40 }],
    };
    server.state.foods = [listed];
    await replaceFoods(db, server.state.foodsVersion, [listed]);
    server.state.photoEstimate = answer(ROTI, DAL);
    setUp(server);
  });
  await screen.findByRole('button', { name: 'Add a photo' });
  return app;
}

// The camera icon beside Speak your meal opens "Add a photo"; either choice has AI read the photo.
const takePhoto = async (choice: 'Take photo' | 'Choose from gallery' = 'Take photo') => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a photo' }));
  await fireEvent.press(await screen.findByText(choice));
};

/** Log meal also has a tile with this name behind the sheet: the sheet's button is the last one on the screen. */
const inSheet = (name: string) => screen.getAllByRole('button', { name }).at(-1)!;

beforeEach(() => {
  mockSpeech.can = false;
  mockPick.mockReset();
  mockRouter.push.mockReset();
  mockPick.mockResolvedValue({ kind: 'picked', files: { full: PICTURE, thumbnail: 'dGh1bWI=' } });
});

const ROTI_KCAL = formatKcal(photoItemOf(photoFoodsOf([ROTI])[0]!).kcal);
const DAL_KCAL = formatKcal(photoItemOf(photoFoodsOf([DAL])[0]!).kcal);

describe('REQ-LOG-006 the camera icon beside Speak your meal', () => {
  it('shows Take photo, Choose from gallery and the notice that AI reads the photo', async () => {
    await openLogMeal();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText('Take photo')).toBeOnTheScreen();
    expect(screen.getByText('Choose from gallery')).toBeOnTheScreen();
    expect(screen.getByText('The photo is read by AI (OpenAI) to estimate the foods and their nutrition. It is not saved.')).toBeOnTheScreen();
  });
});

describe('ADR-0012 a photo is read with no consent step', () => {
  it('the picture goes straight to the AI, with no consent sheet and no consent recorded', async () => {
    const { server } = await openLogMeal();
    await takePhoto();

    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(screen.queryByText('Read your photo with AI?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Turn on' })).toBeNull();
    expect(mockPick).toHaveBeenCalledWith('camera');
    expect(server.state.photoEstimateImages).toEqual([PICTURE]);
    expect(server.state.aiConsent).toBeNull();
  });

  it('Choose from gallery uses the gallery', async () => {
    await openLogMeal();
    await takePhoto('Choose from gallery');
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(mockPick).toHaveBeenCalledWith('library');
  });

  it('a user who agreed to an older text is read too', async () => {
    const { server } = await openLogMeal((fake) => {
      fake.state.aiConsent = { consented: true, textVersion: 'older', recordedAt: NOW.toISOString() };
    });
    await takePhoto();
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(server.state.photoEstimateImages).toHaveLength(1);
  });
});

describe('D-120 the foods of a photo, reviewed and added', () => {
  it('lists each food with its amount, weight and kcal, tagged Estimated, with no food-list section', async () => {
    await openLogMeal();
    await takePhoto();

    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(screen.getByText('Test roti')).toBeOnTheScreen();
    expect(screen.getByText(`2 pieces · about 80 g · ${ROTI_KCAL}`)).toBeOnTheScreen();
    expect(screen.getByText(`1 katori · about 150 g · ${DAL_KCAL}`)).toBeOnTheScreen();
    expect(screen.getAllByText('Estimated')).toHaveLength(2);
    // The food list is not used: the listed "Test roti" (180 kcal per 100 g) is not what is shown.
    expect(screen.queryByText('Not in our food list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Look up online' })).toBeNull();
  });

  it('Add puts the ticked foods in the meal as estimated foods of the user’s own, without the spoken banner', async () => {
    await openLogMeal();
    await takePhoto();
    await screen.findByText('2 foods found');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Add Test dal' }));

    await fireEvent.press(screen.getByRole('button', { name: `Add 1 food · ${ROTI_KCAL}` }));

    expect(await screen.findByText(/Test roti/)).toBeOnTheScreen();
    expect(screen.queryByText(/Test dal/)).toBeNull();
    expect(screen.queryByText(/from what you said/)).toBeNull();
  });

  it('a food opens in Check the estimate; a new weight changes its kcal, and Done keeps it in the list', async () => {
    await openLogMeal();
    await takePhoto();
    await screen.findByText('2 foods found');

    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^Test dal, 1 katori · about 150 g, ${DAL_KCAL}`) }));
    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('Test dal');
    expect(screen.getByLabelText('Amount (g)')).toHaveDisplayValue('150');
    expect(screen.getByLabelText('Calories (kcal per 100 g)')).toHaveDisplayValue('92');
    expect(screen.getByLabelText('Fibre (g per 100 g)')).toHaveDisplayValue('');
    expect(screen.getByText('The AI saw about 1 katori. The values below change with the amount.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Amount (g)'), '300');
    const doubled = formatKcal(photoItemOf({ ...photoFoodsOf([DAL])[0]!, grams: 300 }).kcal);
    expect(screen.getByText(doubled)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    // Back on the list: the weight is the user's now, so it is no longer "about".
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(screen.getByText(`1 katori · 300 g · ${doubled}`)).toBeOnTheScreen();
  });

  it('an amount that cannot be used keeps Done waiting; Back to the list changes nothing', async () => {
    await openLogMeal();
    await takePhoto();
    await screen.findByText('2 foods found');
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^Test dal, `) }));
    await screen.findByRole('header', { name: 'Check the estimate' });

    await fireEvent.changeText(screen.getByLabelText('Amount (g)'), '0');
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Calories (kcal per 100 g)'), '950');
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to the list' }));
    expect(await screen.findByText(`1 katori · about 150 g · ${DAL_KCAL}`)).toBeOnTheScreen();
  });
});

describe('ADR-0012 Q-A a user who switched AI reading off is not read', () => {
  it('"AI reading is off", with Open Settings and Enter your own food', async () => {
    await openLogMeal((server) => {
      server.state.aiConsent = { consented: false, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: NOW.toISOString() };
      server.state.photoEstimate = { status: 403, code: 'AI_CONSENT_REQUIRED' };
    });
    await takePhoto();

    expect(await screen.findByText('AI reading is off')).toBeOnTheScreen();
    expect(screen.getByText(/You turned off AI meal reading, so this photo was not sent/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/account');
  });

  it('Enter your own food opens the own food sheet', async () => {
    await openLogMeal((server) => {
      server.state.photoEstimate = { status: 403, code: 'AI_CONSENT_REQUIRED' };
    });
    await takePhoto();
    await screen.findByText('AI reading is off');
    await fireEvent.press(inSheet('Enter your own food'));
    expect(await screen.findByRole('header', { name: 'Enter your own food' })).toBeOnTheScreen();
  });
});

describe('D-120 "No data available"', () => {
  const failing: [string, (server: FakeServer) => void][] = [
    ['no food in the picture', (server) => void (server.state.photoEstimate = answer())],
    ['the AI unavailable', (server) => void (server.state.photoEstimate = { status: 503, code: 'SERVICE_UNAVAILABLE' })],
    ['offline', (server) => void (server.state.photoEstimateOffline = true)],
  ];

  it.each(failing)('%s: says so, with Try another photo, Enter your own food and Close', async (_name, setUp) => {
    await openLogMeal(setUp);
    await takePhoto();

    expect(await screen.findByText('No data available')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try another photo' })).toBeOnTheScreen();
    expect(inSheet('Enter your own food')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    // Nothing from the food list stands in for the answer.
    expect(screen.queryByText(/foods? found/)).toBeNull();
  });

  it('Try another photo opens Add a photo again', async () => {
    await openLogMeal((server) => void (server.state.photoEstimate = answer()));
    await takePhoto();
    await fireEvent.press(await screen.findByRole('button', { name: 'Try another photo' }));
    expect(await screen.findByText('Choose from gallery')).toBeOnTheScreen();
  });

  it('Enter your own food opens the own food sheet', async () => {
    await openLogMeal((server) => void (server.state.photoEstimate = answer()));
    await takePhoto();
    await screen.findByText('No data available');
    await fireEvent.press(inSheet('Enter your own food'));
    expect(await screen.findByRole('header', { name: 'Enter your own food' })).toBeOnTheScreen();
  });
});

describe('REQ-LOG-006 the picker', () => {
  it('a cancelled picker changes nothing and sends nothing', async () => {
    mockPick.mockResolvedValue({ kind: 'cancelled' });
    const { server } = await openLogMeal();
    await takePhoto();
    expect(screen.queryByText(/foods? found/)).toBeNull();
    expect(server.state.photoEstimateImages).toEqual([]);
  });

  it('the camera refused: says how to turn it on, and sends nothing', async () => {
    mockPick.mockResolvedValue({ kind: 'noPermission' });
    const { server } = await openLogMeal();
    await takePhoto();
    expect(await screen.findByText(/FitSphere needs the camera to take a photo/)).toBeOnTheScreen();
    expect(server.state.photoEstimateImages).toEqual([]);
  });

  it('a picture that can’t be prepared: says so', async () => {
    mockPick.mockResolvedValue({ kind: 'failed' });
    await openLogMeal();
    await takePhoto();
    expect(await screen.findByText('This photo could not be used. Try another one.')).toBeOnTheScreen();
  });
});

// "Look up online" stays for what was said or typed (D-118): words typed in Log meal's box, read by AI
// after consent, with a food the list lacks.
describe('REQ-LOG-011 Look up online, for a food of typed words not in our list', () => {
  const OFF_FOOD: FoodLookupResponse = { source: 'open_food_facts', name: 'Mango Lassi', brand: 'Zorblax', kcal: 90, proteinG: 3, carbsG: 14, fatG: 2, fibreG: null };
  const said = (name: string): ParsedMealItem => ({ spokenWords: name, name, quantity: 1, unit: 'glass', preparation: null, ambiguity: [] });

  async function lookedUp(answerFor: FoodLookupResponse | null) {
    const app = await openLogMeal((server) => {
      server.state.aiConsent = { consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: NOW.toISOString() };
      server.state.mealParse = { items: [said('mango lassi')] };
      server.state.foodLookup = answerFor;
    });
    await fireEvent.changeText(await screen.findByLabelText('Speak or type what you ate'), 'mango lassi');
    await fireEvent.press(screen.getByRole('button', { name: 'Read my meal' }));
    await screen.findByText('Not in our food list');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up online' }));
    return app;
  }

  it('an Open Food Facts find opens Check the estimate, prefilled; only the name was sent', async () => {
    const { server } = await lookedUp(OFF_FOOD);
    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    await waitFor(() => expect(server.state.foodLookupBodies).toEqual([{ name: 'mango lassi' }]));
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('Mango Lassi (Zorblax)');
  });

  it('nothing found: a short message and Own food still offered', async () => {
    await lookedUp(null);
    expect(await screen.findByText('Couldn’t find it online. Enter it yourself.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Own food' })).toBeOnTheScreen();
  });
});
