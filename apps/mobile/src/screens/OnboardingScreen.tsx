import {
  EARLIEST_DAY,
  formatWeight,
  fromGrams,
  isAcceptedDateOfBirth,
  istToday,
  type BodyWeightUnit,
  type IstDay,
  type LengthUnit,
} from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Activity, Check, Globe, Info, Scale, TrendingUp, Utensils, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LogOut } from './LogOut';
import { useAuth } from '../auth/AuthProvider';
import { sendOnboardingFinished } from '../auth/service';
import { CalendarSheet } from '../components/CalendarSheet';
import { FormScreen } from '../components/FormScreen';
import { ProfileFields, ProfilePhotoEditor, useProfileChecks, type PhotoDraft } from '../components/ProfileFields';
import { StripeCorner } from '../components/StripeCorner';
import { Wordmark } from '../components/Wordmark';
import { Field, Message, Text, TextButton } from '../components/ui';
import { formatDay, nameFromEmail, parseWeightInput, weightRule } from '../format';
import { ageText, formFromProfile, typedDateOfBirth, type ProfileForm } from '../profile';
import { useHealth } from '../health/HealthSyncProvider';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, getMeta, PROFILE_KEY, setMeta, targetsOn } from '../local/store';
import {
  DEFAULT_START_KG,
  neighbour,
  nudgeWeightText,
  resumeStep,
  startingTargetsToSave,
  stepCounter,
  type OnboardingStep,
} from '../onboarding';
import { useSettings } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Choice, UNITS } from './AccountScreen';

// First sign-in onboarding (D-124, REQ-ACC-013, docs/plans/onboarding.md; canvas boards F1 to J, locked by
// the owner 2026-11-24): Welcome, About you, Starting weight, Health Connect (Android, where it is
// there) and All set. Every step but Welcome has a Skip; each step saves when it is completed, so
// quitting never loses a value, and the step left at is kept on this phone to resume. Go to Home ends it:
// the starting targets are saved for any kind not set, the phone's copy says finished, and the server is
// told (retried at the next start if there is no connection). Nothing here blocks the app (invariant #4).

const systemNow = (): Date => new Date();

const WELCOME_ROWS: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: Utensils, title: 'Log your food', text: 'Meals, calories and protein against your targets.' },
  { Icon: Activity, title: 'Log your workouts', text: 'Exercises, sets and a timer for each session.' },
  { Icon: TrendingUp, title: 'See your progress', text: 'Weight, measurements and workouts over time.' },
];

