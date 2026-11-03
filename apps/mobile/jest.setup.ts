// The design's fonts (typography.ts) are files the bundler serves to the app. Tests have no bundler
// to load them from, so fonts count as loaded and the app renders at once.
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
