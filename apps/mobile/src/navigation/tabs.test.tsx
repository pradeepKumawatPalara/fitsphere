import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import TabsLayout from '../app/(tabs)/_layout';
import { ComingLaterScreen } from '../screens/ComingLaterScreen';
import { routerProviders } from '../testing/appHarness';
import { LIGHT_COLORS } from '../theme';

// REQ-NAV-001 and REQ-NAV-002 with the real expo-router navigators. The screens behind the tabs
// are stand-ins; Home's own behaviour is tested in screens/home.test.tsx.

async function renderTabs() {
  const Providers = await routerProviders();
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

// The redesign's 2.1 (locked by the owner, 2026-11-03), in place of D-34's tinted pill.
describe('REQ-NAV-001 the tab bar: an icon over each label', () => {
  it('the tab shown has a caramel bar along its top edge and is read out as selected; both move with the tab chosen', async () => {
    await renderTabs();
    await screen.findByText('Home content');
    const marked = { backgroundColor: LIGHT_COLORS.accent };

    expect(screen.getByTestId('tab-marker-home')).toHaveStyle(marked);
    for (const tab of ['nutrition', 'training', 'progress']) expect(screen.getByTestId(`tab-marker-${tab}`)).not.toHaveStyle(marked);
    expect(screen.getByRole('tab', { name: 'Home' })).toBeSelected();

    await fireEvent.press(screen.getByText('Progress'));

    expect(screen.getByTestId('tab-marker-progress')).toHaveStyle(marked);
    expect(screen.getByTestId('tab-marker-home')).not.toHaveStyle(marked);
    expect(screen.getByRole('tab', { name: 'Progress' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Home' })).not.toBeSelected();
  });

  it('the header shows the selected date in caramel while it is today, over the greeting', async () => {
    await renderTabs();

    expect(await screen.findByLabelText(/^Selected date: Today · /)).toHaveStyle({ color: LIGHT_COLORS.accent });
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
