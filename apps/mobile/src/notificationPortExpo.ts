import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';
import type { PermissionState, PushPort } from './notificationPush';

// The real port (notificationPush.ts) on expo-notifications. The module is loaded when first used, not
// when the app starts, so a build without it (an older development build) fails here only, quietly,
// and the rest of the app is untouched.

type Notifications = typeof import('expo-notifications');
let loaded: Promise<Notifications> | null = null;
export function notifications(): Promise<Notifications> {
  // An older development build has no native part: importing the package would throw at once, and the
  // development screen shows that as a red error on Home. Checked first, it fails quietly here instead.
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return Promise.reject(new Error('Notifications are not in this build'));
  loaded ??= import('expo-notifications');
  return loaded;
}

function stateOf(status: string): PermissionState {
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

const CHANNELS = [
  { id: 'reminders', name: 'Reminders' },
  { id: 'goals', name: 'Goals' },
  { id: 'nudges', name: 'Nudges' },
] as const;

export const expoPort: PushPort = {
  async permission() {
    const N = await notifications();
    const result = await N.getPermissionsAsync();
    return { state: stateOf(result.status), canAskAgain: result.canAskAgain };
  },
  async requestPermission() {
    const N = await notifications();
    return stateOf((await N.requestPermissionsAsync()).status);
  },
  async createChannels() {
    if (Platform.OS !== 'android') return;
    const N = await notifications();
    for (const channel of CHANNELS) {
      await N.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: N.AndroidImportance.DEFAULT,
      });
    }
  },
  async schedule(request) {
    const N = await notifications();
    await N.scheduleNotificationAsync({
      content: { title: 'FitSphere', body: request.body, data: { route: request.route } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: request.at, channelId: request.channel },
    });
  },
  async present(request) {
    const N = await notifications();
    await N.scheduleNotificationAsync({
      content: { title: 'FitSphere', body: request.body, data: { route: request.route, keep: true } },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: request.channel },
    });
  },
  async cancelAll() {
    const N = await notifications();
    // One shown now is not part of the schedule, so a rebuild must not cancel it.
    for (const pending of await N.getAllScheduledNotificationsAsync()) {
      if (pending.content.data?.keep !== true) await N.cancelScheduledNotificationAsync(pending.identifier);
    }
  },
  async openSettings() {
    await Linking.openSettings();
  },
};
