import { AI_CONSENT_TEXT, type BodyWeightUnit, type ThemePreference } from '@fitsphere/shared';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { readAiConsent, saveAiConsent, type AiConsent } from '../api/account';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ApiStatus } from '../components/ApiStatus';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { LocalDatabaseCheck } from '../components/LocalDatabaseCheck';
import { TodayIst } from '../components/TodayIst';
import { Text, TextButton, useChoiceStyles } from '../components/ui';
import { nameFromEmail } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, setMeta } from '../local/store';
import { useSettings } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { LogOut } from './LogOut';

// Settings, opened from the header's avatar (REQ-NAV-002; MVP defaults, D-31): Appearance
// (REQ-ACC-001), Units (REQ-ACC-002, REQ-ACC-003), AI meal reading (REQ-ACC-004), the fixed country
// and time zone (REQ-ACC-006, D-09), then the account: the user's targets (REQ-ROLE-007), change
// password (REQ-ACC-007), Log out (REQ-ACC-008) and Delete account (REQ-ACC-009). Development
// builds also show the tools the Skeleton's phone checks use (SC-02, SC-04, SC-08, SC-13).

const THEMES: { value: ThemePreference; label: string; help: string }[] = [
  { value: 'system', label: 'System', help: "Matches your phone's light or dark setting." },
  { value: 'light', label: 'Light', help: 'Always light.' },
  { value: 'dark', label: 'Dark', help: 'Always dark.' },
];
const UNITS: { value: BodyWeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];

