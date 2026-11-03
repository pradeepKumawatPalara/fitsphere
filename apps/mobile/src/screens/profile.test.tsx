import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { HeaderActions, HeaderTitle } from '../components/AppHeader';
import { getPhoto, insertNewPhoto } from '../local/photos';
import type { SqlDb } from '../local/sql';
import { getEntry, PROFILE_KEY, saveEntry, setMeta } from '../local/store';
import { pickPhoto } from '../photos/takePhoto';
import { PROFILE_TEXTS } from '../profile';
import { NOW, renderInApp } from '../testing/appHarness';
import { AccountScreen } from './AccountScreen';
import { ProfileScreen } from './ProfileScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('../photos/takePhoto', () => ({ pickPhoto: jest.fn() }));

// The profile (REQ-ACC-011; docs/plans/user-profile.md; the redesign's 6.6 and 6.1's Profile card,
// locked by the owner 2026-11-03). Every value is synthetic; the camera is a fake that returns
// synthetic base64 text, not an image.

const TODAY = '2026-10-28';
const AT = NOW.toISOString();
const FILES = { thumbnail: 'dGh1bWI=', full: 'ZnVsbA==' };
const ADDRESS = { line1: '12 Example Lane', line2: null, city: 'Pune', state: 'Maharashtra', pinCode: '411001' };
const SAVED = {
  name: 'Synthetic Person',
  dateOfBirth: '1994-06-14',
  sex: 'female' as const,
  heightMm: 1620,
  phone: '+919876543210',
  address: ADDRESS,
  photoMediaId: null,
};
const PHOTO_ID = '00000000-0000-4000-c000-000000000001';
const pick = pickPhoto as jest.MockedFunction<typeof pickPhoto>;

/** The saved profile, with a photo taken on this phone when `photo`. */
async function saveProfile(db: SqlDb, photo = false) {
  await saveEntry(
    db,
    'profile',
    { changeId: 'c1', data: { ...SAVED, photoMediaId: photo ? PHOTO_ID : null, setAt: AT } },
    photo ? () => insertNewPhoto(db, { id: PHOTO_ID, mealId: PROFILE_KEY, createdAt: AT, files: FILES }) : undefined,
  );
}

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.push.mockClear();
  pick.mockReset();
});

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

async function renderProfile(before?: Parameters<typeof renderInApp>[2]) {
  const app = await renderInApp(<ProfileScreen now={() => NOW} />, undefined, before);
  await screen.findByLabelText('Name (optional)');
  return app;
}

