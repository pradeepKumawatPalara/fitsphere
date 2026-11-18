import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../auth/AuthProvider';
import { weightRule } from '../format';
import { LocalDatabaseProvider } from '../local/LocalDatabaseProvider';
import type { SqlDb } from '../local/sql';
import { migrateLocal } from '../local/store';
import { SelectedDayProvider } from '../navigation/SelectedDayProvider';
import { SyncProvider } from '../sync/SyncProvider';
import { deps, fakeAuthClient, fakeSession } from '../testing/fakes';
import { fakeServer } from '../testing/fakeServer';
import { memoryDb } from '../testing/memoryDb';
import { HistoryScreen } from './HistoryScreen';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// Wednesday 28 October 2026, 09:00 IST. The week shown is Mon 26 Oct – Sun 1 Nov.
const NOW = new Date('2026-10-28T03:30:00Z');
const clock = () => NOW;
const noNetworkEvents = { watch: () => ({ remove: () => undefined }) };

let ids = 0;
function newId() {
  ids += 1;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`;
}

async function renderApp(screenElement: 'home' | 'history' = 'home') {
  const db: SqlDb = memoryDb();
  await migrateLocal(db);
  const server = fakeServer(NOW);
  const client = fakeAuthClient(fakeSession({ age_confirmed: true, age_confirmation_text_version: '2026-10-27' }));
  await render(
    <AuthProvider deps={deps(client, server.fetchImpl)}>
      <LocalDatabaseProvider owner="user-1" open={async () => ({ db, cipherVersion: '4.6.1' })}>
        <SyncProvider now={clock} newId={newId} network={noNetworkEvents}>
          <SelectedDayProvider now={clock}>
            {screenElement === 'home' ? <HomeScreen /> : <HistoryScreen now={clock} />}
          </SelectedDayProvider>
        </SyncProvider>
      </LocalDatabaseProvider>
    </AuthProvider>,
  );
  return { db, server };
}

async function logWeight(text: string) {
  await fireEvent.press(await screen.findByRole('button', { name: /^Weight:/ }));
  await fireEvent.changeText(screen.getByLabelText('Weight in kg'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

describe('REQ-HOME-006 Weight tile and entry sheet', () => {
  it('REQ-HOME-006 shows "+ Add" with no weight, then the logged value, and syncs it', async () => {
    const { server } = await renderApp();

    expect(await screen.findByRole('button', { name: 'Weight: + Add' })).toBeOnTheScreen();
    await logWeight('70.3');

    expect(await screen.findByRole('button', { name: 'Weight: 70.3 kg' })).toBeOnTheScreen();
    await waitFor(() => expect(server.weighIns.get('2026-10-28')?.weightGrams).toBe(70_300));
  });

  it('Q-030 a new value for the day replaces the old one', async () => {
    const { server } = await renderApp();
    await logWeight('70.0');
    await screen.findByRole('button', { name: 'Weight: 70.0 kg' });

    await logWeight('71.5');

    expect(await screen.findByRole('button', { name: 'Weight: 71.5 kg' })).toBeOnTheScreen();
    await waitFor(() => expect(server.weighIns.get('2026-10-28')?.weightGrams).toBe(71_500));
  });

  it.each(['19.9', '300.1', '70.25', 'abc'])('Q-028 refuses "%s" and saves nothing; D-99 the rule shows without Save, which waits', async (text) => {
    const { db } = await renderApp();

    await logWeight(text);

    expect(await screen.findByText(weightRule('kg'))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(await db.getFirstAsync('SELECT * FROM weigh_ins', [])).toBeNull();
  });

  it('Q-028 accepts the range ends 20.0 and 300.0 kg', async () => {
    await renderApp();

    await logWeight('20.0');
    expect(await screen.findByRole('button', { name: 'Weight: 20.0 kg' })).toBeOnTheScreen();
    await logWeight('300');
    expect(await screen.findByRole('button', { name: 'Weight: 300.0 kg' })).toBeOnTheScreen();
  });
});

describe('REQ-DATE-001…003 date strip and past-date banner', () => {
  it('REQ-DATE-003 highlights today in its week, Monday to Sunday; the days after today cannot be picked (Q-017, D-79)', async () => {
    await renderApp();

    expect(await screen.findByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Monday 26 Oct' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Thursday 29 Oct, not available' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sunday 1 Nov, not available' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Sunday 25 Oct/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Later days' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Thursday 29 Oct, not available' }));
    expect(screen.getByRole('button', { name: 'Wednesday 28 Oct, today' })).toBeSelected();
    expect(screen.queryByText(/^Showing/)).toBeNull();
  });

  it('REQ-DATE-002 a past day shows the banner; a weight logged there gets that IST day; "Back to today" returns', async () => {
    const { server } = await renderApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));

    expect(await screen.findByText('Showing Mon 26 Oct')).toBeOnTheScreen();
    await logWeight('69.9');
    await waitFor(() => expect(server.weighIns.get('2026-10-26')?.weightGrams).toBe(69_900));
    expect(server.weighIns.has('2026-10-28')).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.queryByText(/^Showing/)).toBeNull();
    expect(await screen.findByRole('button', { name: 'Weight: + Add' })).toBeOnTheScreen();
  });

  it('REQ-DATE-001 "Earlier days" shows the week before, Monday to Sunday, every day of it can be picked (D-79)', async () => {
    await renderApp();

    await fireEvent.press(await screen.findByRole('button', { name: 'Earlier days' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sunday 25 Oct' }));

    expect(await screen.findByText('Showing Sun 25 Oct')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Monday 19 Oct' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Sunday 18 Oct/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Later days' })).toBeEnabled();
  });
});

describe('ADR-0007 rule 2 rejected changes', () => {
  it('ADR-0007 rule 2 shows "…Edit or discard it." and Discard removes it', async () => {
    const { server } = await renderApp();
    server.state.rejectWith = 'DAY_IN_FUTURE';

    await logWeight('70.0');

    expect(
      await screen.findByText("This weight wasn't saved: the date is in the future. Edit or discard it."),
    ).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Weight: 70.0 kg' })).toBeOnTheScreen();

    server.state.rejectWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByText(/wasn't saved/)).toBeNull());
    expect(await screen.findByRole('button', { name: 'Weight: + Add' })).toBeOnTheScreen();
  });

  it('ADR-0007 rule 2 Edit saves a new value, which replaces the rejected one', async () => {
    const { server } = await renderApp();
    server.state.rejectWith = 'VALIDATION_FAILED';
    await logWeight('70.0');
    await screen.findByText(/wasn't saved/);
    server.state.rejectWith = null;

    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.changeText(screen.getByLabelText('Weight in kg'), '70.4');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByText(/wasn't saved/)).toBeNull());
    await waitFor(() => expect(server.weighIns.get('2026-10-28')?.weightGrams).toBe(70_400));
  });
});

// D-116 (the owner's A, 2026-11-18): Weight history by dates, as Progress's measurements (D-114): the
// last 90 days, the phone's (Fri 31 Jul to Wed 28 Oct), at first; a year or Pick dates read older ones.
describe('REQ-PRG-001 history by dates (D-116)', () => {
  const rowNames = () => screen.getAllByLabelText(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}( \d{4})?: /).map((row) => row.props.accessibilityLabel);

  it('opens on the last 90 days, the phone’s, with the date choices and no Load older', async () => {
    const { server } = await renderApp('history');

    expect(await screen.findByText('No weigh-ins in the last 90 days.')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio').map((choice) => choice.props.accessibilityLabel).slice(0, 4)).toEqual(['Pick dates', 'Last 90 days', '2026', '2025']);
    expect(screen.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Load older' })).toBeNull();
    expect(server.state.weighInQueries).toEqual([]);
  });

  it('a year lists its weigh-ins read online, newest first with their year, under a count line', async () => {
    const { server } = await renderApp('history');
    server.state.older = [
      { day: '2025-06-01', weightGrams: 72_000 },
      { day: '2025-12-28', weightGrams: 71_500 },
    ];

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('2 weigh-ins · Wed 1 Jan 2025 – Wed 31 Dec 2025')).toBeOnTheScreen();
    expect(rowNames()).toEqual(['Sun 28 Dec 2025: 71.5 kg', 'Sun 1 Jun 2025: 72.0 kg']);
    expect(server.calls.find((call) => call.path.endsWith('/weigh-ins'))?.path).toBe(`/users/${'0f8e5a1c-9b7d-4c1e-8a2b-3c4d5e6f7a8b'}/weigh-ins`);
    expect(server.state.weighInQueries).toEqual([{ from: '2025-01-01', to: '2025-12-31', cursor: null }]);
  });

  it('a year with none says so, its days written as everywhere else', async () => {
    await renderApp('history');

    await fireEvent.press(await screen.findByRole('radio', { name: '2023' }));

    expect(await screen.findByText('No weigh-ins from Sun 1 Jan 2023 to Sun 31 Dec 2023.')).toBeOnTheScreen();
  });

  it('ADR-0007 rule 6 offline, says older weigh-ins need the internet; Try again loads them once online', async () => {
    const { server } = await renderApp('history');
    server.state.older = [{ day: '2025-06-01', weightGrams: 72_000 }];
    server.state.offline = true;

    await fireEvent.press(await screen.findByRole('radio', { name: '2025' }));

    expect(await screen.findByText('Weigh-ins older than 90 days need an internet connection.')).toBeOnTheScreen();
    server.state.offline = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 weigh-in · Wed 1 Jan 2025 – Wed 31 Dec 2025')).toBeOnTheScreen();
  });
});
