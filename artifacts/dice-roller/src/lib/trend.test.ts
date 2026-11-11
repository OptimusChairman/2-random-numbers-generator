import { describe, expect, it } from "vitest";
import { createGenerator } from "./generator";
import { EXPECTED_WAYS, SUM_VALUES } from "./stats";
import { seededRandomInt } from "./test-utils";
import {
  MAX_TREND_POINTS,
  appendTrend,
  isValidTrend,
  totalVariation,
  typicalFairDeviation,
  type TrendPoint,
} from "./trend";

function tallyOf(mode: "pure" | "balanced", rolls: number, seed: number) {
  const generator = createGenerator({ mode, randomInt: seededRandomInt(seed) });
  const tally: Record<number, number> = {};
  for (let i = 0; i < rolls; i += 1) {
    const [a, b] = generator.next();
    tally[a + b] = (tally[a + b] ?? 0) + 1;
  }
  return tally;
}

describe("totalVariation", () => {
  it("is 0 for a perfectly matching tally", () => {
    const tally: Record<number, number> = {};
    for (const value of SUM_VALUES) tally[value] = EXPECTED_WAYS[value] * 50;
    expect(totalVariation(tally, 1800)).toBeCloseTo(0, 10);
  });

  it("is 0 for an empty session", () => {
    expect(totalVariation({}, 0)).toBe(0);
  });

  it("is large when every result is the same total", () => {
    // All results are 7 (expected 16.67%): TVD = 100% - 16.67% = 83.33 pp.
    expect(totalVariation({ 7: 100 }, 100)).toBeCloseTo(83.33, 1);
  });
});

describe("typicalFairDeviation", () => {
  it("shrinks like 1/sqrt(n)", () => {
    expect(typicalFairDeviation(100) / typicalFairDeviation(10_000)).toBeCloseTo(10, 5);
    expect(typicalFairDeviation(0)).toBe(0);
  });

  it("matches what a fair independent generator actually does", () => {
    const n = 2_000;
    const runs = 60;
    let sum = 0;
    for (let seed = 1; seed <= runs; seed += 1) sum += totalVariation(tallyOf("pure", n, seed * 101), n);
    const observed = sum / runs;
    const predicted = typicalFairDeviation(n);
    // The formula is a normal approximation; within 15% is plenty for a reference line.
    expect(Math.abs(observed - predicted) / predicted).toBeLessThan(0.15);
  });

  it("shows the balanced pool staying closer to fair than pure random", () => {
    const n = 2_000;
    let pure = 0;
    let balanced = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      pure += totalVariation(tallyOf("pure", n, seed * 7), n);
      balanced += totalVariation(tallyOf("balanced", n, seed * 7), n);
    }
    expect(balanced).toBeLessThan(pure);
  });
});

describe("appendTrend", () => {
  it("appends while under the limit", () => {
    expect(appendTrend([[1, 5]], [2, 4])).toEqual([[1, 5], [2, 4]]);
  });

  it("stays bounded and keeps the first and last points", () => {
    let trend: TrendPoint[] = [];
    for (let n = 1; n <= 2_000; n += 1) trend = appendTrend(trend, [n, 100 / n]);
    expect(trend.length).toBeLessThanOrEqual(MAX_TREND_POINTS);
    expect(trend[0][0]).toBe(1);
    expect(trend[trend.length - 1][0]).toBe(2_000);
    // Still ordered by number of results.
    for (let i = 1; i < trend.length; i += 1) expect(trend[i][0]).toBeGreaterThan(trend[i - 1][0]);
  });
});

describe("isValidTrend", () => {
  it("accepts a good series and an empty one", () => {
    expect(isValidTrend([])).toBe(true);
    expect(isValidTrend([[1, 80], [2, 40.5]])).toBe(true);
  });

  it("rejects malformed data", () => {
    expect(isValidTrend("nope")).toBe(false);
    expect(isValidTrend([[1]])).toBe(false);
    expect(isValidTrend([[0, 5]])).toBe(false);
    expect(isValidTrend([[1.5, 5]])).toBe(false);
    expect(isValidTrend([[1, -2]])).toBe(false);
    expect(isValidTrend([[1, 101]])).toBe(false);
    expect(isValidTrend([[1, Number.NaN]])).toBe(false);
    expect(isValidTrend(Array.from({ length: MAX_TREND_POINTS + 5 }, (_, i) => [i + 1, 1]))).toBe(false);
  });
});