describe('REQ-ACC-011 the Profile screen', () => {
  it('6.6 a new profile: every field empty and optional; the email read-only, with why', async () => {
    await renderProfile();

    for (const label of ['Name (optional)', 'Day of birth', 'Month of birth', 'Year of birth', 'Height in cm', 'Phone number']) {
      expect(screen.getByLabelText(label)).toHaveProp('value', '');
    }
    for (const label of ['Address line 1', 'Address line 2 (optional)', 'City', 'State', 'PIN code']) {
      expect(screen.getByLabelText(label)).toHaveProp('value', '');
    }
    expect(screen.getByRole('radio', { name: 'Sex: Female', checked: false })).toBeOnTheScreen();
    expect(screen.getByLabelText('Email: user@example.test')).toBeOnTheScreen();
    expect(screen.getByText(PROFILE_TEXTS.emailFixed)).toBeOnTheScreen();
    expect(screen.getByText('No weigh-ins yet.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('REQ-ACC-011 saves the whole profile on the phone, syncs it (the height in mm, the phone with +91) and goes back', async () => {
    const { db, server } = await renderProfile();

    await type('Name (optional)', '  Synthetic Person ');
    await type('Day of birth', '14');
    await type('Month of birth', '6');
    await type('Year of birth', '1994');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sex: Female' }));
    await type('Height in cm', '162');
    await type('Phone number', '98765 43210');
    await type('Address line 1', '12 Example Lane');
    await type('City', 'Pune');
    await type('State', 'Maharashtra');
    await type('PIN code', '411001');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'profile', PROFILE_KEY)).toMatchObject(SAVED);
    await waitFor(() => expect(server.entries('profiles').get('profile')).toMatchObject(SAVED));
  });

  it('REQ-ACC-011 shows the age the date of birth gives once it is whole', async () => {
    await renderProfile();
    await type('Day of birth', '14');
    await type('Month of birth', '06');
    expect(screen.queryByText(/^Age /)).toBeNull();

    await type('Year of birth', '1994');

    expect(screen.getByText('Age 32')).toBeOnTheScreen();
  });

  it.each([
    ['a date of birth under 18', { 'Day of birth': '29', 'Month of birth': '10', 'Year of birth': '2008' }, PROFILE_TEXTS.dateOfBirthAge],
    ['a date that does not exist', { 'Day of birth': '30', 'Month of birth': '02', 'Year of birth': '1994' }, PROFILE_TEXTS.dateOfBirthReal],
    ['a date with no year', { 'Day of birth': '14', 'Month of birth': '06' }, PROFILE_TEXTS.dateOfBirthReal],
    ['a phone number of 9 digits', { 'Phone number': '98765 4321' }, PROFILE_TEXTS.phone],
    ['a landline-like number', { 'Phone number': '2212345678' }, PROFILE_TEXTS.phone],
    ['an address without its city', { 'Address line 1': '12 Example Lane', State: 'Maharashtra', 'PIN code': '411001' }, PROFILE_TEXTS.addressIncomplete],
    ['a PIN code of 4 digits', { 'Address line 1': '12 Example Lane', City: 'Pune', State: 'Maharashtra', 'PIN code': '4110' }, PROFILE_TEXTS.pinCode],
    ['a height of 99 cm', { 'Height in cm': '99' }, 'Enter a height from 100 to 250 cm.'],
  ])('6.6 refuses %s, with the problem under its field, and saves nothing', async (_case, typed, problem) => {
    const { db } = await renderProfile();
    for (const [label, text] of Object.entries(typed)) await type(label, text);

    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(problem);
    expect(await getEntry(db, 'profile', PROFILE_KEY)).toBeNull();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('invariant #6 the height is typed in inches when the measurements use inches, and kept in mm', async () => {
    const { db } = await renderProfile(async (database) => setMeta(database, 'measurement_unit', 'in'));
    expect(screen.getByText('Height in inches (optional)')).toBeOnTheScreen();

    await type('Height in inches', '64');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'profile', PROFILE_KEY)).toMatchObject({ heightMm: 1626 });
  });

  it('ADR-0007 a profile saved on another phone is pulled and fills the form', async () => {
    await renderProfile(async (_db, server) => server.storeProfileFromElsewhere(SAVED));

    await waitFor(() => expect(screen.getByLabelText('Name (optional)')).toHaveProp('value', 'Synthetic Person'));
  });

  it('a saved profile fills the form, the phone without +91; clearing a field and saving clears it', async () => {
    const { db } = await renderProfile(async (database) => saveProfile(database));
    await waitFor(() => expect(screen.getByLabelText('Phone number')).toHaveProp('value', '9876543210'));
    expect(screen.getByLabelText('Height in cm')).toHaveProp('value', '162');
    expect(screen.getByRole('radio', { name: 'Sex: Female', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('Age 32')).toBeOnTheScreen();

    await type('Phone number', '');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sex: Female' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'profile', PROFILE_KEY)).toMatchObject({ phone: null, sex: null, name: 'Synthetic Person' });
  });

  it('ADR-0007 offline, the profile is saved on the phone and shows it is waiting to sync', async () => {
    await renderProfile(async (database, server) => {
      server.state.offline = true;
      await saveProfile(database);
    });

    expect(await screen.findByText('Waiting to sync')).toBeOnTheScreen();
  });
});

describe('REQ-ACC-011 the weight on the profile', () => {
  it('REQ-HOME-006 shows the latest weigh-in with its day; "Log today’s weight" saves today’s', async () => {
    const { db } = await renderProfile(async (database) =>
      saveEntry(database, 'weighIn', { changeId: 'w1', data: { day: '2026-10-26', weightGrams: 72_400, recordedAt: AT } }),
    );
    expect(await screen.findByText('72.4 kg')).toBeOnTheScreen();
    expect(screen.getByText('Latest weigh-in · Mon 26 Oct')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: "Log today's weight" }));
    await fireEvent.changeText(await screen.findByLabelText('Weight in kg'), '72.0');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Latest weigh-in · Wed 28 Oct')).toBeOnTheScreen());
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: 72_000 });
  });
});

