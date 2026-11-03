import { formatIstTime } from './format';

// A meal's saved time in India time (D-34; invariant #5: Asia/Kolkata, UTC+5:30, no daylight saving).

describe('formatIstTime', () => {
  it.each([
    ['2026-10-28T03:30:00.000Z', '9:00 am'],
    ['2026-10-28T02:45:00.000Z', '8:15 am'],
    ['2026-10-28T06:30:00.000Z', '12:00 pm'],
    ['2026-10-28T13:05:00.000Z', '6:35 pm'],
    ['2026-10-27T18:30:00.000Z', '12:00 am'],
    ['2026-10-27T20:59:59.999Z', '2:29 am'],
  ])('shows %s as %s', (instant, time) => {
    expect(formatIstTime(instant)).toBe(time);
  });
});
