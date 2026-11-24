import { describe, expect, it } from 'vitest';
import { exerciseListVersion } from './exercises.ts';
import { foodListVersion } from './foods.ts';

// D-126: the lists' versions are worked out exactly as before the change, so a phone whose copy is
// current stays current when the new API is deployed, and downloads nothing. The expected values were
// computed with the code before D-126 (foods.ts's foodListVersion and its call, exercises.ts's hash) on
// these rows. Synthetic rows, shaped as PostgreSQL returns them; made-up values.

const FOOD_ROWS = {
  foods: [{ source: 'ifct2017', code: 'T001', name: 'Test grain', food_group: 'Test group', aliases: ['test grain'], protein_g: '10.50', fibre_g: null, fat_g: '1.20', carbs_g: '70.00', kcal: '340.00', estimated: false, opens_on: null }],
  dishes: [{ code: 'test_dal', name: 'Test dal', portion_unit: 'katori', kcal: '138.82', protein_g: '7.42', carbs_g: '19.60', fat_g: '3.05', fibre_g: '3.33' }],
  measures: [{ source: 'ifct2017', code: 'T001', measure: 'katori', grams: '129.00' }],
  portions: [{ source: 'indb', code: 'T002', label: 'Bowl', grams: '180.00' }],
  packaged: [{ barcode: '89000000000011', name: 'Test biscuit', brand: 'Test brand', kcal: '480.00', protein_g: '6.00', carbs_g: '70.00', fat_g: '20.00', fibre_g: null, serving_grams: '25.00', aliases: [], opens_on: null }],
  packagedPortions: [{ barcode: '89000000000011', label: 'Piece', grams: '8.00' }],
};

const EXERCISE_ROWS = {
  exercises: [{ code: 'test_press', name: 'Test press', exercise_group: 'strength', log_type: 'weights', aliases: [], compendium_code: null, met: '3.50', places: [{ category: 'Test category', subGroup: null }] }],
  speeds: [{ exercise_code: 'test_run', from_kmh: '8.0', compendium_code: '12030', met: '8.3' }],
  details: [{ exercise_code: 'test_press', category: 'Test category', sub_group: null, primary_muscle: 'Test muscle', muscles_worked: ['Test muscle'], equipment: 'Test bar', tags: [], how_to: ['Step one'], watch_for: 'Test note', video_url: null }],
};

describe('D-126 the lists keep their versions', () => {
  it('gives the food list the version it had before', () => {
    expect(foodListVersion(FOOD_ROWS)).toBe('ism6qUhE0HhFk0JIJK5EJ4');
  });

  it('gives the food list the same version whatever order the fields are handed in', () => {
    const { packagedPortions, packaged, portions, measures, dishes, foods } = FOOD_ROWS;
    expect(foodListVersion({ packagedPortions, packaged, portions, measures, dishes, foods })).toBe('ism6qUhE0HhFk0JIJK5EJ4');
  });

  it('gives the exercise list the version it had before, whatever order the fields are handed in', () => {
    expect(exerciseListVersion(EXERCISE_ROWS)).toBe('2fTnS-e_TBJ63ZAA-ThBWC');
    const { details, speeds, exercises } = EXERCISE_ROWS;
    expect(exerciseListVersion({ details, speeds, exercises })).toBe('2fTnS-e_TBJ63ZAA-ThBWC');
  });

  it('gives a new version when any value changes', () => {
    const changed = { ...FOOD_ROWS, packagedPortions: [{ ...FOOD_ROWS.packagedPortions[0], grams: '9.00' }] };
    expect(foodListVersion(changed)).not.toBe('ism6qUhE0HhFk0JIJK5EJ4');
  });
});
