import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthClient } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { apiError, deps, fakeApi, fakeAuthClient, fakeSession, ME, OFFLINE } from '../testing/fakes';
import { AccountSetupScreen } from './AccountSetupScreen';
import { CheckEmailScreen } from './CheckEmailScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

const mockRouter = { replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));

beforeEach(() => {
  mockRouter.replace.mockClear();
});

async function renderWith(element: ReactElement, client: AuthClient, fetchImpl = fakeApi({}).fetchImpl) {
  await render(<AuthProvider deps={deps(client, fetchImpl)}>{element}</AuthProvider>);
}

async function fillSignUp(email = 'someone@example.test', password = 'password1') {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('REQ-ACC-010 Sign up', () => {
  it('REQ-ACC-010 keeps the button disabled until "I am 18 or older" is ticked', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignUpScreen />, client);
    await fillSignUp();

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
    expect(client.signUp).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled();
  });

  it.each([
    ['success', null],
    ['already registered', null],
    ['email_address_not_authorized', { name: 'AuthApiError', code: 'email_address_not_authorized', status: 400 }],
  ])('D-11 shows the same neutral screen for %s', async (_case, error) => {
    const client = fakeAuthClient();
    client.signUp.mockResolvedValueOnce({ error });
    await renderWith(<SignUpScreen />, client);
    await fillSignUp();
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(mockRouter.replace).toHaveBeenCalledWith('/check-email');
  });

  it('ADR-0007 rule 6 names the step that needs internet when offline', async () => {
    const client = fakeAuthClient();
    client.signUp.mockResolvedValueOnce({ error: OFFLINE });
    await renderWith(<SignUpScreen />, client);
    await fillSignUp();
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Signing up needs an internet connection.')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('Skeleton decision 3 asks for at least 8 characters', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignUpScreen />, client);
    await fillSignUp('someone@example.test', 'short');
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.passwordRule);
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it('D-11 the check-email screen shows the neutral text', async () => {
    await render(<CheckEmailScreen />);

    expect(screen.getByText(TEXTS.signUpSent)).toBeOnTheScreen();
  });
});

describe('REQ-ACC-010 Sign in', () => {
  async function signInWith(client: AuthClient, fetchImpl = fakeApi({}).fetchImpl) {
    await renderWith(<SignInScreen />, client, fetchImpl);
    await fillSignUp();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  }

  it.each([
    ['a wrong password', { name: 'AuthApiError', code: 'invalid_credentials', status: 400 }],
    ['an unverified email (Q-080)', { name: 'AuthApiError', code: 'email_not_confirmed', status: 400 }],
  ])('REQ-ACC-010 shows the sign-in failure text for %s', async (_case, error) => {
    const client = fakeAuthClient();
    client.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error });

    await signInWith(client);

    expect(await screen.findByText(TEXTS.signInFailed)).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('ADR-0007 rule 6 names the step that needs internet when offline', async () => {
    const client = fakeAuthClient();
    client.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: OFFLINE });

    await signInWith(client);

    expect(await screen.findByText('Signing in needs an internet connection.')).toBeOnTheScreen();
  });

  it('REQ-ACC-010 goes to Home once the account is set up', async () => {
    const api = fakeApi({
      'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'),
      'POST /me': { status: 201, body: ME },
    });

    await signInWith(fakeAuthClient(), api.fetchImpl);

    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
    expect(api.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /me', 'POST /me']);
  });
});

describe('REQ-ACC-010 Account setup', () => {
  it('REQ-ACC-010 sends the confirmation and its text version once the box is ticked', async () => {
    const api = fakeApi({
      'GET /me': apiError(403, 'ACCOUNT_SETUP_REQUIRED'),
      'POST /me': { status: 201, body: ME },
    });
    await renderWith(<AccountSetupScreen />, fakeAuthClient(fakeSession({})), api.fetchImpl);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(api.calls[1]?.body).toEqual({ ageConfirmed: true, ageConfirmationTextVersion: '2026-10-27' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});
