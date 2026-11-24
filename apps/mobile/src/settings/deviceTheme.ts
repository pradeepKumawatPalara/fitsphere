import { SETTING_VALUES, type ThemePreference } from '@fitsphere/shared';
import * as SecureStore from 'expo-secure-store';

// The last Appearance choice, kept on the phone itself, outside the signed-in user's database (REQ-ACC-001).
// Log out deletes that database, so without this copy the screen fell back to "System" (the phone's own
// light or dark) the moment the user logged out, and the sign-in screens never knew the choice. It holds one
// word, never a secret, and is replaced by the account's own saved choice as soon as that is read.

const KEY = 'fitsphere_device_theme';

/** The saved choice, or null when there is none or it cannot be read (the defaults then apply). */
export async function readDeviceTheme(): Promise<ThemePreference | null> {
  try {
    const value = await SecureStore.getItemAsync(KEY);
    return value !== null && (SETTING_VALUES.theme as readonly string[]).includes(value) ? (value as ThemePreference) : null;
  } catch {
    return null;
  }
}

/** Keeps the choice; a failure only means the next log out falls back to System. */
export async function writeDeviceTheme(preference: ThemePreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, preference);
  } catch {
    // Nothing to do: the choice still applies while the app is open.
  }
}
