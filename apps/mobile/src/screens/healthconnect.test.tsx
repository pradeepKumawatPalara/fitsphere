import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HealthSyncProvider } from '../health/HealthSyncProvider';
import type { DaySteps, HealthAvailability, WeightReading } from '../health/types';
import { countImported, getEntry, getMeta, pendingChanges, saveEntry, setMeta } from '../local/store';
import { NOW, renderInApp } from '../testing/appHarness';
import { ConnectionsScreen } from './ConnectionsScreen';
import { HealthGuideScreen } from './HealthGuideScreen';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), usePreventRemove: () => () => undefined }));

// A fake of the phone's health store (health/healthSource.ts): the test says what it holds.
const mockHealth = {
  availability: 'available' as HealthAvailability,
  access: false,
  grantOnAsk: true,
  steps: [] as DaySteps[],
  weights: [] as WeightReading[],
  failReads: false,
  asked: 0,
  installOpened: 0,
  availabilityCalls: 0,
};
jest.mock('../health/healthSource', () => ({
  healthSource: () => ({
    availability: async () => {
      mockHealth.availabilityCalls += 1;
      return mockHealth.availability;
    },
    hasAccess: async () => mockHealth.access,
    requestAccess: async () => {
      mockHealth.asked += 1;
      mockHealth.access = mockHealth.grantOnAsk;
      return mockHealth.grantOnAsk;
    },
    readSteps: async () => {
      if (mockHealth.failReads) throw new Error('store is busy');
      return mockHealth.steps;
    },
    readWeights: async () => {
      if (mockHealth.failReads) throw new Error('store is busy');
      return mockHealth.weights;
    },
    openInstall: () => {
      mockHealth.installOpened += 1;
    },
  }),
}));

// D-121 (REQ-ACC-012, ADR-0013, docs/plans/health-connect.md): Settings â€º Connections, Health Connect
// read into steps and weight, end to end on a fake store. Synthetic values only.

const TODAY = '2026-10-28';
const YESTERDAY = '2026-10-27';
const clock = () => NOW;
const AT = '2026-10-28T02:00:00.000Z';

beforeEach(() => {
  Object.assign(mockHealth, {
    availability: 'available',
    access: false,
    grantOnAsk: true,
    steps: [],
    weights: [],
    failReads: false,
    asked: 0,
    installOpened: 0,
    availabilityCalls: 0,
  });
  mockRouter.push.mockClear();
});

async function renderConnections(before?: Parameters<typeof renderInApp>[2]) {
  return renderInApp(
    <HealthSyncProvider now={clock}>
      <ConnectionsScreen now={clock} />
    </HealthSyncProvider>,
    clock,
    before,
  );
}

const typedSteps = (db: Parameters<typeof saveEntry>[0], day: string, steps: number) =>
  saveEntry(db, 'steps', { changeId: `00000000-0000-4000-8000-${String(steps).padStart(12, '0')}`, data: { day, steps, recordedAt: AT } });

