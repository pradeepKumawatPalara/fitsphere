import { router, Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Button, Text } from 'react-native';
import { routerProviders } from '../testing/appHarness';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { LogOut } from './LogOut';

// After Log out or Delete account, Sign in has nothing under it (REQ-ACC-008, REQ-ACC-009; tracker
// ACC-10). The owner's phone test, 2026-11-19: Log out from Settings, then Android's Back, showed Home
// again, signed out and empty, because only Settings had been replaced by Sign in. With the real
// expo-router stack; Android's Back is React Navigation's goBack, so "nothing under Sign in" is
// router.canGoBack() being false.

function Home() {
  return <Button title="Settings" onPress={() => router.push('/account')} />;
}

function Settings() {
  return <LogOut after={<Button title="Delete account" onPress={() => router.push('/delete-account')} />} />;
}

function SignIn() {
  return <Text>Sign in</Text>;
}

async function renderSignedIn() {
  const removeDatabase = jest.fn(async () => undefined);
  const app = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      home: Home,
      account: Settings,
      'delete-account': DeleteAccountScreen,
      'sign-in': SignIn,
    },
    { initialUrl: '/home', wrapper: await routerProviders({ removeDatabase }) },
  );
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings' }));
  expect(app.getPathname()).toBe('/account');
  return { app, removeDatabase };
}

describe('REQ-ACC-008, REQ-ACC-009 Sign in alone after leaving the account', () => {
  it('REQ-ACC-008 Log out from Settings opens Sign in with no screen under it, so Back cannot reach Home', async () => {
    const { app, removeDatabase } = await renderSignedIn();

    await fireEvent.press(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'));
    expect(removeDatabase).toHaveBeenCalled();
    expect(router.canGoBack()).toBe(false);
  });

  it('REQ-ACC-009 Delete account opens Sign in, with its notice, and no screen under it', async () => {
    const { app, removeDatabase } = await renderSignedIn();
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete account' }));
    expect(app.getPathname()).toBe('/delete-account');

    await fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'));
    expect(app.getSearchParams()).toEqual({ notice: 'accountDeleted' });
    expect(removeDatabase).toHaveBeenCalled();
    expect(router.canGoBack()).toBe(false);
  });
});
