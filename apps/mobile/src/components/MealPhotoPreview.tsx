import type { MealPhoto } from '@fitsphere/shared';
import { ImageOff, Link, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, View } from 'react-native';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto, type LoadedPhoto } from '../photos/loadPhoto';
import { themedStyles, useTheme } from '../theme';
import { linkSite } from './MealPhotoField';
import { Text, TextButton } from './ui';

// A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010, REQ-NFR-006). The thumbnail opens
// the viewing copy; photos are view-only, with no download. A link shows its site and opens in the
// browser; FitSphere never fetches it.
export function MealPhotoPreview({ mealId, photo }: { mealId: string; photo: MealPhoto }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const thumbnail = usePhoto(photo.kind === 'photo' ? { id: photo.mediaId, mealId } : null, 'thumbnail');

  if (photo.kind === 'link') {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open image link on ${linkSite(photo.url)}`}
        onPress={() => void Linking.openURL(photo.url)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={[styles.tile, styles.linkTile]}>
          <Link size={20} color={colors.accent} />
        </View>
        <Text style={styles.link}>Image link: {linkSite(photo.url)} ↗</Text>
      </Pressable>
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View meal photo"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [thumbnail.kind === 'ready' ? null : styles.row, pressed && styles.pressed]}
      >
        {thumbnail.kind === 'ready' ? (
          <Image accessibilityLabel="Meal photo" source={{ uri: jpegDataUri(thumbnail.base64) }} style={styles.thumbnail} />
        ) : (
          <>
            <View style={styles.tile}>
              {thumbnail.kind === 'loading' ? (
                <ActivityIndicator color={colors.accent} />
              ) : thumbnail.kind === 'offline' ? (
                <WifiOff size={20} color={colors.inkMuted} />
              ) : (
                <ImageOff size={20} color={colors.inkMuted} />
              )}
            </View>
            <Text style={styles.note}>{photoNote(thumbnail)}</Text>
          </>
        )}
      </Pressable>
      {open ? <PhotoViewer mealId={mealId} mediaId={photo.mediaId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PhotoViewer({ mealId, mediaId, onClose }: { mealId: string; mediaId: string; onClose(): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const full = usePhoto({ id: mediaId, mealId }, 'full');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <View style={styles.picture}>
          {full.kind === 'ready' ? (
            <Image accessibilityLabel="Meal photo, full size" source={{ uri: jpegDataUri(full.base64) }} style={styles.full} resizeMode="contain" />
          ) : (
            <>
              {full.kind === 'loading' ? (
                <ActivityIndicator color={colors.accent} />
              ) : full.kind === 'offline' ? (
                <WifiOff size={32} color={colors.accent} />
              ) : (
                <ImageOff size={32} color={colors.accent} />
              )}
              <Text style={styles.viewerText}>{photoNote(full)}</Text>
            </>
          )}
        </View>
        <TextButton title="Close" filled onPress={onClose} />
      </View>
    </Modal>
  );
}

function photoNote(photo: LoadedPhoto): string {
  if (photo.kind === 'loading') return 'Loading photo…';
  if (photo.kind === 'offline') return 'The photo needs an internet connection.';
  return 'Photo not available yet.';
}

// The redesign's 3.9 (locked by the owner, 2026-11-03): the thumbnail square-cornered; a photo still
// loading, or a link, as a 44 tile with its icon and a short text; the viewer's text light on its dark
// backdrop in both themes, with Close at the foot.
const useStyles = themedStyles((c) => ({
  thumbnail: { width: 64, height: 64, borderRadius: 4 },
  row: { flexShrink: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tile: { width: 44, height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken },
  linkTile: { backgroundColor: c.accentTint },
  note: { flexShrink: 1, color: c.inkMuted, fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.6 },
  link: { flexShrink: 1, fontSize: 14, lineHeight: 18, fontWeight: '600', color: c.accent },
  viewer: { flex: 1, backgroundColor: c.scrimStrong, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 34, gap: 16 },
  picture: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  full: { width: '100%', height: '100%' },
  viewerText: { fontSize: 16, lineHeight: 24, color: c.onScrim, textAlign: 'center' },
}));
