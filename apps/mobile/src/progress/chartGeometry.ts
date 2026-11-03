import { daysBetween, type WeighInPoint } from './calculations';

// Where the weight chart's dots go (REQ-PRG-004). The chart draws a line through them, the area
// under it and the dots with react-native-svg, which the app has had since D-35 (no chart package).

export type Dot = { x: number; y: number };

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
): { dots: Dot[]; lowest: number; highest: number } {
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
  return { dots, lowest, highest };
}
