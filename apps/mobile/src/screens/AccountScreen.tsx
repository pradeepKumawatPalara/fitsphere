import { AI_CONSENT_TEXT, type BodyWeightUnit, type ThemePreference } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Globe,
  KeyRound,
  Moon,
  Smartphone,
  Sparkles,
  SquarePen,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Pressable, ScrollView, Switch, View } from 'react-native';
import { readAiConsent, saveAiConsent, type AiConsent } from '../api/account';
import { checkApiHealth } from '../api/health';
import { useAuth } from '../auth/AuthProvider';
import { ApiStatus } from '../components/ApiStatus';
import { ExpiredTokenTest } from '../components/ExpiredTokenTest';
import { LocalDatabaseCheck } from '../components/LocalDatabaseCheck';
import { ProfilePhoto, useProfile } from '../components/ProfilePhoto';
import { StripeCorner } from '../components/StripeCorner';
import { TodayIst } from '../components/TodayIst';
import { Message, Text, TextButton, useChoiceStyles } from '../components/ui';
import { nameFromEmail } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, setMeta } from '../local/store';
import { useSettings } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { LogOut } from './LogOut';

// Settings, opened from the header's avatar (REQ-NAV-002; MVP defaults, D-31): the profile
// (REQ-ACC-011), Appearance (REQ-ACC-001), Units (REQ-ACC-002, REQ-ACC-003), AI meal reading
// (REQ-ACC-004), the fixed country and time zone (REQ-ACC-006, D-09), then the account: the user's
// targets (REQ-ROLE-007), change password (REQ-ACC-007), Log out (REQ-ACC-008) and Delete account
// (REQ-ACC-009). Development builds also show the tools the Skeleton's phone checks use (SC-02,
// SC-04, SC-08, SC-13). The redesign's 6.1 (locked by the owner, 2026-11-03): a Profile card with the
// photo, the name and the email on top; the choices as square blocks with their icons.

const THEMES: { value: ThemePreference; label: string; help: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', help: "Matches your phone's light or dark setting.", icon: Smartphone },
  { value: 'light', label: 'Light', help: 'Always light.', icon: Sun },
  { value: 'dark', label: 'Dark', help: 'Always dark.', icon: Moon },
];
const UNITS: { value: BodyWeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];

