import { isAcceptedDateOfBirth, istToday, SEXES, syncWindowStart, type LengthUnit, type Sex } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Camera, Image as ImageIcon, Lock, Plus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { FormScreen } from '../components/FormScreen';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { ProfilePhoto } from '../components/ProfilePhoto';
import { andList } from '../components/MealFoods';
import { Field, Problem, Text, TextButton, TextInput, useChoiceStyles } from '../components/ui';
import { useFieldChecks } from '../fieldChecks';
import { dayValues } from '../dayValues';
import { formatDay, nameFromEmail } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import type { PhotoFiles } from '../local/photos';
import { getEntry, getMeta, listEntries, PROFILE_KEY, type LocalProfile, type LocalWeighIn } from '../local/store';
import { pickPhoto } from '../photos/takePhoto';
import {
  ageText,
  formFromProfile,
  PROFILE_TEXTS,
  readProfileForm,
  SEX_LABELS,
  typedDateOfBirth,
  type ProfileForm,
  type ProfileProblems,
} from '../profile';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useSync } from '../sync/SyncProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

/** The photo being edited: none, the saved one, or one just taken whose files are not saved yet. */
type PhotoDraft = { mediaId: string | null; files: PhotoFiles | null };

// The profile (REQ-ACC-011; docs/plans/user-profile.md, Accepted; the redesign's 6.6, locked by the
// owner 2026-11-03): the photo; about you (name, date of birth with the age it gives, sex); the body
// (height in cm, or in inches when the measurements' choice is inches; the weight as the latest
// weigh-in, with today's opening the weight sheet); contact (a +91 mobile number, the address, and
// the sign-in email, read-only). Every field is optional; each problem shows under its field. It is
// saved on the phone and synced, so it works offline; the weight is a weigh-in, saved as on Home.
// Since D-99 a problem shows once typing pauses or the field is left, not when Save is pressed; the
// date of birth's and the address's wait until they are complete or left. Save waits while there is
// one, saying what to check.
export function ProfileScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { email } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const router = useRouter();
  const bodyWeightUnit = useBodyWeightUnit();
  const today = istToday(now());
  const db = local.state.status === 'ready' ? local.state.db : null;

  const [saved, setSaved] = useState<LocalProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [unit, setUnit] = useState<LengthUnit>('cm');
  const [photo, setPhoto] = useState<PhotoDraft>({ mediaId: null, files: null });
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [latest, setLatest] = useState<LocalWeighIn | null>(null);
  const [weightSheet, setWeightSheet] = useState(false);
  // Set once the user changes anything: from then on a sync no longer refills the form.
  const edited = useRef(false);

  // The saved profile, its sync state and the latest weigh-in are read again after each save and
  // sync. The saved profile fills the form until the user edits it, so a profile pulled after the
  // screen opened (a new phone's first sync) is shown, never saved over with empty fields.
  useEffect(() => {
    if (!db) return;
    let active = true;
    void Promise.all([getEntry(db, 'profile', PROFILE_KEY), getMeta(db, 'measurement_unit')]).then(([profile, savedUnit]) => {
      if (!active) return;
      setSaved(profile);
      if (edited.current) return;
      const shownUnit: LengthUnit = savedUnit === 'in' ? 'in' : 'cm';
      setUnit(shownUnit);
      setForm(formFromProfile(profile, shownUnit));
      setPhoto({ mediaId: profile?.photoMediaId ?? null, files: null });
    });
    return () => {
      active = false;
    };
  }, [db, sync.version]);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void listEntries(db, 'weighIn', syncWindowStart(today), today).then((weighIns) => {
      if (active) setLatest(weighIns[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, [db, today, sync.version]);

  function change(fields: Partial<ProfileForm>) {
    edited.current = true;
    setForm((current) => (current ? { ...current, ...fields } : current));
  }

  function changePhoto(next: PhotoDraft) {
    edited.current = true;
    setPhoto(next);
  }

  async function pick(source: 'camera' | 'library') {
    setPhotoProblem(null);
    setPicking(true);
    const outcome = await pickPhoto(source, 'square').catch(() => ({ kind: 'failed' }) as const);
    setPicking(false);
    if (outcome.kind === 'picked') changePhoto({ mediaId: sync.newId(), files: outcome.files });
    else if (outcome.kind === 'noPermission') setPhotoProblem('FitSphere needs the camera to take a photo. You can choose one from the gallery instead.');
    else if (outcome.kind === 'failed') setPhotoProblem('This photo could not be used. Try another one.');
  }

  // Each problem worked out from what is typed now; each shows once its fields settle (D-99).
  const checks = useFieldChecks(form ? fieldTexts(form) : {});
  const result = form ? readProfileForm(form, today, unit) : null;
  const typed: ProfileProblems = result?.kind === 'problems' ? result.problems : {};
  /** A group's problem waits while it is being typed in and not complete; otherwise once it settles. */
  const groupShows = (names: readonly string[], complete: boolean) =>
    names.every((name) => checks.isSettled(name)) &&
    (complete || (!names.includes(checks.focused ?? '') && names.some((name) => checks.wasLeft(name))));
  const problems: ProfileProblems = {
    ...(typed.name && checks.shows('name') ? { name: typed.name } : {}),
    ...(typed.dateOfBirth && form && groupShows(DATE_FIELDS, dateComplete(form)) ? { dateOfBirth: typed.dateOfBirth } : {}),
    ...(typed.height && checks.shows('height') ? { height: typed.height } : {}),
    ...(typed.phone && checks.shows('phone') ? { phone: typed.phone } : {}),
    ...(typed.address && form && groupShows(ADDRESS_FIELDS, addressComplete(form)) ? { address: typed.address } : {}),
  };
  const toCheck = (Object.keys(typed) as (keyof ProfileProblems)[]).map((field) => CHECK_NAMES[field]);
  /** Focus and blur for a field, for its checks. */
  const watch = (name: string) => ({ onFocus: () => checks.focus(name), onBlur: () => checks.blur(name) });

  async function save() {
    if (result?.kind !== 'ok') return;
    setSaving(true);
    try {
      const newPhoto = photo.mediaId && photo.files ? { id: photo.mediaId, files: photo.files } : undefined;
      await sync.save('profile', { ...result.data, photoMediaId: photo.mediaId }, newPhoto);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const name = form?.name.trim() || nameFromEmail(email);
  // The age shows once the boxes hold a date of birth the profile accepts.
  const dateOfBirth = form ? typedDateOfBirth(form) : null;
  const age = dateOfBirth && isAcceptedDateOfBirth(dateOfBirth, today) ? ageText(dateOfBirth, today) : null;
  const weighIn = dayValues(bodyWeightUnit).weighIn;
  const todaysWeight = latest?.day === today ? latest.weightGrams : null;
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <TextButton title="Save profile" filled busy={saving} disabled={!form || picking || toCheck.length > 0} onPress={() => void save()} />
          {toCheck.length > 0 ? <Text style={styles.saveHint}>Check the {andList(toCheck)} to save.</Text> : null}
        </>
      }
    >
      <View style={styles.photoRow}>
        <ProfilePhoto mediaId={photo.files ? null : photo.mediaId} thumbnail={photo.files?.thumbnail ?? null} name={name} size={96} />
        <View style={styles.photoActions}>
          <PickButton title="Take photo" icon={Camera} disabled={picking} onPress={() => void pick('camera')} />
          <PickButton title="Choose from gallery" icon={ImageIcon} disabled={picking} onPress={() => void pick('library')} />
          {photo.mediaId ? (
            <TextButton title="Remove photo" destructive disabled={picking} onPress={() => changePhoto({ mediaId: null, files: null })} />
          ) : null}
        </View>
      </View>
      {picking ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          <Text accessibilityRole="progressbar" style={styles.hint}>
            Preparing the photo…
          </Text>
        </View>
      ) : null}
      {photoProblem ? <Problem text={photoProblem} /> : null}
      {saved?.syncState === 'pending' || saved?.syncState === 'rejected' ? (
        <View style={styles.state}>
          <View style={[styles.dot, saved.syncState === 'rejected' && styles.dotProblem]} />
          <Text style={[styles.stateText, saved.syncState === 'rejected' && styles.problemText]}>
            {saved.syncState === 'pending' ? 'Waiting to sync' : 'Not saved'}
          </Text>
        </View>
      ) : null}

      {form ? (
        <>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              About you
            </Text>
            <Field
              label="Name (optional)"
              value={form.name}
              onChangeText={(text) => change({ name: text })}
              autoCapitalize="words"
              autoComplete="name"
              error={problems.name ?? null}
              {...watch('name')}
            />
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Date of birth (optional)</Text>
                {age ? <Text style={styles.age}>{age}</Text> : null}
              </View>
              <View style={styles.dateRow}>
                <DatePart
                  label="Day"
                  placeholder="DD"
                  length={2}
                  value={form.day}
                  refused={!!problems.dateOfBirth}
                  onChange={(day) => change({ day })}
                  {...watch('day')}
                />
                <DatePart
                  label="Month"
                  placeholder="MM"
                  length={2}
                  value={form.month}
                  refused={!!problems.dateOfBirth}
                  onChange={(month) => change({ month })}
                  {...watch('month')}
                />
                <DatePart
                  label="Year"
                  placeholder="YYYY"
                  length={4}
                  value={form.year}
                  refused={!!problems.dateOfBirth}
                  onChange={(year) => change({ year })}
                  {...watch('year')}
                  wide
                />
              </View>
              {problems.dateOfBirth ? <Problem text={problems.dateOfBirth} /> : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Sex (optional)</Text>
              <SexChoice value={form.sex} onChange={(sex) => change({ sex })} />
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Body
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>{unit === 'in' ? 'Height in inches (optional)' : 'Height in cm (optional)'}</Text>
              <View style={[styles.box, problems.height ? styles.boxRefused : null]}>
                <TextInput
                  accessibilityLabel={unit === 'in' ? 'Height in inches' : 'Height in cm'}
                  value={form.height}
                  onChangeText={(height) => change({ height })}
                  {...watch('height')}
                  keyboardType="decimal-pad"
                  style={styles.number}
                />
                <Text style={styles.unit}>{unit}</Text>
              </View>
              {problems.height ? <Problem text={problems.height} /> : null}
            </View>
            <View style={styles.weight}>
              <View style={styles.weightText}>
                <Text style={styles.label}>Weight</Text>
                {latest ? (
                  <>
                    <Text style={styles.weightValue}>{weighIn.format(latest.weightGrams)}</Text>
                    <Text style={styles.hint}>Latest weigh-in · {formatDay(latest.day)}</Text>
                  </>
                ) : (
                  <Text style={styles.hint}>No weigh-ins yet.</Text>
                )}
              </View>
              <TextButton title="Log today's weight" icon={Plus} onPress={() => setWeightSheet(true)} />
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Contact
            </Text>
            <View style={styles.field}>
              <Text style={styles.label}>Phone number (optional)</Text>
              <View style={[styles.box, problems.phone ? styles.boxRefused : null]}>
                <Text style={styles.prefix}>+91</Text>
                <TextInput
                  accessibilityLabel="Phone number"
                  value={form.phone}
                  onChangeText={(phone) => change({ phone })}
                  {...watch('phone')}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={14}
                  style={styles.text}
                />
              </View>
              {problems.phone ? <Problem text={problems.phone} /> : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Address (optional)</Text>
              <AddressInput
                label="Address line 1"
                placeholder="Line 1"
                value={form.line1}
                refused={!!problems.address}
                onChange={(line1) => change({ line1 })}
                {...watch('line1')}
              />
              <AddressInput
                label="Address line 2 (optional)"
                placeholder="Line 2 (optional)"
                value={form.line2}
                refused={false}
                onChange={(line2) => change({ line2 })}
                {...watch('line2')}
              />
              <View style={styles.pair}>
                <AddressInput
                  label="City"
                  placeholder="City"
                  value={form.city}
                  refused={!!problems.address}
                  onChange={(city) => change({ city })}
                  {...watch('city')}
                  half
                />
                <AddressInput
                  label="State"
                  placeholder="State"
                  value={form.state}
                  refused={!!problems.address}
                  onChange={(state) => change({ state })}
                  {...watch('state')}
                  half
                />
              </View>
              <View style={styles.pair}>
                <AddressInput
                  label="PIN code"
                  placeholder="PIN code"
                  value={form.pinCode}
                  refused={!!problems.address}
                  onChange={(pinCode) => change({ pinCode })}
                  {...watch('pinCode')}
                  digits
                  half
                />
                <View style={styles.halfSpace} />
              </View>
              {problems.address ? <Problem text={problems.address} /> : null}
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.email} accessible accessibilityLabel={`Email: ${email ?? ''}`}>
                <Lock size={18} color={colors.inkMuted} />
                <Text numberOfLines={1} style={styles.emailText}>
                  {email}
                </Text>
              </View>
              <Text style={styles.hint}>{PROFILE_TEXTS.emailFixed}</Text>
            </View>
          </View>
        </>
      ) : null}

      {weightSheet ? (
        <NumberEntrySheet
          title={`${weighIn.label} · ${formatDay(today)}`}
          label={weighIn.inputLabel}
          unit={weighIn.unit}
          initialText={todaysWeight === null ? '' : weighIn.toText(todaysWeight)}
          parse={weighIn.parse}
          rule={weighIn.rule}
          decimal={weighIn.decimal}
          onSave={(grams) => sync.saveWeight(today, grams)}
          onClose={() => setWeightSheet(false)}
        />
      ) : null}
    </FormScreen>
  );
}

const DATE_FIELDS = ['day', 'month', 'year'] as const;
const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'state', 'pinCode'] as const;

/** What "Check the … to save." names for each field with a problem (D-99). */
const CHECK_NAMES: Record<keyof ProfileProblems, string> = {
  name: 'name',
  dateOfBirth: 'date of birth',
  height: 'height',
  phone: 'phone number',
  address: 'address',
};

/** Each typed field's text, by name, for its checks (D-99). */
function fieldTexts(form: ProfileForm): Record<string, string> {
  const { name, day, month, year, height, phone, line1, line2, city, state, pinCode } = form;
  return { name, day, month, year, height, phone, line1, line2, city, state, pinCode };
}

/** The date of birth's three boxes all filled, the year in four digits. */
function dateComplete(form: ProfileForm): boolean {
  return form.day.trim() !== '' && form.month.trim() !== '' && /^\d{4}$/.test(form.year.trim());
}

/** The address's four required parts all filled. */
function addressComplete(form: ProfileForm): boolean {
  return [form.line1, form.city, form.state, form.pinCode].every((part) => part.trim() !== '');
}

/** One part of the date of birth: a sunken box of digits with its name under it. */
function DatePart({
  label,
  placeholder,
  length,
  value,
  refused,
  onChange,
  onFocus,
  onBlur,
  wide = false,
}: {
  label: string;
  placeholder: string;
  length: number;
  value: string;
  refused: boolean;
  onChange(text: string): void;
  onFocus(): void;
  onBlur(): void;
  wide?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.datePart, wide && styles.datePartWide]}>
      <TextInput
        accessibilityLabel={`${label} of birth`}
        value={value}
        placeholder={placeholder}
        onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
        onFocus={onFocus}
        onBlur={onBlur}
        keyboardType="number-pad"
        maxLength={length}
        style={[styles.box, styles.dateBox, refused && styles.boxRefused]}
      />
      <Text style={styles.dateLabel}>{label}</Text>
    </View>
  );
}

