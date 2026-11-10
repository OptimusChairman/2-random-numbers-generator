// Statistics helpers shared by the live tracker, the sanity check, and the tests.

import { createGenerator, type RandomInt } from "./generator";

/** Number of ways to make each total with two six-sided values (out of 36). */
export const EXPECTED_WAYS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

export const SUM_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Chi-square critical values for 10 degrees of freedom (11 totals - 1). */
export const CHI_SQUARE_DF = 10;
export const CHI_SQUARE_CRITICAL_5 = 18.307;
export const CHI_SQUARE_CRITICAL_1 = 23.209;

/** A fair generator trips the check roughly 1% of the time, so a recheck is the intended follow-up. */
export const P_VALUE_THRESHOLD = 0.01;
export const SERIAL_Z_LIMIT = 3;

export function expectedShare(total: number): number {
  return (EXPECTED_WAYS[total] ?? 0) / 36;
}

/** Pearson chi-square statistic of observed totals against the 1/36 distribution. */
export function chiSquareOfSums(tally: Record<number, number>, rolls: number): number {
  if (rolls <= 0) return 0;
  let statistic = 0;
  for (const total of SUM_VALUES) {
    const expected = expectedShare(total) * rolls;
    const observed = tally[total] ?? 0;
    statistic += ((observed - expected) ** 2) / expected;
  }
  return statistic;
}

/**
 * Upper-tail probability P(X >= x) for a chi-square variable with 10 degrees of
 * freedom. Even degrees of freedom have a closed form:
 *   P = e^(-x/2) * sum_{k=0}^{df/2 - 1} (x/2)^k / k!
 */
export function chiSquarePValueDf10(x: number): number {
  if (x <= 0) return 1;
  const half = x / 2;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < CHI_SQUARE_DF / 2; k += 1) {
    term *= half / k;
    sum += term;
  }
  return Math.min(1, Math.exp(-half) * sum);
}

/**
 * Normal-variation band for an observed share: the 95% range a fair generator
 * would land in after `rolls` results. Used to draw the tracker's variation band.
 */
export function variationBand(total: number, rolls: number): { low: number; high: number } {
  const p = expectedShare(total);
  if (rolls <= 0) return { low: 0, high: 1 };
  const margin = 1.96 * Math.sqrt((p * (1 - p)) / rolls);
  return { low: Math.max(0, p - margin), high: Math.min(1, p + margin) };
}

export type SanityReport = {
  rolls: number;
  passed: boolean;
  isRecheck: boolean;
  chiSquare: number;
  pValue: number;
  /** Lag-1 correlation between consecutive totals; about 0 for independent results. */
  serialCorrelation: number;
  serialZ: number;
  worstTotal: number;
  /** Largest gap between observed and expected share, in percentage points. */
  maxDifference: number;
  actualPct: number;
  expectedPct: number;
  failures: Array<"distribution" | "independence">;
};

export type SanityOptions = {
  rolls: number;
  isRecheck?: boolean;
  randomInt?: RandomInt;
  chunkSize?: number;
  onProgress?: (completed: number, total: number) => void;
};

/**
 * Tests the raw randomness source: draws independent pairs from a private
 * "pure" generator (never the live shoe) and checks the totals' distribution
 * and the lag-1 correlation between consecutive totals.
 */
export function runSanityCheck(options: SanityOptions): SanityReport {
  const { rolls, isRecheck = false, randomInt, chunkSize = 5_000, onProgress } = options;
  const generator = createGenerator({ mode: "pure", randomInt });

  const tally: Record<number, number> = {};
  let previous: number | null = null;
  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let completed = 0; completed < rolls; completed += 1) {
    const [a, b] = generator.next();
    const total = a + b;
    tally[total] = (tally[total] ?? 0) + 1;

    if (previous !== null) {
      n += 1;
      sumX += previous;
      sumY += total;
      sumXY += previous * total;
      sumXX += previous * previous;
      sumYY += total * total;
    }
    previous = total;

    if (onProgress && (completed + 1) % chunkSize === 0) onProgress(completed + 1, rolls);
  }
  onProgress?.(rolls, rolls);

  let serialCorrelation = 0;
  if (n > 1) {
    const covariance = sumXY - (sumX * sumY) / n;
    const varianceX = sumXX - (sumX * sumX) / n;
    const varianceY = sumYY - (sumY * sumY) / n;
    const denominator = Math.sqrt(varianceX * varianceY);
    serialCorrelation = denominator === 0 ? 0 : covariance / denominator;
  }
  const serialZ = serialCorrelation * Math.sqrt(Math.max(n, 1));

  const chiSquare = chiSquareOfSums(tally, rolls);
  const pValue = chiSquarePValueDf10(chiSquare);

  let maxDifference = -1;
  let worstTotal = 7;
  let actualPct = 0;
  let expectedPct = 0;
  for (const total of SUM_VALUES) {
    const actual = ((tally[total] ?? 0) / rolls) * 100;
    const expected = expectedShare(total) * 100;
    const difference = Math.abs(actual - expected);
    if (difference > maxDifference) {
      maxDifference = difference;
      worstTotal = total;
      actualPct = actual;
      expectedPct = expected;
    }
  }

  const failures: SanityReport["failures"] = [];
  if (pValue < P_VALUE_THRESHOLD) failures.push("distribution");
  if (Math.abs(serialZ) > SERIAL_Z_LIMIT) failures.push("independence");

  return {
    rolls,
    passed: failures.length === 0,
    isRecheck,
    chiSquare,
    pValue,
    serialCorrelation,
    serialZ,
    worstTotal,
    maxDifference,
    actualPct,
    expectedPct,
    failures,
  };
}