describe('D-121 what the row says', () => {
  it('a phone that cannot have Health Connect says so and offers nothing', async () => {
    mockHealth.availability = 'not_supported';

    await renderConnections();

    expect(await screen.findByText('Not available on this phone.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('with Health Connect missing, Get Health Connect opens where to get it', async () => {
    mockHealth.availability = 'needs_install';
    await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Get Health Connect' }));

    expect(mockHealth.installOpened).toBe(1);
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('with it available and not connected, the row says Not connected and what is read', async () => {
    await renderConnections();

    expect(await screen.findByText('Not connected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(screen.getByText(/only reads/)).toBeTruthy();
  });
});

describe('D-121 the provider without a clock of its own (as the app mounts it)', () => {
  it('asks the store a few times at most, not again and again (a read loop drained the phone, 2026-11-23)', async () => {
    mockHealth.access = true;
    mockHealth.steps = [{ day: TODAY, steps: 3_300 }];

    // No `now` prop: the app's own clock, a default that once changed on every render.
    await renderInApp(
      <HealthSyncProvider>
        <ConnectionsScreen />
      </HealthSyncProvider>,
      clock,
      async (database) => {
        await setMeta(database, 'health_connect_connected_at', '2026-10-27T05:00:00.000Z');
      },
    );
    await screen.findByText(/Read just now/);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(mockHealth.availabilityCalls).toBeLessThanOrEqual(3);
  });
});

describe('D-121 Connect', () => {
  it('asks Android once, reads the last days and saves them tagged Health Connect, like typed ones', async () => {
    mockHealth.steps = [
      { day: YESTERDAY, steps: 5_400 },
      { day: TODAY, steps: 2_100 },
    ];
    mockHealth.weights = [{ at: '2026-10-27T01:30:00.000Z', grams: 70_250 }];
    const { db, server } = await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Read just now: 2 days of steps, 1 weigh-in')).toBeTruthy();
    expect(mockHealth.asked).toBe(1);
    expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 2_100, source: 'health_connect' });
    expect(await getEntry(db, 'weighIn', YESTERDAY)).toMatchObject({ weightGrams: 70_250, source: 'health_connect' });
    // They sync like typed values, and the server is told where they came from.
    await waitFor(() => expect([...server.entries('steps').values()].map((item) => item.source)).toEqual(['health_connect', 'health_connect']));
    expect([...server.entries('weighIns').values()].map((item) => item.source)).toEqual(['health_connect']);
    await waitFor(async () => expect(await pendingChanges(db, 10)).toEqual([]));
    expect(await getMeta(db, 'health_connect_connected_at')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('when the user says no on Android\'s screen, nothing is connected or read', async () => {
    mockHealth.grantOnAsk = false;
    mockHealth.steps = [{ day: TODAY, steps: 2_100 }];
    const { db } = await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Allow steps and weight in Health Connect to connect.')).toBeTruthy();
    expect(await getMeta(db, 'health_connect_connected_at')).toBeNull();
    expect(await getEntry(db, 'steps', TODAY)).toBeNull();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('a value the user typed is never changed by a read, and the same read twice changes nothing more', async () => {
    mockHealth.steps = [
      { day: YESTERDAY, steps: 9_999 },
      { day: TODAY, steps: 2_100 },
    ];
    const { db } = await renderConnections(async (database) => {
      await typedSteps(database, YESTERDAY, 4_000);
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));
    await screen.findByText(/Read just now/);
    const afterFirst = await pendingChanges(db, 20);
    await fireEvent.press(screen.getByRole('button', { name: 'Read now' }));
    await waitFor(async () => expect((await getMeta(db, 'health_connect_read_at')) !== null).toBe(true));

    expect(await getEntry(db, 'steps', YESTERDAY)).toMatchObject({ steps: 4_000, source: 'manual' });
    expect((await pendingChanges(db, 20)).length).toBe(afterFirst.length);
  });

  it('a later read updates an earlier import (steps grow through the day)', async () => {
    mockHealth.steps = [{ day: TODAY, steps: 2_100 }];
    const { db } = await renderConnections();
    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));
    await screen.findByText(/Read just now/);

    mockHealth.steps = [{ day: TODAY, steps: 6_300 }];
    await fireEvent.press(screen.getByRole('button', { name: 'Read now' }));

    await waitFor(async () => expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 6_300, source: 'health_connect' }));
  });

  it('skips, never clips, a day over 200,000 steps, with none, or in the future; and a weight outside 20 to 300 kg', async () => {
    mockHealth.steps = [
      { day: YESTERDAY, steps: 200_001 },
      { day: TODAY, steps: 0 },
      { day: '2026-10-29', steps: 500 },
    ];
    mockHealth.weights = [
      { at: '2026-10-27T01:30:00.000Z', grams: 19_999 },
      { at: '2026-10-28T01:30:00.000Z', grams: 300_001 },
    ];
    const { db } = await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));

    await screen.findByText('Read just now: 0 days of steps, 0 weigh-ins');
    expect(await pendingChanges(db, 10)).toEqual([]);
  });

  it('several weigh-ins in a day: the latest of the day, by India time', async () => {
    // 18:40 UTC on 27 Oct is 00:10 on 28 Oct in India: the second reading is on the 28th.
    mockHealth.weights = [
      { at: '2026-10-27T03:00:00.000Z', grams: 71_000 },
      { at: '2026-10-27T18:40:00.000Z', grams: 70_400 },
      { at: '2026-10-28T02:30:00.000Z', grams: 70_300 },
    ];
    const { db } = await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));

    await screen.findByText(/Read just now/);
    expect(await getEntry(db, 'weighIn', YESTERDAY)).toMatchObject({ weightGrams: 71_000 });
    expect(await getEntry(db, 'weighIn', TODAY)).toMatchObject({ weightGrams: 70_300 });
  });

  it('a store that fails keeps the old values and says so; the user can try again', async () => {
    mockHealth.steps = [{ day: TODAY, steps: 2_100 }];
    const { db } = await renderConnections();
    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));
    await screen.findByText(/Read just now/);

    mockHealth.failReads = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Read now' }));

    expect(await screen.findByText("Couldn't read. Try again.")).toBeTruthy();
    expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 2_100 });
  });
});

