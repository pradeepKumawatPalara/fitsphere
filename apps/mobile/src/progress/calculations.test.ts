import {
  averageCalories,
  chartPoints,
  daysBetween,
  daysLogged,
  fourWeekWeight,
  mergeWeighIns,
  rangeNeedsServer,
  weeklyAverages,
  weekRows,
  type DayNutrition,
} from './calculations';

// Progress's numbers (REQ-PRG-001…005; Q-043, Q-044, D-30). Synthetic values only.

const TODAY = '2026-10-28'; // a Wednesday; the phone holds 2026-07-31 to today

function meals(days: Record<string, number>, proteinG = 100): Record<string, DayNutrition> {
  return Object.fromEntries(Object.entries(days).map(([day, kcal]) => [day, { kcal, proteinG }]));
}

describe('daysBetween', () => {
  it('counts whole days across months', () => {
    expect(daysBetween('2026-09-30', '2026-10-28')).toBe(28);
    expect(daysBetween('2026-10-28', '2026-10-21')).toBe(-7);
  });
});

describe('REQ-PRG-001 fourWeekWeight', () => {
  it('is null with no weigh-ins', () => {
    expect(fourWeekWeight([])).toBeNull();
  });

  it('has no change or rate with one weigh-in', () => {
    expect(fourWeekWeight([{ day: TODAY, weightGrams: 80_000 }])).toEqual({
      latest: { day: TODAY, weightGrams: 80_000 },
      earlier: null,
      changeGrams: null,
      weeklyRateGrams: null,
    });
  });

  it('measures from the weigh-in nearest 28 days before the latest; the rate is the change ÷ 4', () => {
    const result = fourWeekWeight([
      { day: '2026-10-14', weightGrams: 79_000 },
      { day: TODAY, weightGrams: 78_800 },
      { day: '2026-09-30', weightGrams: 80_000 },
      { day: '2026-10-01', weightGrams: 79_800 },
    ]);
    expect(result?.latest.day).toBe(TODAY);
    expect(result?.earlier).toEqual({ day: '2026-09-30', weightGrams: 80_000 });
    expect(result?.changeGrams).toBe(-1200);
    expect(result?.weeklyRateGrams).toBe(-300);
  });

  it('keeps the earlier weigh-in on a tie', () => {
    const result = fourWeekWeight([
      { day: '2026-09-29', weightGrams: 80_000 },
      { day: '2026-10-01', weightGrams: 79_800 },
      { day: TODAY, weightGrams: 79_000 },
    ]);
    expect(result?.earlier?.day).toBe('2026-09-29');
  });

  it('divides by the weeks between the two weigh-ins when they are less than 28 days apart (D-30)', () => {
    const result = fourWeekWeight([
      { day: '2026-10-18', weightGrams: 80_000 },
      { day: TODAY, weightGrams: 79_000 },
    ]);
    expect(result?.changeGrams).toBe(-1000);
    expect(result?.weeklyRateGrams).toBeCloseTo(-700);
  });

  it('has a change but no rate with less than a week of weigh-ins', () => {
    const result = fourWeekWeight([
      { day: '2026-10-22', weightGrams: 80_000 },
      { day: '2026-10-24', weightGrams: 79_900 },
      { day: TODAY, weightGrams: 79_500 },
    ]);
    expect(result?.earlier?.day).toBe('2026-10-22');
    expect(result?.changeGrams).toBe(-500);
    expect(result?.weeklyRateGrams).toBeNull();
  });

  it('prefers a weigh-in a week or more earlier, even when a recent one is nearer to 28 days back', () => {
    const result = fourWeekWeight([
      { day: '2026-08-29', weightGrams: 82_000 },
      { day: '2026-10-25', weightGrams: 79_500 },
      { day: TODAY, weightGrams: 79_000 },
    ]);
    expect(result?.earlier?.day).toBe('2026-08-29');
    expect(result?.weeklyRateGrams).toBeCloseTo((-3000 * 7) / 60);
  });
});

describe('REQ-PRG-002 averageCalories', () => {
  it('averages the days with meals in the last 28 days, today included', () => {
    const nutrition = meals({ '2026-09-30': 5000, '2026-10-01': 1800, '2026-10-27': 2000, [TODAY]: 1000 });
    expect(averageCalories(nutrition, TODAY)).toBe(1600);
  });

  it('rounds to whole kcal', () => {
    expect(averageCalories(meals({ '2026-10-27': 1000.4, [TODAY]: 1000.7 }), TODAY)).toBe(1001);
  });

  it('is null with no meals in the period', () => {
    expect(averageCalories(meals({ '2026-09-30': 2000 }), TODAY)).toBeNull();
  });
});

describe('REQ-PRG-003 daysLogged (Q-044)', () => {
  const nutrition = meals({ '2026-09-30': 1, '2026-10-01': 1, '2026-10-20': 1, '2026-10-27': 1, [TODAY]: 1 });

  it('counts out of 28 days for an account older than 4 weeks', () => {
    expect(daysLogged(nutrition, TODAY, '2026-08-01')).toEqual({ logged: 4, total: 28 });
  });

  it('counts from the day a newer account was created', () => {
    expect(daysLogged(nutrition, TODAY, '2026-10-26')).toEqual({ logged: 2, total: 3 });
  });

  it('counts the whole period while the creation day is unknown', () => {
    expect(daysLogged(nutrition, TODAY, null)).toEqual({ logged: 4, total: 28 });
  });

  it('counts today alone for an account created today', () => {
    expect(daysLogged({}, TODAY, TODAY)).toEqual({ logged: 0, total: 1 });
  });
});

