import { chartGeometry } from './chartGeometry';

// Where the weight chart's dots and lines go (REQ-PRG-004). Synthetic values only.

describe('REQ-PRG-004 chartGeometry', () => {
  it('spreads days across the width in proportion to the time between them, highest weight at the top', () => {
    const { dots, lowest, highest } = chartGeometry(
      [
        { day: '2026-10-01', weightGrams: 80_000 },
        { day: '2026-10-21', weightGrams: 79_000 },
        { day: '2026-10-31', weightGrams: 78_000 },
      ],
      310,
      110,
      5,
      2,
    );
    expect(dots).toEqual([
      { x: 5, y: 5 },
      { x: 205, y: 55 },
      { x: 305, y: 105 },
    ]);
    expect([lowest, highest]).toEqual([78_000, 80_000]);
  });

  it('turns each line about its centre so it joins two dots', () => {
    const { dots, lines } = chartGeometry(
      [
        { day: '2026-10-01', weightGrams: 80_000 },
        { day: '2026-10-02', weightGrams: 79_000 },
      ],
      40,
      30,
      0,
      2,
    );
    expect(dots).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 30 },
    ]);
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.length).toBe(50);
    expect(line.left).toBe(-5);
    expect(line.top).toBe(14);
    expect(line.angle).toBeCloseTo(Math.atan2(30, 40));
  });

  it('puts an unchanged weight across the middle', () => {
    const { dots, lines } = chartGeometry(
      [
        { day: '2026-10-01', weightGrams: 80_000 },
        { day: '2026-10-08', weightGrams: 80_000 },
      ],
      100,
      50,
      0,
      2,
    );
    expect(dots.map((dot) => dot.y)).toEqual([25, 25]);
    expect(lines[0]?.angle).toBe(0);
  });
});
