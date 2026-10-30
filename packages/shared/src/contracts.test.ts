import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  errorBodySchema,
  foodsResponseSchema,
  isPublicLink,
  mealItemSchema,
  mealPhotoSchema,
  mealSetDataSchema,
  mealTotals,
  measurementsSetDataSchema,
  meSetupRequestSchema,
  pulledWorkoutSchema,
  sleepSetDataSchema,
  stepsSetDataSchema,
  syncRequestSchema,
  syncResponseSchema,
  TARGET_KINDS,
  TARGET_RANGES,
  targetSetDataSchema,
  validationDetails,
  weighInSetDataSchema,
  workoutDeleteDataSchema,
  workoutSetDataSchema,
} from './contracts.ts';

const CHANGE_ID = '5d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const validData = { day: '2026-10-27', weightGrams: 70_250, recordedAt: '2026-10-27T02:45:10.123Z' };

function detailsFor(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected the input to be refused');
  return validationDetails(result.error, input);
}

describe('REQ-HOME-006 weighIn.set data', () => {
  it('REQ-HOME-006 accepts a valid weigh-in', () => {
    expect(weighInSetDataSchema.parse(validData)).toEqual(validData);
  });

  it('REQ-HOME-006 refuses weights outside 20–300 kg, without the value in the details', () => {
    for (const weightGrams of [19_999, 300_001]) {
      const details = detailsFor(weighInSetDataSchema, { ...validData, weightGrams });
      expect(details).toEqual([{ field: 'weightGrams', issue: 'out_of_range' }]);
      expect(JSON.stringify(details)).not.toContain(String(weightGrams));
    }
  });

  it('REQ-HOME-006 refuses a weight that is not whole grams', () => {
    expect(detailsFor(weighInSetDataSchema, { ...validData, weightGrams: 70_250.5 })).toEqual([
      { field: 'weightGrams', issue: 'invalid_format' },
    ]);
  });

  it('REQ-DATE-004 refuses a day that is not a real YYYY-MM-DD day', () => {
    for (const day of ['2026-02-30', '27-10-2026', '2026-10-27T00:00:00Z']) {
      expect(detailsFor(weighInSetDataSchema, { ...validData, day })).toEqual([
        { field: 'day', issue: 'invalid_format' },
      ]);
    }
  });

  it('REQ-DATE-004 refuses an instant that is not UTC with Z', () => {
    expect(
      detailsFor(weighInSetDataSchema, { ...validData, recordedAt: '2026-10-27T08:15:10+05:30' }),
    ).toEqual([{ field: 'recordedAt', issue: 'invalid_format' }]);
  });

  it('REQ-NFR-001 refuses unknown fields and missing ones', () => {
    expect(detailsFor(weighInSetDataSchema, { ...validData, userId: CHANGE_ID })).toEqual([
      { field: 'userId', issue: 'unknown_field' },
    ]);
    expect(detailsFor(weighInSetDataSchema, { day: '2026-10-27', recordedAt: validData.recordedAt })).toEqual([
      { field: 'weightGrams', issue: 'required' },
    ]);
  });
});

const RECORDED_AT = '2026-10-27T02:45:10.123Z';

describe('REQ-HOME-006 steps.set and sleep.set data', () => {
  it('Q-028 accepts 0–100,000 whole steps and refuses anything else', () => {
    for (const steps of [0, 8_432, 100_000]) {
      expect(stepsSetDataSchema.safeParse({ day: '2026-10-27', steps, recordedAt: RECORDED_AT }).success).toBe(true);
    }
    for (const steps of [-1, 100_001]) {
      expect(detailsFor(stepsSetDataSchema, { day: '2026-10-27', steps, recordedAt: RECORDED_AT })).toEqual([
        { field: 'steps', issue: 'out_of_range' },
      ]);
    }
    expect(detailsFor(stepsSetDataSchema, { day: '2026-10-27', steps: 1.5, recordedAt: RECORDED_AT })).toEqual([
      { field: 'steps', issue: 'invalid_format' },
    ]);
  });

  it('Q-028 accepts 0–24 h of sleep in whole minutes and refuses anything else', () => {
    for (const sleepMinutes of [0, 450, 1_440]) {
      expect(sleepSetDataSchema.safeParse({ day: '2026-10-27', sleepMinutes, recordedAt: RECORDED_AT }).success).toBe(true);
    }
    expect(detailsFor(sleepSetDataSchema, { day: '2026-10-27', sleepMinutes: 1_441, recordedAt: RECORDED_AT })).toEqual([
      { field: 'sleepMinutes', issue: 'out_of_range' },
    ]);
  });

  it('REQ-NFR-001 refuses unknown fields', () => {
    expect(
      detailsFor(stepsSetDataSchema, { day: '2026-10-27', steps: 10, recordedAt: RECORDED_AT, userId: CHANGE_ID }),
    ).toEqual([{ field: 'userId', issue: 'unknown_field' }]);
  });
});

