import { describe, expect, it } from 'vitest';
import {
  addDays,
  isFutureIstDay,
  isIstDay,
  istDayOf,
  istToday,
  istWeekDays,
  istWeekStart,
  yearsBetween,
} from './dates.ts';

// CI runs these under TZ=Asia/Kolkata and TZ=America/Los_Angeles (invariant #5).

describe('REQ-DATE-004 IST day boundaries', () => {
  it('REQ-DATE-004 18:29:59Z is still the same IST day', () => {
    expect(istDayOf(new Date('2026-10-27T18:29:59Z'))).toBe('2026-10-27');
    expect(istDayOf(new Date('2026-10-27T18:29:59.999Z'))).toBe('2026-10-27');
  });

  it('REQ-DATE-004 18:30:00Z is the next IST day', () => {
    expect(istDayOf(new Date('2026-10-27T18:30:00Z'))).toBe('2026-10-28');
  });

  it('REQ-DATE-004 an entry at 23:50 IST belongs to that IST date', () => {
    // 23:50 IST on 27 October is 18:20 UTC.
    expect(istDayOf(new Date('2026-10-27T18:20:00Z'))).toBe('2026-10-27');
  });

  it('REQ-DATE-004 00:10 IST belongs to the new IST date while UTC is still on the old one', () => {
    expect(istDayOf(new Date('2026-10-27T18:40:00Z'))).toBe('2026-10-28');
  });

  it('REQ-DATE-004 today comes from the UTC clock, across a year end', () => {
    expect(istToday(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
});

describe('REQ-DATE-001 future days', () => {
  const now = new Date('2026-10-27T18:29:59Z'); // 23:59:59 IST on 27 October

  it('REQ-DATE-001 today and past days are not in the future', () => {
    expect(isFutureIstDay('2026-10-27', now)).toBe(false);
    expect(isFutureIstDay('2026-10-26', now)).toBe(false);
  });

  it('REQ-DATE-001 tomorrow in IST is in the future', () => {
    expect(isFutureIstDay('2026-10-28', now)).toBe(true);
  });

  it('REQ-DATE-001 tomorrow becomes today at 00:00 IST', () => {
    expect(isFutureIstDay('2026-10-28', new Date('2026-10-27T18:30:00Z'))).toBe(false);
  });
});

describe('REQ-HOME-002 Mon–Sun IST week', () => {
  it('REQ-HOME-002 a Wednesday belongs to the week starting on Monday', () => {
    expect(istWeekStart('2026-10-28')).toBe('2026-10-26');
  });

  it('REQ-HOME-002 Monday starts its own week and Sunday ends it', () => {
    expect(istWeekStart('2026-10-26')).toBe('2026-10-26');
    expect(istWeekStart('2026-11-01')).toBe('2026-10-26');
    expect(istWeekStart('2026-11-02')).toBe('2026-11-02');
  });

  it('REQ-HOME-002 a week crossing a month and a year end has seven days', () => {
    expect(istWeekDays('2026-12-31')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });

  it('REQ-HOME-002 the IST week follows the IST day, not the UTC day', () => {
    // Sunday 23:59:59 UTC is already Monday in IST.
    const day = istDayOf(new Date('2026-11-01T23:59:59Z'));
    expect(day).toBe('2026-11-02');
    expect(istWeekStart(day)).toBe('2026-11-02');
  });
});

describe('IST day helpers', () => {
  it('adds and subtracts days across months and leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-10-28', -90)).toBe('2026-07-30');
  });

  it('REQ-ACC-011 counts whole years between two days, a 29 February birthday from 1 March', () => {
    expect(yearsBetween('1994-06-14', '2026-06-13')).toBe(31);
    expect(yearsBetween('1994-06-14', '2026-06-14')).toBe(32);
    expect(yearsBetween('2008-02-29', '2026-02-28')).toBe(17);
    expect(yearsBetween('2008-02-29', '2026-03-01')).toBe(18);
    expect(yearsBetween('2008-02-29', '2028-02-29')).toBe(20);
  });

  it('accepts only real YYYY-MM-DD days', () => {
    expect(isIstDay('2026-10-28')).toBe(true);
    expect(isIstDay('2028-02-29')).toBe(true);
    expect(isIstDay('2026-02-29')).toBe(false);
    expect(isIstDay('2026-13-01')).toBe(false);
    expect(isIstDay('2026-10-28T00:00:00Z')).toBe(false);
    expect(isIstDay('28-10-2026')).toBe(false);
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });
});
