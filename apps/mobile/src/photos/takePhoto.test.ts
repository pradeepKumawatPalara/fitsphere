import { pickPhoto } from './takePhoto';

// Taking or choosing a meal photo and shrinking it on the phone (REQ-LOG-006; D-16; ADR-0002 rule
// 2). The camera, gallery, image encoder and files are fakes; sizes are what the fake encoder says.

const mockCache = 'file:///data/user/0/app/cache/';
const CACHE = mockCache;
const mockPicker = {
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
/** Base64 length the fake encoder returns for each JPEG quality; 4 characters are 3 bytes. */
let mockSizes: Record<number, number> = {};
const mockResizes: unknown[] = [];
const mockCrops: unknown[] = [];
const mockSaves: { compress: number }[] = [];
const mockDeleted: string[] = [];
let mockSaved = 0;

// The import of the module under test runs first, so the fake delegates to `mockPicker` when called.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockPicker.requestCameraPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockPicker.launchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockPicker.launchImageLibraryAsync(...args),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize(size: unknown) {
        mockResizes.push(size);
        return this;
      },
      crop(rect: unknown) {
        mockCrops.push(rect);
        return this;
      },
      renderAsync: async () => ({
        release: jest.fn(),
        saveAsync: async ({ compress }: { compress: number }) => {
          mockSaves.push({ compress });
          mockSaved += 1;
          return { uri: `${mockCache}manipulated-${mockSaved}.jpg`, base64: 'A'.repeat(mockSizes[compress] ?? 400) };
        },
      }),
    }),
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///data/user/0/app/cache/' } },
  File: class {
    uri: string;
    exists = true;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSizes = {};
  mockResizes.length = 0;
  mockSaves.length = 0;
  mockDeleted.length = 0;
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
});

function picked(uri: string, width = 4000, height = 3000) {
  return { canceled: false, assets: [{ uri, width, height }] };
}

it('shrinks to a 1,280 px viewing copy of about 200 KB, lowering the quality until it fits, and a 240 px thumbnail', async () => {
  mockPicker.launchCameraAsync.mockResolvedValue(picked(`${CACHE}ImagePicker/photo.jpg`));
  mockSizes = { 0.7: 400_000, 0.55: 300_000, 0.4: 260_000 };

  const outcome = await pickPhoto('camera');

  expect(outcome).toEqual({ kind: 'picked', files: { full: 'A'.repeat(260_000), thumbnail: 'A'.repeat(400) } });
  expect(mockResizes).toEqual([{ width: 1280 }, { width: 240 }]);
  expect(mockSaves.map((save) => save.compress)).toEqual([0.7, 0.55, 0.4, 0.6]);
  expect(mockPicker.launchCameraAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: false });
});

it('a portrait photo is limited by its height; a small one is not enlarged', async () => {
  mockPicker.launchImageLibraryAsync.mockResolvedValue(picked(`${CACHE}ImagePicker/tall.jpg`, 900, 1600));

  await pickPhoto('library');

  expect(mockResizes).toEqual([{ height: 1280 }, { height: 240 }]);
  mockResizes.length = 0;
  mockPicker.launchImageLibraryAsync.mockResolvedValue(picked(`${CACHE}ImagePicker/small.jpg`, 200, 150));
  await pickPhoto('library');
  expect(mockResizes).toEqual([{ width: 200 }, { width: 200 }]);
});

it('deletes every temporary image file at once, but never a file outside the app’s cache', async () => {
  mockPicker.launchCameraAsync.mockResolvedValue(picked(`${CACHE}ImagePicker/photo.jpg`));
  await pickPhoto('camera');
  expect(mockDeleted).toEqual([`${CACHE}ImagePicker/photo.jpg`, ...[...Array(mockSaved).keys()].slice(-2).map((n) => `${CACHE}manipulated-${n + 1}.jpg`)]);

  mockDeleted.length = 0;
  mockPicker.launchImageLibraryAsync.mockResolvedValue(picked('content://media/external/images/media/42'));
  await pickPhoto('library');
  expect(mockDeleted.every((uri) => uri.startsWith(CACHE))).toBe(true);
  expect(mockDeleted).not.toContain('content://media/external/images/media/42');
});

it('without camera permission, or when cancelled, nothing is taken', async () => {
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  expect(await pickPhoto('camera')).toEqual({ kind: 'noPermission' });
  expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();

  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickPhoto('library')).toEqual({ kind: 'cancelled' });
});

it('REQ-ACC-011 a profile photo is its middle square, then shrunk the same way', async () => {
  mockCrops.length = 0;
  mockPicker.launchImageLibraryAsync.mockResolvedValue(picked(`${CACHE}ImagePicker/wide.jpg`, 4000, 3000));

  await pickPhoto('library', 'square');

  expect(mockCrops).toEqual([
    { originX: 500, originY: 0, width: 3000, height: 3000 },
    { originX: 500, originY: 0, width: 3000, height: 3000 },
  ]);
  expect(mockResizes).toEqual([{ width: 1280 }, { width: 240 }]);
});
