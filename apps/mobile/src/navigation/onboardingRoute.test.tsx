import { Stack } from 'expo-router';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';
import TabsLayout from '../app/(tabs)/_layout';
import OnboardingRoute from '../app/onboarding';
import { routerProviders } from '../testing/appHarness';

// A new user opened on Home is sent to "Set your targets" (REQ-ROLE-007), with the real expo-router
// navigators: the redirect from the tabs' layout lands on the form, and a user who finished it stays.

async function renderApp(onboardingDone: boolean) {
  const Providers = await routerProviders({ onboardingDone });
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/home': () => <Text>Home screen</Text>,
      '(tabs)/nutrition': () => <Text>Nutrition screen</Text>,
      '(tabs)/training': () => <Text>Training screen</Text>,
      '(tabs)/progress': () => <Text>Progress screen</Text>,
      onboarding: OnboardingRoute,
    },
    { initialUrl: '/home', wrapper: Providers },
  );
}

describe('REQ-ROLE-007 the redirect to Set your targets, through the real router', () => {
  it('a new user opened on Home lands on the form after the first sync', async () => {
    await renderApp(false);
    expect(await screen.findByRole('header', { name: 'Your food targets' }, { timeout: 5000 })).toBeOnTheScreen();
  });

  it('a user who finished or skipped it stays on Home', async () => {
    await renderApp(true);
    expect(await screen.findByText('Home screen')).toBeOnTheScreen();
    // The first sync ran, and nothing sent the user away from Home.
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Your food targets' })).toBeNull());
    expect(screen.getByText('Home screen')).toBeOnTheScreen();
  });
});
