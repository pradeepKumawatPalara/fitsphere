import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PushControl, PushPortProvider } from '../components/PushControl';
import type { PermissionState, PushPort } from '../notificationPush';
import type { ScheduleRequest } from '../notificationSchedule';
import { NOW, renderInApp } from '../testing/appHarness';

// The card that turns push on (ADR-0014; REQ-NOT-005, REQ-NOT-006). A fake phone; nothing is sent.

function fakePhone(initial: PermissionState, afterPrompt: PermissionState = 'granted') {
  let state = initial;
  const calls = { prompts: 0, scheduled: [] as ScheduleRequest[], settings: 0, cancelled: 0 };
  const port: PushPort = {
    permission: async () => ({ state, canAskAgain: state !== 'denied' }),
    requestPermission: async () => {
      calls.prompts += 1;
      state = afterPrompt;
      return state;
    },
    createChannels: async () => undefined,
    present: async () => undefined,
    schedule: async (request) => {
      calls.scheduled.push(request);
    },
    cancelAll: async () => {
      calls.cancelled += 1;
    },
    openSettings: async () => {
      calls.settings += 1;
    },
  };
  return { port, calls };
}

const renderCard = (port: PushPort) =>
  renderInApp(
    <PushPortProvider port={port}>
      <PushControl now={() => NOW} />
    </PushPortProvider>,
  );

describe('the push card', () => {
  it('asks the phone only when Turn on is pressed, then offers a test', async () => {
    const phone = fakePhone('undetermined');
    await renderCard(phone.port);

    expect(await screen.findByText('Get reminders')).toBeTruthy();
    expect(phone.calls.prompts).toBe(0);

    await fireEvent.press(screen.getByLabelText('Turn on'));

    expect(await screen.findByText('Notifications are on')).toBeTruthy();
    expect(phone.calls.prompts).toBe(1);
    await fireEvent.press(screen.getByLabelText('Send a test notification'));
    await waitFor(() => expect(phone.calls.scheduled).toHaveLength(1));
    expect(phone.calls.scheduled[0]).toMatchObject({ route: '/notifications' });
  });

  it('says when the phone refuses, and opens the phone settings', async () => {
    const phone = fakePhone('denied');
    await renderCard(phone.port);

    expect(await screen.findByText('Notifications are off on your phone')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Open phone settings'));

    expect(phone.calls.settings).toBe(1);
  });

  it('turns off and cancels what was scheduled', async () => {
    const phone = fakePhone('granted');
    await renderCard(phone.port);
    await fireEvent.press(await screen.findByLabelText('Turn on'));
    await fireEvent.press(await screen.findByLabelText('Turn off'));

    expect(await screen.findByText('Get reminders')).toBeTruthy();
    expect(phone.calls.cancelled).toBe(1);
  });

  it('shows nothing where the phone has no notification module', async () => {
    const port: PushPort = { ...fakePhone('granted').port, permission: () => Promise.reject(new Error('no module')) };
    await renderCard(port);

    await waitFor(() => expect(screen.queryByText('Get reminders')).toBeNull());
  });
});