describe('D-121 when the app opens', () => {
  it('a connected phone reads on its own; no tap needed', async () => {
    mockHealth.access = true;
    mockHealth.steps = [{ day: TODAY, steps: 3_300 }];

    const { db } = await renderConnections(async (database) => {
      await setMeta(database, 'health_connect_connected_at', '2026-10-27T05:00:00.000Z');
    });

    await waitFor(async () => expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 3_300, source: 'health_connect' }));
  });

  it('access withdrawn in Android shows as Not connected and says why; what was read stays', async () => {
    mockHealth.access = false;
    const { db } = await renderConnections(async (database) => {
      await setMeta(database, 'health_connect_connected_at', '2026-10-27T05:00:00.000Z');
      await saveEntry(database, 'steps', {
        changeId: '00000000-0000-4000-8000-000000000321',
        data: { day: YESTERDAY, steps: 1_000, recordedAt: AT, source: 'health_connect' },
      });
    });

    expect(await screen.findByText('Access was withdrawn in Android. Connect again to read.')).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(await getMeta(db, 'health_connect_connected_at')).toBeNull();
    expect(await getEntry(db, 'steps', YESTERDAY)).toMatchObject({ steps: 1_000 });
  });
});

describe('D-121 Disconnect', () => {
  async function connectedWithValues() {
    mockHealth.steps = [{ day: YESTERDAY, steps: 5_400 }];
    mockHealth.weights = [{ at: '2026-10-28T01:30:00.000Z', grams: 70_250 }];
    const rendered = await renderConnections(async (database) => {
      await typedSteps(database, TODAY, 7_000);
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));
    await screen.findByText(/Read just now/);
    return rendered;
  }

  it('Keep: reading stops at once and the values stay', async () => {
    const { db } = await connectedWithValues();

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText(/1 day of steps and 1 weigh-in came from Health Connect/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep them' }));

    expect(await screen.findByText('Not connected')).toBeTruthy();
    expect(await getMeta(db, 'health_connect_connected_at')).toBeNull();
    expect(await countImported(db)).toEqual({ steps: 1, weights: 1 });
  });

  it('Remove: the imported values go from the phone and the server is told; typed values stay', async () => {
    const { db, server } = await connectedWithValues();
    await waitFor(async () => expect(await pendingChanges(db, 20)).toEqual([]));

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove them' }));

    expect(await screen.findByText('Not connected')).toBeTruthy();
    await waitFor(async () => expect(await countImported(db)).toEqual({ steps: 0, weights: 0 }));
    expect(await getEntry(db, 'steps', YESTERDAY)).toBeNull();
    expect(await getEntry(db, 'weighIn', TODAY)).toBeNull();
    expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 7_000, source: 'manual' });
    // The server deleted its copies too, and kept the typed day; nothing is left waiting to be sent.
    await waitFor(() => expect([...server.entries('steps').values()].map((item) => item.day)).toEqual([TODAY]));
    expect([...server.entries('weighIns').values()]).toEqual([]);
    await waitFor(async () => expect(await pendingChanges(db, 20)).toEqual([]));
  });

  it('Cancel changes nothing', async () => {
    const { db } = await connectedWithValues();

    await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await getMeta(db, 'health_connect_connected_at')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('with nothing read, Disconnect asks nothing', async () => {
    mockHealth.access = true;
    const { db } = await renderConnections(async (database) => {
      await setMeta(database, 'health_connect_connected_at', '2026-10-27T05:00:00.000Z');
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Not connected')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep them' })).toBeNull();
    expect(await getMeta(db, 'health_connect_connected_at')).toBeNull();
  });
});

