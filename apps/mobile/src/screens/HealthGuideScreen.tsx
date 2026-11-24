import { RefreshCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Text, TextButton } from '../components/ui';
import { REFRESH_MINUTES, useHealth } from '../health/HealthSyncProvider';
import { themedStyles, useTheme } from '../theme';

// Settings › Connections › How to connect (D-121, docs/plans/health-connect-sleep.md; canvas "Health Connect:
// sleep and guide", the owner's word on 2026-11-24). Four steps, written from the owner's own list.

const STEPS: { title: string; text: string }[] = [
  { title: 'Install Health Connect', text: 'Get it from Google Play if it is not on your phone yet.' },
  { title: 'Open Health Connect', text: 'It sits between FitSphere and your other apps, passing their data along.' },
  {
    title: 'Connect your other apps to it',
    text: 'For example Fastrack or Google Fit. Allow them to write steps and weight.',
  },
  { title: 'Connect it in FitSphere', text: '' },
];

export function HealthGuideScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const health = useHealth();

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Health Connect is the link between FitSphere and your other health apps. Set it up once, in four steps.
      </Text>

      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <Text style={styles.number}>{index + 1}</Text>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            {index === 3 ? (
              <>
                <View accessible accessibilityLabel="Profile, then Connections, then Health Connect" style={styles.path}>
                  {['Profile', 'Connections', 'Health Connect'].map((place, at) => (
                    <View key={place} style={styles.pathPart}>
                      {at > 0 ? <Text style={styles.help}>›</Text> : null}
                      <Text style={styles.chip}>{place}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.help}>Scroll down on your profile to find Connections. Tap Connect and allow steps and weight.</Text>
              </>
            ) : (
              <Text style={styles.help}>{step.text}</Text>
            )}
            {index === 0 && health.availability === 'needs_install' ? (
              <TextButton title="Get Health Connect" onPress={health.openInstall} />
            ) : null}
          </View>
        </View>
      ))}

      <View style={styles.tip}>
        <RefreshCw size={18} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
        <Text style={[styles.help, styles.stepText]}>
          <Text style={styles.strong}>Not showing yet? </Text>
          {`FitSphere checks about every ${REFRESH_MINUTES} minutes while it is open. Tap Read now on Connections to check straight away. Your other app must have synced to Health Connect first.`}
        </Text>
      </View>

      <TextButton title="Go to Connections" filled wide onPress={() => router.back()} />
    </ScrollView>
  );
}

const useStyles = themedStyles((c) => ({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 34, gap: 18 },
  intro: { fontSize: 15, color: c.inkMuted, lineHeight: 21 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepText: { flex: 1, gap: 4 },
  number: {
    width: 32,
    height: 32,
    lineHeight: 32,
    borderRadius: 16,
    textAlign: 'center',
    overflow: 'hidden',
    backgroundColor: c.primary,
    color: c.onPrimary,
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 18,
  },
  stepTitle: { fontSize: 16, fontWeight: '600' },
  help: { fontSize: 14, color: c.inkMuted, lineHeight: 19 },
  strong: { fontSize: 14, fontWeight: '600', color: c.ink },
  path: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  pathPart: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 4, backgroundColor: c.surface },
}));
