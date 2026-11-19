import { AI_CONSENT_TEXT_VERSION, type Food, type FoodLookupResponse, type ParsedMealItem } from '@fitsphere/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { itemFromServings } from '../mealItems';
import { formatAmount, formatGrams, formatKcal } from '../meals';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ day: '2026-10-28', slot: 'lunch' }), usePreventRemove: () => () => undefined }));

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

// D-118 (REQ-LOG-006, REQ-LOG-009, REQ-ACC-004): a photo of a meal in Search foods, read by AI after
// consent, its foods found in the phone's list and reviewed; a food not listed is looked up online
// (Open Food Facts by name, else an AI estimate). Synthetic foods, a made-up picture.

const food = (source: Food['source'], code: string, name: string, extra: Partial<Food> = {}): Food => ({
  source,
  code,
  name,
  foodGroup: 'Synthetic group',
  aliases: [],
  proteinG: 6,
  fibreG: 2,
  fatG: 3,
  carbsG: 30,
  kcal: 180,
  kcalEstimated: source !== 'ifct2017',
  measures: [],
  portions: [],
  ...extra,
});
const ROTI = food('indb', 'P01', 'Test roti', { portions: [{ label: 'Roti', grams: 40 }] });

const seen = (name: string, quantity: number | null, unit: ParsedMealItem['unit']): ParsedMealItem => ({
  spokenWords: name,
  name,
  quantity,
  unit,
  preparation: null,
  ambiguity: [],
});

const OFF_FOOD: FoodLookupResponse = { source: 'open_food_facts', name: 'Mango Lassi', brand: 'Zorblax', kcal: 90, proteinG: 3, carbsG: 14, fatG: 2, fibreG: null };
const AI_FOOD: FoodLookupResponse = { source: 'ai_estimate', name: 'Mango Lassi', brand: null, kcal: 95, proteinG: 3, carbsG: 15, fatG: 2.5, fibreG: 0.5 };

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

async function openSearch(setUp: (server: FakeServer) => void = () => undefined) {
  const app = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db: SqlDb, server) => {
    server.state.foods = [ROTI];
    await replaceFoods(db, server.state.foodsVersion, [ROTI]);
    server.state.photoParse = { items: [seen('roti', 2, 'piece'), seen('mango lassi', 1, 'glass')] };
    setUp(server);
  });
  await screen.findByRole('button', { name: 'Add a photo' });
  return app;
}

const consentOn = (server: FakeServer) => {
  server.state.aiConsent = { consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: NOW.toISOString() };
};

// The camera icon beside Speak your meal opens "Add a photo"; either choice attaches the photo and has AI read it.
const takePhoto = async (choice: 'Take photo' | 'Choose from gallery' = 'Take photo') => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Add a photo' }));
  await fireEvent.press(await screen.findByText(choice));
};

beforeEach(() => {
  mockSpeech.can = false;
  mockPick.mockReset();
  mockPick.mockResolvedValue({ kind: 'picked', files: { full: PICTURE, thumbnail: 'dGh1bWI=' } });
});

describe('REQ-LOG-006 the camera icon beside Speak your meal', () => {
  it('shows Take photo and Choose from gallery, and Search foods has no photo buttons of its own', async () => {
    await openSearch();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText('Take photo')).toBeOnTheScreen();
    expect(screen.getByText('Choose from gallery')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Search foods' }));
    expect(screen.queryByRole('button', { name: 'Take a photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose a photo' })).toBeNull();
  });
});

