import type { BodyWeightUnit } from '@fitsphere/shared';
import { useBodyWeightUnit } from '../settings/SettingsProvider';

/**
 * The body-weight unit Progress shows weights in (REQ-ACC-003): the Settings slice's body-weight
 * unit setting. Every Progress weight goes through this one hook (agreed with slice 6, D-30).
 */
export function useProgressWeightUnit(): BodyWeightUnit {
  return useBodyWeightUnit();
}
