import { isAcceptedDateOfBirth, istToday, syncWindowStart, type LengthUnit } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { FormScreen } from '../components/FormScreen';
import { NumberEntrySheet } from '../components/NumberEntrySheet';
import { ProfileFields, ProfilePhotoEditor, useProfileChecks, type PhotoDraft } from '../components/ProfileFields';
import { andList } from '../components/MealFoods';
import { Text, TextButton } from '../components/ui';
import { dayValues } from '../dayValues';
import { formatDay, nameFromEmail } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, getMeta, listEntries, PROFILE_KEY, type LocalProfile, type LocalWeighIn } from '../local/store';
import { ageText, formFromProfile, typedDateOfBirth, type ProfileForm } from '../profile';
import { useBodyWeightUnit } from '../settings/SettingsProvider';
import { useDataVersion, useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';

// The profile (REQ-ACC-011; docs/plans/user-profile.md, Accepted; the redesign's 6.6, locked by the
// owner 2026-11-03): the photo; about you (name, date of birth with the age it gives, sex); the body
// (height in cm, or in inches when the measurements' choice is inches; the weight as the latest
// weigh-in, with today's opening the weight sheet); contact (a +91 mobile number, the address, and
// the sign-in email, read-only). Every field is optional; each problem shows under its field. It is
// saved on the phone and synced, so it works offline; the weight is a weigh-in, saved as on Home.
// Since D-99 a problem shows once typing pauses or the field is left, not when Save is pressed; the
// date of birth's and the address's wait until they are complete or left. Save waits while there is
// one, saying what to check. Since D-109 the address's State is chosen from a list of India's states
// and union territories (components/StatePicker.tsx). Since D-124 the boxes live in
// components/ProfileFields.tsx, shared with the first sign-in onboarding's About you step.
export function ProfileScreen({ now = () => new Date() }: { now?: () => Date }) {
  const styles = useStyles();
  const { email } = useAuth();
  const local = useLocalDatabase();
  const sync = useSync();
  const version = useDataVersion();
  const router = useRouter();
  const bodyWeightUnit = useBodyWeightUnit();
  const today = istToday(now());
  const db = local.state.status === 'ready' ? local.state.db : null;

  const [saved, setSaved] = useState<LocalProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [unit, setUnit] = useState<LengthUnit>('cm');
  const [photo, setPhoto] = useState<PhotoDraft>({ mediaId: null, files: null });
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
  }, [db, version]);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void listEntries(db, 'weighIn', syncWindowStart(today), today).then((weighIns) => {
      if (active) setLatest(weighIns[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, [db, today, version]);

  function change(fields: Partial<ProfileForm>) {
    edited.current = true;
    setForm((current) => (current ? { ...current, ...fields } : current));
  }

  function changePhoto(next: PhotoDraft) {
    edited.current = true;
    setPhoto(next);
  }

  const { result, problems, toCheck, watch } = useProfileChecks(form, today, unit);

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
      <ProfilePhotoEditor photo={photo} onChange={changePhoto} name={name} onPicking={setPicking} />
      {saved?.syncState === 'pending' || saved?.syncState === 'rejected' ? (
        <View style={styles.state}>
          <View style={[styles.dot, saved.syncState === 'rejected' && styles.dotProblem]} />
          <Text style={[styles.stateText, saved.syncState === 'rejected' && styles.problemText]}>
            {saved.syncState === 'pending' ? 'Waiting to sync' : 'Not saved'}
          </Text>
        </View>
      ) : null}

      {form ? (
        <ProfileFields
          form={form}
          unit={unit}
          change={change}
          problems={problems}
          watch={watch}
          age={age}
          email={email}
          weight={
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
          }
        />
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

const useStyles = themedStyles((c) => ({
  saveHint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted },
  dotProblem: { backgroundColor: c.danger },
  stateText: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: c.inkMuted },
  problemText: { color: c.danger },
  label: { ...TYPE.label, color: c.inkMuted },
  weight: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, borderRadius: 4, backgroundColor: c.surface },
  weightText: { flex: 1, gap: 2 },
  weightValue: { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 26, lineHeight: 28, textTransform: 'uppercase', fontVariant: ['tabular-nums'] },
  hint: { ...TYPE.small, color: c.inkMuted },
}));
