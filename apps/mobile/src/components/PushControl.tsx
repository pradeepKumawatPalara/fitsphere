import { BellRing } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { isEnabled, sendTest, turnOff, turnOn, type PermissionState, type PushPort } from '../notificationPush';
import { expoPort } from '../notificationPortExpo';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text, TextButton } from './ui';

// The phone's push, as the user sees it (ADR-0014): one card on the notification list that turns
// notifications on (asking the phone's permission then, never at start), says when the phone refuses
// and opens its settings, and sends a test. The Settings screen will use the same card.

const PushPortContext = createContext<PushPort>(expoPort);
/** Tests give the card a fake phone. */
export function PushPortProvider({ port, children }: { port: PushPort; children: ReactNode }) {
  return <PushPortContext.Provider value={port}>{children}</PushPortContext.Provider>;
}

type Status = { enabled: boolean; permission: PermissionState } | 'unavailable' | null;

export function PushControl({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const port = useContext(PushPortContext);
  const local = useLocalDatabase();
  const db = local.state.status === 'ready' ? local.state.db : null;
  const [status, setStatus] = useState<Status>(null);
  const [sent, setSent] = useState(false);

  // Counts the changes made here, so the card reads the switch and the phone's permission again.
  const [reads, setReads] = useState(0);
  const refresh = useCallback(() => setReads((count) => count + 1), []);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void Promise.all([isEnabled(db), port.permission()])
      .then(([enabled, { state }]) => {
        if (active) setStatus({ enabled, permission: state });
      })
      .catch(() => {
        // A build made before notifications existed has no native module; the list works without it.
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [db, port, reads]);

  if (status === null || status === 'unavailable') return null;

  const on = status.enabled && status.permission === 'granted';
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.tile}>
          <BellRing size={22} color={colors.accent} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{on ? 'Notifications are on' : status.permission === 'denied' ? 'Notifications are off on your phone' : 'Get reminders'}</Text>
          <Text style={styles.hint}>
            {on
              ? 'Reminders and alerts arrive on this phone.'
              : status.permission === 'denied'
                ? 'Allow them in your phone settings to get reminders.'
                : 'Log meals and workouts on time. You choose which ones.'}
          </Text>
        </View>
      </View>
      {on ? (
        <View style={styles.row}>
          <TextButton
            title={sent ? 'Test sent' : 'Send a test notification'}
            outlined
            disabled={sent}
            onPress={() => {
              if (!db) return;
              setSent(true);
              void sendTest(port, now()).catch(() => setSent(false));
            }}
          />
          <TextButton title="Turn off" end onPress={() => db && void turnOff(port, db).then(refresh)} />
        </View>
      ) : status.permission === 'denied' ? (
        <TextButton title="Open phone settings" outlined wide onPress={() => void port.openSettings()} />
      ) : (
        <TextButton title="Turn on" outlined strong wide onPress={() => db && void turnOn(port, db).then(refresh)} />
      )}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  card: { gap: 12, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.accentTint },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tile: { width: 44, height: 44, borderRadius: 4, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { ...TYPE.metric, fontSize: 18, lineHeight: 20, color: c.ink },
  hint: { ...TYPE.small, color: c.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
}));