export function AccountScreen({ showDevTools = __DEV__ }: { showDevTools?: boolean }) {
  const styles = useStyles();
  const { deps, email } = useAuth();
  const { settings, saveSetting } = useSettings();
  const sync = useSync();
  const router = useRouter();
  const theme = THEMES.find((option) => option.value === settings.theme) ?? THEMES[0]!;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Appearance">
        <Choice
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(value) => void saveSetting('theme', value)}
        />
        <Text style={styles.help}>{theme.help}</Text>
      </Section>

      <Section title="Units">
        <View style={styles.unitRow}>
          <Text style={styles.body}>Body weight</Text>
          <Choice
            label="Body weight unit"
            options={UNITS}
            value={settings.body_weight_unit}
            onChange={(value) => void saveSetting('body_weight_unit', value)}
          />
        </View>
        <View style={styles.unitRow}>
          <Text style={styles.body}>Lifting weight</Text>
          <Choice
            label="Lifting weight unit"
            options={UNITS}
            value={settings.lifting_weight_unit}
            onChange={(value) => void saveSetting('lifting_weight_unit', value)}
          />
        </View>
      </Section>

      <Section title="AI meal reading">
        <AiConsentSwitch />
      </Section>

      <Section title="Country and time zone">
        <Text style={styles.body}>India · Kolkata</Text>
        <Text style={styles.help}>FitSphere counts your days in India time.</Text>
      </Section>

      {/* Who is signed in and where to go, in one panel; then, set apart, Log out and Delete account:
          destructive, so red, never filled, and never more prominent than the rows. */}
      <Section title="Account">
        <View style={styles.rows}>
          <View style={styles.who}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{nameFromEmail(email).charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <Text style={styles.whoText}>Signed in as {email}</Text>
          </View>
          <View style={styles.rule} />
          <LinkRow title="Your targets" onPress={() => router.push('/targets')} />
          <View style={styles.rule} />
          <LinkRow title="Change password" onPress={() => router.push('/change-password')} />
        </View>
        <View style={styles.leave}>
          <LogOut />
          <TextButton title="Delete account" destructive wide onPress={() => router.push('/delete-account')} />
        </View>
      </Section>

      {showDevTools ? (
        <View style={styles.dev}>
          <Text accessibilityRole="header" style={styles.heading}>
            Development
          </Text>
          <TodayIst />
          <Text>Sync: {sync.status}</Text>
          <ApiStatus apiUrl={deps.apiUrl} check={checkApiHealth} />
          <LocalDatabaseCheck />
          <Button title="200-row list (development)" onPress={() => router.push('/dev-history')} />
          <ExpiredTokenTest deps={deps} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** A row in the Account panel that opens another screen. */
function LinkRow({ title, onPress }: { title: string; onPress(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // The chevron only shows the row leads on; the row's name stays its title.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <Text style={styles.linkRowText}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} importantForAccessibility="no" accessibilityElementsHidden />
    </Pressable>
  );
}

/** One choice from a few, as a row of buttons; the chosen one is marked. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ checked: chosen }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [pill.choice, chosen && pill.chosen, pressed && pill.pressed]}
          >
            <Text style={[pill.choiceText, chosen && pill.chosenText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CONSENT_OFFLINE = 'Changing this needs an internet connection.';
const CONSENT_UNAVAILABLE = "This can't be changed right now. Try again later.";

type ConsentState = { consent: AiConsent | null; online: boolean; busy: boolean; problem: string | null };

/**
 * The AI meal-reading switch (REQ-ACC-004; MVP defaults, D-31). Off until the user turns it on
 * (A-007). Each change is recorded by the server with its time and the text's version; it needs
 * the internet, so offline the last known choice is shown, disabled. No AI is called from here.
 */
function AiConsentSwitch() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const db = local.state.status === 'ready' ? local.state.db : null;
  const [state, setState] = useState<ConsentState>({ consent: null, online: false, busy: true, problem: null });

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await readAiConsent(deps);
      if (!active) return;
      if (result.kind === 'ok') {
        setState({ consent: result.consent, online: true, busy: false, problem: null });
        if (db) await setMeta(db, 'ai_consent', JSON.stringify(result.consent));
        return;
      }
      const cached = db ? await getMeta(db, 'ai_consent') : null;
      if (!active) return;
      setState({
        consent: cached ? (JSON.parse(cached) as AiConsent) : null,
        online: false,
        busy: false,
        problem: result.kind === 'offline' ? CONSENT_OFFLINE : CONSENT_UNAVAILABLE,
      });
    })();
    return () => {
      active = false;
    };
  }, [deps, db]);

  async function change(consented: boolean) {
    setState((current) => ({ ...current, busy: true, problem: null }));
    const result = await saveAiConsent(deps, consented);
    if (result.kind === 'ok') {
      setState({ consent: result.consent, online: true, busy: false, problem: null });
      if (db) await setMeta(db, 'ai_consent', JSON.stringify(result.consent));
    } else {
      setState((current) => ({
        ...current,
        busy: false,
        problem: result.kind === 'offline' ? CONSENT_OFFLINE : CONSENT_UNAVAILABLE,
      }));
    }
  }

  const on = state.consent?.consented === true;
  return (
    <View style={styles.consent}>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>AI meal reading</Text>
        <Switch
          accessibilityLabel="AI meal reading"
          value={on}
          disabled={!state.online || state.busy}
          accessibilityState={{ disabled: !state.online || state.busy, checked: on }}
          onValueChange={(value) => void change(value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={on ? colors.primaryStrong : colors.surface}
        />
      </View>
      <Text style={styles.help}>{AI_CONSENT_TEXT}</Text>
      {state.problem ? (
        <Text accessibilityRole="alert" style={styles.problem}>
          {state.problem}
        </Text>
      ) : null}
    </View>
  );
}

// Spacing as on Home: 24 between sections, 12 within one.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  // The Development section's heading, unchanged.
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  help: { fontSize: 13, color: c.textMuted },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  // Choice pills, as the meal choice on Log meal: the chosen one filled.
  choices: { flexDirection: 'row', gap: 8 },
  rows: { borderRadius: 12, backgroundColor: c.surface, overflow: 'hidden' },
  who: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  whoText: { flexShrink: 1, fontSize: 15 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, backgroundColor: c.border },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  // Set apart from the panel: Log out full width and outlined, Delete account under it as red text.
  leave: { marginTop: 12, gap: 4 },
  linkRowText: { fontSize: 15, fontWeight: '600', color: c.primary },
  pressed: { opacity: 0.6 },
  consent: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 15 },
  problem: { fontSize: 13, color: c.error },
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 },
}));
