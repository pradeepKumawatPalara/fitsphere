import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { addNotification, listNotifications, unreadCount } from '../local/notificationStore';
import type { SqlDb } from '../local/sql';
import { newNotification } from '../notifications';
import { NOW, renderInApp } from '../testing/appHarness';
import { NotificationsScreen } from './NotificationsScreen';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));

// The notification list (ADR-0014; design D): a card for each, a cross to dismiss it, a button that
// opens what it is about. Synthetic data only.

const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const AT = new Date(NOW.getTime() - 5 * 60_000);

async function seed(db: SqlDb) {
  await addNotification(db, newNotification('meal_dinner', id(1), AT));
  await addNotification(db, newNotification('target_reached', id(2), new Date(NOW.getTime() - 60 * 60_000)));
}

// The list shows the push card; here the phone has no notification module, so it stays out of the way.
jest.mock('../notificationPortExpo', () => ({
  expoPort: { permission: () => Promise.reject(new Error('no module')) },
  notifications: () => Promise.reject(new Error('no module')),
}));

beforeEach(() => mockRouter.push.mockClear());

describe('the notification list screen', () => {
  it('shows a card for each notification with its button', async () => {
    await renderInApp(<NotificationsScreen now={() => NOW} />, () => NOW, seed);

    expect(await screen.findByText('Time to log dinner.')).toBeTruthy();
    expect(screen.getByText("You reached today's target.")).toBeTruthy();
    expect(screen.getByLabelText('Log dinner')).toBeTruthy();
    expect(screen.getByLabelText("See today's nutrition")).toBeTruthy();
    expect(screen.getByText('New · 5 min ago')).toBeTruthy();
  });

  it("a card's button marks it read and opens its screen", async () => {
    let database!: SqlDb;
    await renderInApp(<NotificationsScreen now={() => NOW} />, () => NOW, async (db) => {
      database = db;
      await seed(db);
    });

    await fireEvent.press(await screen.findByLabelText('Log dinner'));

    expect(mockRouter.push).toHaveBeenCalledWith('/log-meal?slot=dinner');
    expect(await unreadCount(database)).toBe(1);
  });

  it('the cross dismisses a notification', async () => {
    let database!: SqlDb;
    await renderInApp(<NotificationsScreen now={() => NOW} />, () => NOW, async (db) => {
      database = db;
      await seed(db);
    });

    await fireEvent.press(await screen.findByLabelText('Dismiss: Time to log dinner.'));

    await waitFor(() => expect(screen.queryByText('Time to log dinner.')).toBeNull());
    expect(screen.getByText("You reached today's target.")).toBeTruthy();
    expect((await listNotifications(database)).map((row) => row.kind)).toEqual(['target_reached']);
  });

  it('a filter shows one category, and "Mark all read" clears the unread', async () => {
    let database!: SqlDb;
    await renderInApp(<NotificationsScreen now={() => NOW} />, () => NOW, async (db) => {
      database = db;
      await seed(db);
    });

    await fireEvent.press(await screen.findByLabelText('Goals'));
    await waitFor(() => expect(screen.queryByText('Time to log dinner.')).toBeNull());
    expect(screen.getByText("You reached today's target.")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('All'));
    await fireEvent.press(await screen.findByLabelText('Mark all read'));
    await waitFor(async () => expect(await unreadCount(database)).toBe(0));
    expect(await screen.findByText('5 min ago')).toBeTruthy();
  });

  it('says so when there are none', async () => {
    await renderInApp(<NotificationsScreen now={() => NOW} />);

    expect(await screen.findByText('No notifications.')).toBeTruthy();
  });
});
