// The phone's health store, as this build has it (D-121). On Android the Health Connect adapter
// (healthConnect.ts), loaded when first asked: a build made before the library was added, an iPhone and
// anything that fails to load answer `not_supported`, so the Connections row says so and nothing is read
// (the same care as speech.ts). Tests replace this file with a fake (jest.mock).
import { Platform } from 'react-native';
import type { HealthSource } from './types';

const NOT_IN_THIS_BUILD: HealthSource = {
  availability: async () => 'not_supported',
  hasAccess: async () => false,
  requestAccess: async () => false,
  readSteps: async () => [],
  readWeights: async () => [],
  openInstall: () => undefined,
};

let chosen: HealthSource | null = null;

export function healthSource(): HealthSource {
  if (chosen) return chosen;
  chosen = NOT_IN_THIS_BUILD;
  if (Platform.OS === 'android') {
    try {
      // Loaded here, not at the top, so a build without the native module never fails to start.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      chosen = (require('./healthConnect') as typeof import('./healthConnect')).healthConnect;
    } catch {
      chosen = NOT_IN_THIS_BUILD;
    }
  }
  return chosen;
}
