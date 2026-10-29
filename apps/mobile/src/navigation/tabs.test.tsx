import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import TabsLayout from '../app/(tabs)/_layout';
import { AuthProvider } from '../auth/AuthProvider';
import { ComingLaterScreen } from '../screens/ComingLaterScreen';
import { deps, fakeAuthClient, fakeApi, fakeSession } from '../testing/fakes';

// REQ-NAV-001 and REQ-NAV-002 with the real expo-router navigators. The screens behind the tabs
// are stand-ins; Home's own behaviour is tested in screens/home.test.tsx.

function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider deps={deps(fakeAuthClient(fakeSession()), fakeApi({}).fetchImpl)}>{children}</AuthProvider>;
}

async function renderTabs() {
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/home': () => <Text>Home content</Text>,
      '(tabs)/nutrition': ComingLaterScreen,
      '(tabs)/training': ComingLaterScreen,
      '(tabs)/progress': () => <Text>Progress content</Text>,
      account: () => <Text>Account content</Text>,
    },
    { initialUrl: '/home', wrapper: Providers },
  );
}

describe('REQ-NAV-001 bottom navigation', () => {
  it('REQ-NAV-001 shows the four tabs, and each opens its screen', async () => {
    const router = await renderTabs();

    expect(await screen.findByText('Home content')).toBeOnTheScreen();
    for (const [tab, path] of [
      ['Nutrition', '/nutrition'],
      ['Training', '/training'],
      ['Progress', '/progress'],
      ['Home', '/home'],
    ] as const) {
      await fireEvent.press(screen.getByText(tab));
      expect(router.getPathname()).toBe(path);
    }
    await fireEvent.press(screen.getByText('Training'));
    expect(screen.getByText('Coming in a later update.')).toBeOnTheScreen();
  });
});

describe('REQ-NAV-002 common header', () => {
  it.each(['Home', 'Nutrition', 'Training', 'Progress'])(
    'REQ-NAV-002 the %s tab shows the selected date, the calendar and the avatar',
    async (tab) => {
      await renderTabs();
      await fireEvent.press(await screen.findByText(tab));

      expect(screen.getByLabelText(/^Selected date: Today · /)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Calendar' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Account' })).toBeOnTheScreen();
    },
  );

  it('REQ-HOME-001 the header greets the user by the name before "@" in their email (D-23)', async () => {
    await renderTabs();

    expect(await screen.findByText('Hi, user')).toBeOnTheScreen();
  });

  it('REQ-NAV-002 the avatar opens Account', async () => {
    const router = await renderTabs();

    await fireEvent.press(await screen.findByRole('button', { name: 'Account' }));

    expect(router.getPathname()).toBe('/account');
    expect(await screen.findByText('Account content')).toBeOnTheScreen();
  });
});