describe('REQ-LOG-009 a photo, read end to end', () => {
  it('consent asked once, the picture read, the foods found reviewed and added', async () => {
    const { server } = await openSearch();
    await takePhoto();

    expect(await screen.findByText('Read your photo with AI?')).toBeOnTheScreen();
    expect(server.state.photoParseImages).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on' }));

    expect(await screen.findByText('1 food found')).toBeOnTheScreen();
    expect(mockPick).toHaveBeenCalledWith('camera');
    expect(server.state.aiConsent).toMatchObject({ consented: true, textVersion: AI_CONSENT_TEXT_VERSION });
    expect(server.state.photoParseImages).toEqual([PICTURE]);
    expect(screen.getByText('Not in our food list')).toBeOnTheScreen();
    expect(screen.getByText('mango lassi')).toBeOnTheScreen();

    const roti = itemFromServings(ROTI, ROTI.portions[0]!, 2);
    await fireEvent.press(screen.getByRole('button', { name: `Add 1 food · ${formatKcal(roti.kcal)}` }));
    expect(await screen.findByText('Added 1 food from what you said')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${roti.name}: ${formatAmount(roti.amount)}, ${formatKcal(roti.kcal)}, ${formatGrams(roti.proteinG)} protein`)).toBeOnTheScreen();
  });

  it('Choose from gallery uses the gallery', async () => {
    await openSearch(consentOn);
    await takePhoto('Choose from gallery');
    expect(await screen.findByText('1 food found')).toBeOnTheScreen();
    expect(mockPick).toHaveBeenCalledWith('library');
  });

  it('consent already given: no sheet, the picture goes straight to the reading', async () => {
    const { server } = await openSearch(consentOn);
    await takePhoto();
    expect(await screen.findByText('1 food found')).toBeOnTheScreen();
    expect(screen.queryByText('Read your photo with AI?')).toBeNull();
    expect(server.state.photoParseImages).toHaveLength(1);
  });

  it('Not now: the picture is never sent, and AI-off is said', async () => {
    const { server } = await openSearch();
    await takePhoto();
    await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));

    expect(await screen.findByText('AI meal reading is off')).toBeOnTheScreen();
    expect(server.state.aiConsent).toMatchObject({ consented: false, textVersion: AI_CONSENT_TEXT_VERSION });
    expect(server.state.photoParseImages).toEqual([]);
  });

  it('a cancelled picker changes nothing and sends nothing', async () => {
    mockPick.mockResolvedValue({ kind: 'cancelled' });
    const { server } = await openSearch(consentOn);
    await takePhoto();
    expect(screen.queryByText(/foods? found/)).toBeNull();
    expect(server.state.photoParseImages).toEqual([]);
  });

  it('the camera refused: says how to turn it on', async () => {
    mockPick.mockResolvedValue({ kind: 'noPermission' });
    await openSearch(consentOn);
    await takePhoto();
    // The meal photo's own message (MealPhotoField); nothing is sent to AI.
    expect(await screen.findByText(/FitSphere needs the camera to take a photo/)).toBeOnTheScreen();
  });

  it('a picture that can’t be prepared: says so', async () => {
    mockPick.mockResolvedValue({ kind: 'failed' });
    await openSearch(consentOn);
    await takePhoto();
    expect(await screen.findByText('This photo could not be used. Try another one.')).toBeOnTheScreen();
  });

  it('no food in the picture: says so', async () => {
    await openSearch((server) => {
      consentOn(server);
      server.state.photoParse = { items: [] };
    });
    await takePhoto();
    expect(await screen.findByText('Nothing was recognised as food in the picture.')).toBeOnTheScreen();
  });

  it('offline: says so, and the picture is let go of', async () => {
    await openSearch((server) => {
      consentOn(server);
      server.state.photoParseOffline = true;
    });
    await takePhoto();
    expect(await screen.findByText(/You're offline/)).toBeOnTheScreen();
  });

  it('the reading failing: "isn’t available right now"', async () => {
    await openSearch((server) => {
      consentOn(server);
      server.state.photoParse = { status: 503, code: 'SERVICE_UNAVAILABLE' };
    });
    await takePhoto();
    expect(await screen.findByText(/AI meal reading isn't available right now/)).toBeOnTheScreen();
  });
});

describe('REQ-LOG-011 Look up online, for a food not in our list', () => {
  const lookedUp = async (answer: FoodLookupResponse | null) => {
    const app = await openSearch((server) => {
      consentOn(server);
      server.state.foodLookup = answer;
    });
    await takePhoto();
    await screen.findByText('Not in our food list');
    await fireEvent.press(screen.getByRole('button', { name: 'Look up online' }));
    return app;
  };

  it('an Open Food Facts find opens Check the estimate, prefilled, with its own banner; only the name was sent', async () => {
    const { server } = await lookedUp(OFF_FOOD);

    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(server.state.foodLookupBodies).toEqual([{ name: 'mango lassi' }]);
    expect(screen.getByText('Found on Open Food Facts by name; it may be a different product. Check the pack and change what is off.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Food name')).toHaveDisplayValue('Mango Lassi (Zorblax)');
    expect(screen.getByDisplayValue('90')).toBeOnTheScreen();
  });

  it('an AI estimate opens Check the estimate with the AI banner', async () => {
    await lookedUp(AI_FOOD);

    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(screen.getByText('Estimated by AI from the name, not read from a label. Check the pack and change what is off.')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('95')).toBeOnTheScreen();
  });

  it('nothing found: a short message and Own food still offered', async () => {
    await lookedUp(null);

    expect(await screen.findByText('Couldn’t find it online. Enter it yourself.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Own food' })).toBeOnTheScreen();
  });

  it('the food checked and added from a lookup lands in the meal under its name', async () => {
    await lookedUp(OFF_FOOD);
    await screen.findByRole('header', { name: 'Check the estimate' });
    await fireEvent.changeText(screen.getByLabelText('Grams eaten'), '200');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText(/Mango Lassi \(Zorblax\)/)).toBeOnTheScreen();
  });
});
