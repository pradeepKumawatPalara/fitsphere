import { daysBetween, type WeighInPoint } from './calculations';

// Where the weight chart's dots and lines go (REQ-PRG-004). The chart is drawn with plain views,
// with no chart or SVG package (D-P1): each dot is a small circle, and each line between two dots
// is a thin view of the right length, turned to the right angle about its centre.

export type Dot = { x: number; y: number };
export type Line = { left: number; top: number; length: number; angle: number };

/**
 * Places the points (oldest first) in a `width` × `height` area, keeping `inset` clear at every
 * edge so the dots are not cut off: days run left to right in proportion to the time between them,
 * and the highest weight is at the top. One day, or one weight, sits in the middle.
 */
export function chartGeometry(
  points: readonly WeighInPoint[],
  width: number,
  height: number,
  inset: number,
  thickness: number,
): { dots: Dot[]; lines: Line[]; lowest: number; highest: number } {
  const lowest = Math.min(...points.map((point) => point.weightGrams));
  const highest = Math.max(...points.map((point) => point.weightGrams));
  const first = points[0]?.day;
  const span = first === undefined ? 0 : daysBetween(first, points[points.length - 1]!.day);
  const innerWidth = width - 2 * inset;
  const innerHeight = height - 2 * inset;

  const dots = points.map((point) => ({
    x: inset + (span === 0 ? innerWidth / 2 : (innerWidth * daysBetween(first!, point.day)) / span),
    y: inset + (highest === lowest ? innerHeight / 2 : (innerHeight * (highest - point.weightGrams)) / (highest - lowest)),
  }));
  const lines = dots.slice(1).map((to, index) => {
    const from = dots[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return {
      left: (from.x + to.x) / 2 - length / 2,
      top: (from.y + to.y) / 2 - thickness / 2,
      length,
      angle: Math.atan2(to.y - from.y, to.x - from.x),
    };
  });
  return { dots, lines, lowest, highest };
}
