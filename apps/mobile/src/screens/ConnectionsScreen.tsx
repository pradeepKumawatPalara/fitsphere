import { istDayOf, istToday } from '@fitsphere/shared';
import { HeartPulse } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextButton } from '../components/ui';
import { formatDay, formatInteger } from '../format';
import { daysRead } from '../health/importHealth';
import { useHealth, type HealthProblem } from '../health/HealthSyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

// Settings › Connections (D-121, ADR-0013, docs/plans/health-connect.md; layout proposed, the owner's
// word on 2026-11-20). One row for now, Health Connect: steps and body weight, read only. A device is
// named here only once the owner's test marks it Works, Partial or Not supported (none yet).

const PROBLEMS: Record<Exclude<HealthProblem, null>, string> = {
  denied: 'Allow steps and weight in Health Connect to connect.',
  withdrawn: 'Access was withdrawn in Android. Connect again to read.',
  failed: "Couldn't read. Try again.",
};

function plural(count: number, one: string, many: string): string {
  return `${formatInteger(count)} ${count === 1 ? one : many}`;
}

const systemNow = (): Date => new Date();

export function ConnectionsScreen({ now = systemNow }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const health = useHealth();
  // Disconnect asks Keep or Remove only when something was read.
  const [asking, setAsking] = useState(false);
  const connected = health.connectedAt !== null;
  const importedAny = health.imported.steps + health.imported.weights > 0;

  const status = (() => {
    if (health.availability === 'checking') return 'Checking…';
    if (health.availability === 'not_supported') return 'Not available on this phone.';
    if (health.availability === 'needs_install') return "Health Connect isn't installed on this phone.";
    if (!connected) return 'Not connected';
    if (health.reading) return 'Reading…';
    if (health.last) {
      return `Read just now: ${plural(daysRead(health.last.steps), 'day', 'days')} of steps, ${plural(daysRead(health.last.weights), 'weigh-in', 'weigh-ins')}`;
    }
    return health.readAt ? `Last read on ${formatDay(istDayOf(new Date(health.readAt)), istToday(now()))}` : 'Connected';
  })();

  function disconnect() {
    if (importedAny) setAsking(true);
    else void health.disconnect(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Health apps
        </Text>
        <View accessibilityLabel="Health Connect" style={styles.panel}>
          <View style={styles.head}>
            <HeartPulse size={22} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
            <View style={styles.headText}>
              <Text style={styles.name}>Health Connect</Text>
              <Text style={styles.help}>{status}</Text>
            </View>
          </View>
          <Text style={styles.help}>
            Reads your steps and body weight from the apps and watches that write to Health Connect. FitSphere only reads, and
            you can stop at any time. A value you type yourself is never changed.
          </Text>
          {health.problem ? <Text accessibilityRole="alert" style={styles.problem}>{PROBLEMS[health.problem]}</Text> : null}

          {asking ? (
            <View style={styles.ask}>
              <Text style={styles.body}>
                {`${plural(health.imported.steps, 'day', 'days')} of steps and ${plural(health.imported.weights, 'weigh-in', 'weigh-ins')} came from Health Connect. Keep them, or remove them from FitSphere?`}
              </Text>
              <TextButton
                title="Keep them"
                wide
                onPress={() => {
                  setAsking(false);
                  void health.disconnect(false);
                }}
              />
              <TextButton
                title="Remove them"
                destructive
                wide
                onPress={() => {
                  setAsking(false);
                  void health.disconnect(true);
                }}
              />
              <TextButton title="Cancel" wide onPress={() => setAsking(false)} />
            </View>
          ) : (
            <View style={styles.actions}>
              {health.availability === 'needs_install' ? <TextButton title="Get Health Connect" filled wide onPress={health.openInstall} /> : null}
              {health.availability === 'available' && !connected ? <TextButton title="Connect" filled wide onPress={() => void health.connect()} /> : null}
              {connected ? <TextButton title="Read now" wide disabled={health.reading} onPress={() => void health.readNow()} /> : null}
              {connected ? <TextButton title="Disconnect" destructive wide onPress={disconnect} /> : null}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const useStyles = themedStyles((c) => ({
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 34, gap: 22 },
  section: { gap: 10 },
  sectionTitle: { ...TYPE.label, color: c.inkMuted },
  panel: { gap: 12, padding: 16, borderRadius: 4, backgroundColor: c.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 2 },
  name: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 18, letterSpacing: 0.5, textTransform: 'uppercase' },
  help: { ...TYPE.small, color: c.inkMuted },
  body: { fontSize: 15 },
  problem: { ...TYPE.small, color: c.danger },
  actions: { gap: 8 },
  ask: { gap: 8 },
}));