describe('REQ-ACC-011 the profile photo', () => {
  it('ADR-0002 a photo taken is cropped square, kept with the profile on the phone and uploaded once synced', async () => {
    pick.mockResolvedValue({ kind: 'picked', files: FILES });
    const { db, server } = await renderProfile();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(await screen.findByLabelText('Profile photo')).toBeOnTheScreen();
    expect(pick).toHaveBeenCalledWith('camera', 'square');
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const mediaId = (await getEntry(db, 'profile', PROFILE_KEY))?.photoMediaId;
    expect(mediaId).toEqual(expect.any(String));
    expect(await getPhoto(db, mediaId!)).toMatchObject({ mealId: PROFILE_KEY, thumbnail: FILES.thumbnail });
    await waitFor(async () => expect(await getPhoto(db, mediaId!)).toMatchObject({ uploaded: true }));
    expect(server.state.files.has(`${mediaId}-thumb.jpg`)).toBe(true);
  });

  it('removing the photo saves the profile without one, and the phone forgets its files', async () => {
    const { db } = await renderProfile(async (database) => saveProfile(database, true));
    expect(await screen.findByLabelText('Profile photo')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByLabelText('Profile photo')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(await getEntry(db, 'profile', PROFILE_KEY)).toMatchObject({ photoMediaId: null });
    expect(await getPhoto(db, PHOTO_ID)).toBeNull();
  });

  it('without camera permission, says so and keeps the profile as it is', async () => {
    pick.mockResolvedValue({ kind: 'noPermission' });
    await renderProfile();

    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(await screen.findByText('FitSphere needs the camera to take a photo. You can choose one from the gallery instead.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Profile photo')).toBeNull();
  });
});

describe('REQ-ACC-011 the profile in Settings and the header', () => {
  it('6.1 with no profile yet, the card shows the email’s name and initial; Edit profile opens the profile', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />);
    const card = await screen.findByLabelText('Profile');

    expect(within(card).getByText('user')).toBeOnTheScreen();
    expect(within(card).getByText('U', { includeHiddenElements: true })).toBeOnTheScreen();
    await fireEvent.press(within(card).getByRole('button', { name: 'Edit profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/profile');
  });

  it('6.1 with a profile, the card shows its name and photo', async () => {
    await renderInApp(<AccountScreen showDevTools={false} />, undefined, async (db) => saveProfile(db, true));
    const card = await screen.findByLabelText('Profile');

    expect(await within(card).findByText('Synthetic Person')).toBeOnTheScreen();
    expect(await within(card).findByLabelText('Profile photo')).toBeOnTheScreen();
  });

  it('REQ-HOME-001 the header greets the user by the profile’s first name, and the avatar shows the initial', async () => {
    await renderInApp(
      <>
        <HeaderTitle />
        <HeaderActions />
      </>,
      undefined,
      async (db) => saveProfile(db),
    );

    expect(await screen.findByText('Hi, Synthetic')).toBeOnTheScreen();
    expect(within(screen.getByRole('button', { name: 'Account' })).getByText('S', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
