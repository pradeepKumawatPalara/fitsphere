import {
  daysLoggedText,
  weekLabel,
  weeklyRateText,
  weightCell,
  weightChangeText,
  weightText,
  wholeCell,
} from './texts';

// Progress's texts in both body-weight units (REQ-PRG-001…005, REQ-ACC-003). Synthetic values only.

describe('Progress texts', () => {
  it('shows weights in the unit given', () => {
    expect(weightText(70_300, 'kg')).toBe('70.3 kg');
    expect(weightText(70_300, 'lb')).toBe('155.0 lb');
    expect(weightCell(70_300, 'kg')).toBe('70.3');
    expect(weightCell(70_300, 'lb')).toBe('155.0');
    expect(weightCell(null, 'kg')).toBe('–');
  });

  it('describes the change since the earlier weigh-in', () => {
    expect(weightChangeText(-1200, '2026-10-02', 'kg')).toBe('Down 1.2 kg since Fri 2 Oct');
    expect(weightChangeText(-1200, '2026-10-02', 'lb')).toBe('Down 2.6 lb since Fri 2 Oct');
    expect(weightChangeText(400, '2026-10-02', 'kg')).toBe('Up 0.4 kg since Fri 2 Oct');
    expect(weightChangeText(40, '2026-10-02', 'kg')).toBe('No change since Fri 2 Oct');
  });

  it('describes the weekly rate', () => {
    expect(weeklyRateText(-300, 'kg')).toBe('Down 0.3 kg a week');
    expect(weeklyRateText(-300, 'lb')).toBe('Down 0.7 lb a week');
    expect(weeklyRateText(150.4, 'kg')).toBe('Up 0.2 kg a week');
    expect(weeklyRateText(-20, 'kg')).toBe('No weekly change');
  });

  it('writes counts and week labels', () => {
    expect(daysLoggedText({ logged: 12, total: 27 })).toBe('Meals logged: 12 of 27 days');
    expect(daysLoggedText({ logged: 0, total: 1 })).toBe('Meals logged: 0 of 1 day');
    expect(wholeCell(10_000)).toBe('10,000');
    expect(wholeCell(null)).toBe('–');
    expect(weekLabel('2026-10-26', '2026-10-26')).toBe('This week');
    expect(weekLabel('2026-10-19', '2026-10-26')).toBe('19 Oct');
  });
});
