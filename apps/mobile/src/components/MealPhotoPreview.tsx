import type { MealPhoto } from '@fitsphere/shared';
import { useState } from 'react';
import { Image, Linking, Modal, Pressable, View } from 'react-native';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto, type LoadedPhoto } from '../photos/loadPhoto';
import { themedStyles } from '../theme';
import { linkSite } from './MealPhotoField';
import { Text, TextButton } from './ui';

// A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010, REQ-NFR-006). The thumbnail opens
// the viewing copy; photos are view-only, with no download. A link shows its site and opens in the
// browser; FitSphere never fetches it.
export function MealPhotoPreview({ mealId, photo }: { mealId: string; photo: MealPhoto }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const thumbnail = usePhoto(photo.kind === 'photo' ? { id: photo.mediaId, mealId } : null, 'thumbnail');

  if (photo.kind === 'link') {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open image link on ${linkSite(photo.url)}`}
        onPress={() => void Linking.openURL(photo.url)}
        style={({ pressed }) => pressed && styles.pressed}
      >
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
        style={({ pressed }) => pressed && styles.pressed}
      >
        {thumbnail.kind === 'ready' ? (
          <Image accessibilityLabel="Meal photo" source={{ uri: jpegDataUri(thumbnail.base64) }} style={styles.thumbnail} />
        ) : (
          <Text style={styles.note}>{photoNote(thumbnail)}</Text>
        )}
      </Pressable>
      {open ? <PhotoViewer mealId={mealId} mediaId={photo.mediaId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PhotoViewer({ mealId, mediaId, onClose }: { mealId: string; mediaId: string; onClose(): void }) {
  const styles = useStyles();
  const full = usePhoto({ id: mediaId, mealId }, 'full');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {full.kind === 'ready' ? (
          <Image accessibilityLabel="Meal photo, full size" source={{ uri: jpegDataUri(full.base64) }} style={styles.full} resizeMode="contain" />
        ) : (
          <Text style={styles.viewerText}>{photoNote(full)}</Text>
        )}
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

// The thumbnail is a tile (radius 12); the viewer's Close is filled, to show on the dark backdrop.
const useStyles = themedStyles((c) => ({
  thumbnail: { width: 64, height: 64, borderRadius: 12 },
  note: { color: c.textMuted, fontSize: 13 },
  pressed: { opacity: 0.6 },
  link: { fontSize: 13, fontWeight: '600', color: c.primary },
  viewer: { flex: 1, backgroundColor: c.scrimStrong, justifyContent: 'center', padding: 16, gap: 16 },
  full: { width: '100%', height: '80%' },
  viewerText: { color: c.onPrimary, textAlign: 'center' },
}));
