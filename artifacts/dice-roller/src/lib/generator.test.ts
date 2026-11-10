import { describe, expect, it } from "vitest";
import {
  BASE_PAIR_COUNT,
  CUT_AFTER,
  POOL_CYCLES,
  POOL_SIZE,
  POOL_TOTAL_COUNTS,
  cosmeticPair,
  createGenerator,
  cryptoRandomInt,
  fisherYatesShuffle,
  isValidShoeState,
  type Pair,
} from "./generator";
import { seededRandomInt } from "./test-utils";

const pairKey = ([a, b]: Pair) => `${a}-${b}`;

describe("constants", () => {
  it("builds a 540-pair pool with a 75% cut point", () => {
    expect(POOL_SIZE).toBe(540);
    expect(BASE_PAIR_COUNT * POOL_CYCLES).toBe(540);
    expect(CUT_AFTER).toBe(405);
  });
});

describe("cryptoRandomInt", () => {
  it("stays within range", () => {
    for (let i = 0; i < 5_000; i += 1) {
      const value = cryptoRandomInt(6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  it("returns 0 when there is only one option", () => {
    expect(cryptoRandomInt(1)).toBe(0);
  });

  it("rejects invalid bounds", () => {
    expect(() => cryptoRandomInt(0)).toThrow(RangeError);
    expect(() => cryptoRandomInt(-3)).toThrow(RangeError);
    expect(() => cryptoRandomInt(2.5)).toThrow(RangeError);
  });

  it("is uniform across 1-6 (no modulo bias)", () => {
    const draws = 60_000;
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < draws; i += 1) counts[cryptoRandomInt(6)] += 1;
    // Expected 10,000 each, standard deviation about 91; allow roughly 5.5 sigma.
    for (const count of counts) expect(Math.abs(count - draws / 6)).toBeLessThan(500);
  });
});

describe("fisherYatesShuffle", () => {
  it("keeps every element exactly once", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const shuffled = fisherYatesShuffle([...items], seededRandomInt(7));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("is reproducible with the same seed", () => {
    const base = Array.from({ length: 50 }, (_, i) => i);
    const first = fisherYatesShuffle([...base], seededRandomInt(99));
    const second = fisherYatesShuffle([...base], seededRandomInt(99));
    expect(first).toEqual(second);
  });

  it("produces all permutations of three items about equally often", () => {
    const randomInt = seededRandomInt(2024);
    const counts = new Map<string, number>();
    const runs = 60_000;
    for (let i = 0; i < runs; i += 1) {
      const key = fisherYatesShuffle([1, 2, 3], randomInt).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) expect(Math.abs(count - runs / 6)).toBeLessThan(500);
  });
});

describe("balanced mode (540 pool)", () => {
  it("starts with a pool holding every pair exactly 15 times", () => {
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(1) });
    generator.next();
    const shoe = generator.serializeShoe();
    expect(shoe).not.toBeNull();
    expect(isValidShoeState(shoe)).toBe(true);
    expect(shoe!.pool).toHaveLength(POOL_SIZE);

    const counts = new Array<number>(BASE_PAIR_COUNT).fill(0);
    for (const index of shoe!.pool) counts[index] += 1;
    expect(counts.every((count) => count === POOL_CYCLES)).toBe(true);
  });

  it("makes totals appear in exactly the real odds (2.78% up to 16.67%)", () => {
    const expectedPct: Record<number, string> = {
      2: "2.78", 3: "5.56", 4: "8.33", 5: "11.11", 6: "13.89", 7: "16.67",
      8: "13.89", 9: "11.11", 10: "8.33", 11: "5.56", 12: "2.78",
    };

    // Count totals across a real shuffled pool (all 540 stored indexes, not just the dealt ones).
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(42) });
    generator.next();
    const totals = new Array<number>(13).fill(0);
    for (const index of generator.serializeShoe()!.pool) {
      totals[Math.floor(index / 6) + 1 + ((index % 6) + 1)] += 1;
    }

    let sum = 0;
    for (let total = 2; total <= 12; total += 1) {
      expect(totals[total]).toBe(POOL_TOTAL_COUNTS[total]);
      expect(((totals[total] / POOL_SIZE) * 100).toFixed(2)).toBe(expectedPct[total]);
      sum += totals[total];
    }
    expect(sum).toBe(POOL_SIZE);
    expect(POOL_TOTAL_COUNTS[7]).toBe(90);
    expect(POOL_TOTAL_COUNTS[2]).toBe(15);
    expect(POOL_TOTAL_COUNTS[12]).toBe(15);
  });

  it("only returns pairs with values 1-6", () => {
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(3) });
    for (let i = 0; i < 2_000; i += 1) {
      const [a, b] = generator.next();
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
  });

  it("never deals one pair more than 15 times before the cut", () => {
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(5) });
    const counts = new Map<string, number>();
    for (let i = 0; i < CUT_AFTER; i += 1) {
      const key = pairKey(generator.next());
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(POOL_CYCLES);
  });

  it("reshuffles at the cut point instead of dealing the whole pool", () => {
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(11) });
    for (let i = 0; i < CUT_AFTER; i += 1) generator.next();
    expect(generator.shoeStatus().drawn).toBe(CUT_AFTER);
    expect(generator.shoeStatus().remaining).toBe(0);

    generator.next();
    expect(generator.shoeStatus().drawn).toBe(1);
    expect(generator.shoeStatus().remaining).toBe(CUT_AFTER - 1);
  });

  it("restores a serialized pool and continues the same sequence", () => {
    const original = createGenerator({ mode: "balanced", randomInt: seededRandomInt(21) });
    for (let i = 0; i < 10; i += 1) original.next();
    const restored = createGenerator({
      mode: "balanced",
      randomInt: seededRandomInt(999),
      shoe: original.serializeShoe(),
    });
    for (let i = 0; i < 100; i += 1) expect(restored.next()).toEqual(original.next());
  });

  it("ignores a corrupted saved pool", () => {
    const generator = createGenerator({
      mode: "balanced",
      randomInt: seededRandomInt(8),
      shoe: { pool: [1, 2, 3], drawn: 0 },
    });
    expect(generator.serializeShoe()).toBeNull();
    generator.next();
    expect(isValidShoeState(generator.serializeShoe())).toBe(true);
  });

  it("is reproducible with the same seed", () => {
    const a = createGenerator({ mode: "balanced", randomInt: seededRandomInt(77) });
    const b = createGenerator({ mode: "balanced", randomInt: seededRandomInt(77) });
    for (let i = 0; i < 500; i += 1) expect(a.next()).toEqual(b.next());
  });
});

