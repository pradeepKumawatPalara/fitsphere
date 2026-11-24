import { AI_CONSENT_TEXT_VERSION, type Food, type ParsedMealItem, type PhotoEstimateItem } from '@fitsphere/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { replaceFoods } from '../local/store';
import type { SqlDb } from '../local/sql';
import { formatKcal } from '../meals';
import { photoFoodsOf, photoItemOf } from '../photoMeal';
import type { ListenEvents } from '../speech';
import { NOW, renderInApp } from '../testing/appHarness';
import { LogMealScreen } from './LogMealScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));

// A fake of the phone's recognizer (speech.ts): the test says the words.
const mockSpeech = {
  can: true,
  permission: 'granted' as 'granted' | 'ask' | 'denied',
  grantOnAsk: true,
  events: null as ListenEvents | null,
  language: null as string | null,
  /** How many times the recognizer was started (once, then again after each end before Done). */
  listens: 0,
  /** The quiet that ends listening: long here, so a slow test never ends by it; short in its own test. */
  silenceMs: 60_000,
  /** The languages whose offline pack is on the phone; null when the phone can't say. */
  installed: null as string[] | null,
  downloadOk: true,
  downloads: [] as string[],
};
jest.mock('../speech', () => ({
  ...jest.requireActual('../speech'),
  silenceAllowedMs: () => mockSpeech.silenceMs,
  speechEngine: () => ({
    canListen: () => mockSpeech.can,
    permission: async () => mockSpeech.permission,
    requestPermission: async () => mockSpeech.grantOnAsk,
    listen: (language: string, events: ListenEvents) => {
      mockSpeech.language = language;
      mockSpeech.events = events;
      mockSpeech.listens += 1;
      return () => undefined;
    },
    stop: () => mockSpeech.events?.onEnd(),
    abort: () => undefined,
    installedLanguages: async () => mockSpeech.installed,
    downloadLanguage: async (language: string) => {
      mockSpeech.downloads.push(language);
      return mockSpeech.downloadOk;
    },
  }),
}));

// D-115 (REQ-LOG-005, REQ-LOG-009, REQ-ACC-004; the canvas's VoiceMealLocked): Speak your meal in
// Search foods, end to end: words heard, consent asked once, the text read by the (fake) API, the
// foods found in the phone's list and reviewed, then added to Log meal. Synthetic foods, made-up meals.

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
const ROTI = food('indb', 'V01', 'Test roti', { portions: [{ label: 'Roti', grams: 40 }] });
const DAL = food('ifct2017', 'V02', 'Test toor dal', { measures: [{ measure: 'katori', grams: 150 }] });
const CHAI = food('ifct2017', 'V03', 'Test chai');

const said = (name: string, quantity: number | null, unit: ParsedMealItem['unit']): ParsedMealItem => ({
  spokenWords: name,
  name,
  quantity,
  unit,
  preparation: null,
  ambiguity: [],
});

/** A food the AI heard (voice, 2026-11-24): its weight and its values per 100 g are estimates. */
const heard = (name: string, quantity: number | null, unit: PhotoEstimateItem['unit'], grams: number, kcal: number): PhotoEstimateItem => ({
  spokenWords: name,
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
const ROTI_HEARD = heard('Test roti', 2, 'piece', 80, 297);
const DAL_HEARD = heard('Test dal', 1, 'katori', 150, 92);

type FakeServer = Parameters<NonNullable<Parameters<typeof renderInApp>[2]>>[1];

const MEAL = 'do roti aur ek katori dal';

async function openSearch(setUp: (server: FakeServer) => void = () => undefined) {
  mockParams = { day: '2026-10-28', slot: 'lunch' };
  const app = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db: SqlDb, server) => {
    server.state.foods = [ROTI, DAL, CHAI];
    await replaceFoods(db, server.state.foodsVersion, [ROTI, DAL, CHAI]);
    server.state.mealParse = { items: [said('roti', 2, 'piece'), said('toor dal', 1, 'katori')] };
    server.state.voiceEstimate = { items: [ROTI_HEARD, DAL_HEARD] };
    setUp(server);
  });
  await fireEvent.press(await screen.findByRole('button', { name: 'Search foods' }));
  return app;
}

