import { setCheckPause } from './src/fieldChecks';

// The design's fonts (typography.ts) are files the bundler serves to the app. Tests have no bundler
// to load them from, so fonts count as loaded and the app renders at once.
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));

// A field's problem shows once typing pauses for three seconds (D-99). Tests see it as soon as it is
// typed, apart from the tests of the wait, which set a short pause themselves.
beforeEach(() => setCheckPause(0));
