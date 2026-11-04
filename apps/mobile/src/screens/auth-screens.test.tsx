import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import type { AuthClient } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { LIGHT_COLORS } from '../theme';
import { apiError, deps, fakeApi, fakeAuthClient, fakeSession, ME, OFFLINE } from '../testing/fakes';
import { AccountSetupScreen } from './AccountSetupScreen';
import { CheckEmailScreen } from './CheckEmailScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { VerifiedScreen } from './VerifiedScreen';

const mockRouter = { replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockParams = {};
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

  it('D-11 the check-email screen shows the neutral text, under its heading', async () => {
    await render(<CheckEmailScreen />);

    expect(screen.getByRole('header', { name: TEXTS.signUpSentHeading })).toBeOnTheScreen();
    expect(screen.getByText(TEXTS.signUpSent)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeOnTheScreen();
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

// The redesign's screen 1.1 (locked by the owner, 2026-11-03; D-35).
describe('REQ-ACC-010 Sign in, redesigned', () => {
  it('names an empty field under that field, its outline red; wrong details show above Sign in', async () => {
    const client = fakeAuthClient();
    client.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400 },
    });
    await renderWith(<SignInScreen />, client);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const problem = screen.getByRole('alert');
    expect(problem).toHaveTextContent(TEXTS.emailRule);
    expect(within(problem.parent!.parent!).getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email').parent).toHaveStyle({ borderColor: LIGHT_COLORS.danger });

    await fillSignUp();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.signInFailed);
    expect(screen.getByLabelText('Email').parent).not.toHaveStyle({ borderColor: LIGHT_COLORS.danger });
  });

  it('shows the password when asked, and hides it again', async () => {
    await renderWith(<SignInScreen />, fakeAuthClient());
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);

    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);

    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  });

  it('while signing in, a spinner takes the title’s place and Sign in cannot be pressed again', async () => {
    const client = fakeAuthClient();
    let answer: (value: { data: { session: null }; error: typeof OFFLINE }) => void = () => {};
    client.signInWithPassword.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    await renderWith(<SignInScreen />, client);
    await fillSignUp();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(within(button).queryByText('Sign in')).toBeNull();

    answer({ data: { session: null }, error: OFFLINE });
    expect(await screen.findByText('Signing in needs an internet connection.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});

// The redesign's screen 1.2 (locked by the owner, 2026-11-03).
describe('REQ-ACC-010 Sign up, redesigned', () => {
  it('the password’s rule ticks once met, and turns red with the field when Sign up finds it broken', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignUpScreen />, client);
    await fillSignUp('someone@example.test', 'short');
    expect(screen.getByText(TEXTS.passwordRule)).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();

    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.passwordRule);
    expect(screen.getByLabelText('Password').parent).toHaveStyle({ borderColor: LIGHT_COLORS.danger });

    await fireEvent.changeText(screen.getByLabelText('Password'), 'password1');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(`${TEXTS.passwordRule} Done.`)).toBeOnTheScreen();
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it('names a problem with the email under the email field', async () => {
    await renderWith(<SignUpScreen />, fakeAuthClient());
    await fillSignUp('someone@', 'password1');
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    const problem = screen.getByRole('alert');
    expect(problem).toHaveTextContent(TEXTS.emailFormat);
    expect(within(problem.parent!.parent!).getByLabelText('Email')).toBeOnTheScreen();
  });
});

// The redesign's screen 1.4 (locked by the owner, 2026-11-03), opened by the link in the verify email.
describe('REQ-ACC-010 Email verified', () => {
  it('says the email is verified, and Sign in goes to sign in', async () => {
    await render(<VerifiedScreen />);

    expect(screen.getByRole('header', { name: 'Your email is verified' })).toBeOnTheScreen();
    expect(screen.getByText('Sign in to continue.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('says the link expired when Supabase adds an error to it', async () => {
    mockParams = { error: 'access_denied' };
    await render(<VerifiedScreen />);

    expect(screen.getByRole('header', { name: 'Link expired' })).toBeOnTheScreen();
    expect(
      screen.getByText('This link has expired or was already used. Sign in, or sign up again for a new link.'),
    ).toBeOnTheScreen();
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

  // The redesign's screen 1.7 (locked by the owner, 2026-11-03).
  it('says what to do under Continue until the box is ticked', async () => {
    await renderWith(<AccountSetupScreen />, fakeAuthClient(fakeSession({})));

    expect(screen.getByRole('header', { name: 'Set up your account' })).toBeOnTheScreen();
    expect(screen.getByText(TEXTS.ageHint)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    expect(screen.queryByText(TEXTS.ageHint)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});

// Messages that name what is missing or wrong (owner review, 2 November); the limits are unchanged.
describe('REQ-ACC-010 messages', () => {
  it('Sign in names an empty email or password; wrong details stay neutral (D-11)', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignInScreen />, client);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.emailRule);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'someone@example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.');
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('Sign up shows what an email address looks like when the one typed isn’t one', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignUpScreen />, client);
    await fillSignUp('someone.example.test');
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an email address like name@example.com.');
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it('Skeleton decision 3 says the password takes 8 to 72 characters, above 72 too', async () => {
    const client = fakeAuthClient();
    await renderWith(<SignUpScreen />, client);
    await fillSignUp('someone@example.test', 'x'.repeat(73));
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));

    await fireEvent.press(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Use 8 to 72 characters.');
  });

  it.each([
    ['Sign up', SignUpScreen, 'Sign up'],
    ['Account setup', AccountSetupScreen, 'Continue'],
  ] as const)('D-18 %s says why its button waits until the 18+ box is ticked', async (_, Screen, title) => {
    await renderWith(<Screen />, fakeAuthClient(fakeSession({})));

    expect(screen.getByRole('button', { name: title })).toBeDisabled();
    expect(screen.getByText('Tick "I am 18 or older" to continue.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('checkbox', { name: TEXTS.ageConfirmation }));
    expect(screen.queryByText('Tick "I am 18 or older" to continue.')).toBeNull();
  });
});