const consentOn = (server: FakeServer) => {
  server.state.aiConsent = { consented: true, textVersion: AI_CONSENT_TEXT_VERSION, recordedAt: NOW.toISOString() };
};

/** Taps Speak your meal, says the words, then Done. */
async function speak(words: string) {
  await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);
  await waitFor(() => expect(mockSpeech.events).not.toBeNull());
  await act(async () => mockSpeech.events!.onWords(words, true));
  await fireEvent.press(screen.getByRole('button', { name: 'Done speaking' }));
}

beforeEach(() => {
  mockSpeech.can = true;
  mockSpeech.permission = 'granted';
  mockSpeech.grantOnAsk = true;
  mockSpeech.events = null;
  mockSpeech.language = null;
  mockSpeech.listens = 0;
  mockSpeech.silenceMs = 60_000;
  mockSpeech.installed = null;
  mockSpeech.downloadOk = true;
  mockSpeech.downloads = [];
});

describe('REQ-LOG-005 Speak your meal', () => {
  it('is not shown on a phone that can’t recognise speech on the device (B-15)', async () => {
    mockSpeech.can = false;
    await openSearch();
    expect(screen.queryByRole('button', { name: 'Speak your meal' })).toBeNull();
  });

  it('the words heard fill the search box while listening, in English (India) by default', async () => {
    await openSearch(consentOn);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);
    await waitFor(() => expect(mockSpeech.events).not.toBeNull());
    await act(async () => mockSpeech.events!.onWords('do roti', false));

    expect(screen.getByText(/Listening/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Search foods')).toHaveDisplayValue('do roti');
    expect(mockSpeech.language).toBe('en-IN');
  });

  it('a pause does not end listening: the recognizer is started again and the pieces are joined; only Done reads them', async () => {
    const { server } = await openSearch(consentOn);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);
    await waitFor(() => expect(mockSpeech.listens).toBe(1));

    // The phone ends on a pause by itself, after the first piece.
    await act(async () => mockSpeech.events!.onWords('do roti', true));
    await act(async () => mockSpeech.events!.onEnd());
    await waitFor(() => expect(mockSpeech.listens).toBe(2));
    expect(screen.getByText(/Listening/)).toBeOnTheScreen();
    expect(server.state.voiceEstimateTexts).toEqual([]);

    // Silence reported as "no speech": still listening.
    await act(async () => mockSpeech.events!.onError('no-speech'));
    await waitFor(() => expect(mockSpeech.listens).toBe(3));
    expect(screen.getByText(/Listening/)).toBeOnTheScreen();

    await act(async () => mockSpeech.events!.onWords('aur ek katori', false));
    await act(async () => mockSpeech.events!.onWords('aur ek katori dal', true));
    expect(screen.getByLabelText('Search foods')).toHaveDisplayValue(MEAL);

    await fireEvent.press(screen.getByRole('button', { name: 'Done speaking' }));
    await waitFor(() => expect(server.state.voiceEstimateTexts).toEqual([MEAL]));
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
  });

  it('the owner’s quiet time with no words ends listening by itself, and the words are read', async () => {
    const { server } = await openSearch(consentOn);
    mockSpeech.silenceMs = 600;
    await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);
    await waitFor(() => expect(mockSpeech.listens).toBe(1));
    await act(async () => mockSpeech.events!.onWords(MEAL, true));

    // No Done: the quiet after the words ends it.
    await waitFor(() => expect(server.state.voiceEstimateTexts).toEqual([MEAL]), { timeout: 4000 });
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
  });

  it('the microphone refused: says how to turn it on, and listens to nothing', async () => {
    mockSpeech.permission = 'ask';
    mockSpeech.grantOnAsk = false;
    await openSearch(consentOn);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);

    expect(await screen.findByText(/FitSphere can't use the microphone/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open phone settings' })).toBeOnTheScreen();
    expect(mockSpeech.events).toBeNull();
  });
});

