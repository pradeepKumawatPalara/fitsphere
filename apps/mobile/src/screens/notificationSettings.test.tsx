import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PushPortProvider } from '../components/PushControl';
import { getReminderSettings } from '../local/notificationStore';
import type { SqlDb } from '../local/sql';
import type { PushPort } from '../notificationPush';
import { NOW, renderInApp } from '../testing/appHarness';
import { NotificationSettingsScreen } from './NotificationSettingsScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('../notificationPortExpo', () => ({ expoPort: {}, notifications: () => Promise.reject(new Error('no module')) }));

// The push card's phone: allowed, so the card settles at once and nothing is left pending in the tests.
const phone: PushPort = {
  permission: async () => ({ state: 'granted', canAskAgain: true }),
  requestPermission: async () => 'granted',
  createChannels: async () => undefined,
  schedule: async () => undefined,
  present: async () => undefined,
  cancelAll: async () => undefined,
  openSettings: async () => undefined,
};

// Notifications in Settings (ADR-0014; REQ-NOT-002, REQ-NOT-005): each reminder off until turned on, with
// its time, saved on the phone as it changes. Synthetic data only. The tests read what the screen shows;
// only the last reads what was saved.

async function open() {
  let database!: SqlDb;
  await renderInApp(
    <PushPortProvider port={phone}>
      <NotificationSettingsScreen now={() => NOW} />
    </PushPortProvider>,
    () => NOW,
    async (db) => {
    database = db;
    },
  );
  await screen.findByLabelText('Lunch', {}, { timeout: 5000 });
  return () => database;
}

const checked = (label: string) => Boolean(screen.getByLabelText(label).props.accessibilityState?.checked);

describe('the notification settings', () => {
  it('has every reminder off, with no time shown', async () => {
    await open();

    expect(screen.getByLabelText('Lunch').props.value).toBe(false);
    expect(screen.queryByLabelText('Lunch: later')).toBeNull();
  });

  it('chooses the workout days, from Monday, Wednesday and Friday', async () => {
    await open();

    await fireEvent(screen.getByLabelText('Workout reminder'), 'valueChange', true);
    expect(await screen.findByLabelText('Monday')).toBeTruthy();
    expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(checked)).toEqual([true, false, true, false, true]);
    await fireEvent.press(screen.getByLabelText('Tuesday'));
    await fireEvent.press(screen.getByLabelText('Monday'));

    expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(checked)).toEqual([false, true, true, false, true]);
  });

  it('turning one off keeps its time for next time', async () => {
    await open();
    await fireEvent(screen.getByLabelText('Dinner'), 'valueChange', true);
    await fireEvent.press(await screen.findByLabelText('Dinner: earlier'));
    expect(screen.getByLabelText('Dinner time: 7:30 pm')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Dinner'), 'valueChange', false);
    expect(screen.queryByLabelText('Dinner time: 7:30 pm')).toBeNull();
    await fireEvent(screen.getByLabelText('Dinner'), 'valueChange', true);

    expect(await screen.findByLabelText('Dinner time: 7:30 pm')).toBeTruthy();
  });

  it('saves what is chosen on the phone', async () => {
    const db = await open();

    await fireEvent(screen.getByLabelText('Lunch'), 'valueChange', true);
    expect(await screen.findByLabelText('Lunch time: 1:00 pm')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Lunch: later'));

    expect(await screen.findByLabelText('Lunch time: 1:30 pm')).toBeTruthy();
    await waitFor(async () => expect((await getReminderSettings(db())).meals.lunch).toEqual({ enabled: true, time: '13:30' }));
    expect((await getReminderSettings(db())).meals.lunch).toEqual({ enabled: true, time: '13:30' });
  });

  it('goals and the nudge: off at first, saved when chosen, the nudge days kept between 2 and 7', async () => {
    const db = await open();
    expect(screen.getByLabelText('Daily target reached').props.accessibilityState.checked).toBe(false);

    await fireEvent(screen.getByLabelText('Daily target reached'), 'valueChange', true);
    await fireEvent(screen.getByLabelText('Inactivity nudge'), 'valueChange', true);
    expect(await screen.findByLabelText('Nudge after 3 days')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Nudge after: more days'));

    expect(await screen.findByLabelText('Nudge after 4 days')).toBeTruthy();
    await waitFor(async () => expect((await getReminderSettings(db())).nudge.afterDays).toBe(4));
    expect((await getReminderSettings(db())).goals.dailyTarget).toBe(true);
  });
});
