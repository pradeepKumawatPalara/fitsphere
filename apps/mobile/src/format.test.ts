import { formatIstTime, parseOneDecimal, parseTwoDecimals } from './format';

// Numbers as a number pad types them (the owner, 2026-11-16: ".5" hours of sleep was refused): the
// whole part may be left out, and a point may end the number while its decimal is still to come.
describe('parseOneDecimal and parseTwoDecimals', () => {
  it.each([
    ['7.5', 7.5, 7.5],
    ['7,5', 7.5, 7.5],
    ['.5', 0.5, 0.5],
    [',5', 0.5, 0.5],
    ['7.', 7, 7],
    ['7', 7, 7],
    [' 0.5 ', 0.5, 0.5],
    ['9999.9', 9999.9, 9999.9],
    ['.25', null, 0.25],
    ['5.25', null, 5.25],
  ])('reads "%s"', (text, one, two) => {
    expect(parseOneDecimal(text)).toBe(one);
    expect(parseTwoDecimals(text)).toBe(two);
  });

  it.each(['', '.', ',', '-1', 'abc', '1e2', '1.5.2', '10000', '5.255', '..5'])('refuses "%s"', (text) => {
    expect(parseOneDecimal(text)).toBeNull();
    expect(parseTwoDecimals(text)).toBeNull();
  });
});

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
