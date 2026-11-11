import { sinceText, targetChanges, targetPeriods, weekTargetDay, type DatedTarget } from './targets';

// Targets by date (D-77, REQ-ROLE-018): since when a value holds, the week's workout target day, and
// the history's changes and periods. Synthetic values only.

const HISTORY: DatedTarget[] = [
  { kind: 'calories', day: '2026-11-06', value: 1_800 },
  { kind: 'protein', day: '2026-11-06', value: 110 },
  { kind: 'calories', day: '2026-11-08', value: 2_000 },
  { kind: 'protein', day: '2026-11-08', value: 120 },
  { kind: 'body_weight', day: '2026-11-09', value: 70_000 },
  { kind: 'calories', day: '2026-11-11', value: 2_200 },
];

describe('D-77 targets by date', () => {
  it('says "from today" for a value set today, and "since <date>" for an earlier one', () => {
    expect(sinceText('2026-11-11', '2026-11-11')).toBe('from today');
    expect(sinceText('2026-11-08', '2026-11-11')).toBe('since 8 Nov');
    expect(sinceText('2026-10-28', '2026-11-11')).toBe('since 28 Oct');
  });

  it('reads a week’s workout target on its Sunday', () => {
    expect(weekTargetDay('2026-11-09')).toBe('2026-11-15');
    expect(weekTargetDay('2026-11-11')).toBe('2026-11-15');
    expect(weekTargetDay('2026-11-15')).toBe('2026-11-15');
    expect(weekTargetDay('2026-11-16')).toBe('2026-11-22');
  });

  it('lists the changes by day, newest first, each day’s in the targets’ order; a first value has nothing before it', () => {
    expect(targetChanges(HISTORY)).toEqual([
      { day: '2026-11-11', changes: [{ kind: 'calories', from: 2_000, to: 2_200 }] },
      { day: '2026-11-09', changes: [{ kind: 'body_weight', from: null, to: 70_000 }] },
      {
        day: '2026-11-08',
        changes: [
          { kind: 'calories', from: 1_800, to: 2_000 },
          { kind: 'protein', from: 110, to: 120 },
        ],
      },
      {
        day: '2026-11-06',
        changes: [
          { kind: 'calories', from: null, to: 1_800 },
          { kind: 'protein', from: null, to: 110 },
        ],
      },
    ]);
  });

  it('leaves out a value the same as the one before it: it changed nothing', () => {
    const back: DatedTarget[] = [
      { kind: 'steps', day: '2026-11-01', value: 8_000 },
      { kind: 'steps', day: '2026-11-05', value: 8_000 },
      { kind: 'steps', day: '2026-11-07', value: 9_000 },
    ];

    expect(targetChanges(back)).toEqual([
      { day: '2026-11-07', changes: [{ kind: 'steps', from: 8_000, to: 9_000 }] },
      { day: '2026-11-01', changes: [{ kind: 'steps', from: null, to: 8_000 }] },
    ]);
    expect(targetPeriods(back, 'steps')?.earlier).toEqual([{ from: '2026-11-01', to: '2026-11-06', days: 6, value: 8_000 }]);
  });

  it('gives one target’s value now and since when, its earlier values newest first with their days, and its first day', () => {
    expect(targetPeriods(HISTORY, 'calories')).toEqual({
      now: { value: 2_200, since: '2026-11-11' },
      earlier: [
        { from: '2026-11-08', to: '2026-11-10', days: 3, value: 2_000 },
        { from: '2026-11-06', to: '2026-11-07', days: 2, value: 1_800 },
      ],
      firstDay: '2026-11-06',
    });
    expect(targetPeriods(HISTORY, 'body_weight')).toEqual({ now: { value: 70_000, since: '2026-11-09' }, earlier: [], firstDay: '2026-11-09' });
    expect(targetPeriods(HISTORY, 'fibre')).toBeNull();
  });

  it('counts a value that held one day as one day, across a month’s end', () => {
    const short: DatedTarget[] = [
      { kind: 'fat', day: '2026-10-31', value: 60 },
      { kind: 'fat', day: '2026-11-01', value: 55 },
    ];

    expect(targetPeriods(short, 'fat')?.earlier).toEqual([{ from: '2026-10-31', to: '2026-10-31', days: 1, value: 60 }]);
  });
});
