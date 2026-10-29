import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { RESET_REDIRECT, type AuthClient } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { deps, fakeApi, fakeAuthClient, fakeSession, OFFLINE } from '../testing/fakes';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';

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

async function renderWith(element: ReactElement, client: AuthClient) {
  await render(<AuthProvider deps={deps(client, fakeApi({}).fetchImpl)}>{element}</AuthProvider>);
}

describe('REQ-ACC-010 Forgot password', () => {
  async function requestReset(client: AuthClient) {
    await renderWith(<ForgotPasswordScreen />, client);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'Someone@Example.test');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
  }

  it.each([
    ['a registered address', null],
    ['an unregistered address', null],
    ['an address outside the team', { name: 'AuthApiError', code: 'email_address_not_authorized', status: 400 }],
    ['the email rate limit', { name: 'AuthApiError', code: 'over_email_send_rate_limit', status: 429 }],
  ])('D-11 shows the same neutral text for %s', async (_case, error) => {
    const client = fakeAuthClient();
    client.resetPasswordForEmail.mockResolvedValueOnce({ error });

    await requestReset(client);

    expect(await screen.findByText(TEXTS.resetSent)).toBeOnTheScreen();
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith('someone@example.test', { redirectTo: RESET_REDIRECT });
  });

  it('ADR-0007 rule 6 names the step that needs internet when offline', async () => {
    const client = fakeAuthClient();
    client.resetPasswordForEmail.mockResolvedValueOnce({ error: OFFLINE });

    await requestReset(client);

    expect(await screen.findByText('Resetting a password needs an internet connection.')).toBeOnTheScreen();
    expect(screen.queryByText(TEXTS.resetSent)).toBeNull();
  });
});

describe('REQ-ACC-010 Set a new password', () => {
  it('REQ-ACC-010 trades the link code for a session and sets the new password', async () => {
    mockParams = { code: 'one-time-code' };
    const client = fakeAuthClient();
    client.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: fakeSession() }, error: null });
    await renderWith(<ResetPasswordScreen />, client);

    await fireEvent.changeText(await screen.findByLabelText('New password'), 'new-password-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Set password' }));

    expect(client.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
    expect(client.updateUser).toHaveBeenCalledWith({ password: 'new-password-1' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });

  it('Skeleton decision 3 refuses a password under 8 characters', async () => {
    mockParams = { code: 'one-time-code' };
    const client = fakeAuthClient();
    client.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: fakeSession() }, error: null });
    await renderWith(<ResetPasswordScreen />, client);

    await fireEvent.changeText(await screen.findByLabelText('New password'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Set password' }));

    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.passwordRule);
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it('REQ-ACC-010 asks for a different password when Supabase says it is the same', async () => {
    mockParams = { code: 'one-time-code' };
    const client = fakeAuthClient();
    client.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: fakeSession() }, error: null });
    client.updateUser.mockResolvedValueOnce({ error: { name: 'AuthApiError', code: 'same_password', status: 422 } });
    await renderWith(<ResetPasswordScreen />, client);

    await fireEvent.changeText(await screen.findByLabelText('New password'), 'old-password-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByText(TEXTS.samePassword)).toBeOnTheScreen();
  });

  it.each([
    ['an expired or used link', { error: 'access_denied' }],
    ['a link without a code', {}],
  ])('Q-080 explains %s and offers a new one', async (_case, params) => {
    mockParams = params;
    const client = fakeAuthClient();
    await renderWith(<ResetPasswordScreen />, client);

    expect(await screen.findByText(TEXTS.resetLinkInvalid)).toBeOnTheScreen();
    expect(client.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('REQ-ACC-010 a code this phone cannot use (opened on another phone) is refused', async () => {
    mockParams = { code: 'one-time-code' };
    const client = fakeAuthClient();
    client.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthPKCECodeVerifierMissingError', status: 400 },
    });
    await renderWith(<ResetPasswordScreen />, client);

    expect(await screen.findByText(TEXTS.resetLinkInvalid)).toBeOnTheScreen();
  });
});
