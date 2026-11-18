import { Platform } from 'react-native';
import appJson from '../app.json';
import { FLOATING_SHADOW } from './theme';

// The iPhone app's settings in app.json, which Expo writes into iOS's Info.plist (D-104).

type Plugin = string | [string, Record<string, unknown>];
const expo = appJson.expo;

function pluginOptions(name: string): Record<string, unknown> | undefined {
  const plugin = (expo.plugins as unknown as Plugin[]).find((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

describe('D-104 the iPhone app', () => {
  it('REQ-ACC-001 follows the phone light or dark, so Appearance System works on an iPhone', () => {
    // "light" made iOS report light always, whatever the phone's setting.
    expect(expo.userInterfaceStyle).toBe('automatic');
  });

  it('is for iPhones only, upright', () => {
    expect(expo.ios.supportsTablet).toBe(false);
    expect(expo.orientation).toBe('portrait');
  });

  it('keeps one app ID on iOS and Android', () => {
    expect(expo.ios.bundleIdentifier).toBe(expo.android.package);
  });

  it('asks for no Face ID, which the app does not use', () => {
    expect(pluginOptions('expo-secure-store')).toMatchObject({ faceIDPermission: false });
  });

  it('D-115 asks for the microphone for Speak your meal only, with one text, and blocks it nowhere', () => {
    const text = pluginOptions('expo-speech-recognition')?.microphonePermission;
    expect(text).toMatch(/^FitSphere uses the microphone only when you tap Speak your meal/);
    // `false` would make the image picker block Android's microphone permission, and empty iOS's text.
    expect(pluginOptions('expo-camera')).toMatchObject({ microphonePermission: text, recordAudioAndroid: false });
    expect(pluginOptions('expo-image-picker')).toMatchObject({ microphonePermission: text });
    expect(pluginOptions('expo-speech-recognition')?.speechRecognitionPermission).toMatch(/^FitSphere turns what you say into text on your phone/);
  });

  it('says why it asks for the camera and the photos', () => {
    for (const options of [pluginOptions('expo-camera'), pluginOptions('expo-image-picker')]) {
      expect(options?.cameraPermission).toMatch(/^FitSphere uses the camera to /);
    }
    expect(pluginOptions('expo-image-picker')?.photosPermission).toMatch(/^FitSphere uses the photo /);
  });

  it('keeps the phone database encrypted (ADR-0007 rule 5)', () => {
    expect(pluginOptions('expo-sqlite')).toMatchObject({ useSQLCipher: true });
  });

  it('draws the floating controls\' shadow with iOS\'s own shadow, as iOS has no elevation', () => {
    // The tests run as iOS (React Native's test preset).
    expect(Platform.OS).toBe('ios');
    expect(FLOATING_SHADOW).toEqual({ shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.27, shadowRadius: 4.65 });
  });
});
