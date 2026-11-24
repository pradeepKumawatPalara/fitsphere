import { formatWeight, istDayOf, istToday } from '@fitsphere/shared';
import { Activity, BookOpen, HeartPulse, RefreshCw, Scale, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, TextButton } from '../components/ui';
import { formatDay, formatInteger, formatIstTime } from '../format';
import { daysRead } from '../health/importHealth';
import { REFRESH_MINUTES, useHealth, type HealthProblem } from '../health/HealthSyncProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry } from '../local/store';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
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

/** The short list shown before connecting; the full guide is the How to connect page. */
const BEFORE_YOU_CONNECT = [
  'Install Health Connect.',
  'Open it and connect your other apps, such as Fastrack or Google Fit.',
  'Come back here, tap Connect and allow steps and weight.',
];

function plural(count: number, one: string, many: string): string {
  return `${formatInteger(count)} ${count === 1 ? one : many}`;
}

const systemNow = (): Date => new Date();

function ReadRow({ Icon, name, note, value }: { Icon: LucideIcon; name: string; note: string; value: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${name}, ${note}: ${value}`} style={styles.readRow}>
      <View style={styles.tile}>
        <Icon size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
      </View>
      <View style={styles.headText}>
        <Text style={styles.body}>{name}</Text>
        <Text style={styles.help}>{note}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ConnectionsScreen({ now = systemNow }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const health = useHealth();
  const weightUnit = useBodyWeightUnit();
  const { state: local } = useLocalDatabase();
  const db = local.status === 'ready' ? local.db : null;
  // Today's steps and weight as FitSphere holds them, read again after every read from Health Connect.
  const [today, setToday] = useState<{ steps: number | null; weightGrams: number | null }>({ steps: null, weightGrams: null });
  useEffect(() => {
    if (!db) return;
    let active = true;
    const day = istToday(now());
    void (async () => {
      const [steps, weight] = await Promise.all([getEntry(db, 'steps', day), getEntry(db, 'weighIn', day)]);
      if (active) setToday({ steps: steps?.steps ?? null, weightGrams: weight?.weightGrams ?? null });
    })();
    return () => {
      active = false;
    };
  }, [db, now, health.readAt, health.last]);
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

          {connected && health.readAt ? (
            <View style={styles.refresh}>
              <RefreshCw size={18} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
              <View style={styles.headText}>
                <Text style={styles.body}>{`Updates about every ${REFRESH_MINUTES} minutes`}</Text>
                <Text style={styles.help}>{`Last updated ${formatIstTime(health.readAt)}. Also when you open FitSphere or tap Read now.`}</Text>
              </View>
            </View>
          ) : null}

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

      {connected ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            What FitSphere reads
          </Text>
          <View style={styles.panel}>
            <ReadRow Icon={Activity} name="Steps" note="Today" value={today.steps === null ? 'None yet' : formatInteger(today.steps)} />
            <View style={styles.divider} />
            <ReadRow
              Icon={Scale}
              name="Weight"
              note="Today"
              value={today.weightGrams === null ? 'None yet' : formatWeight(today.weightGrams, weightUnit)}
            />
          </View>
        </View>
      ) : health.availability === 'available' || health.availability === 'needs_install' ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Before you connect
          </Text>
          <View style={styles.panel}>
            {BEFORE_YOU_CONNECT.map((line, index) => (
              <View key={line} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={[styles.body, styles.headText]}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {health.availability === 'available' || health.availability === 'needs_install' || connected ? (
        <TextButton title="How to connect" icon={BookOpen} arrow wide onPress={() => router.push('/health-guide')} />
      ) : null}
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
  refresh: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  tile: { width: 40, height: 40, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 20 },
  divider: { height: 1, backgroundColor: c.border },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, lineHeight: 28, borderRadius: 14, textAlign: 'center', overflow: 'hidden', backgroundColor: c.accentTint, color: c.accent, fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 16 },
  ask: { gap: 8 },
}));
