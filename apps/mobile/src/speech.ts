// Speech to text on the phone only (ADR-0005, D-18, D-115): the phone's own recognizer, asked to work
// on the device (`requiresOnDeviceRecognition`), so the voice never leaves the phone and no audio is
// kept. The native part comes with a development build made after D-115; on an older build, or a
// phone that can't recognise speech on the device, `canListen` is false and "Speak your meal" is not
// shown (B-15). The module is reached through Expo's optional loader, so an older build never fails
// to start. Tests replace this file with a fake (jest.mock).
import { requireOptionalNativeModule } from 'expo';

/** The languages the mic offers (D-115): English (India) by default, or Hindi, in Settings. */
export const VOICE_LANGUAGES = ['en-IN', 'hi-IN'] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];
export const DEFAULT_VOICE_LANGUAGE: VoiceLanguage = 'en-IN';

/** Listening stops by itself after this long, at the latest (D-115). */
export const LISTEN_MAX_MS = 30_000;
/**
 * Listening stops after this long with no words heard (the owner's phone test, 2026-11-17: "stop
 * listen if there is a pause more than 6 seconds"); a shorter pause doesn't end it.
 */
export const SILENCE_ALLOWED_MS = 6_000;
/** SILENCE_ALLOWED_MS, read through a function so tests can shorten it. */
export function silenceAllowedMs(): number {
  return SILENCE_ALLOWED_MS;
}

export type MicPermission = 'granted' | 'ask' | 'denied';

export type ListenEvents = {
  /**
   * The words of the piece being heard (`final` once the recognizer is done with that piece; the next
   * piece starts afresh, so the caller adds the final pieces together).
   */
  onWords(text: string, final: boolean): void;
  /** The recognizer ended: on `stop`, after an error, or by itself on a long pause (then listen again). */
  onEnd(): void;
  /** The recognizer's error code ("no-speech", "not-allowed", "language-not-supported"…). */
  onError(code: string): void;
};

export interface SpeechEngine {
  /** Whether this build has the module and the phone can recognise speech on the device. */
  canListen(): boolean;
  permission(): Promise<MicPermission>;
  /** Asks for the microphone (and, on iOS, speech recognition): true when granted. */
  requestPermission(): Promise<boolean>;
  /** Starts listening; the returned function stops the events. */
  listen(language: VoiceLanguage, events: ListenEvents): () => void;
  /** Ends listening, keeping the words heard so far. */
  stop(): void;
  /** Ends listening, dropping the rest. */
  abort(): void;
  /** The languages this phone can recognise on the device, or null when it can't say. */
  installedLanguages(): Promise<string[] | null>;
  /** Asks the phone to download a language's offline speech pack (Android 13 and later). */
  downloadLanguage(language: VoiceLanguage): Promise<boolean>;
}

type Subscription = { remove(): void };
type PermissionAnswer = { granted: boolean; canAskAgain: boolean };
/** The part of expo-speech-recognition's native module used here. */
type NativeSpeech = {
  supportsOnDeviceRecognition(): boolean;
  isRecognitionAvailable(): boolean;
  getPermissionsAsync(): Promise<PermissionAnswer>;
  requestPermissionsAsync(): Promise<PermissionAnswer>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  getSupportedLocales(options: { androidRecognitionServicePackage?: string }): Promise<{ locales: string[]; installedLocales: string[] }>;
  androidTriggerOfflineModelDownload(options: { locale: string }): Promise<{ status: string }>;
  addListener(event: string, listener: (event: never) => void): Subscription;
};

/** Android's on-device recognition service, which lists the languages installed for offline use. */
const ON_DEVICE_SERVICE = 'com.google.android.as';

function nativeEngine(native: NativeSpeech): SpeechEngine {
  return {
    canListen() {
      try {
        return native.isRecognitionAvailable() && native.supportsOnDeviceRecognition();
      } catch {
        return false;
      }
    },
    async permission() {
      const answer = await native.getPermissionsAsync();
      return answer.granted ? 'granted' : answer.canAskAgain ? 'ask' : 'denied';
    },
    async requestPermission() {
      return (await native.requestPermissionsAsync()).granted;
    },
    listen(language, events) {
      const subscriptions = [
        native.addListener('result', ((event: { isFinal: boolean; results: { transcript: string }[] }) => {
          const text = event.results[0]?.transcript ?? '';
          if (text !== '') events.onWords(text, event.isFinal);
        }) as (event: never) => void),
        native.addListener('error', ((event: { error: string }) => events.onError(event.error)) as (event: never) => void),
        native.addListener('end', (() => events.onEnd()) as (event: never) => void),
      ];
      native.start({
        lang: language,
        interimResults: true,
        // The voice never leaves the phone (D-18): no recognition over the network.
        requiresOnDeviceRecognition: true,
        // Keeps listening through pauses until stopped (Android 13 and later, iOS); where the phone
        // still ends on a pause, the caller listens again (D-115).
        continuous: true,
        maxAlternatives: 1,
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_ALLOWED_MS,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_ALLOWED_MS,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: LISTEN_MAX_MS,
        },
      });
      return () => subscriptions.forEach((subscription) => subscription.remove());
    },
    stop: () => native.stop(),
    abort: () => native.abort(),
    async installedLanguages() {
      try {
        const { installedLocales } = await native.getSupportedLocales({ androidRecognitionServicePackage: ON_DEVICE_SERVICE });
        return installedLocales.length > 0 ? installedLocales : null;
      } catch {
        return null;
      }
    },
    async downloadLanguage(language) {
      try {
        await native.androidTriggerOfflineModelDownload({ locale: language });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** No module in this build: nothing to listen with, so no mic is shown. */
const NO_SPEECH: SpeechEngine = {
  canListen: () => false,
  permission: async () => 'denied',
  requestPermission: async () => false,
  listen: () => () => undefined,
  stop: () => undefined,
  abort: () => undefined,
  installedLanguages: async () => null,
  downloadLanguage: async () => false,
};

let engine: SpeechEngine | null = null;

export function speechEngine(): SpeechEngine {
  if (!engine) {
    const native = requireOptionalNativeModule<NativeSpeech>('ExpoSpeechRecognition');
    engine = native ? nativeEngine(native) : NO_SPEECH;
  }
  return engine;
}

/** Whether a language is on the phone for offline use; true when the phone can't say (it is tried). */
export function languageInstalled(installed: string[] | null, language: VoiceLanguage): boolean {
  if (installed === null) return true;
  const wanted = language.toLowerCase();
  return installed.some((locale) => {
    const have = locale.toLowerCase().replace('_', '-');
    return have === wanted || have === wanted.slice(0, 2);
  });
}
