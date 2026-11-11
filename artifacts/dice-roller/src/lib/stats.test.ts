import { describe, expect, it } from "vitest";
import type { RandomInt } from "./generator";
import {
  CHI_SQUARE_CRITICAL_1,
  CHI_SQUARE_CRITICAL_5,
  EXPECTED_WAYS,
  SUM_VALUES,
  chiSquareOfSums,
  chiSquarePValueDf10,
  expectedShare,
  createSanityRun,
  runSanityCheck,
  variationBand,
} from "./stats";
import { seededRandomInt } from "./test-utils";

describe("expected distribution", () => {
  it("covers all 36 combinations", () => {
    const total = SUM_VALUES.reduce((sum, value) => sum + EXPECTED_WAYS[value], 0);
    expect(total).toBe(36);
    expect(expectedShare(7)).toBeCloseTo(6 / 36, 10);
    expect(expectedShare(2)).toBeCloseTo(1 / 36, 10);
  });
});

describe("chi-square helpers", () => {
  it("is zero for a perfectly matching tally", () => {
    const tally: Record<number, number> = {};
    for (const value of SUM_VALUES) tally[value] = EXPECTED_WAYS[value] * 100;
    expect(chiSquareOfSums(tally, 3_600)).toBeCloseTo(0, 10);
  });

  it("matches the published critical values for 10 degrees of freedom", () => {
    expect(chiSquarePValueDf10(CHI_SQUARE_CRITICAL_5)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValueDf10(CHI_SQUARE_CRITICAL_1)).toBeCloseTo(0.01, 3);
    expect(chiSquarePValueDf10(0)).toBe(1);
    expect(chiSquarePValueDf10(200)).toBeLessThan(1e-10);
  });
});

describe("variationBand", () => {
  it("narrows as the session gets longer", () => {
    const small = variationBand(7, 50);
    const large = variationBand(7, 5_000);
    expect(small.high - small.low).toBeGreaterThan(large.high - large.low);
    expect(large.low).toBeLessThan(6 / 36);
    expect(large.high).toBeGreaterThan(6 / 36);
  });
});

describe("runSanityCheck", () => {
  it("passes for a fair generator on nearly every seed", () => {
    // A fair source trips the check about 1.3% of the time (1% distribution + ~0.3% serial),
    // so across 20 seeds more than a couple of failures would be suspicious.
    let failures = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const report = runSanityCheck({ rolls: 100_000, randomInt: seededRandomInt(seed * 7919) });
      expect(report.pValue).toBeGreaterThanOrEqual(0);
      expect(report.pValue).toBeLessThanOrEqual(1);
      expect(Math.abs(report.serialCorrelation)).toBeLessThan(0.05);
      if (!report.passed) failures += 1;
    }
    expect(failures).toBeLessThanOrEqual(3);
  });

  it("flags a biased generator as a distribution failure", () => {
    const fair = seededRandomInt(5);
    const biased: RandomInt = (max) => (max === 6 && fair(100) < 30 ? 5 : fair(max));
    const report = runSanityCheck({ rolls: 50_000, randomInt: biased });
    expect(report.passed).toBe(false);
    expect(report.failures).toContain("distribution");
  });

  it("flags correlated results as an independence failure", () => {
    const fair = seededRandomInt(17);
    const recent: number[] = [];
    // Half the time, repeat the value drawn two calls ago, so back-to-back totals match.
    const correlated: RandomInt = (max) => {
      const value = recent.length >= 2 && fair(2) === 0 ? recent[recent.length - 2] : fair(max);
      recent.push(value);
      if (recent.length > 4) recent.shift();
      return value;
    };
    const report = runSanityCheck({ rolls: 50_000, randomInt: correlated });
    expect(report.passed).toBe(false);
    expect(report.failures).toContain("independence");
    expect(report.serialCorrelation).toBeGreaterThan(0.1);
  });

  it("reports progress and the recheck flag", () => {
    const steps: number[] = [];
    const report = runSanityCheck({
      rolls: 20_000,
      isRecheck: true,
      randomInt: seededRandomInt(3),
      chunkSize: 5_000,
      onProgress: (completed) => steps.push(completed),
    });
    expect(report.isRecheck).toBe(true);
    expect(report.rolls).toBe(20_000);
    expect(steps[steps.length - 1]).toBe(20_000);
    expect(steps.length).toBeGreaterThanOrEqual(4);
  });
});

describe("createSanityRun", () => {
  it("gives the same report whether drawn in one go or in small steps", () => {
    const whole = runSanityCheck({ rolls: 20_000, randomInt: seededRandomInt(99) });
    const run = createSanityRun({ rolls: 20_000, randomInt: seededRandomInt(99) });
    const seen: number[] = [];
    let done = 0;
    while (done < 20_000) {
      done = run.advance(1_500);
      seen.push(done);
    }
    expect(run.report()).toEqual(whole);
    expect(seen.length).toBeGreaterThan(10);
    expect(seen[seen.length - 1]).toBe(20_000);
  });

  it("never draws past the requested number of results", () => {
    const run = createSanityRun({ rolls: 1_000, randomInt: seededRandomInt(5) });
    expect(run.advance(5_000)).toBe(1_000);
    expect(run.advance(5_000)).toBe(1_000);
  });
});
