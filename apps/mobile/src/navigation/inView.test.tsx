import { Stack, useRouter } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useEffect } from 'react';
import { Button, Text } from 'react-native';
import TabsLayout from '../app/(tabs)/_layout';
import { useDataVersion, useSync, useSyncStatus } from '../sync/SyncProvider';
import { routerProviders } from '../testing/appHarness';
import { inViewWhenFocused } from './inViewRoute';

// REQ-NFR-003 (usable on a low-end Android phone), with the real expo-router navigators: the tabs keep
// every tab visited open, and a page pushed over the tabs leaves them open under it. Out of view, a
// screen reads nothing after a save or sync; it reads once when it comes back into view.

/** How many times each stand-in screen read its data, and the data version it last read. */
const reads: Record<string, { count: number; version: number }> = {};

beforeEach(() => {
  for (const name of Object.keys(reads)) delete reads[name];
});

/** A stand-in screen: it reads at each change of the data version, as the app's screens do. */
function standIn(name: string) {
  function StandIn() {
    const version = useDataVersion();
    const sync = useSync();
    const status = useSyncStatus();
    const router = useRouter();
    useEffect(() => {
      reads[name] = { count: (reads[name]?.count ?? 0) + 1, version };
    }, [version]);
    return (
      <>
        <Text>{`${name}: sync ${status}`}</Text>
        <Button title={`Save on ${name}`} onPress={() => void sync.saveWeight('2026-10-28', 70_000)} />
        <Button title={`Open the page from ${name}`} onPress={() => router.push('/account')} />
        <Button title={`Back from ${name}`} onPress={() => router.back()} />
      </>
    );
  }
  // As a route file exports it (renderRouter takes a component with no props).
  const Route = inViewWhenFocused(StandIn);
  return () => <Route />;
}

async function renderApp() {
  const Providers = await routerProviders();
  return renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/home': standIn('Home'),
      '(tabs)/nutrition': standIn('Nutrition'),
      '(tabs)/training': standIn('Training'),
      '(tabs)/progress': standIn('Progress'),
      account: standIn('Page'),
    },
    { initialUrl: '/home', wrapper: Providers },
  );
}

/** Saves on `name`'s screen and waits until it has read the save and its sync: two changes. */
async function saveOn(name: string) {
  const before = reads[name]!.version;
  await fireEvent.press(screen.getByRole('button', { name: `Save on ${name}` }));
  await waitFor(() => expect(reads[name]!.version).toBeGreaterThanOrEqual(before + 2));
  await screen.findByText(`${name}: sync synced`);
}

describe('REQ-NFR-003 a screen out of view reads nothing until it is shown again', () => {
  it('a tab visited and left reads nothing after a save and its sync, and reads once when shown again', async () => {
    await renderApp();
    await screen.findByText('Home: sync synced');
    await fireEvent.press(screen.getByText('Nutrition'));
    await screen.findByText('Nutrition: sync synced');
    await fireEvent.press(screen.getByText('Home'));
    const left = { ...reads.Nutrition! };

    await saveOn('Home');

    expect(reads.Nutrition).toEqual(left);
    await fireEvent.press(screen.getByText('Nutrition'));
    await waitFor(() => expect(reads.Nutrition).toEqual({ count: left.count + 1, version: reads.Home!.version }));
  });

  it('a tab under a page pushed over it reads nothing after a save there, and reads once when the page is left', async () => {
    await renderApp();
    await screen.findByText('Home: sync synced');
    await fireEvent.press(screen.getByRole('button', { name: 'Open the page from Home' }));
    await screen.findByText('Page: sync synced');
    const under = { ...reads.Home! };

    await saveOn('Page');

    expect(reads.Home).toEqual(under);
    await fireEvent.press(screen.getByRole('button', { name: 'Back from Page' }));
    await waitFor(() => expect(reads.Home).toEqual({ count: under.count + 1, version: reads.Page!.version }));
  });

  it('a screen shown again with nothing changed meanwhile reads nothing', async () => {
    await renderApp();
    await screen.findByText('Home: sync synced');
    await fireEvent.press(screen.getByText('Nutrition'));
    await screen.findByText('Nutrition: sync synced');
    const home = { ...reads.Home! };

    await fireEvent.press(screen.getByText('Home'));
    await screen.findByText('Home: sync synced');

    expect(reads.Home).toEqual(home);
  });
});
