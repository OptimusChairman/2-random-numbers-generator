// "How far from fair are my results, and is that shrinking?" helpers for the tracker.
//
// Deviation is the total variation distance between the observed totals and the 1/36
// odds, in percentage points: half the sum of |actual share - expected share|. It is
// 0 for a perfect match and shrinks like 1/sqrt(n) for a fair generator.

import { SUM_VALUES, expectedShare } from "./stats";

/** [number of results, deviation in percentage points] */
export type TrendPoint = [number, number];

export const MAX_TREND_POINTS = 240;

export function totalVariation(tally: Record<number, number>, rolls: number): number {
  if (rolls <= 0) return 0;
  let sum = 0;
  for (const total of SUM_VALUES) {
    sum += Math.abs((tally[total] ?? 0) / rolls - expectedShare(total));
  }
  return (sum / 2) * 100;
}

const SPREAD = SUM_VALUES.reduce((sum, total) => {
  const p = expectedShare(total);
  return sum + Math.sqrt(p * (1 - p));
}, 0);

/**
 * Typical deviation of a fair, independent generator after n results (percentage points).
 * Each total's share has expected absolute error sqrt(2 p (1-p) / (pi n)); halve the sum.
 */
export function typicalFairDeviation(n: number): number {
  if (n <= 0) return 0;
  return 0.5 * Math.sqrt(2 / (Math.PI * n)) * SPREAD * 100;
}

/**
 * Adds a point and keeps the series bounded. Past `max` points, every second point is
 * dropped (the first and last always stay), so a long session keeps its whole shape.
 */
export function appendTrend(trend: TrendPoint[], point: TrendPoint, max = MAX_TREND_POINTS): TrendPoint[] {
  const next = [...trend, point];
  if (next.length <= max) return next;
  return next.filter((_, index) => index % 2 === 0 || index === next.length - 1);
}

export function isValidTrend(value: unknown): value is TrendPoint[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_TREND_POINTS + 1 &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        Number.isInteger(point[0]) &&
        point[0] > 0 &&
        typeof point[1] === "number" &&
        Number.isFinite(point[1]) &&
        point[1] >= 0 &&
        point[1] <= 100,
    )
  );
}