describe('REQ-MEAS-004…006 measurements.set data', () => {
  const measurements = {
    day: '2026-10-27',
    upperWaistMm: 812,
    lowerWaistMm: 845,
    chestMm: null,
    hipsMm: null,
    armMm: null,
    thighMm: null,
    notes: null,
    recordedAt: RECORDED_AT,
  };

  it('REQ-MEAS-004 accepts both waist values with the optional fields empty', () => {
    expect(measurementsSetDataSchema.parse(measurements)).toEqual(measurements);
  });

  it('REQ-MEAS-005 accepts the optional fields and notes', () => {
    const full = { ...measurements, chestMm: 990, hipsMm: 1_000, armMm: 330, thighMm: 560, notes: 'After a rest day' };
    expect(measurementsSetDataSchema.parse(full)).toEqual(full);
  });

  it('REQ-MEAS-004 refuses a missing waist value', () => {
    const withoutLower: Record<string, unknown> = { ...measurements };
    delete withoutLower.lowerWaistMm;
    expect(detailsFor(measurementsSetDataSchema, withoutLower)).toEqual([{ field: 'lowerWaistMm', issue: 'required' }]);
  });

  it('Q-028 refuses values outside 10–250 cm in any field', () => {
    expect(detailsFor(measurementsSetDataSchema, { ...measurements, upperWaistMm: 99 })).toEqual([
      { field: 'upperWaistMm', issue: 'out_of_range' },
    ]);
    expect(detailsFor(measurementsSetDataSchema, { ...measurements, thighMm: 2_501 })).toEqual([
      { field: 'thighMm', issue: 'out_of_range' },
    ]);
  });

  it('D-23 refuses notes over 500 characters, and empty notes (no value is null)', () => {
    expect(detailsFor(measurementsSetDataSchema, { ...measurements, notes: 'x'.repeat(501) })).toEqual([
      { field: 'notes', issue: 'out_of_range' },
    ]);
    expect(detailsFor(measurementsSetDataSchema, { ...measurements, notes: '' })).toEqual([
      { field: 'notes', issue: 'out_of_range' },
    ]);
  });
});

