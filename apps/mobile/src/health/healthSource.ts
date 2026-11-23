// The phone's health store, as this build has it (D-121). The Health Connect adapter comes with the
// development build made in step 4 of docs/plans/health-connect.md: until then every build answers
// `not_supported`, so the Connections row says so and nothing is read. Tests replace this file with a
// fake (jest.mock), as they do speech.ts.
import type { HealthSource } from './types';

const NOT_IN_THIS_BUILD: HealthSource = {
  availability: async () => 'not_supported',
  hasAccess: async () => false,
  requestAccess: async () => false,
  readSteps: async () => [],
  readWeights: async () => [],
  openInstall: () => undefined,
};

export function healthSource(): HealthSource {
  return NOT_IN_THIS_BUILD;
}
