import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HealthSyncProvider } from '../health/HealthSyncProvider';
import type { HealthAvailability } from '../health/types';
import { getEntry, getMeta, listSettings, saveEntry, setMeta, targetsOn } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { OnboardingScreen } from './OnboardingScreen';

// Log out goes through signInAlone (navigation.ts), which asks canDismiss and may call dismissAll.
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), usePreventRemove: () => () => undefined }));

// A fake of the phone's health store: the test says whether it is there and whether access is given.
const mockHealth = { availability: 'not_supported' as HealthAvailability, access: false, grant: true, asked: 0 };
jest.mock('../health/healthSource', () => ({
  healthSource: () => ({
    availability: async () => mockHealth.availability,
    hasAccess: async () => mockHealth.access,
    requestAccess: async () => {
      mockHealth.asked += 1;
      mockHealth.access = mockHealth.grant;
      return mockHealth.grant;
    },
    readSteps: async () => [],
    readWeights: async () => [],
    openInstall: () => undefined,
  }),
}));

// First sign-in onboarding (D-124, REQ-ACC-013, docs/plans/onboarding.md; canvas boards F1 to J). Synthetic
// values only.

const clock = () => NOW;
const TODAY = '2026-10-28';

beforeEach(() => {
  Object.assign(mockHealth, { availability: 'not_supported', access: false, grant: true, asked: 0 });
  mockRouter.replace.mockClear();
});

async function renderOnboarding(before?: Parameters<typeof renderInApp>[2]) {
  return renderInApp(
    <HealthSyncProvider now={clock}>
      <OnboardingScreen now={clock} />
    </HealthSyncProvider>,
    clock,
    before,
  );
}

const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));

describe('D-124 Welcome', () => {
  it('has a Log out that leads back to Sign in, so a wrong account can be left (the owner, 2026-11-24)', async () => {
    await renderOnboarding();

    await press('Log out');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('says welcome, and Get started opens About you', async () => {
    const { db } = await renderOnboarding();

    expect(await screen.findByText("Let's set\nyou up.", { exact: false })).toBeTruthy();
    expect(screen.getByText('Log your food')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();

    await press('Get started');

    expect(await screen.findByText('Your details')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 2')).toBeTruthy();
    // This phone knows the account has not finished.
    expect(await getMeta(db, 'onboarded')).toBe('0');
    await waitFor(async () => expect(await getMeta(db, 'onboarding_step')).toBe('about'));
  });
});

describe('D-124 About you', () => {
  it('Next saves the name and the units chosen', async () => {
    const { db } = await renderOnboarding();
    await press('Get started');
    await fireEvent.changeText(await screen.findByLabelText('Name (optional)'), 'Asha Rao');
    await fireEvent.press(screen.getByRole('radio', { name: 'Body weight unit: lb' }));

    await press('Next');

    expect(await screen.findByText('Where are you starting?')).toBeTruthy();
    expect((await getEntry(db, 'profile', 'profile'))?.name).toBe('Asha Rao');
    expect(await listSettings(db)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'body_weight_unit', value: 'lb' })]));
  });

  it('has every Profile box, and saves them all with the name', async () => {
    const { db } = await renderOnboarding();
    await press('Get started');
    await fireEvent.changeText(await screen.findByLabelText('Name (optional)'), 'Asha Rao');
    await fireEvent.changeText(screen.getByLabelText('Day of birth'), '14');
    await fireEvent.changeText(screen.getByLabelText('Month of birth'), '03');
    await fireEvent.changeText(screen.getByLabelText('Year of birth'), '1995');
    await fireEvent.press(screen.getByRole('radio', { name: 'Sex: Female' }));
    await fireEvent.changeText(screen.getByLabelText('Height in cm'), '165');
    await fireEvent.changeText(screen.getByLabelText('Phone number'), '9876543210');
    expect(screen.getByLabelText('Address line 1')).toBeTruthy();
    expect(screen.getByLabelText('PIN code')).toBeTruthy();

    await press('Next');

    expect(await screen.findByText('Where are you starting?')).toBeTruthy();
    expect(await getEntry(db, 'profile', 'profile')).toMatchObject({
      name: 'Asha Rao',
      dateOfBirth: '1995-03-14',
      heightMm: 1650,
      phone: '+919876543210',
    });
  });

  it('Back on Your details returns to Welcome', async () => {
    await renderOnboarding();
    await press('Get started');
    await press('Back');
    expect(await screen.findByText('Get started')).toBeTruthy();
  });

  it('refuses a name with digits, saving nothing', async () => {
    const { db } = await renderOnboarding();
    await press('Get started');
    await fireEvent.changeText(await screen.findByLabelText('Name (optional)'), 'Asha 9');

    expect(await screen.findByText(/Enter a name of 2 to 60 letters/)).toBeTruthy();
    await press('Next');

    expect(screen.getByText('Your details')).toBeTruthy();
    expect(await getEntry(db, 'profile', 'profile')).toBeNull();
  });

  it('Skip goes on without saving a name or units', async () => {
    const { db } = await renderOnboarding();
    await press('Get started');
    await fireEvent.changeText(await screen.findByLabelText('Name (optional)'), 'Asha Rao');

    await press('Skip');

    expect(await screen.findByText('Where are you starting?')).toBeTruthy();
    expect(await getEntry(db, 'profile', 'profile')).toBeNull();
  });
});

