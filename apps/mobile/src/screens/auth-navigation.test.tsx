import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { deps, fakeApi, fakeAuthClient } from '../testing/fakes';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

// Moving between the sign-in screens (REQ-ACC-010; the owner's final check, #11), with the real
// expo-router stack. Sign in opens Sign up and Forgot password on top of itself, so going back
// returns to it, and their links back go back rather than open a second Sign in. Android's back
// gesture is React Navigation's goBack, which router.back() calls too; the tests run as iOS, where
// there is no hardware back button to press.

function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider deps={deps(fakeAuthClient(), fakeApi({}).fetchImpl)}>{children}</AuthProvider>;
}

async function renderSignIn() {
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      'sign-in': SignInScreen,
      'sign-up': SignUpScreen,
      'forgot-password': ForgotPasswordScreen,
    },
    { initialUrl: '/sign-in', wrapper: Providers },
  );
}

async function goBack() {
  await act(() => {
    router.back();
  });
}

describe('REQ-ACC-010 the sign-in screens and going back', () => {
  it.each([
    ['Create an account', '/sign-up'],
    ['Forgot password?', '/forgot-password'],
  ])('"%s" opens its screen on top of Sign in, and back returns to Sign in', async (link, path) => {
    const app = await renderSignIn();

    await fireEvent.press(await screen.findByRole('button', { name: link }));
    expect(app.getPathname()).toBe(path);

    await goBack();
    expect(app.getPathname()).toBe('/sign-in');
    // Back on the only Sign in: nothing under it.
    expect(router.canGoBack()).toBe(false);
  });

  it.each([
    ['Create an account', 'I already have an account'],
    ['Forgot password?', 'Back to sign in'],
  ])('from "%s", "%s" goes back to Sign in, not to a second one', async (link, back) => {
    const app = await renderSignIn();
    await fireEvent.press(await screen.findByRole('button', { name: link }));

    await fireEvent.press(await screen.findByRole('button', { name: back }));

    expect(app.getPathname()).toBe('/sign-in');
    expect(router.canGoBack()).toBe(false);
  });

  it('Sign up opened with nothing under it, e.g. from a link, still reaches Sign in', async () => {
    const app = await renderRouter(
      {
        _layout: () => <Stack screenOptions={{ headerShown: false }} />,
        'sign-in': SignInScreen,
        'sign-up': SignUpScreen,
      },
      { initialUrl: '/sign-up', wrapper: Providers },
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'I already have an account' }));

    expect(app.getPathname()).toBe('/sign-in');
  });
});
