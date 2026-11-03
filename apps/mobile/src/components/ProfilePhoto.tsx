import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getEntry, PROFILE_KEY, type LocalProfile } from '../local/store';
import { usePhoto } from '../photos/loadPhoto';
import { jpegDataUri } from '../photos/bytes';
import { initialOf } from '../profile';
import { useSync } from '../sync/SyncProvider';
import { themedStyles } from '../theme';
import { Text } from './ui';

/** The profile on this phone (REQ-ACC-011), read again after each save and sync; null for none yet. */
export function useProfile(): LocalProfile | null {
  const local = useLocalDatabase();
  const { version } = useSync();
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void getEntry(local.state.db, 'profile', PROFILE_KEY).then((found) => {
      if (active) setProfile(found);
    });
    return () => {
      active = false;
    };
  }, [local.state, version]);
  return profile;
}

/**
 * The profile photo as a square with rounded corners (the header 44, Settings 64, Profile 96), or,
 * with none, the name's initial on caramel (D-35). `files` shows a photo just taken, not saved yet;
 * otherwise `mediaId`'s thumbnail is read from the phone, or once from storage.
 */
export function ProfilePhoto({
  mediaId,
  thumbnail,
  name,
  size,
}: {
  mediaId: string | null;
  /** A photo taken on the Profile screen and not saved yet. */
  thumbnail?: string | null;
  name: string;
  size: 44 | 64 | 96;
}) {
  const styles = useStyles();
  const loaded = usePhoto(thumbnail || !mediaId ? null : { id: mediaId, mealId: PROFILE_KEY }, 'thumbnail');
  const base64 = thumbnail ?? (loaded.kind === 'ready' ? loaded.base64 : null);
  const frame = { width: size, height: size };
  if (base64) return <Image accessibilityLabel="Profile photo" source={{ uri: jpegDataUri(base64) }} style={[styles.photo, frame]} />;
  return (
    <View style={[styles.initialTile, frame]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Text style={[styles.initial, { fontSize: size === 96 ? 44 : size === 64 ? 30 : 22, lineHeight: size === 96 ? 48 : size === 64 ? 34 : 26 }]}>
        {initialOf(name)}
      </Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  photo: { borderRadius: 8, backgroundColor: c.surfaceSunken },
  initialTile: { borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: 'BarlowCondensed_800ExtraBold', color: c.onPrimary },
}));