describe('REQ-PRG-005 weekRows', () => {
  it('lists this week and the 11 before it, newest first, all within the 90 days the phone holds', () => {
    const rows = weekRows({ today: TODAY, accountStart: null, weighIns: [], nutrition: {}, steps: [] });
    expect(rows).toHaveLength(12);
    expect(rows[0]?.weekStart).toBe('2026-10-26');
    expect(rows[11]?.weekStart).toBe('2026-08-10');
    expect(rows[11]!.weekStart >= '2026-07-31').toBe(true);
    expect(rows[5]).toEqual({ weekStart: '2026-09-21', weightGrams: null, kcal: null, proteinG: null, steps: null });
  });

  it('starts at the week the account was created', () => {
    const rows = weekRows({ today: TODAY, accountStart: '2026-10-14', weighIns: [], nutrition: {}, steps: [] });
    expect(rows.map((row) => row.weekStart)).toEqual(['2026-10-26', '2026-10-19', '2026-10-12']);
  });

  it('averages each value over the days of the week that have entries', () => {
    const rows = weekRows({
      today: TODAY,
      accountStart: null,
      weighIns: [
        { day: '2026-10-26', weightGrams: 80_000 },
        { day: '2026-10-27', weightGrams: 80_500 },
        { day: '2026-10-25', weightGrams: 90_000 },
      ],
      nutrition: { '2026-10-27': { kcal: 1800, proteinG: 90.5 }, [TODAY]: { kcal: 2200, proteinG: 100 } },
      steps: [
        { day: '2026-10-26', steps: 8000 },
        { day: TODAY, steps: 10_001 },
      ],
    });
    expect(rows[0]).toEqual({ weekStart: '2026-10-26', weightGrams: 80_250, kcal: 2000, proteinG: 95, steps: 9001 });
    expect(rows[1]).toEqual({ weekStart: '2026-10-19', weightGrams: 90_000, kcal: null, proteinG: null, steps: null });
  });

  it('keeps a week across a month boundary together', () => {
    const rows = weekRows({
      today: TODAY,
      accountStart: null,
      weighIns: [
        { day: '2026-09-30', weightGrams: 81_000 },
        { day: '2026-10-02', weightGrams: 80_000 },
      ],
      nutrition: {},
      steps: [],
    });
    expect(rows.find((row) => row.weekStart === '2026-09-28')?.weightGrams).toBe(80_500);
  });
});

describe('REQ-PRG-004 chart points', () => {
  const weighIns = [
    { day: '2026-04-01', weightGrams: 84_000 },
    { day: '2026-10-20', weightGrams: 79_000 },
    { day: TODAY, weightGrams: 81_000 },
    { day: '2026-10-22', weightGrams: 80_000 },
    { day: '2026-10-26', weightGrams: 80_000 },
  ];

  it('plots every weigh-in in the range for 1W, 4W and 12W, oldest first', () => {
    expect(chartPoints('1W', weighIns, TODAY).map((point) => point.day)).toEqual(['2026-10-22', '2026-10-26', TODAY]);
    expect(chartPoints('4W', weighIns, TODAY)).toHaveLength(4);
    expect(chartPoints('12W', weighIns, TODAY)).toHaveLength(4);
  });

  it('plots weekly averages for 26W and All', () => {
    expect(chartPoints('26W', weighIns, TODAY)).toEqual([
      { day: '2026-10-19', weightGrams: 79_500 },
      { day: '2026-10-26', weightGrams: 80_500 },
    ]);
    expect(chartPoints('All', weighIns, TODAY)[0]).toEqual({ day: '2026-03-30', weightGrams: 84_000 });
  });

  it('weeklyAverages puts each point on its Monday', () => {
    expect(weeklyAverages([{ day: '2026-11-01', weightGrams: 70_000 }])).toEqual([{ day: '2026-10-26', weightGrams: 70_000 }]);
  });

  it('reads older weigh-ins online only for ranges reaching past the 90 days on the phone', () => {
    expect(rangeNeedsServer('12W', TODAY, null)).toBe(false);
    expect(rangeNeedsServer('26W', TODAY, null)).toBe(true);
    expect(rangeNeedsServer('All', TODAY, '2026-05-01')).toBe(true);
    // An account newer than 90 days has nothing older on the server.
    expect(rangeNeedsServer('All', TODAY, '2026-09-01')).toBe(false);
  });

  it('merges older weigh-ins from the server; the phone wins for a day', () => {
    const merged = mergeWeighIns(
      [{ day: TODAY, weightGrams: 81_000 }],
      [
        { day: TODAY, weightGrams: 70_000 },
        { day: '2026-04-01', weightGrams: 84_000 },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((point) => point.day === TODAY)?.weightGrams).toBe(81_000);
  });
});
