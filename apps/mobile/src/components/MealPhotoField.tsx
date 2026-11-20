import { isPublicLink } from '@fitsphere/shared';
import { Camera, Image as ImageIcon, Link, TriangleAlert, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import type { PhotoFiles } from '../local/photos';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto } from '../photos/loadPhoto';
import { pickPhoto } from '../photos/takePhoto';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { ActionsSheet } from './MealSheets';
import { Sheet } from './Sheet';
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
  chooser,
  onChooserClose,
  onPicked,
}: {
  mealId: string;
  value: PhotoDraft;
  onChange(draft: PhotoDraft): void;
  newId(): string;
  /** The camera icon beside Speak your meal was tapped: "Add a photo" is open (the owner's redesign, 2026-11-18). */
  chooser: boolean;
  onChooserClose(): void;
  /** A photo was taken or chosen: its shrunk copy, for AI to read the foods in it (D-118). When given, the photo is not attached to the meal. */
  onPicked?(imageBase64: string): void;
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
    if (outcome.kind === 'picked') {
      // With a reader (Log meal), the picture is only read by AI and not attached (the owner, 2026-11-19).
      if (onPicked) onPicked(outcome.files.full);
      else onChange({ kind: 'photo', mediaId: newId(), files: outcome.files });
    }
    else if (outcome.kind === 'noPermission') setProblem('FitSphere needs the camera to take a photo. You can choose one from the gallery instead.');
    else if (outcome.kind === 'failed') setProblem('This photo could not be used. Try another one.');
  }

  const linkValid = isPublicLink(linkText.trim());
  const offline = loaded.kind === 'offline';
  return (
    <View style={styles.field}>
      {value !== null ? (
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
      ) : null}
      {chooser ? (
        <Sheet title="Add a photo" onClose={onChooserClose} actions={<TextButton title="Cancel" outlined wide onPress={onChooserClose} />}>
          <Banner tone="info" text="The photo is read by AI (OpenAI) to estimate the foods and their nutrition. It is not saved." />
          <ChooserRow
            icon={Camera}
            title="Take photo"
            tint={colors.accentTint}
            ink={colors.accent}
            disabled={busy}
            onPress={() => {
              onChooserClose();
              void pick('camera');
            }}
          />
          <ChooserRow
            icon={ImageIcon}
            title="Choose from gallery"
            tint={colors.fatTint}
            ink={colors.fat}
            disabled={busy}
            onPress={() => {
              onChooserClose();
              void pick('library');
            }}
          />
          <ChooserRow
            icon={Link}
            title="Add an image link instead"
            tint={colors.warningTint}
            ink={colors.warning}
            disabled={busy}
            onPress={() => {
              onChooserClose();
              setLinkText('');
              setLinkStep('enter');
            }}
          />
        </Sheet>
      ) : null}
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

/** One way to add a photo, in "Add a photo": its icon on its own tint, its name beside it. */
function ChooserRow({
  icon: Icon,
  title,
  tint,
  ink,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  tint: string;
  ink: string;
  disabled: boolean;
  onPress(): void;
}) {
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
      <View style={[styles.pickIcon, { backgroundColor: tint }]}>
        <Icon size={24} color={ink} />
      </View>
      <Text style={styles.pickText}>{title}</Text>
    </Pressable>
  );
}

// The redesign's 3.9 (locked by the owner, 2026-11-03), now opened by the camera icon beside Speak your meal
// (the owner, 2026-11-18): no heading of its own; the photo,
// or a tile for a photo still loading or a link, with Remove beside it on a raised card; the link's
// warning as a caramel banner.
const useStyles = themedStyles((c) => ({
  field: { gap: 10 },
  pick: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  pickIcon: { width: 44, height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  pickText: { ...TYPE.buttonSecondary, flex: 1, fontSize: 16, letterSpacing: 1 },
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