/** A line of the address, in a sunken box with its placeholder. */
function AddressInput({
  label,
  placeholder,
  value,
  refused,
  onChange,
  onFocus,
  onBlur,
  digits = false,
  half = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  refused: boolean;
  onChange(text: string): void;
  onFocus(): void;
  onBlur(): void;
  digits?: boolean;
  half?: boolean;
}) {
  const styles = useStyles();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      placeholder={placeholder}
      onChangeText={(text) => onChange(digits ? text.replace(/\D/g, '') : text)}
      onFocus={onFocus}
      onBlur={onBlur}
      keyboardType={digits ? 'number-pad' : 'default'}
      autoCapitalize={digits ? 'none' : 'words'}
      // A PIN code is six digits; a line, a city or a state too long says so (D-100), not cut off.
      {...(digits ? { maxLength: 6 } : {})}
      style={[styles.box, styles.text, digits && styles.pin, half && styles.half, refused && styles.boxRefused]}
    />
  );
}

/**
 * The four choices as square blocks, two by two; the chosen one filled. Choosing it again clears it,
 * as the field is optional.
 */
function SexChoice({ value, onChange }: { value: Sex | null; onChange(sex: Sex | null): void }) {
  const styles = useStyles();
  const pill = useChoiceStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Sex" style={styles.sexes}>
      {SEXES.map((sex) => {
        const chosen = sex === value;
        return (
          <Pressable
            key={sex}
            accessibilityRole="radio"
            accessibilityLabel={`Sex: ${SEX_LABELS[sex]}`}
            accessibilityState={{ checked: chosen }}
            onPress={() => onChange(chosen ? null : sex)}
            style={({ pressed }) => [pill.choice, styles.sex, chosen && pill.chosen, pressed && pill.pressed]}
          >
            <Text style={[pill.choiceText, styles.sexText, chosen && pill.chosenText]}>{SEX_LABELS[sex]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Take photo" and "Choose from gallery": outlined, with their icon. */
function PickButton({ title, icon: Icon, disabled, onPress }: { title: string; icon: LucideIcon; disabled: boolean; onPress(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pick, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon size={16} color={colors.accent} />
      <Text style={styles.pickText}>{title}</Text>
    </Pressable>
  );
}

// 24 between sections, 14 within one; boxes as Field's (54 tall, a 1.5 outline in the subtle ink).
const useStyles = themedStyles((c) => ({
  saveHint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoActions: { flex: 1, gap: 8 },
  pick: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  pickText: { ...TYPE.buttonSecondary, fontSize: 15, letterSpacing: 1 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  stateText: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: c.inkMuted },
  problemText: { color: c.danger },
  section: { gap: 14 },
  sectionTitle: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 20, lineHeight: 22, letterSpacing: 0.5, textTransform: 'uppercase' },
  field: { gap: 8 },
  label: { ...TYPE.label, color: c.inkMuted },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  age: { ...TYPE.link, color: c.accent },
  dateRow: { flexDirection: 'row', gap: 8 },
  datePart: { flex: 1, gap: 4 },
  datePartWide: { flex: 1.5 },
  dateBox: { ...TYPE.metric, textAlign: 'center', paddingHorizontal: 4 },
  dateLabel: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', color: c.inkMuted },
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.inkSubtle,
    backgroundColor: c.surfaceSunken,
  },
  boxRefused: { borderColor: c.danger },
  number: { ...TYPE.metric, fontSize: 24, lineHeight: 28, flex: 1, paddingVertical: 10 },
  unit: { ...TYPE.label, fontSize: 16, lineHeight: 20, letterSpacing: 1 },
  prefix: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 17,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: c.border,
    color: c.inkMuted,
  },
  text: { ...TYPE.input, flex: 1, paddingVertical: 12 },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  halfSpace: { flex: 1 },
  pin: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 20, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  weight: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, borderRadius: 4, backgroundColor: c.surface },
  weightText: { flex: 1, gap: 2 },
  weightValue: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 26, lineHeight: 28, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
  hint: { ...TYPE.small, color: c.inkMuted },
  email: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  emailText: { ...TYPE.input, flex: 1, color: c.inkMuted },
  sexes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sex: { flexBasis: '40%', flexGrow: 1, minHeight: 44, paddingHorizontal: 8 },
  sexText: { fontSize: 15, letterSpacing: 0.5, textAlign: 'center' },
}));