describe('REQ-TRN-003 workout.set and workout.delete data', () => {
  const WORKOUT_ID = '0b9e1d2c-3a4f-4e5d-8c7b-6a5f4e3d2c1b';
  const exercise = { name: 'Squat', sets: 3, reps: 10, weightGrams: 40_000, note: null };
  const workout = { id: WORKOUT_ID, day: '2026-10-27', exercises: [exercise], recordedAt: RECORDED_AT };

  it('Q-025 accepts an empty workout, and Q-042 exercises with or without a weight and a note', () => {
    expect(workoutSetDataSchema.parse({ ...workout, exercises: [] })).toEqual({ ...workout, exercises: [] });
    const exercises = [exercise, { name: 'Push-up', sets: 2, reps: 20, weightGrams: null, note: 'Slow on the way down' }];
    expect(workoutSetDataSchema.parse({ ...workout, exercises })).toEqual({ ...workout, exercises });
  });

  it('D-29 accepts each limit and refuses one step outside it', () => {
    const at = (fields: Record<string, unknown>) => ({ ...workout, exercises: [{ ...exercise, ...fields }] });
    for (const fields of [{ sets: 1 }, { sets: 20 }, { reps: 1 }, { reps: 200 }, { weightGrams: 100 }, { weightGrams: 500_000 }]) {
      expect(workoutSetDataSchema.safeParse(at(fields)).success).toBe(true);
    }
    for (const [fields, field] of [
      [{ sets: 0 }, 'sets'],
      [{ sets: 21 }, 'sets'],
      [{ reps: 0 }, 'reps'],
      [{ reps: 201 }, 'reps'],
      [{ weightGrams: 99 }, 'weightGrams'],
      [{ weightGrams: 500_001 }, 'weightGrams'],
      [{ name: 'x'.repeat(81) }, 'name'],
      [{ note: 'x'.repeat(501) }, 'note'],
      [{ note: '' }, 'note'],
    ] as const) {
      expect(detailsFor(workoutSetDataSchema, at(fields))).toEqual([{ field: `exercises[0].${field}`, issue: 'out_of_range' }]);
    }
  });

  it('D-29 refuses a name of spaces only, and keeps a trimmed name', () => {
    expect(workoutSetDataSchema.safeParse({ ...workout, exercises: [{ ...exercise, name: '   ' }] }).success).toBe(false);
    expect(workoutSetDataSchema.parse({ ...workout, exercises: [{ ...exercise, name: ' Squat ' }] }).exercises[0]?.name).toBe(
      'Squat',
    );
  });

  it('D-29 refuses more than 30 exercises', () => {
    const exercises = Array.from({ length: 31 }, () => exercise);
    expect(detailsFor(workoutSetDataSchema, { ...workout, exercises })).toEqual([{ field: 'exercises', issue: 'too_many' }]);
  });

  it('REQ-NFR-001 refuses unknown fields, and an ID that is not a UUID', () => {
    expect(detailsFor(workoutSetDataSchema, { ...workout, userId: CHANGE_ID })).toEqual([
      { field: 'userId', issue: 'unknown_field' },
    ]);
    expect(detailsFor(workoutSetDataSchema, { ...workout, exercises: [{ ...exercise, rpe: 8 }] })).toEqual([
      { field: 'exercises[0].rpe', issue: 'unknown_field' },
    ]);
    expect(detailsFor(workoutDeleteDataSchema, { id: 'abc', deletedAt: RECORDED_AT })).toEqual([
      { field: 'id', issue: 'invalid_format' },
    ]);
  });

  it('D-29 a pulled workout is either the whole workout or a deleted one with no content', () => {
    const live = { deleted: false, ...workout, updatedAt: RECORDED_AT };
    const deleted = { deleted: true, id: WORKOUT_ID, day: '2026-10-27', updatedAt: RECORDED_AT };
    expect(pulledWorkoutSchema.parse(live)).toEqual(live);
    expect(pulledWorkoutSchema.parse({ ...deleted, exercises: [exercise] })).toEqual(deleted);
  });
});

describe('REQ-ROLE-007 target.set data', () => {
  it('D-23 accepts each kind at both ends of its range and refuses one step outside', () => {
    for (const kind of TARGET_KINDS) {
      const { min, max } = TARGET_RANGES[kind];
      for (const value of [min, max]) {
        expect(targetSetDataSchema.safeParse({ kind, value, setAt: RECORDED_AT }).success).toBe(true);
      }
      for (const value of [min - 1, max + 1]) {
        expect(targetSetDataSchema.safeParse({ kind, value, setAt: RECORDED_AT }).success).toBe(false);
      }
    }
  });

  it('D-23 checks the range of the kind given', () => {
    expect(targetSetDataSchema.safeParse({ kind: 'weekly_workouts', value: 2_000, setAt: RECORDED_AT }).success).toBe(false);
    expect(targetSetDataSchema.safeParse({ kind: 'calories', value: 2_000, setAt: RECORDED_AT }).success).toBe(true);
  });

  it('invariant #2 refuses a change that names who set the target, and an unknown kind', () => {
    expect(
      detailsFor(targetSetDataSchema, { kind: 'calories', value: 2_000, setAt: RECORDED_AT, setByUserId: CHANGE_ID }),
    ).toEqual([{ field: 'setByUserId', issue: 'unknown_field' }]);
    expect(targetSetDataSchema.safeParse({ kind: 'carbs', value: 200, setAt: RECORDED_AT }).success).toBe(false);
  });
});

