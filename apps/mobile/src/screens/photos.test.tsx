import type { MealItem, MealPhoto } from '@fitsphere/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { LINK_WARNING } from '../components/MealPhotoField';
import { insertNewPhoto, markUploaded } from '../local/photos';
import type { SqlDb } from '../local/sql';
import { getEntry, saveEntry } from '../local/store';
import { pickPhoto } from '../photos/takePhoto';
import { NOW, renderInApp } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';
import { LogMealScreen } from './LogMealScreen';
import { NutritionScreen } from './NutritionScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, usePreventRemove: () => () => undefined }));
jest.mock('../photos/takePhoto', () => ({ pickPhoto: jest.fn() }));

// A meal's photo or image link in Log meal and Nutrition (REQ-LOG-006, REQ-LOG-010, REQ-NFR-006;
// MVP defaults, D-26). The camera is a fake that returns synthetic base64 text, not an image.

const TODAY = '2026-10-28';
const AT = NOW.toISOString();
const FILES = { thumbnail: 'dGh1bWI=', full: 'ZnVsbA==' };
const BAR: MealItem = {
  source: 'own',
  ref: null,
  name: 'Synthetic bar',
  amount: { unit: 'g', value: 40 },
  kcal: 180,
  proteinG: 4,
  carbsG: null,
  fatG: null,
  fibreG: null,
  estimated: false,
};
const pick = pickPhoto as jest.MockedFunction<typeof pickPhoto>;

let ids = 0;
function id(): string {
  ids += 1;
  return `00000000-0000-4000-b000-${String(ids).padStart(12, '0')}`;
}

async function mealWithPhoto(db: SqlDb, photo: MealPhoto | null, files = false) {
  const mealId = id();
  await saveEntry(
    db,
    'meal',
    { changeId: id(), data: { id: mealId, day: TODAY, mealType: 'lunch', tags: [], items: [BAR], photo, recordedAt: AT } },
    files && photo?.kind === 'photo' ? () => insertNewPhoto(db, { id: photo.mediaId, mealId, createdAt: AT, files: FILES }) : undefined,
  );
  return mealId;
}

/** Log meal with one food added by "Enter your own food" and Lunch chosen. */
async function logMealWithFood(before?: (db: SqlDb) => Promise<void>) {
  mockParams = { day: TODAY, slot: 'lunch' };
  const result = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (db) => before?.(db));
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter your own food' }));
  await fireEvent.changeText(screen.getByLabelText('Food name'), 'Synthetic bar');
  for (const [label, value] of [
    ['kcal per 100 g', '450'],
    ['Protein per 100 g (g)', '10'],
    ['Carbs per 100 g (g)', '60'],
    ['Fat per 100 g (g)', '20'],
    ['Grams eaten', '40'],
  ]) {
    await fireEvent.changeText(screen.getByLabelText(label!), value!);
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  return result;
}

async function savedMeal(db: SqlDb) {
  // Saved, and Log meal stays open for the next meal (D-68).
  await screen.findByText(/^Lunch saved · /);
  const [row] = await db.getAllAsync<{ id: string }>('SELECT id FROM meals', []);
  return getEntry(db, 'meal', row!.id);
}

beforeEach(() => {
  mockRouter.back.mockClear();
  pick.mockReset();
});

