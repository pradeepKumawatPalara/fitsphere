// The icon font (@expo/vector-icons) is a file the bundler serves to the app. Tests have no bundler
// to load it from, so fonts count as loaded and each icon renders its glyph at once.
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
