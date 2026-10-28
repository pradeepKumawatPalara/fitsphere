import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  errorBodySchema,
  meSetupRequestSchema,
  syncRequestSchema,
  syncResponseSchema,
  validationDetails,
  weighInSetDataSchema,
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
