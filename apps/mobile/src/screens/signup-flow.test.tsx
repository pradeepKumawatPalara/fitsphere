import { fireEvent, render, screen } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { HealthSyncProvider } from '../health/HealthSyncProvider';
import type { AuthClient } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { apiError, deps, fakeApi, fakeAuthClient, ME } from '../testing/fakes';
import { NOW, renderInApp } from '../testing/appHarness';
import { OnboardingScreen } from './OnboardingScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), usePreventRemove: () => () => undefined }));
jest.mock('../health/healthSource', () => ({
  healthSource: () => ({
    availability: async () => 'not_supported',
    hasAccess: async () => false,
    requestAccess: async () => false,
    readSteps: async () => [],
    readWeights: async () => [],
    openInstall: () => undefined,
  }),
}));

// The new-user journey as one automated check (the owner, 2026-11-24): a fresh address signs up and is told
// to check its email; the same user signing in for the first time is taken to onboarding, whose Welcome page
// opens; and signing up again with the same address is told it already has an account (D-125), not "Check
// your email". The auth service is a fake that behaves like Supabase: a second sign-up for a registered,
// confirmed address answers with no error and a user with no identities. Synthetic password; no real
// Supabase, no real email.

const EMAIL = 'unnatigaur123@gmail.com';
const PASSWORD = 'password1';

/** A fake Supabase auth client that remembers which addresses are registered. */
function supabaseLikeClient(): AuthClient & ReturnType<typeof fakeAuthClient> {
  const registered = new Set<string>();
  const client = fakeAuthClient();
  client.signUp.mockImplementation(async ({ email }) => {
    if (registered.has(email)) return { data: { user: { identities: [] } }, error: null };
    registered.add(email);
    return { data: { user: { identities: [{ id: 'identity-1' }] } }, error: null };
  });
  return client as never;
}

async function signUpWith(client: AuthClient) {
  await render(
    <AuthProvider deps={deps(client, fakeApi({}).fetchImpl)}>
      <SignUpScreen />
    </AuthProvider>,
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), EMAIL);
  await fireEvent.changeText(screen.getByLabelText('Password'), PASSWORD);
  await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
}

const client = supabaseLikeClient();

beforeEach(() => mockRouter.replace.mockClear());

describe('the new user journey, unnatigaur123@gmail.com', () => {
  it('1. a fresh address signs up and is sent to "Check your email"', async () => {
    await signUpWith(client);

    expect(client.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/check-email');
    expect(screen.queryByText(TEXTS.accountExists)).toBeNull();
  });

  it('2. the new account signs in for the first time and goes to onboarding, not Home', async () => {
    const created = { ...ME, user: { ...ME.user, email: EMAIL, onboardedAt: null } };
    const api = fakeApi({ 'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'), 'POST /me': { status: 201, body: created } });
    await render(
      <AuthProvider deps={deps(client, api.fetchImpl)}>
        <SignInScreen />
      </AuthProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Email'), EMAIL);
    await fireEvent.changeText(screen.getByLabelText('Password'), PASSWORD);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('button', { name: 'Sign in' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home');
  });

  it('3. the onboarding page exists for a fresh user: Welcome, Get started, the three lines, no Skip', async () => {
    const clock = () => NOW;
    await renderInApp(
      <HealthSyncProvider now={clock}>
        <OnboardingScreen now={clock} />
      </HealthSyncProvider>,
      clock,
    );

    expect(await screen.findByText("Let's set\nyou up.", { exact: false })).toBeTruthy();
    expect(screen.getByText('Log your food')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('4. signing up again with the same address says the account already exists, and does not go to Check your email', async () => {
    await signUpWith(client);

    expect(await screen.findByText(TEXTS.accountExists)).toBeOnTheScreen();
    expect(screen.getByText('This email already has an account. Sign in instead, or reset your password if you forgot it.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(client.signUp).toHaveBeenCalledTimes(2);
  });
});
