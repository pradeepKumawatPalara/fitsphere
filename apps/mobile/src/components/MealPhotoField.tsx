import { isPublicLink } from '@fitsphere/shared';
import { Image as ImageIcon, Link, TriangleAlert, WifiOff, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import type { PhotoFiles } from '../local/photos';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto } from '../photos/loadPhoto';
import { pickPhoto } from '../photos/takePhoto';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { ActionsSheet } from './MealSheets';
import { Banner, Field, Problem, Text, TextButton } from './ui';
import { useFieldChecks } from '../fieldChecks';

/** The meal's photo while it is being logged: a new one with its files, the one it had, or a link. */
export type PhotoDraft = { kind: 'photo'; mediaId: string; files: PhotoFiles | null } | { kind: 'link'; url: string } | null;

/** REQ-LOG-010's warning, without the coach clause: there are no coaches in the MVP (D-20, D-26). */
export const LINK_WARNING = 'Anyone who has this link can view it. FitSphere cannot delete content stored on other sites.';

/** The site a link points to, shown instead of the whole link. */
export function linkSite(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// The meal's one photo or public image link in Log meal (REQ-LOG-006, REQ-LOG-010; MVP default,
// D-26). A photo is taken or chosen, then shrunk on the phone. A link is https only and is saved
// only after the user confirms the privacy warning; FitSphere never opens or fetches it here.
export function MealPhotoField({
  mealId,
  value,
  onChange,
  newId,
}: {
  mealId: string;
  value: PhotoDraft;
  onChange(draft: PhotoDraft): void;
  newId(): string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkStep, setLinkStep] = useState<'enter' | 'confirm' | null>(null);
  const [linkText, setLinkText] = useState('');
  // The link's rule shows once typing pauses or the box is left (D-99).
  const checks = useFieldChecks({ link: linkText });
  const existing = value?.kind === 'photo' && !value.files ? { id: value.mediaId, mealId } : null;
  const loaded = usePhoto(existing, 'thumbnail');
  const thumbnail = value?.kind === 'photo' ? (value.files?.thumbnail ?? (loaded.kind === 'ready' ? loaded.base64 : null)) : null;

  async function pick(source: 'camera' | 'library') {
    setProblem(null);
    setBusy(true);
    const outcome = await pickPhoto(source).catch(() => ({ kind: 'failed' }) as const);
    setBusy(false);
    if (outcome.kind === 'picked') onChange({ kind: 'photo', mediaId: newId(), files: outcome.files });
    else if (outcome.kind === 'noPermission') setProblem('FitSphere needs the camera to take a photo. You can choose one from the gallery instead.');
    else if (outcome.kind === 'failed') setProblem('This photo could not be used. Try another one.');
  }

  const linkValid = isPublicLink(linkText.trim());
  const offline = loaded.kind === 'offline';
  return (
    <View style={styles.field}>
      <Text accessibilityRole="header" style={styles.heading}>
        Photo (optional)
      </Text>
      {value === null ? (
        <>
          <View style={styles.pickRow}>
            <PickButton title="Take photo" disabled={busy} onPress={() => void pick('camera')} />
            <PickButton title="Choose from gallery" disabled={busy} onPress={() => void pick('library')} />
          </View>
          <TextButton
            title="Add an image link instead"
            disabled={busy}
            onPress={() => {
              setLinkText('');
              setLinkStep('enter');
            }}
          />
        </>
      ) : (
        <View style={styles.attached}>
          {value.kind === 'photo' && thumbnail ? (
            <Image accessibilityLabel="Meal photo" source={{ uri: jpegDataUri(thumbnail) }} style={styles.thumbnail} />
          ) : (
            <View style={styles.tile}>
              {value.kind === 'link' ? (
                <Link size={26} color={colors.accent} />
              ) : offline ? (
                <WifiOff size={26} color={colors.inkMuted} />
              ) : (
                <ImageIcon size={26} color={colors.inkMuted} />
              )}
            </View>
          )}
          <View style={styles.attachedText}>
            {value.kind === 'link' ? (
              <Text accessibilityLabel={`Image link: ${linkSite(value.url)}`} style={styles.linkText}>
                Image link: {linkSite(value.url)}
              </Text>
            ) : !thumbnail ? (
              <Text style={styles.hint}>{offline ? 'The photo needs an internet connection.' : 'Photo'}</Text>
            ) : null}
            <TextButton title={value.kind === 'link' ? 'Remove link' : 'Remove photo'} icon={X} onPress={() => onChange(null)} />
          </View>
        </View>
      )}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          <Text accessibilityRole="progressbar" style={styles.hint}>
            Preparing the photo…
          </Text>
        </View>
      ) : null}
      {problem ? <Problem text={problem} /> : null}

      {linkStep === 'enter' ? (
        <ActionsSheet
          title="Add an image link"
          actions={linkValid ? [{ label: 'Continue', onPress: () => setLinkStep('confirm') }] : []}
          onClose={() => setLinkStep((step) => (step === 'enter' ? null : step))}
        >
          <Text style={styles.body}>A link to your own image on another site, starting with https://</Text>
          <Field
            label="Image link"
            value={linkText}
            onChangeText={setLinkText}
            autoCorrect={false}
            keyboardType="url"
            error={linkText.trim() !== '' && !linkValid && checks.shows('link') ? 'Enter a link that starts with https://' : null}
            onFocus={() => checks.focus('link')}
            onBlur={() => checks.blur('link')}
          />
        </ActionsSheet>
      ) : null}
      {linkStep === 'confirm' ? (
        <ActionsSheet
          title="Add this link?"
          actions={[{ label: 'Add link', onPress: () => onChange({ kind: 'link', url: linkText.trim() }) }]}
          onClose={() => setLinkStep(null)}
        >
          <Banner tone="info" icon={TriangleAlert} text={LINK_WARNING} />
        </ActionsSheet>
      ) : null}
    </View>
  );
}

/** Taking or choosing a photo: half the row each, outlined, as Log meal's other choices (3.5). */
function PickButton({ title, disabled, onPress }: { title: string; disabled: boolean; onPress(): void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pick, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.pickText}>{title}</Text>
    </Pressable>
  );
}

// The redesign's 3.9 (locked by the owner, 2026-11-03): headed as Log meal's other parts; the photo,
// or a tile for a photo still loading or a link, with Remove beside it on a raised card; the link's
// warning as a caramel banner.
const useStyles = themedStyles((c) => ({
  field: { gap: 10 },
  heading: { ...TYPE.label, color: c.inkMuted },
  pickRow: { flexDirection: 'row', gap: 8 },
  pick: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  pickText: { ...TYPE.buttonSecondary, fontSize: 15, letterSpacing: 1, textAlign: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  attached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  thumbnail: { width: 72, height: 72, borderRadius: 4 },
  tile: { width: 72, height: 72, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  attachedText: { flex: 1, alignItems: 'flex-start', gap: 4 },
  linkText: { fontSize: 15, lineHeight: 20 },
  hint: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  body: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
}));