describe('REQ-LOG-006 a meal photo in Log meal', () => {
  it('a photo taken is shown, saved with the meal on the phone, and uploaded after the sync', async () => {
    pick.mockResolvedValue({ kind: 'picked', files: FILES });
    const { db, server } = await logMealWithFood();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(pick).toHaveBeenCalledWith('camera');
    expect(await screen.findByLabelText('Meal photo')).toHaveProp('source', { uri: `data:image/jpeg;base64,${FILES.thumbnail}` });
    await fireEvent.press(screen.getByRole('button', { name: 'Save lunch' }));

    const meal = await savedMeal(db);
    expect(meal?.photo).toEqual({ kind: 'photo', mediaId: expect.any(String) });
    const mediaId = (meal!.photo as { mediaId: string }).mediaId;
    await waitFor(() => expect(server.state.files.has(`${mediaId}.jpg`)).toBe(true));
    expect(server.state.files.has(`${mediaId}-thumb.jpg`)).toBe(true);
  });

  it('says what to do when the camera is not allowed, or the photo cannot be used', async () => {
    await logMealWithFood();

    pick.mockResolvedValue({ kind: 'noPermission' });
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByText(/FitSphere needs the camera to take a photo/)).toBeOnTheScreen();

    pick.mockResolvedValue({ kind: 'failed' });
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));
    expect(await screen.findByText('This photo could not be used. Try another one.')).toBeOnTheScreen();
    expect(pick).toHaveBeenLastCalledWith('library');
  });

  it('Edit shows the meal’s photo; removing it saves the meal with none and removes it from the phone', async () => {
    const mediaId = id();
    let mealId = '';
    mockParams = { mealId: '' };
    const { db } = await renderInApp(<LogMealScreen now={() => NOW} />, undefined, async (database) => {
      mealId = await mealWithPhoto(database, { kind: 'photo', mediaId }, true);
      mockParams = { mealId };
    });

    expect(await screen.findByLabelText('Meal photo')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save meal' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'meal', mealId)).toMatchObject({ photo: null });
    expect(await db.getAllAsync('SELECT id FROM photos', [])).toEqual([]);
  });
});

describe('REQ-LOG-010 a public image link instead of a photo', () => {
  it('accepts https links only, and saves one only after the privacy warning is confirmed', async () => {
    const { db } = await logMealWithFood();

    await fireEvent.press(screen.getByRole('button', { name: 'Add an image link instead' }));
    await fireEvent.changeText(screen.getByLabelText('Image link'), 'http://images.example.com/meal.jpg');
    expect(screen.getByText('Enter a link that starts with https://')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Image link'), 'https://images.example.com/meal.jpg');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(LINK_WARNING)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Image link:/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add an image link instead' }));
    await fireEvent.changeText(screen.getByLabelText('Image link'), 'https://images.example.com/meal.jpg');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByLabelText('Image link: images.example.com')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save lunch' }));

    expect((await savedMeal(db))?.photo).toEqual({ kind: 'link', url: 'https://images.example.com/meal.jpg' });
  });
});

describe('REQ-NFR-006 photos and links on Nutrition', () => {
  it('a meal shows its thumbnail, which opens the photo; photos are view-only', async () => {
    const mediaId = id();
    await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await mealWithPhoto(db, { kind: 'photo', mediaId }, true);
      await markUploaded(db, mediaId);
    });

    // A slot's meals show once it is opened (D-34).
    await fireEvent.press(await screen.findByRole('button', { name: 'Show Lunch meals' }));
    expect(await screen.findByLabelText('Meal photo')).toHaveProp('source', { uri: `data:image/jpeg;base64,${FILES.thumbnail}` });
    await fireEvent.press(screen.getByRole('button', { name: 'View meal photo' }));

    expect(await screen.findByLabelText('Meal photo, full size')).toHaveProp('source', { uri: `data:image/jpeg;base64,${FILES.full}` });
    expect(screen.queryByRole('button', { name: /Download|Save photo|Share/ })).toBeNull();
  });

  it('a photo not on the phone says why while offline, and the viewer’s note is light on its dark backdrop', async () => {
    await renderInApp(<NutritionScreen />, undefined, async (db, server) => {
      await mealWithPhoto(db, { kind: 'photo', mediaId: id() });
      server.state.offline = true;
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Show Lunch meals' }));
    expect(await screen.findByText('The photo needs an internet connection.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'View meal photo' }));

    await waitFor(() => expect(screen.getAllByText('The photo needs an internet connection.')).toHaveLength(2));
    expect(screen.getAllByText('The photo needs an internet connection.').at(-1)).toHaveStyle({ color: LIGHT_COLORS.onScrim });
  });

  it('a link shows its site and opens in the browser; FitSphere never fetches it', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { server } = await renderInApp(<NutritionScreen />, undefined, async (db) => {
      await mealWithPhoto(db, { kind: 'link', url: 'https://images.example.com/meal.jpg' });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Show Lunch meals' }));
    await fireEvent.press(await screen.findByRole('link', { name: 'Open image link on images.example.com' }));

    expect(open).toHaveBeenCalledWith('https://images.example.com/meal.jpg');
    expect(jest.mocked(server.fetchImpl).mock.calls.some(([input]) => String(input).includes('images.example.com'))).toBe(false);
    open.mockRestore();
  });
});
