import type { MealPhoto } from '@fitsphere/shared';
import { useState } from 'react';
import { Button, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { jpegDataUri } from '../photos/bytes';
import { usePhoto, type LoadedPhoto } from '../photos/loadPhoto';
import { linkSite } from './MealPhotoField';

// A logged meal's photo or image link (REQ-LOG-006, REQ-LOG-010, REQ-NFR-006). The thumbnail opens
// the viewing copy; photos are view-only, with no download. A link shows its site and opens in the
// browser; FitSphere never fetches it.
export function MealPhotoPreview({ mealId, photo }: { mealId: string; photo: MealPhoto }) {
  const [open, setOpen] = useState(false);
  const thumbnail = usePhoto(photo.kind === 'photo' ? { id: photo.mediaId, mealId } : null, 'thumbnail');

  if (photo.kind === 'link') {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open image link on ${linkSite(photo.url)}`}
        onPress={() => void Linking.openURL(photo.url)}
      >
        <Text style={styles.link}>Image link: {linkSite(photo.url)} ↗</Text>
      </Pressable>
    );
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="View meal photo" onPress={() => setOpen(true)}>
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
  const full = usePhoto({ id: mediaId, mealId }, 'full');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {full.kind === 'ready' ? (
          <Image accessibilityLabel="Meal photo, full size" source={{ uri: jpegDataUri(full.base64) }} style={styles.full} resizeMode="contain" />
        ) : (
          <Text style={styles.viewerText}>{photoNote(full)}</Text>
        )}
        <Button title="Close" onPress={onClose} />
      </View>
    </Modal>
  );
}

function photoNote(photo: LoadedPhoto): string {
  if (photo.kind === 'loading') return 'Loading photo…';
  if (photo.kind === 'offline') return 'The photo needs an internet connection.';
  return 'Photo not available yet.';
}

const styles = StyleSheet.create({
  thumbnail: { width: 64, height: 64, borderRadius: 8 },
  note: { color: '#555', fontSize: 12 },
  link: { color: '#0d47a1' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 16, gap: 16 },
  full: { width: '100%', height: '80%' },
  viewerText: { color: '#fff', textAlign: 'center' },
});