describe('REQ-NFR-004 sync request and response', () => {
  it('REQ-NFR-004 accepts the request from the contract', () => {
    const request = {
      cursor: null,
      changes: [{ changeId: CHANGE_ID, type: 'weighIn.set', data: validData }],
    };
    expect(syncRequestSchema.parse(request)).toEqual(request);
  });

  it('REQ-NFR-004 refuses unknown fields in the envelope and gives the field path', () => {
    const request = {
      cursor: null,
      changes: [{ changeId: CHANGE_ID, type: 'weighIn.set', data: validData, userId: CHANGE_ID }],
    };
    expect(detailsFor(syncRequestSchema, request)).toEqual([
      { field: 'changes[0].userId', issue: 'unknown_field' },
    ]);
  });

  it('REQ-NFR-004 refuses a change ID that is not a UUID', () => {
    const request = { cursor: null, changes: [{ changeId: 'abc', type: 'weighIn.set', data: {} }] };
    expect(detailsFor(syncRequestSchema, request)).toEqual([
      { field: 'changes[0].changeId', issue: 'invalid_format' },
    ]);
  });

  it('REQ-NFR-004 more than 100 changes is too many', () => {
    const change = { changeId: CHANGE_ID, type: 'weighIn.set', data: validData };
    const request = { cursor: null, changes: Array.from({ length: 101 }, () => change) };
    expect(detailsFor(syncRequestSchema, request)).toEqual([{ field: 'changes', issue: 'too_many' }]);
  });

  it('REQ-NFR-004 reads the response from the contract and ignores added fields', () => {
    const response = {
      results: [{ changeId: CHANGE_ID, status: 'accepted', error: null }],
      pull: {
        weighIns: [{ ...validData, updatedAt: '2026-10-27T02:45:11.004Z', addedLater: 1 }],
        steps: [],
        sleep: [],
        measurements: [],
        workouts: [],
        targets: [],
        meals: [],
        savedMeals: [],
        removals: [],
      },
      cursor: 'opaque-string',
      hasMore: false,
    };
    const parsed = syncResponseSchema.parse(response);
    expect(parsed.pull.weighIns[0]).not.toHaveProperty('addedLater');
  });
});

describe('REQ-ACC-010 account setup request', () => {
  it('REQ-ACC-010 accepts the confirmation and its text version', () => {
    const body = { ageConfirmed: true, ageConfirmationTextVersion: '2026-10-27' };
    expect(meSetupRequestSchema.parse(body)).toEqual(body);
  });

  it('REQ-ACC-010 refuses an email in the body as an unknown field', () => {
    const body = {
      ageConfirmed: true,
      ageConfirmationTextVersion: '2026-10-27',
      email: 'someone@example.com',
    };
    const details = detailsFor(meSetupRequestSchema, body);
    expect(details).toEqual([{ field: 'email', issue: 'unknown_field' }]);
    expect(JSON.stringify(details)).not.toContain('@example.com');
  });
});

describe('Error body', () => {
  it('reads the error shape from the error model', () => {
    const body = {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Some fields are not valid.',
        retryable: false,
        requestId: '8b0e7c1e-3f0a-4a51-9c39-2f0d5d7b6a10',
        details: [{ field: 'changes[0].data.weightGrams', issue: 'out_of_range' }],
      },
    };
    expect(errorBodySchema.parse(body)).toEqual(body);
  });
});

