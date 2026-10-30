import type { BodyWeightUnit } from '@fitsphere/shared';
import { BODY_WEIGHT_UNIT } from '../format';

/**
 * The body-weight unit Progress shows weights in (REQ-ACC-003). Every Progress weight goes
 * through this one hook; when the Settings slice's setting is on main, it returns
 * `useBodyWeightUnit()` instead (agreed with slice 6, D-P1).
 */
export function useProgressWeightUnit(): BodyWeightUnit {
  return BODY_WEIGHT_UNIT;
}