export function OnboardingScreen({ now = systemNow }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { deps, email } = useAuth();
  const sync = useSync();
  const health = useHealth();
  const { settings, saveSetting } = useSettings();
  const { state: local } = useLocalDatabase();
  const db = local.status === 'ready' ? local.db : null;
  const today = istToday(now());
  const hc = health.availability === 'available';

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const resumed = useRef(false);
  // About you holds Profile's own boxes (D-124): the form fills from what is saved, until the user types.
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>('cm');
  const [photo, setPhoto] = useState<PhotoDraft>({ mediaId: null, files: null });
  const [picking, setPicking] = useState(false);
  const edited = useRef(false);
  const [units, setUnits] = useState<{ body: BodyWeightUnit; lifting: BodyWeightUnit } | null>(null);
  const [weightText, setWeightText] = useState<string | null>(null);
  const [weightDay, setWeightDay] = useState<IstDay>(today);
  const [calendar, setCalendar] = useState(false);
  const [savedWeight, setSavedWeight] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const bodyUnit = units?.body ?? settings.body_weight_unit;
  const liftingUnit = units?.lifting ?? settings.lifting_weight_unit;
  const shownWeight = weightText ?? fromGrams(DEFAULT_START_KG * 1000, bodyUnit).toFixed(1);

  // Open on the step left at (once the database and Health Connect's answer are known), and mark this account
  // as not finished on this phone.
  useEffect(() => {
    if (!db || health.availability === 'checking' || resumed.current) return;
    resumed.current = true;
    void (async () => {
      if ((await getMeta(db, 'onboarded')) === null) await setMeta(db, 'onboarded', '0');
      setStep(resumeStep(await getMeta(db, 'onboarding_step'), hc));
    })();
  }, [db, health.availability, hc]);

  // The saved profile (a step resumed, or one pulled from another phone) fills the boxes until the user types.
  useEffect(() => {
    if (!db) return;
    let active = true;
    void Promise.all([getEntry(db, 'profile', PROFILE_KEY), getMeta(db, 'measurement_unit')]).then(([profile, savedUnit]) => {
      if (!active || edited.current) return;
      const shown: LengthUnit = savedUnit === 'in' ? 'in' : 'cm';
      setLengthUnit(shown);
      setForm(formFromProfile(profile, shown));
      setPhoto({ mediaId: profile?.photoMediaId ?? null, files: null });
    });
    return () => {
      active = false;
    };
  }, [db]);

  const shownForm = form ?? formFromProfile(null, lengthUnit);
  const { result: aboutResult, problems, toCheck, watch } = useProfileChecks(shownForm, today, lengthUnit);
  function changeAbout(fields: Partial<ProfileForm>) {
    edited.current = true;
    setForm((current) => ({ ...(current ?? formFromProfile(null, lengthUnit)), ...fields }));
  }
  const dateOfBirth = typedDateOfBirth(shownForm);
  const age = dateOfBirth && isAcceptedDateOfBirth(dateOfBirth, today) ? ageText(dateOfBirth, today) : null;

  function go(next: OnboardingStep | null) {
    if (!next) return;
    setMessage(null);
    setStep(next);
    if (db) void setMeta(db, 'onboarding_step', next);
  }
  const forward = () => go(neighbour(step, hc, 1));
  const back = () => go(neighbour(step, hc, -1));

  async function saveAbout() {
    if (aboutResult?.kind !== 'ok') return;
    setBusy(true);
    try {
      // Saved only when something was typed or chosen: an untouched step leaves the profile as it is.
      if (edited.current) {
        const newPhoto = photo.mediaId && photo.files ? { id: photo.mediaId, files: photo.files } : undefined;
        await sync.save('profile', { ...aboutResult.data, photoMediaId: photo.mediaId }, newPhoto);
        edited.current = false;
      }
      if (units) {
        if (units.body !== settings.body_weight_unit) await saveSetting('body_weight_unit', units.body);
        if (units.lifting !== settings.lifting_weight_unit) await saveSetting('lifting_weight_unit', units.lifting);
      }
      forward();
    } catch {
      setMessage("Couldn't save. Try again, or skip this step.");
    } finally {
      setBusy(false);
    }
  }

  async function saveWeight() {
    const grams = parseWeightInput(shownWeight, bodyUnit);
    if (grams === null) {
      setMessage(weightRule(bodyUnit));
      return;
    }
    setBusy(true);
    try {
      await sync.save('weighIn', { day: weightDay, weightGrams: grams });
      setSavedWeight(grams);
      forward();
    } catch {
      setMessage("Couldn't save. Try again, or skip this step.");
    } finally {
      setBusy(false);
    }
  }

  async function connectHealth() {
    setBusy(true);
    try {
      await health.connect();
    } finally {
      setBusy(false);
    }
    // A refused permission still goes on: Connections has it later.
    forward();
  }

  async function finish() {
    setBusy(true);
    try {
      if (db) {
        const alreadySet = (await targetsOn(db, today)).map((target) => target.kind);
        for (const { kind, value } of startingTargetsToSave(alreadySet)) {
          await sync.save('target', { kind, value }).catch(() => undefined);
        }
        await setMeta(db, 'onboarded', '1');
        await setMeta(db, 'onboarding_step', null);
        await setMeta(db, 'onboarding_flag_pending', '1');
        if (await sendOnboardingFinished(deps).catch(() => false)) await setMeta(db, 'onboarding_flag_pending', null);
      }
    } finally {
      setBusy(false);
      router.replace('/home');
    }
  }

  const counter = stepCounter(step, hc);
  const header = (withBack: boolean) => (
    <View style={styles.topRow}>
      {withBack ? <TextButton title="Back" onPress={back} /> : <Wordmark />}
      <TextButton title="Skip" onPress={forward} />
    </View>
  );
  const progress = counter ? (
    <View accessible accessibilityLabel={`Step ${counter.at} of ${counter.of}`} style={styles.progress}>
      <View style={styles.bars}>
        {Array.from({ length: counter.of }, (_, index) => (
          <View key={index} style={[styles.bar, index < counter.at && styles.barDone]} />
        ))}
      </View>
    </View>
  ) : null;
  const next = (title: string, onPress: () => void) => (
    <TextButton title={title} filled arrow busy={busy} onPress={onPress} />
  );
  const stepHint = counter ? <Text style={styles.hint}>{`Step ${counter.at} of ${counter.of}`}</Text> : null;

  if (step === 'welcome') {
    return (
      <FormScreen
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            {next('Get started', forward)}
            <Text style={styles.hint}>Takes about a minute</Text>
            {/* A way back to Sign in (the owner, 2026-11-24): the same Log out as Settings, so a wrong account can be left. */}
            <LogOut />
          </View>
        }
      >
        <StripeCorner />
        <Wordmark />
        <Text style={styles.overline}>Your account is ready</Text>
        <Text accessibilityRole="header" style={styles.display}>
          {"Welcome.\nLet's set\nyou up."}
        </Text>
        <Text style={styles.lead}>
          A minute now makes your first day easier. Every step can be skipped, and you can change it all later.
        </Text>
        {WELCOME_ROWS.map(({ Icon, title, text }) => (
          <View key={title} style={styles.welcomeRow}>
            <View style={styles.tile}>
              <Icon size={22} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.small}>{text}</Text>
            </View>
          </View>
        ))}
      </FormScreen>
    );
  }

  if (step === 'about') {
    return (
      <FormScreen
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            <Message text={message} />
            <TextButton title="Next" filled arrow busy={busy} disabled={picking || toCheck.length > 0} onPress={() => void saveAbout()} />
            {toCheck.length > 0 ? <Text style={styles.hint}>{`Check the ${toCheck.join(', ')} to go on.`}</Text> : null}
            {stepHint}
          </View>
        }
      >
        {header(true)}
        {progress}
        <Text accessibilityRole="header" style={styles.heading}>
          Your details
        </Text>
        <Text style={styles.lead}>
          The same details as your Profile. Every one is optional, and you can change them later in Profile and Settings.
        </Text>
        <ProfilePhotoEditor
          photo={photo}
          onChange={(next) => {
            edited.current = true;
            setPhoto(next);
          }}
          name={shownForm.name.trim() || nameFromEmail(email)}
          onPicking={setPicking}
        />
        <ProfileFields form={shownForm} unit={lengthUnit} change={changeAbout} problems={problems} watch={watch} age={age} email={email} />
        <Text accessibilityRole="header" style={styles.rowTitle}>
          Units
        </Text>
        <View style={styles.unitRow}>
          <Text style={styles.rowTitle}>Body weight</Text>
          <Choice label="Body weight unit" options={UNITS} value={bodyUnit} onChange={(body) => setUnits({ body, lifting: liftingUnit })} />
        </View>
        <View style={styles.unitRow}>
          <Text style={styles.rowTitle}>Weights you lift</Text>
          <Choice label="Lifting weight unit" options={UNITS} value={liftingUnit} onChange={(lifting) => setUnits({ body: bodyUnit, lifting })} />
        </View>
        <View style={styles.place}>
          <Globe size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>India · IST</Text>
            <Text style={styles.small}>Your days start and end in India time.</Text>
          </View>
        </View>
      </FormScreen>
    );
  }

  if (step === 'weight') {
    return (
      <FormScreen
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            <Message text={message} />
            {next('Save and next', () => void saveWeight())}
            {stepHint}
          </View>
        }
      >
        {header(true)}
        {progress}
        <Text accessibilityRole="header" style={styles.heading}>
          Where are you starting?
        </Text>
        <Text style={styles.lead}>
          Your starting weight is the first point on your progress chart. Not sure? Skip it and add a weigh-in later.
        </Text>
        <View style={styles.card}>
          <Text style={styles.overline}>Body weight</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Down 0.1 ${bodyUnit}`}
              onPress={() => setWeightText(nudgeWeightText(shownWeight, -1))}
              style={styles.nudge}
            >
              <Text style={styles.nudgeText}>−0.1</Text>
            </Pressable>
            <View style={styles.big}>
              <Field
                label={`Starting weight in ${bodyUnit}`}
                value={shownWeight}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                style={styles.bigInput}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Up 0.1 ${bodyUnit}`}
              onPress={() => setWeightText(nudgeWeightText(shownWeight, 1))}
              style={styles.nudge}
            >
              <Text style={styles.nudgeText}>+0.1</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
          <View style={styles.dayRow}>
            <View style={styles.rowText}>
              <Text style={styles.overline}>Weighed on</Text>
              <Text style={styles.rowTitle}>{weightDay === today ? `Today · ${formatDay(weightDay)}` : formatDay(weightDay, today)}</Text>
            </View>
            <TextButton title="Change" onPress={() => setCalendar(true)} />
          </View>
        </View>
        <Text style={styles.small}>{weightRule(bodyUnit)} It is saved as your first weigh-in.</Text>
        {calendar ? (
          <CalendarSheet
            title="Weighed on"
            today={today}
            firstDay={EARLIEST_DAY}
            selected={weightDay}
            onSelect={(day) => {
              if (day <= today) setWeightDay(day);
              setCalendar(false);
            }}
            onClose={() => setCalendar(false)}
          />
        ) : null}
      </FormScreen>
    );
  }

  if (step === 'health') {
    return (
      <FormScreen
        contentStyle={styles.content}
        footer={
          <View style={styles.footer}>
            {next('Connect Health Connect', () => void connectHealth())}
            <TextButton title="Maybe later" wide onPress={forward} />
            <Text style={styles.hint}>{`Android only. Step ${counter?.at ?? 3} of ${counter?.of ?? 3}`}</Text>
          </View>
        }
      >
        {header(true)}
        {progress}
        <Text accessibilityRole="header" style={styles.heading}>
          Bring in your steps and weight
        </Text>
        <Text style={styles.lead}>
          Health Connect passes data from apps like Fastrack or Google Fit to FitSphere. FitSphere only reads, and you can stop any
          time.
        </Text>
        <View style={styles.card}>
          <View style={styles.healthRow}>
            <View style={styles.tile}>
              <Activity size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Steps</Text>
              <Text style={styles.small}>Your daily total</Text>
            </View>
            <Text style={styles.readOnly}>Read only</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.healthRow}>
            <View style={styles.tile}>
              <Scale size={20} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Weight</Text>
              <Text style={styles.small}>Your latest weigh-in each day</Text>
            </View>
            <Text style={styles.readOnly}>Read only</Text>
          </View>
        </View>
        <View style={styles.note}>
          <Info size={18} color={colors.accent} importantForAccessibility="no" accessibilityElementsHidden />
          <Text style={[styles.small, styles.rowText]}>
            Set up Health Connect first and connect your other apps to it. Not done yet? Choose Maybe later. Profile › Connections has a
            guide.
          </Text>
        </View>
      </FormScreen>
    );
  }

  // All set.
  const rows: [string, string][] = [
    ['Units', `${bodyUnit} · ${liftingUnit}`],
    ['Starting weight', savedWeight === null ? 'Not set' : formatWeight(savedWeight, bodyUnit)],
    ['Daily targets', 'Starting numbers'],
    ...(hc ? ([['Health Connect', health.connectedAt ? 'Connected' : 'Not connected']] as [string, string][]) : []),
  ];
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <TextButton title="Go to Home" filled arrow busy={busy} onPress={() => void finish()} />
        </View>
      }
    >
      <View style={styles.topRow}>
        <TextButton title="Back" onPress={back} />
      </View>
      <Wordmark />
      <View style={styles.check}>
        <Check size={30} strokeWidth={2.5} color={colors.success} importantForAccessibility="no" accessibilityElementsHidden />
      </View>
      <Text accessibilityRole="header" style={styles.display}>
        {"You're\nall set."}
      </Text>
      <Text style={styles.lead}>
        This is what you chose. Your targets start from common numbers, 2,000 kcal and 120 g protein a day. Change any of it later in
        Profile, Your targets and Connections.
      </Text>
      <View style={styles.card}>
        {rows.map(([label, value], index) => (
          <View key={label}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.summaryRow}>
              <Text style={styles.overline}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.small}>A step you skipped shows here as Not set. You can finish it any time.</Text>
    </FormScreen>
  );
}

const useStyles = themedStyles((c) => ({
  content: { paddingTop: 24, gap: 16 },
  footer: { gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { gap: 8 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.track },
  barDone: { backgroundColor: c.accent },
  overline: { ...TYPE.label, color: c.accent },
  display: { ...TYPE.display, fontSize: 56, lineHeight: 52 },
  heading: { ...TYPE.display, fontSize: 40, lineHeight: 42 },
  lead: { fontSize: 15, lineHeight: 21, color: c.inkMuted },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  small: { ...TYPE.small, color: c.inkMuted },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  tile: { width: 44, height: 44, borderRadius: 4, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  card: { gap: 12, padding: 16, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nudge: { width: 56, height: 56, borderRadius: 4, borderWidth: 1.5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  nudgeText: { ...TYPE.label, fontSize: 17, color: c.accent },
  big: { flex: 1 },
  bigInput: { textAlign: 'center', fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 40 },
  divider: { height: 1, backgroundColor: c.border },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readOnly: { ...TYPE.label, color: c.inkMuted },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 4, backgroundColor: c.accentTint },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.successTint, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  summaryValue: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 19 },
}));
