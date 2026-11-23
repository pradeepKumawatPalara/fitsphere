// The Android adapter: Health Connect through react-native-health-connect (D-121, ADR-0013, plan step 4).
// It asks for steps and body weight, read only, and nothing else. Steps are Health Connect's own total for
// each India day (its aggregate call counts overlapping apps once); weigh-ins are read as records.
import { addDays, type IstDay } from '@fitsphere/shared';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { Linking } from 'react-native';
import type { DaySteps, HealthAvailability, HealthSource, WeightReading } from './types';

/** The two data types asked for, read only. Nothing else is ever requested. */
export const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Weight' },
] as const;

const PLAY_APP = 'market://details?id=com.google.android.apps.healthdata';
const PLAY_WEB = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

/** The first instant of an India day, as the UTC time Health Connect is asked about. */
export function istDayStart(day: IstDay): string {
  return new Date(`${day}T00:00:00+05:30`).toISOString();
}

let ready: Promise<boolean> | null = null;
/** Health Connect's client must be initialised once before any other call. */
function initialised(): Promise<boolean> {
  ready ??= initialize().catch(() => false);
  return ready;
}

export const healthConnect: HealthSource = {
  async availability(): Promise<HealthAvailability> {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs_install';
    return 'not_supported';
  },

  async hasAccess(): Promise<boolean> {
    if (!(await initialised())) return false;
    const granted = await getGrantedPermissions();
    return PERMISSIONS.every((wanted) =>
      granted.some((have) => 'recordType' in have && have.recordType === wanted.recordType && have.accessType === wanted.accessType),
    );
  },

  async requestAccess(): Promise<boolean> {
    if (!(await initialised())) return false;
    await requestPermission([...PERMISSIONS]);
    // What was granted, not what the call says: the user may allow one and not the other.
    return healthConnect.hasAccess();
  },

  async readSteps(from: IstDay, to: IstDay): Promise<DaySteps[]> {
    if (!(await initialised())) return [];
    const days: DaySteps[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const total = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: { operator: 'between', startTime: istDayStart(day), endTime: istDayStart(addDays(day, 1)) },
      });
      const steps = Math.round(total.COUNT_TOTAL);
      if (steps > 0) days.push({ day, steps });
    }
    return days;
  },

  async readWeights(from: IstDay, to: IstDay): Promise<WeightReading[]> {
    if (!(await initialised())) return [];
    const readings: WeightReading[] = [];
    let pageToken: string | undefined;
    do {
      const page = await readRecords('Weight', {
        timeRangeFilter: { operator: 'between', startTime: istDayStart(from), endTime: istDayStart(addDays(to, 1)) },
        pageSize: 500,
        ...(pageToken ? { pageToken } : {}),
      });
      for (const record of page.records) {
        // Health Connect gives a weight in every unit; grams are the phone's own (invariant #6).
        const grams = record.weight.inGrams;
        if (Number.isFinite(grams) && grams > 0) readings.push({ at: record.time, grams });
      }
      pageToken = page.pageToken || undefined;
    } while (pageToken);
    return readings;
  },

  openInstall(): void {
    Linking.openURL(PLAY_APP).catch(() => Linking.openURL(PLAY_WEB).catch(() => undefined));
  },
};