describe('REQ-LOG-009 a spoken meal, end to end (voice is estimated by AI, the owner 2026-11-24)', () => {
  it('no consent step: the words go to the AI at once, and the foods heard are listed Estimated, not taken from the food list', async () => {
    const { server } = await openSearch();
    await speak(MEAL);

    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
    expect(screen.queryByText('Read your meal with AI?')).toBeNull();
    expect(server.state.voiceEstimateTexts).toEqual([MEAL]);
    expect(server.state.mealParseTexts).toEqual([]);
    expect(screen.getAllByText('Estimated')).toHaveLength(2);
    expect(screen.getByText(/Estimated by AI from what you said/)).toBeOnTheScreen();
    expect(screen.queryByText('Not in our food list')).toBeNull();

    const [roti, dal] = photoFoodsOf([ROTI_HEARD, DAL_HEARD]).map(photoItemOf);
    await fireEvent.press(screen.getByRole('button', { name: `Add 2 foods · ${formatKcal(roti!.kcal + dal!.kcal)}` }));
    expect(await screen.findByText(/Test roti/)).toBeOnTheScreen();
    expect(screen.getByText(/Test dal/)).toBeOnTheScreen();
  });

  it('Quantity: changing it changes the amount, the portion kcal and the list; changing the amount changes the quantity', async () => {
    await openSearch();
    await speak(MEAL);
    await screen.findByText('2 foods found');

    await fireEvent.press(screen.getByRole('button', { name: /^Test roti, 2 pieces · about 80 g/ }));
    expect(await screen.findByRole('header', { name: 'Check the estimate' })).toBeOnTheScreen();
    expect(screen.getByText(/The AI heard about 2 pieces/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Quantity (pieces)')).toHaveDisplayValue('2');

    // 2 pieces are 80 g, so 3 pieces are 120 g.
    await fireEvent.changeText(screen.getByLabelText('Quantity (pieces)'), '3');
    expect(screen.getByLabelText('Amount (g)')).toHaveDisplayValue('120');
    const three = formatKcal(photoItemOf({ ...photoFoodsOf([ROTI_HEARD])[0]!, grams: 120 }).kcal);
    expect(screen.getByText(three)).toBeOnTheScreen();

    // And the other way: 40 g is one piece.
    await fireEvent.changeText(screen.getByLabelText('Amount (g)'), '40');
    expect(screen.getByLabelText('Quantity (piece)')).toHaveDisplayValue('1');

    await fireEvent.changeText(screen.getByLabelText('Quantity (piece)'), '3');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText(`3 pieces · 120 g · ${three}`)).toBeOnTheScreen();
  });

  it('a quantity of 0 or more than two decimals cannot be kept', async () => {
    await openSearch();
    await speak(MEAL);
    await screen.findByText('2 foods found');
    await fireEvent.press(screen.getByRole('button', { name: /^Test roti, 2 pieces/ }));
    await screen.findByRole('header', { name: 'Check the estimate' });

    for (const bad of ['0', '1.234', '']) {
      await fireEvent.changeText(screen.getByLabelText(/^Quantity/), bad);
      expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
    }
  });

  it('a food heard with no amount is one portion', async () => {
    await openSearch((server) => {
      server.state.voiceEstimate = { items: [heard('Test chai', null, null, 150, 50)] };
    });
    await speak('chai');
    await fireEvent.press(await screen.findByRole('button', { name: /^Test chai, about 150 g/ }));
    expect(await screen.findByLabelText('Quantity (portion)')).toHaveDisplayValue('1');
  });

  it('AI reading switched off in Settings: "AI reading is off", nothing is added', async () => {
    await openSearch((server) => {
      server.state.voiceEstimate = { status: 403, code: 'AI_CONSENT_REQUIRED' };
    });
    await speak(MEAL);

    expect(await screen.findByText('AI reading is off')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try another photo' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/account');
  });

  it.each([
    ['no food heard', { items: [] }, false],
    ['the service unavailable', { status: 503, code: 'SERVICE_UNAVAILABLE' }, false],
    ['offline', { items: [] }, true],
  ])('%s: "No data available", and the words are kept in the box', async (_name, answer, offline) => {
    await openSearch((server) => {
      server.state.voiceEstimate = answer;
      server.state.voiceEstimateOffline = offline;
    });
    await speak(MEAL);

    expect(await screen.findByText('No data available')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try another photo' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByLabelText('Search foods')).toHaveDisplayValue(MEAL);
  });

  it('Cancel while listening: no reading, the words stay as a search', async () => {
    const { server } = await openSearch(consentOn);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);
    await waitFor(() => expect(mockSpeech.events).not.toBeNull());
    await act(async () => mockSpeech.events!.onWords(MEAL, false));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByLabelText('Search foods')).toHaveDisplayValue(MEAL);
    expect(screen.queryByText(/Listening/)).toBeNull();
    expect(server.state.voiceEstimateTexts).toEqual([]);
  });
});