describe('REQ-LOG-007 meal items and totals (D-26)', () => {
  const item = {
    source: 'ifct2017' as const,
    ref: 'A019',
    name: 'Wheat flour, atta',
    amount: { unit: 'g' as const, value: 60 },
    kcal: 192,
    proteinG: 6.34,
    carbsG: 38.5,
    fatG: 0.92,
    fibreG: 6.82,
    estimated: false,
  };

  // A synthetic dish (D-28): made-up values.
  const dish = { ...item, source: 'dish' as const, ref: 'test_dal', name: 'Test dal', estimated: true };

  it('accepts whole grams from 1 to 2,000 and portions in halves from 0.5 to 10', () => {
    for (const amount of [
      { unit: 'g', value: 1 },
      { unit: 'g', value: 2_000 },
    ]) {
      expect(mealItemSchema.safeParse({ ...item, amount }).success).toBe(true);
    }
    for (const amount of [
      { unit: 'portion', value: 0.5 },
      { unit: 'portion', value: 10 },
    ]) {
      expect(mealItemSchema.safeParse({ ...dish, amount }).success).toBe(true);
    }
    for (const amount of [
      { unit: 'g', value: 0 },
      { unit: 'g', value: 12.5 },
      { unit: 'cup', value: 1 },
    ]) {
      expect(mealItemSchema.safeParse({ ...item, amount }).success).toBe(false);
    }
    for (const amount of [
      { unit: 'portion', value: 0.25 },
      { unit: 'portion', value: 10.5 },
    ]) {
      expect(mealItemSchema.safeParse({ ...dish, amount }).success).toBe(false);
    }
  });

  it('D-28 a dish is in portions, and every other food in grams', () => {
    expect(mealItemSchema.safeParse({ ...dish, amount: { unit: 'portion', value: 1.5 } }).success).toBe(true);
    for (const [source, amount] of [
      ['dish', { unit: 'g', value: 60 }],
      ['ifct2017', { unit: 'portion', value: 1 }],
      ['barcode', { unit: 'portion', value: 1 }],
      ['own', { unit: 'portion', value: 1 }],
    ] as const) {
      const result = mealItemSchema.safeParse({ ...item, source, amount });
      expect(result.success).toBe(false);
      expect(result.error && validationDetails(result.error, {})).toEqual([{ field: 'amount', issue: 'invalid_format' }]);
    }
  });

  it('D-28 the food list carries the dishes, per portion; both are null when the phone is current', () => {
    const flatbread = { code: 'test_flatbread', name: 'Test flatbread', portionUnit: 'piece', kcal: 120, proteinG: 3.6, carbsG: 20, fatG: 3, fibreG: 2 };
    expect(foodsResponseSchema.safeParse({ version: 'v1', items: [], dishes: [flatbread] }).success).toBe(true);
    expect(foodsResponseSchema.safeParse({ version: 'v1', items: null, dishes: null }).success).toBe(true);
    expect(foodsResponseSchema.safeParse({ version: 'v1', items: [], dishes: [{ ...flatbread, portionUnit: 'cup' }] }).success).toBe(false);
  });

  it('sums the known values, and gives null only when no item has that value', () => {
    expect(mealTotals([item, { ...item, kcal: 45, proteinG: 0, carbsG: null, fatG: 5, fibreG: null }])).toEqual({
      kcal: 237,
      proteinG: 6.34,
      carbsG: 38.5,
      fatG: 5.92,
      fibreG: 6.82,
    });
    expect(mealTotals([{ ...item, fibreG: null }]).fibreG).toBeNull();
  });

  it('rounds totals to hundredths, so float sums stay exact', () => {
    expect(mealTotals([{ ...item, proteinG: 0.1 }, { ...item, proteinG: 0.2 }]).proteinG).toBe(0.3);
  });

  it('refuses a meal without items, or one that sets its own totals', () => {
    const meal = {
      id: CHANGE_ID,
      day: '2026-10-27',
      mealType: 'lunch',
      tags: [],
      items: [item],
      recordedAt: '2026-10-27T02:45:10.123Z',
    };
    expect(mealSetDataSchema.safeParse(meal).success).toBe(true);
    expect(mealSetDataSchema.safeParse({ ...meal, items: [] }).success).toBe(false);
    expect(detailsFor(mealSetDataSchema, { ...meal, totals: { kcal: 1 } })).toEqual([{ field: 'totals', issue: 'unknown_field' }]);
  });
});

describe('REQ-LOG-006 and REQ-LOG-010 a meal’s photo or public link (D-26)', () => {
  const meal = {
    id: CHANGE_ID,
    day: '2026-10-27',
    mealType: 'lunch',
    tags: [],
    items: [
      {
        source: 'own',
        ref: null,
        name: 'Synthetic snack bar',
        amount: { unit: 'g', value: 40 },
        kcal: 180,
        proteinG: 4,
        carbsG: null,
        fatG: null,
        fibreG: null,
        estimated: false,
      },
    ],
    recordedAt: '2026-10-27T02:45:10.123Z',
  };

  it('a meal has no photo, one photo named by an ID, or one link; leaving it out means none', () => {
    expect(mealSetDataSchema.safeParse(meal).success).toBe(true);
    expect(mealSetDataSchema.safeParse({ ...meal, photo: null }).success).toBe(true);
    expect(mealSetDataSchema.safeParse({ ...meal, photo: { kind: 'photo', mediaId: CHANGE_ID } }).success).toBe(true);
    expect(mealSetDataSchema.safeParse({ ...meal, photo: { kind: 'link', url: 'https://images.example.com/a.jpg' } }).success).toBe(true);
    expect(mealPhotoSchema.safeParse({ kind: 'photo', mediaId: 'photo-1' }).success).toBe(false);
    expect(mealPhotoSchema.safeParse({ kind: 'photo', mediaId: CHANGE_ID, url: 'https://images.example.com/a.jpg' }).success).toBe(false);
  });

  it('a public link is https with a host name, no user name or password, and at most 2,000 characters', () => {
    expect(isPublicLink('https://images.example.com/meal.jpg?size=large')).toBe(true);
    expect(isPublicLink('HTTPS://Images.Example.COM/Meal.jpg')).toBe(true);
    for (const text of [
      'http://images.example.com/meal.jpg',
      'javascript:alert(1)',
      'data:image/jpeg;base64,AAAA',
      'https://localhost/meal.jpg',
      'https://name:secret@images.example.com/meal.jpg',
      'https://name@images.example.com/meal.jpg',
      'images.example.com/meal.jpg',
      `https://images.example.com/${'a'.repeat(2_000)}`,
    ]) {
      expect(isPublicLink(text), text).toBe(false);
    }
  });
});
