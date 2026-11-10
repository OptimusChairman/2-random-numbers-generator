// Number generator core.
//
// Two modes share one interface:
//   "pure"     - every pair is two independent, uniform draws from 1-6.
//   "balanced" - the 540-pair shuffled pool ("casino shoe"): 36 pairs x 15 cycles,
//                Fisher-Yates shuffled, drawn without replacement, reshuffled at a
//                cut point so the tail of the pool can never be counted.
//
// All randomness flows through an injectable `RandomInt`, so the module is fully
// unit-testable and the production source is the Web Crypto API.

export type Pair = [number, number];
export type GeneratorMode = "pure" | "balanced";

/** Returns a uniform integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

export const POOL_CYCLES = 15;
export const BASE_PAIR_COUNT = 36;
export const POOL_SIZE = BASE_PAIR_COUNT * POOL_CYCLES; // 540
/** Fraction of the pool dealt before reshuffling (casino-style cut card). */
export const CUT_FRACTION = 0.75;
export const CUT_AFTER = Math.floor(POOL_SIZE * CUT_FRACTION); // 405

const UINT32_RANGE = 0x1_0000_0000;

/**
 * Uniform integer in [0, maxExclusive) using Web Crypto with rejection
 * sampling, so there is no modulo bias. Falls back to Math.random only when
 * crypto is unavailable (very old or locked-down environments).
 */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;

  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    return Math.floor(Math.random() * maxExclusive);
  }

  // Largest multiple of maxExclusive that fits in 2^32; reject anything above it.
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  let value: number;
  do {
    if (bufferIndex >= entropyBuffer.length) {
      cryptoApi.getRandomValues(entropyBuffer);
      bufferIndex = 0;
    }
    value = entropyBuffer[bufferIndex];
    bufferIndex += 1;
  } while (value >= limit);
  return value % maxExclusive;
};

// Entropy is fetched in batches: one getRandomValues call per 256 words keeps
// the 100,000+ draw sanity check fast without changing the distribution.
const entropyBuffer = new Uint32Array(256);
let bufferIndex = entropyBuffer.length;

/** Cosmetic randomness for animation frames. Never feeds a real result. */
export function cosmeticPair(): Pair {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

function pairFromIndex(index: number): Pair {
  return [Math.floor(index / 6) + 1, (index % 6) + 1];
}

/** In-place Fisher-Yates shuffle. */
export function fisherYatesShuffle<T>(items: T[], randomInt: RandomInt): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildShuffledPool(randomInt: RandomInt): number[] {
  const pool: number[] = [];
  for (let cycle = 0; cycle < POOL_CYCLES; cycle += 1) {
    for (let index = 0; index < BASE_PAIR_COUNT; index += 1) pool.push(index);
  }
  return fisherYatesShuffle(pool, randomInt);
}

export type ShoeState = {
  /** Shuffled pair indices (0-35) for the current pool. */
  pool: number[];
  /** How many pairs of this pool have been dealt. */
  drawn: number;
};

export type ShoeStatus = {
  drawn: number;
  cutAfter: number;
  poolSize: number;
  /** Pairs left before the next reshuffle. */
  remaining: number;
};

export function isValidShoeState(value: unknown): value is ShoeState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { pool?: unknown; drawn?: unknown };
  if (!Array.isArray(candidate.pool) || candidate.pool.length !== POOL_SIZE) return false;
  if (!Number.isInteger(candidate.drawn) || (candidate.drawn as number) < 0) return false;
  if ((candidate.drawn as number) > CUT_AFTER) return false;

  // A valid pool holds every pair index exactly POOL_CYCLES times.
  const counts = new Array<number>(BASE_PAIR_COUNT).fill(0);
  for (const entry of candidate.pool) {
    if (!Number.isInteger(entry) || entry < 0 || entry >= BASE_PAIR_COUNT) return false;
    counts[entry] += 1;
  }
  return counts.every((count) => count === POOL_CYCLES);
}

export type Generator = {
  readonly mode: GeneratorMode;
  setMode(mode: GeneratorMode): void;
  /** Draw one real result in the current mode. */
  next(): Pair;
  /** Snapshot of the balanced pool, for persistence. */
  serializeShoe(): ShoeState | null;
  shoeStatus(): ShoeStatus;
};

export type GeneratorOptions = {
  mode?: GeneratorMode;
  randomInt?: RandomInt;
  /** Restore a previously serialized pool (ignored if invalid). */
  shoe?: unknown;
};

export function createGenerator(options: GeneratorOptions = {}): Generator {
  const randomInt = options.randomInt ?? cryptoRandomInt;
  let mode: GeneratorMode = options.mode ?? "balanced";
  let shoe: ShoeState | null = isValidShoeState(options.shoe)
    ? { pool: [...options.shoe.pool], drawn: options.shoe.drawn }
    : null;

  const freshShoe = (): ShoeState => ({ pool: buildShuffledPool(randomInt), drawn: 0 });

  return {
    get mode() {
      return mode;
    },
    setMode(nextMode) {
      mode = nextMode;
    },
    next() {
      if (mode === "pure") {
        return [1 + randomInt(6), 1 + randomInt(6)];
      }
      if (!shoe || shoe.drawn >= CUT_AFTER) shoe = freshShoe();
      const index = shoe.pool[shoe.drawn];
      shoe.drawn += 1;
      return pairFromIndex(index);
    },
    serializeShoe() {
      return shoe ? { pool: [...shoe.pool], drawn: shoe.drawn } : null;
    },
    shoeStatus() {
      const drawn = shoe?.drawn ?? 0;
      return {
        drawn,
        cutAfter: CUT_AFTER,
        poolSize: POOL_SIZE,
        remaining: CUT_AFTER - drawn,
      };
    },
  };
}