describe('D-124 Starting weight', () => {
  async function toWeight() {
    const rendered = await renderOnboarding();
    await press('Get started');
    await press('Skip');
    await screen.findByText('Where are you starting?');
    return rendered;
  }

  it('saves the weight shown as a weigh-in today, in grams; the stepper moves it by 0.1', async () => {
    const { db } = await toWeight();
    expect(screen.getByLabelText('Starting weight in kg').props.value).toBe('72.4');

    await press('Up 0.1 kg');
    await press('Save and next');

    expect(await screen.findByText('Starting weight')).toBeTruthy();
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: 72_500 });
    expect(screen.getByLabelText('Starting weight: 72.5 kg')).toBeTruthy();
  });

  it('refuses a weight outside 20 to 300 kg, saving nothing', async () => {
    const { db } = await toWeight();
    await fireEvent.changeText(screen.getByLabelText('Starting weight in kg'), '12.0');

    await press('Save and next');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Enter a weight from 20\.0 to 300\.0 kg/);
    expect(await getEntry(db, 'weighIn', TODAY)).toBeNull();
  });

  it('Skip saves no weigh-in and All set says Not set; Back returns to About you', async () => {
    const { db } = await toWeight();

    await press('Back');
    expect(await screen.findByText('Your details')).toBeTruthy();
    await press('Skip');
    await screen.findByText('Where are you starting?');
    await press('Skip');

    expect(await screen.findByLabelText('Starting weight: Not set')).toBeTruthy();
    expect(await getEntry(db, 'weighIn', TODAY)).toBeNull();
  });
});

describe('D-124 Health Connect and Go to Home', () => {
  it('on a phone without Health Connect the steps are two and the step is left out', async () => {
    await renderOnboarding();
    await press('Get started');
    await press('Skip');
    await press('Skip');

    expect(await screen.findByText("You're\nall set.", { exact: false })).toBeTruthy();
    expect(screen.queryByText('Bring in your steps and weight')).toBeNull();
  });

  it('with Health Connect there, Connect asks Android, and All set says Connected', async () => {
    mockHealth.availability = 'available';
    await renderOnboarding();
    await press('Get started');
    expect(await screen.findByLabelText('Step 1 of 3')).toBeTruthy();
    await press('Skip');
    await press('Skip');
    expect(await screen.findByText('Bring in your steps and weight')).toBeTruthy();

    await press('Connect Health Connect');

    expect(await screen.findByLabelText('Health Connect: Connected')).toBeTruthy();
    expect(mockHealth.asked).toBe(1);
  });

  it('a refused permission still goes on, to All set with Not connected', async () => {
    mockHealth.availability = 'available';
    mockHealth.grant = false;
    await renderOnboarding();
    await press('Get started');
    await press('Skip');
    await press('Skip');

    await press('Connect Health Connect');

    expect(await screen.findByLabelText('Health Connect: Not connected')).toBeTruthy();
  });

  it('Go to Home saves the starting targets, marks it finished, tells the server and opens Home', async () => {
    const { db, server } = await renderOnboarding();
    await press('Get started');
    await press('Skip');
    await press('Skip');

    await press('Go to Home');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    expect((await targetsOn(db, TODAY)).map((target) => target.kind).sort()).toEqual(
      ['calories', 'carbs', 'fat', 'fibre', 'protein', 'steps', 'weekly_workouts'].sort(),
    );
    expect(await getMeta(db, 'onboarded')).toBe('1');
    expect(await getMeta(db, 'onboarding_step')).toBeNull();
    expect(await getMeta(db, 'onboarding_flag_pending')).toBeNull();
    expect(server.state.onboardedAt).not.toBeNull();
  });

  it('with no connection Go to Home still opens Home, and the flag waits to be sent', async () => {
    const { db, server } = await renderOnboarding();
    await press('Get started');
    await press('Skip');
    await press('Skip');
    server.state.offline = true;

    await press('Go to Home');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    expect(await getMeta(db, 'onboarded')).toBe('1');
    expect(await getMeta(db, 'onboarding_flag_pending')).toBe('1');
  });

  it('a target the user already set is not replaced', async () => {
    const { db } = await renderOnboarding(async (database) => {
      await saveEntry(database, 'target', {
        changeId: '00000000-0000-4000-8000-000000000001',
        data: { kind: 'calories', value: 1800, day: TODAY, setAt: '2026-10-28T02:00:00.000Z' },
      });
    });
    await press('Get started');
    await press('Skip');
    await press('Skip');

    await press('Go to Home');

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
    const targets = await targetsOn(db, TODAY);
    expect(targets.find((target) => target.kind === 'calories')?.value).toBe(1800);
    expect(targets.find((target) => target.kind === 'protein')?.value).toBe(120);
  });
});

describe('D-124 resuming', () => {
  it('opens at the step left at, with the earlier choices kept on the phone', async () => {
    await renderOnboarding(async (database) => {
      await setMeta(database, 'onboarded', '0');
      await setMeta(database, 'onboarding_step', 'weight');
    });

    expect(await screen.findByText('Where are you starting?')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 2')).toBeTruthy();
  });
});
