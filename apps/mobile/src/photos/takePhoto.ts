import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { PhotoFiles } from '../local/photos';
import { base64Size } from './bytes';

/** The viewing copy: long edge 1,280 px, about 200 KB (D-16, ADR-0002 rule 2). */
const FULL_EDGE = 1280;
const FULL_TARGET_BYTES = 200_000;
/** JPEG qualities tried in turn until the copy is about 200 KB; the last one is kept regardless. */
const FULL_QUALITIES = [0.7, 0.55, 0.4, 0.3];
/** The thumbnail for lists. */
const THUMBNAIL_EDGE = 240;
const THUMBNAIL_QUALITY = 0.6;

export type PickOutcome = { kind: 'picked'; files: PhotoFiles } | { kind: 'cancelled' } | { kind: 'noPermission' } | { kind: 'failed' };

/**
 * A meal photo from the camera or the gallery (REQ-LOG-006), shrunk on the phone to a viewing copy
 * and a thumbnail. Re-encoding writes new JPEGs without the original's metadata, location included
 * (ADR-0002 rule 2; checked on the phone). The image files the picker and the shrinking leave in
 * the app's cache are deleted at once; the photo is kept only in the encrypted database.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickOutcome> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { kind: 'noPermission' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { kind: 'cancelled' };
  const temporary = [asset.uri];
  try {
    const full = await encode(asset, FULL_EDGE, FULL_QUALITIES, temporary, FULL_TARGET_BYTES);
    const thumbnail = await encode(asset, THUMBNAIL_EDGE, [THUMBNAIL_QUALITY], temporary, Infinity);
    return { kind: 'picked', files: { full, thumbnail } };
  } catch {
    return { kind: 'failed' };
  } finally {
    for (const uri of temporary) deleteFromCache(uri);
  }
}

async function encode(
  asset: { uri: string; width: number; height: number },
  edge: number,
  qualities: number[],
  temporary: string[],
  targetBytes: number,
): Promise<string> {
  const size = asset.width >= asset.height ? { width: Math.min(edge, asset.width) } : { height: Math.min(edge, asset.height) };
  const image = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync();
  try {
    let base64 = '';
    for (const compress of qualities) {
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
      temporary.push(saved.uri);
      base64 = saved.base64 ?? '';
      if (base64Size(base64) <= targetBytes) break;
    }
    if (!base64) throw new Error('No image data');
    return base64;
  } finally {
    image.release();
  }
}

/** Deletes a file only inside the app's cache, so a photo in the user's gallery is never touched. */
function deleteFromCache(uri: string) {
  if (!uri.startsWith(Paths.cache.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The system clears the cache in time; nothing else depends on this file.
  }
}