describe('D-121 Settings and Home', () => {
  it('Home tags a value read from Health Connect, and not one the user typed', async () => {
    await renderInApp(<HomeScreen />, clock, async (db) => {
      await saveEntry(db, 'steps', {
        changeId: '00000000-0000-4000-8000-000000000555',
        data: { day: TODAY, steps: 6_000, recordedAt: AT, source: 'health_connect' },
      });
      await saveEntry(db, 'weighIn', {
        changeId: '00000000-0000-4000-8000-000000000556',
        data: { day: TODAY, weightGrams: 70_000, recordedAt: AT },
      });
    });

    expect(await screen.findByRole('button', { name: /^Steps: .*from Health Connect$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Weight: [^,]*$/ })).toBeTruthy();
    expect(screen.getAllByText('Health Connect')).toHaveLength(1);
  });
});

describe('D-121 the 20-minute refresh, the reads card and the guide (docs/plans/health-connect-sleep.md)', () => {
  it('reads again every 20 minutes while connected, and stops when disconnected', async () => {
    mockHealth.steps = [{ day: TODAY, steps: 2_100 }];
    const timers = jest.spyOn(globalThis, 'setInterval');
    const cleared = jest.spyOn(globalThis, 'clearInterval');
    try {
      const { db } = await renderConnections();
      await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));
      await screen.findByText(/Read just now/);

      const refresh = timers.mock.calls.find((call) => call[1] === 20 * 60 * 1000);
      expect(refresh).toBeTruthy();
      mockHealth.steps = [{ day: TODAY, steps: 7_000 }];
      await act(async () => {
        (refresh![0] as () => void)();
      });
      await waitFor(async () => expect(await getEntry(db, 'steps', TODAY)).toMatchObject({ steps: 7_000 }));

      const clearedBefore = cleared.mock.calls.length;
      await fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Keep them' }));
      await waitFor(() => expect(cleared.mock.calls.length).toBeGreaterThan(clearedBefore));
    } finally {
      timers.mockRestore();
      cleared.mockRestore();
    }
  });

  it('connected, says when it last updated and shows today\'s steps and weight', async () => {
    mockHealth.steps = [{ day: TODAY, steps: 3_300 }];
    await renderConnections();

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Updates about every 20 minutes')).toBeTruthy();
    expect(screen.getByText(/^Last updated /)).toBeTruthy();
    expect(screen.getByText('What FitSphere reads')).toBeTruthy();
    expect(await screen.findByLabelText('Steps, Today: 3,300')).toBeTruthy();
    expect(screen.getByLabelText('Weight, Today: None yet')).toBeTruthy();
  });

  it('not connected, lists what to do first, and How to connect opens the guide', async () => {
    await renderConnections();

    expect(await screen.findByText('Before you connect')).toBeTruthy();
    expect(screen.getByText('Install Health Connect.')).toBeTruthy();
    expect(screen.queryByText('What FitSphere reads')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'How to connect' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/health-guide');
  });

  it('the guide gives the four steps and goes back to Connections', async () => {
    await renderInApp(
      <HealthSyncProvider now={clock}>
        <HealthGuideScreen />
      </HealthSyncProvider>,
      clock,
    );

    expect(await screen.findByText('Install Health Connect')).toBeTruthy();
    expect(screen.getByText('Open Health Connect')).toBeTruthy();
    expect(screen.getByText('Connect your other apps to it')).toBeTruthy();
    expect(screen.getByLabelText('Profile, then Connections, then Health Connect')).toBeTruthy();
    expect(screen.getByText(/about every 20 minutes/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Go to Connections' }));

    expect(mockRouter.back).toHaveBeenCalled();
  });
});
