// D-121, plan step 4: the Health Connect adapter, with the native library replaced by a fake. It checks
// what is asked of Health Connect (steps and weight, read only), the India-day boundaries and the units.
// The library itself, on a phone, is tested by the owner (plan, Phase 2).
const mockLib = {
  sdkStatus: 3,
  granted: [] as { accessType: string; recordType: string }[],
  grantOnRequest: [] as { accessType: string; recordType: string }[],
  requested: [] as unknown[],
  initialized: 0,
  aggregates: [] as { recordType: string; timeRangeFilter: { startTime: string; endTime: string } }[],
  totals: {} as Record<string, number>,
  weightPages: [] as { records: unknown[]; pageToken?: string }[],
  weightRequests: [] as { timeRangeFilter: unknown; pageToken?: string }[],
};

jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  getSdkStatus: async () => mockLib.sdkStatus,
  initialize: async () => {
    mockLib.initialized += 1;
    return true;
  },
  getGrantedPermissions: async () => mockLib.granted,
  requestPermission: async (permissions: unknown[]) => {
    mockLib.requested.push(permissions);
    mockLib.granted = mockLib.grantOnRequest;
    return mockLib.granted;
  },
  aggregateRecord: async (request: { recordType: string; timeRangeFilter: { startTime: string; endTime: string } }) => {
    mockLib.aggregates.push(request);
    return { COUNT_TOTAL: mockLib.totals[request.timeRangeFilter.startTime] ?? 0 };
  },
  readRecords: async (_type: string, options: { timeRangeFilter: unknown; pageToken?: string }) => {
    mockLib.weightRequests.push(options);
    return mockLib.weightPages.shift() ?? { records: [] };
  },
}));

import { healthConnect, istDayStart, PERMISSIONS } from './healthConnect';

const STEPS = { accessType: 'read', recordType: 'Steps' };
const WEIGHT = { accessType: 'read', recordType: 'Weight' };

beforeEach(() => {
  Object.assign(mockLib, {
    sdkStatus: 3,
    granted: [],
    grantOnRequest: [],
    requested: [],
    aggregates: [],
    totals: {},
    weightPages: [],
    weightRequests: [],
  });
});

describe('D-121 the Health Connect adapter', () => {
  it('asks for steps and body weight, read only, and nothing else', () => {
    expect(PERMISSIONS).toEqual([STEPS, WEIGHT]);
  });

  it('says what Health Connect is: available, to install, or not on this phone', async () => {
    mockLib.sdkStatus = 3;
    expect(await healthConnect.availability()).toBe('available');
    mockLib.sdkStatus = 2;
    expect(await healthConnect.availability()).toBe('needs_install');
    mockLib.sdkStatus = 1;
    expect(await healthConnect.availability()).toBe('not_supported');
  });

  it('has access only when both steps and weight are allowed', async () => {
    expect(await healthConnect.hasAccess()).toBe(false);
    mockLib.granted = [STEPS];
    expect(await healthConnect.hasAccess()).toBe(false);
    mockLib.granted = [STEPS, WEIGHT, { accessType: 'read', recordType: 'HeartRate' }];
    expect(await healthConnect.hasAccess()).toBe(true);
  });

  it('requestAccess asks for those two and is true only if both were granted', async () => {
    mockLib.grantOnRequest = [STEPS];
    expect(await healthConnect.requestAccess()).toBe(false);
    expect(mockLib.requested[0]).toEqual([STEPS, WEIGHT]);

    mockLib.grantOnRequest = [STEPS, WEIGHT];
    expect(await healthConnect.requestAccess()).toBe(true);
  });

  it('initialises the client once', async () => {
    await healthConnect.hasAccess();
    await healthConnect.readSteps('2026-10-28', '2026-10-28');
    expect(mockLib.initialized).toBeLessThanOrEqual(1);
  });

  it('an India day starts at 18:30 UTC the evening before', () => {
    expect(istDayStart('2026-10-28')).toBe('2026-10-27T18:30:00.000Z');
  });

  it('steps: one aggregate per India day, each from that day\'s start to the next, zero days left out', async () => {
    mockLib.totals[istDayStart('2026-10-27')] = 5_400.4;
    mockLib.totals[istDayStart('2026-10-29')] = 12;

    const days = await healthConnect.readSteps('2026-10-27', '2026-10-29');

    expect(days).toEqual([
      { day: '2026-10-27', steps: 5_400 },
      { day: '2026-10-29', steps: 12 },
    ]);
    expect(mockLib.aggregates.map((request) => [request.recordType, request.timeRangeFilter.startTime, request.timeRangeFilter.endTime])).toEqual([
      ['Steps', '2026-10-26T18:30:00.000Z', '2026-10-27T18:30:00.000Z'],
      ['Steps', '2026-10-27T18:30:00.000Z', '2026-10-28T18:30:00.000Z'],
      ['Steps', '2026-10-28T18:30:00.000Z', '2026-10-29T18:30:00.000Z'],
    ]);
  });

  it('weights: every page, from the start of the first India day to the end of the last, in grams, a zero one left out', async () => {
    mockLib.weightPages = [
      { records: [{ time: '2026-10-27T03:00:00Z', weight: { inGrams: 70_250, inKilograms: 70.25 } }], pageToken: 'next' },
      {
        records: [
          { time: '2026-10-28T03:00:00Z', weight: { inGrams: 70_306.7, inPounds: 155 } },
          { time: '2026-10-28T04:00:00Z', weight: { inGrams: 0 } },
        ],
      },
    ];

    const weights = await healthConnect.readWeights('2026-10-27', '2026-10-28');

    expect(weights.map((reading) => [reading.at, Math.round(reading.grams)])).toEqual([
      ['2026-10-27T03:00:00Z', 70_250],
      ['2026-10-28T03:00:00Z', 70_307],
    ]);
    expect(mockLib.weightRequests).toHaveLength(2);
    expect(mockLib.weightRequests[0]?.timeRangeFilter).toEqual({
      operator: 'between',
      startTime: '2026-10-26T18:30:00.000Z',
      endTime: '2026-10-28T18:30:00.000Z',
    });
    expect(mockLib.weightRequests[1]?.pageToken).toBe('next');
  });
});
