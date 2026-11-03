import { isPublicLink } from '@fitsphere/shared';
import { useState } from 'react';
import { Image, View } from 'react-native';
import type { PhotoFiles } from '../local/photos';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto } from '../photos/loadPhoto';
import { pickPhoto } from '../photos/takePhoto';
import { themedStyles } from '../theme';
import { ActionsSheet } from './MealSheets';
import { Text, TextButton, TextInput, useFieldInputStyle } from './ui';

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
  const fieldInput = useFieldInputStyle();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkStep, setLinkStep] = useState<'enter' | 'confirm' | null>(null);
  const [linkText, setLinkText] = useState('');
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
  return (
    <View style={styles.field}>
      <Text accessibilityRole="header" style={styles.heading}>
        Photo (optional)
      </Text>
      {value === null ? (
        <View style={styles.buttons}>
          <View style={styles.row}>
            <TextButton title="Take photo" outlined disabled={busy} onPress={() => void pick('camera')} />
            <TextButton title="Choose from gallery" outlined disabled={busy} onPress={() => void pick('library')} />
          </View>
          <TextButton
            title="Add an image link instead"
            disabled={busy}
            onPress={() => {
              setLinkText('');
              setLinkStep('enter');
            }}
          />
        </View>
      ) : value.kind === 'photo' ? (
        <View style={styles.row}>
          {thumbnail ? (
            <Image accessibilityLabel="Meal photo" source={{ uri: jpegDataUri(thumbnail) }} style={styles.thumbnail} />
          ) : (
            <Text style={styles.hint}>{loaded.kind === 'offline' ? 'The photo needs an internet connection.' : 'Photo'}</Text>
          )}
          {/* Wrapped, so the link centres beside the photo. */}
          <View>
            <TextButton title="Remove photo" onPress={() => onChange(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Text accessibilityLabel={`Image link: ${linkSite(value.url)}`}>Image link: {linkSite(value.url)}</Text>
          <View>
            <TextButton title="Remove link" onPress={() => onChange(null)} />
          </View>
        </View>
      )}
      {busy ? (
        <Text accessibilityRole="progressbar" style={styles.hint}>
          Preparing the photo…
        </Text>
      ) : null}
      {problem ? (
        <Text accessibilityRole="alert" style={styles.problem}>
          {problem}
        </Text>
      ) : null}

      {linkStep === 'enter' ? (
        <ActionsSheet
          title="Add an image link"
          actions={linkValid ? [{ label: 'Continue', onPress: () => setLinkStep('confirm') }] : []}
          onClose={() => setLinkStep((step) => (step === 'enter' ? null : step))}
        >
          <Text style={styles.body}>A link to your own image on another site, starting with https://</Text>
          <TextInput
            accessibilityLabel="Image link"
            value={linkText}
            onChangeText={setLinkText}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={fieldInput}
          />
          {linkText.trim() !== '' && !linkValid ? <Text style={styles.problem}>Enter a link that starts with https://</Text> : null}
        </ActionsSheet>
      ) : null}
      {linkStep === 'confirm' ? (
        <ActionsSheet
          title="Add this link?"
          actions={[{ label: 'Add link', onPress: () => onChange({ kind: 'link', url: linkText.trim() }) }]}
          onClose={() => setLinkStep(null)}
        >
          <Text accessibilityRole="alert">{LINK_WARNING}</Text>
        </ActionsSheet>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  field: { gap: 12 },
  heading: { fontSize: 15, fontWeight: '600' },
  buttons: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  thumbnail: { width: 72, height: 72, borderRadius: 12 },
  hint: { fontSize: 13, color: c.textMuted },
  body: { fontSize: 15 },
  problem: { color: c.error },
}));
