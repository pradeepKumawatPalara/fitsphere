import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { useNotificationsVersion } from '../local/notificationStore';
import { expoPort, notifications } from '../notificationPortExpo';
import { syncReminders } from '../notificationSync';
import { useDataVersion, useSync } from '../sync/SyncProvider';

// The reminders' runs, one after another.
let queue: Promise<void> = Promise.resolve();

// What the phone's notifications need while the app runs (ADR-0014): the reminders kept in step with the
// user's choices and logs (notificationSync.ts), a notification that arrives with the app open shown, and a
// tap on one opening the screen it names (its `route`), also when the tap started the app. Shows nothing.
// A build without the native module (an older development build) fails quietly here and the rest of the
// app is untouched.

export function NotificationsRuntime() {
  const router = useRouter();
  const local = useLocalDatabase();
  const { newId } = useSync();
  // What the reminders depend on: the phone's data (a meal, a workout, a measurement) and the user's choices.
  const dataVersion = useDataVersion();
  const choicesVersion = useNotificationsVersion();
  // The app coming back to the front counts as a change: reminders are made again when it does.
  const [opened, setOpened] = useState(0);
  const db = local.state.status === 'ready' ? local.state.db : null;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOpened((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  // No signed-in user's database (signed out, or not open yet): nothing of theirs may fire, so the
  // schedule is cleared; it is made again once their database opens. Failing here (no module) changes nothing.
  useEffect(() => {
    if (!db) queue = queue.then(() => expoPort.cancelAll()).catch(() => undefined);
  }, [db]);

  useEffect(() => {
    if (!db) return;
    // One at a time: two rebuilds side by side could schedule a reminder twice. A failure here (a build
    // with no notification module) leaves the app as it was.
    queue = queue.then(() => syncReminders(db, expoPort, new Date(), newId)).catch(() => undefined);
  }, [db, newId, dataVersion, choicesVersion, opened]);

  useEffect(() => {
    let stopped = false;
    const subscriptions: { remove(): void }[] = [];
    const open = (data: unknown) => {
      const route = (data as { route?: unknown } | null)?.route;
      if (typeof route === 'string' && route.startsWith('/')) router.push(route as never);
    };
    void notifications()
      .then(async (N) => {
        if (stopped) return;
        N.setNotificationHandler({
          handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
        });
        subscriptions.push(N.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data)));
        const started = await N.getLastNotificationResponseAsync();
        if (!stopped && started) open(started.notification.request.content.data);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [router]);
  return null;
}