export function AccountScreen({ showDevTools = __DEV__ }: { showDevTools?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps, email } = useAuth();
  const { settings, saveSetting } = useSettings();
  const sync = useSync();
  const router = useRouter();
  const theme = THEMES.find((option) => option.value === settings.theme) ?? THEMES[0]!;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ProfileCard email={email} onEdit={() => router.push('/profile')} />

      <Section title="Appearance">
        <Choice
          label="Appearance"
          options={THEMES}
          value={settings.theme}
          onChange={(value) => void saveSetting('theme', value)}
          fill
        />
        <Text style={styles.help}>{theme.help}</Text>
      </Section>

      <Section title="Units">
        <View style={styles.panel}>
          <View style={styles.unitRow}>
            <Text style={styles.body}>Body weight</Text>
            <Choice
              label="Body weight unit"
              options={UNITS}
              value={settings.body_weight_unit}
              onChange={(value) => void saveSetting('body_weight_unit', value)}
            />
          </View>
          <View style={[styles.unitRow, styles.divided]}>
            <Text style={styles.body}>Lifting weight</Text>
            <Choice
              label="Lifting weight unit"
              options={UNITS}
              value={settings.lifting_weight_unit}
              onChange={(value) => void saveSetting('lifting_weight_unit', value)}
            />
          </View>
        </View>
      </Section>

      {/* Its own heading: the switch's row, so "AI meal reading" shows once. */}
      <AiConsentSwitch />

      <Section title="Country and time zone">
        <View style={styles.place}>
          <Globe size={22} color={colors.accent} />
          <View style={styles.placeText}>
            <Text style={styles.placeName}>India · Kolkata</Text>
            <Text style={styles.help}>FitSphere counts your days in India time.</Text>
          </View>
        </View>
      </Section>

      {/* Where to go, in one panel; then, set apart, Log out and Delete account: destructive, so red,
          never filled, and never more prominent than the rows. */}
      <Section title="Account">
        <View style={styles.rows}>
          <LinkRow title="Your targets" icon={Target} onPress={() => router.push('/targets')} />
          <LinkRow title="Change password" icon={KeyRound} onPress={() => router.push('/change-password')} divided />
        </View>
        <View style={styles.leave}>
          <LogOut after={<TextButton title="Delete account" destructive wide onPress={() => router.push('/delete-account')} />} />
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

/**
 * The profile (REQ-ACC-011): the photo, or the name's initial; the name, or the email's name with no
 * profile yet; the sign-in email; and Edit profile.
 */
function ProfileCard({ email, onEdit }: { email: string | null; onEdit(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const profile = useProfile();
  const name = profile?.name ?? nameFromEmail(email);
  return (
    <View accessibilityLabel="Profile" style={styles.profile}>
      <StripeCorner size={140} />
      <ProfilePhoto mediaId={profile?.photoMediaId ?? null} name={name} size={64} />
      <View style={styles.profileText}>
        <Text style={styles.profileName}>{name}</Text>
        <Text numberOfLines={1} style={styles.profileEmail}>
          {email}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <SquarePen size={16} color={colors.accent} />
          <Text style={styles.editText}>Edit profile</Text>
        </Pressable>
      </View>
    </View>
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

/** A row in the Account panel that opens another screen, with its icon. */
function LinkRow({ title, icon: Icon, onPress, divided = false }: { title: string; icon: LucideIcon; onPress(): void; divided?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // The chevron only shows the row leads on; the row's name stays its title.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, divided && styles.divided, pressed && styles.pressed]}
    >
      <Icon size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
      <Text style={styles.linkRowText}>{title}</Text>
      <ChevronRight size={20} strokeWidth={2.25} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
    </Pressable>
  );
}

/**
 * One choice from a few, as square blocks; the chosen one filled. `fill`: the blocks share the row
 * (Appearance, with icons); otherwise each is 56 wide (the units).
 */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  fill = false,
}: {
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange(value: T): void;
  fill?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pill = useChoiceStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.choices}>
      {options.map(({ value: option, label: text, icon: Icon }) => {
        const chosen = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${text}`}
            accessibilityState={{ checked: chosen }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [pill.choice, fill ? styles.choiceFill : styles.choiceUnit, chosen && pill.chosen, pressed && pill.pressed]}
          >
            {Icon ? <Icon size={16} strokeWidth={2.25} color={chosen ? colors.onPrimary : colors.ink} /> : null}
            <Text style={[pill.choiceText, chosen && pill.chosenText]}>{text}</Text>
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
        <View style={styles.consentHead}>
          <Sparkles size={20} color={colors.accent} />
          <Text accessibilityRole="header" style={styles.consentTitle}>
            AI meal reading
          </Text>
        </View>
        <Switch
          accessibilityLabel="AI meal reading"
          value={on}
          disabled={!state.online || state.busy}
          accessibilityState={{ disabled: !state.online || state.busy, checked: on }}
          onValueChange={(value) => void change(value)}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={on ? colors.accent : colors.surface}
        />
      </View>
      <Text style={styles.help}>{AI_CONSENT_TEXT}</Text>
      <Message text={state.problem} offline={state.problem === CONSENT_OFFLINE} />
    </View>
  );
}

// 22 between sections, 10 within one; panels on the card colour, radius 4.
const useStyles = themedStyles((c) => ({
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 34, gap: 22 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: c.surface },
  profileText: { flex: 1, gap: 2 },
  profileName: { ...TYPE.screenHeader },
  profileEmail: { ...TYPE.small, color: c.inkMuted },
  edit: {
    alignSelf: 'flex-start',
    marginTop: 6,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  editText: { ...TYPE.buttonSecondary, fontSize: 15, letterSpacing: 1 },
  section: { gap: 10 },
  sectionTitle: { ...TYPE.label, color: c.inkMuted },
  // The Development section's heading, unchanged.
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  help: { ...TYPE.small, color: c.inkMuted },
  panel: { paddingLeft: 16, paddingRight: 12, borderRadius: 4, backgroundColor: c.surface },
  unitRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divided: { borderTopWidth: 1, borderTopColor: c.border },
  choices: { flexDirection: 'row', gap: 6 },
  choiceFill: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  choiceUnit: { width: 56, paddingHorizontal: 0 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 4, backgroundColor: c.surface },
  placeText: { flex: 1, gap: 2 },
  placeName: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 18, letterSpacing: 0.5, textTransform: 'uppercase' },
  rows: { borderRadius: 4, backgroundColor: c.surface },
  linkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 12 },
  linkRowText: { ...TYPE.buttonSecondary, flex: 1, fontSize: 17, letterSpacing: 1 },
  // Set apart from the panel: Log out full width and outlined, Delete account under it as red text.
  leave: { marginTop: 10 },
  pressed: { opacity: 0.6 },
  consent: { gap: 10, padding: 16, borderRadius: 4, backgroundColor: c.surface },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  consentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consentTitle: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 18, lineHeight: 20, letterSpacing: 1, textTransform: 'uppercase' },
  dev: { marginTop: 32, gap: 24, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 },
}));
