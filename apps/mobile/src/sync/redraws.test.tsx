import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Profiler, type ReactNode } from 'react';
import { Button, Text } from 'react-native';
import { useProfile } from '../components/ProfilePhoto';
import type { LocalProfile } from '../local/store';
import { sameData } from '../sameData';
import { useSettings } from '../settings/SettingsProvider';
import { renderInApp } from '../testing/appHarness';
import { useDataVersion, useSync, useSyncStatus } from './SyncProvider';

// REQ-NFR-003 (usable on a low-end Android phone): a save or sync draws again only what shows what
// changed. Synthetic data only.

const renders = { saver: 0, settings: 0 };
const profiles: (LocalProfile | null)[] = [];

beforeEach(() => {
  renders.saver = 0;
  renders.settings = 0;
  profiles.length = 0;
});

/** Counts each time what is inside draws (React's Profiler). */
function Counted({ name, children }: { name: keyof typeof renders; children: ReactNode }) {
  return (
    <Profiler id={name} onRender={() => (renders[name] += 1)}>
      {children}
    </Profiler>
  );
}

/** Saves a weigh-in, and shows nothing that changes. */
function Saver() {
  const sync = useSync();
  return <Button title="Save a weigh-in" onPress={() => void sync.saveWeight('2026-10-28', 70_000)} />;
}

function Status() {
  return <Text>{`Sync: ${useSyncStatus()}`}</Text>;
}

function Version() {
  return <Text>{`Data version ${useDataVersion()}`}</Text>;
}

function SettingsReader() {
  const { settings } = useSettings();
  return <Text>{`Body weight in ${settings.body_weight_unit}`}</Text>;
}

function ProfileReader() {
  const profile = useProfile();
  profiles.push(profile);
  return <Text>{`Profile: ${profile?.name ?? 'none'}`}</Text>;
}

/** The version shown now. */
function shownVersion(): number {
  return Number(/(\d+)$/.exec(String(screen.getByText(/^Data version/).props.children))?.[1]);
}

/** Saves a weigh-in and waits for its sync to end: two changes of the data, the save's and the sync's. */
async function saveAndSync(server: { weighIns: Map<string, unknown> }) {
  const before = shownVersion();
  await fireEvent.press(screen.getByRole('button', { name: 'Save a weigh-in' }));
  await waitFor(() => expect(server.weighIns.size).toBe(1));
  await waitFor(() => expect(shownVersion()).toBeGreaterThanOrEqual(before + 2));
  await screen.findByText('Sync: synced');
}

describe('REQ-NFR-003 a save or sync draws again only what shows what changed', () => {
  it('a part that only saves does not draw again when its save is synced; the status shows the sync', async () => {
    const { server } = await renderInApp(
      <>
        <Counted name="saver">
          <Saver />
        </Counted>
        <Status />
        <Version />
      </>,
    );
    await screen.findByText('Sync: synced');
    const before = renders.saver;

    await saveAndSync(server);

    expect(renders.saver).toBe(before);
  });

  it('the settings, read again unchanged after a save and its sync, draw nothing again', async () => {
    const { server } = await renderInApp(
      <>
        <Saver />
        <Status />
        <Version />
        <Counted name="settings">
          <SettingsReader />
        </Counted>
      </>,
    );
    await screen.findByText('Sync: synced');
    await screen.findByText('Body weight in kg');
    const before = renders.settings;

    await saveAndSync(server);

    expect(renders.settings).toBe(before);
  });

  it('the profile, read again unchanged after a save and its sync, stays the same value', async () => {
    const { server } = await renderInApp(
      <>
        <Saver />
        <Status />
        <Version />
        <ProfileReader />
      </>,
      undefined,
      async (_db, fake) =>
        fake.storeProfileFromElsewhere({
          name: 'Synthetic Person',
          dateOfBirth: null,
          sex: null,
          heightMm: null,
          phone: null,
          address: null,
          photoMediaId: null,
        }),
    );
    await screen.findByText('Sync: synced');
    await screen.findByText('Profile: Synthetic Person');

    await saveAndSync(server);

    const read = profiles.filter((profile) => profile !== null);
    expect(read.length).toBeGreaterThan(1);
    expect(new Set(read).size).toBe(1);
  });
});

describe('sameData', () => {
  it('is true for the same data read twice, false for any difference', () => {
    expect(sameData({ a: 1, b: ['x'] }, { a: 1, b: ['x'] })).toBe(true);
    expect(sameData(null, null)).toBe(true);
    expect(sameData({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameData(null, { a: 1 })).toBe(false);
  });
});
