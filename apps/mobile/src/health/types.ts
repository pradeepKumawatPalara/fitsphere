// A phone's health store as a source of the user's own steps and weight (D-121, ADR-0013,
// docs/plans/health-connect.md). One adapter per store; the rules for what is imported (`importHealth.ts`)
// know nothing of any store, so Apple Health later is one more adapter.
import type { IstDay } from '@fitsphere/shared';

/** `needs_install`: Health Connect is not on the phone yet (Android 13 and older, or removed). */
export type HealthAvailability = 'available' | 'needs_install' | 'not_supported';

/** One IST day's steps, the store's own total for that day (overlapping apps counted once). */
export type DaySteps = { day: IstDay; steps: number };

/** A weigh-in the store holds: when it was taken (an instant) and the weight in whole or part grams. */
export type WeightReading = { at: string; grams: number };

export type HealthSource = {
  /** The data types this source asks for: steps and body weight, read only. */
  availability(): Promise<HealthAvailability>;
  /** Whether the user has allowed steps and weight, on the operating system's own screen. */
  hasAccess(): Promise<boolean>;
  /** Opens that screen; true when both were allowed. */
  requestAccess(): Promise<boolean>;
  /** The day totals from `from` to `to`, both IST days, today included. */
  readSteps(from: IstDay, to: IstDay): Promise<DaySteps[]>;
  /** The weigh-ins taken from the start of `from` to the end of `to` (IST days). */
  readWeights(from: IstDay, to: IstDay): Promise<WeightReading[]>;
  /** Opens where the user can get Health Connect (the Play Store), when `needs_install`. */
  openInstall(): void;
};