describe("pure mode", () => {
  it("draws two independent values in range without touching the pool", () => {
    const generator = createGenerator({ mode: "pure", randomInt: seededRandomInt(13) });
    const seen = new Set<string>();
    for (let i = 0; i < 2_000; i += 1) {
      const pair = generator.next();
      expect(pair.every((value) => value >= 1 && value <= 6)).toBe(true);
      seen.add(pairKey(pair));
    }
    expect(seen.size).toBe(BASE_PAIR_COUNT);
    expect(generator.serializeShoe()).toBeNull();
  });

  it("can repeat the same pair back to back", () => {
    const generator = createGenerator({ mode: "pure", randomInt: seededRandomInt(31) });
    let previous = pairKey(generator.next());
    let repeats = 0;
    for (let i = 0; i < 5_000; i += 1) {
      const key = pairKey(generator.next());
      if (key === previous) repeats += 1;
      previous = key;
    }
    // About 1 in 36 results repeat the previous pair.
    expect(repeats).toBeGreaterThan(60);
    expect(repeats).toBeLessThan(260);
  });
});

describe("mode switching", () => {
  it("switches between pure and balanced draws", () => {
    const generator = createGenerator({ mode: "balanced", randomInt: seededRandomInt(4) });
    generator.next();
    expect(generator.shoeStatus().drawn).toBe(1);

    generator.setMode("pure");
    expect(generator.mode).toBe("pure");
    generator.next();
    expect(generator.shoeStatus().drawn).toBe(1);

    generator.setMode("balanced");
    generator.next();
    expect(generator.shoeStatus().drawn).toBe(2);
  });
});

describe("cosmeticPair", () => {
  it("stays within 1-6", () => {
    for (let i = 0; i < 1_000; i += 1) {
      expect(cosmeticPair().every((value) => value >= 1 && value <= 6)).toBe(true);
    }
  });
});
