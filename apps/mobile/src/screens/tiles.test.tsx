import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { describeRejected, rejectedText } from '../components/RejectedChanges';
import { DAY_VALUES } from '../dayValues';
import type { OutboxEntry } from '../local/store';
import { renderInApp } from '../testing/appHarness';
import { HomeScreen } from './HomeScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

// The Steps and Sleep tiles (REQ-HOME-006): typed in (Q-015), one value per day (Q-030), within the
// Q-028 ranges, stored as steps and minutes. The Weight tile's cases are in home.test.tsx.

beforeEach(() => {
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
});

async function log(label: 'Steps' | 'Sleep', text: string) {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${label}:`) }));
  await fireEvent.changeText(screen.getByLabelText(label === 'Steps' ? 'Steps' : 'Sleep in hours'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

describe('REQ-HOME-006 Steps and Sleep tiles', () => {
  it('REQ-HOME-006 show "+ Add", then the logged value, and sync it in steps and minutes', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    expect(await screen.findByRole('button', { name: 'Steps: + Add' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sleep: + Add' })).toBeOnTheScreen();

    await log('Steps', '8432');
    expect(await screen.findByRole('button', { name: 'Steps: 8,432 steps' })).toBeOnTheScreen();
    await log('Sleep', '7.5');
    expect(await screen.findByRole('button', { name: 'Sleep: 7.5 h' })).toBeOnTheScreen();

    await waitFor(() => expect(server.entries('steps').get('2026-10-28')).toMatchObject({ steps: 8_432 }));
    await waitFor(() => expect(server.entries('sleep').get('2026-10-28')).toMatchObject({ sleepMinutes: 450 }));
  });

  it('Q-030 a new value for the day replaces the old one', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await log('Steps', '1000');
    await screen.findByRole('button', { name: 'Steps: 1,000 steps' });

    await log('Steps', '2,500');

    expect(await screen.findByRole('button', { name: 'Steps: 2,500 steps' })).toBeOnTheScreen();
    await waitFor(() => expect(server.entries('steps').get('2026-10-28')).toMatchObject({ steps: 2_500 }));
  });

  it.each(['-1', '100001', '12.5', 'abc', ''])('Q-028 refuses steps "%s" and saves nothing', async (text) => {
    const { db } = await renderInApp(<HomeScreen />);

    await log('Steps', text);

    expect(await screen.findByText(DAY_VALUES.steps.rule)).toBeOnTheScreen();
    expect(await db.getFirstAsync('SELECT * FROM steps', [])).toBeNull();
  });

  it.each(['24.1', '7.25', '-1', 'x'])('Q-028 refuses sleep "%s" and saves nothing', async (text) => {
    const { db } = await renderInApp(<HomeScreen />);

    await log('Sleep', text);

    expect(await screen.findByText(DAY_VALUES.sleep.rule)).toBeOnTheScreen();
    expect(await db.getFirstAsync('SELECT * FROM sleep', [])).toBeNull();
  });

  it('Q-028 accepts the range ends: 0 and 100,000 steps; 0 and 24 h of sleep', async () => {
    await renderInApp(<HomeScreen />);

    await log('Steps', '0');
    expect(await screen.findByRole('button', { name: 'Steps: 0 steps' })).toBeOnTheScreen();
    await log('Steps', '100000');
    expect(await screen.findByRole('button', { name: 'Steps: 100,000 steps' })).toBeOnTheScreen();
    await log('Sleep', '0');
    expect(await screen.findByRole('button', { name: 'Sleep: 0.0 h' })).toBeOnTheScreen();
    await log('Sleep', '24');
    expect(await screen.findByRole('button', { name: 'Sleep: 24.0 h' })).toBeOnTheScreen();
  });

  it('REQ-DATE-001 a value logged on a past day gets that IST day', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Monday 26 Oct' }));

    await log('Sleep', '6.2');

    await waitFor(() => expect(server.entries('sleep').get('2026-10-26')).toMatchObject({ sleepMinutes: 372 }));
    expect(server.entries('sleep').has('2026-10-28')).toBe(false);
  });
});

describe('ADR-0007 rule 2 rejected changes of every kind', () => {
  it('ADR-0007 rule 2 rejected steps read "These steps weren\'t saved…", and Edit opens them to fix', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    server.state.rejectWith = 'DAY_IN_FUTURE';
    await log('Steps', '8432');

    expect(
      await screen.findByText("These steps weren't saved: the date is in the future. Edit or discard it."),
    ).toBeOnTheScreen();
    server.state.rejectWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Steps')).toHaveDisplayValue('8432');
    await fireEvent.changeText(screen.getByLabelText('Steps'), '8500');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByText(/weren't saved/)).toBeNull());
    await waitFor(() => expect(server.entries('steps').get('2026-10-28')).toMatchObject({ steps: 8_500 }));
  });

  it('ADR-0007 rule 2 rejected sleep reads "This sleep wasn\'t saved…", and Discard removes it', async () => {
    const { server } = await renderInApp(<HomeScreen />);
    server.state.rejectWith = 'VALIDATION_FAILED';
    await log('Sleep', '8');

    expect(await screen.findByText("This sleep wasn't saved: the value is not valid. Edit or discard it.")).toBeOnTheScreen();
    server.state.rejectWith = null;
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByText(/wasn't saved/)).toBeNull());
    expect(await screen.findByRole('button', { name: 'Sleep: + Add' })).toBeOnTheScreen();
  });

  it('D-23 a rejected target says so, and Edit opens Your targets', async () => {
    const { db } = await renderInApp(<HomeScreen />);
    await db.runAsync(
      `INSERT INTO outbox (change_id, type, data, created_at, status, error_code)
       VALUES ('c-target', 'target.set', ?, '2026-10-28T03:00:00.000Z', 'rejected', 'VALIDATION_FAILED')`,
      [JSON.stringify({ kind: 'calories', value: 2_000, setAt: '2026-10-28T03:00:00.000Z' })],
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Tuesday 27 Oct' }));

    expect(await screen.findByText('Daily calories · 2,000 kcal')).toBeOnTheScreen();
    expect(screen.getByText("This target wasn't saved: the value is not valid. Edit or discard it.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/targets');
  });

  it('D-23 each kind has its own subject', () => {
    const entry = (type: string, data: unknown): OutboxEntry => ({
      changeId: 'c',
      type,
      data,
      createdAt: '2026-10-28T03:00:00.000Z',
      attempts: 1,
      status: 'rejected',
      errorCode: 'DAY_IN_FUTURE',
    });

    expect(describeRejected(entry('weighIn.set', { day: '2026-10-28', weightGrams: 70_300 }))).toEqual({
      what: 'Wed 28 Oct · 70.3 kg',
      notSaved: "This weight wasn't saved",
    });
    expect(describeRejected(entry('measurements.set', { day: '2026-10-28', upperWaistMm: 812 })).notSaved).toBe(
      "These measurements weren't saved",
    );
    expect(rejectedText("These steps weren't saved", 'ROLE_NOT_ENABLED')).toBe(
      "These steps weren't saved: your account cannot log this. Edit or discard it.",
    );
  });
});