describe('Log meal’s box (the owner’s redesign, 2026-11-18)', () => {
  async function openLogMeal(setUp: (server: FakeServer) => void = () => undefined) {
    mockParams = { day: '2026-10-28', slot: 'lunch' };
    return renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db: SqlDb, server) => {
      server.state.foods = [ROTI, DAL, CHAI];
      await replaceFoods(db, server.state.foodsVersion, [ROTI, DAL, CHAI]);
      server.state.mealParse = { items: [said('roti', 2, 'piece'), said('toor dal', 1, 'katori')] };
      setUp(server);
    });
  }

  it('Speak your meal opens Search foods already listening', async () => {
    await openLogMeal(consentOn);
    await fireEvent.press(await screen.findByRole('button', { name: 'Speak your meal' }));

    await waitFor(() => expect(mockSpeech.events).not.toBeNull());
    expect(await screen.findByText(/Listening/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Done speaking' })).toBeOnTheScreen();
  });

  it('words typed in the box are read by AI, and the foods found show as in Search foods', async () => {
    const { server } = await openLogMeal(consentOn);
    await fireEvent.changeText(await screen.findByLabelText('Speak or type what you ate'), MEAL);
    await fireEvent.press(screen.getByRole('button', { name: 'Read my meal' }));

    await waitFor(() => expect(server.state.mealParseTexts).toEqual([MEAL]));
    expect(await screen.findByText('2 foods found')).toBeOnTheScreen();
  });

  it('the box is there on a phone that can’t listen, but with no Speak your meal button', async () => {
    mockSpeech.can = false;
    await openLogMeal();
    expect(await screen.findByLabelText('Speak or type what you ate')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Speak your meal' })).toBeNull();
  });
});

describe('the speech pack of a language missing from the phone (the owner, 2026-11-24)', () => {
  const tapSpeak = async () => fireEvent.press(screen.getAllByRole('button', { name: 'Speak your meal' }).at(-1)!);

  it('asks the phone to download English (India) and says so, instead of listening', async () => {
    mockSpeech.installed = ['hi-IN'];
    await openSearch(consentOn);

    await tapSpeak();

    expect(await screen.findByText(/Getting the speech pack ready/)).toBeOnTheScreen();
    expect(mockSpeech.downloads).toEqual(['en-IN']);
    expect(mockSpeech.listens).toBe(0);
  });

  it('says where to turn it on by hand when the phone cannot download it from the app', async () => {
    mockSpeech.installed = [];
    mockSpeech.downloadOk = false;
    await openSearch(consentOn);

    await tapSpeak();

    expect(await screen.findByText(/Offline speech recognition/)).toBeOnTheScreen();
    expect(mockSpeech.listens).toBe(0);
  });

  it('listens as before when the pack is on the phone, or the phone cannot say', async () => {
    mockSpeech.installed = ['en-IN'];
    await openSearch(consentOn);
    await tapSpeak();
    await waitFor(() => expect(mockSpeech.listens).toBe(1));
    expect(mockSpeech.downloads).toEqual([]);
  });

  it('a "language not supported" error offers the download, and the button asks for it', async () => {
    await openSearch(consentOn);
    await tapSpeak();
    await waitFor(() => expect(mockSpeech.events).not.toBeNull());
    await act(async () => mockSpeech.events!.onError('language-not-supported'));

    expect(await screen.findByText(/This language isn't ready for speech/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Download speech pack' }));

    expect(await screen.findByText(/Getting the speech pack ready/)).toBeOnTheScreen();
    expect(mockSpeech.downloads).toEqual(['en-IN']);
  });
});
