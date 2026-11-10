import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CUT_AFTER,
  POOL_SIZE,
  POOL_TOTAL_COUNTS,
  cosmeticPair,
  createGenerator,
  isValidShoeState,
  type Generator,
  type GeneratorMode,
  type Pair,
  type ShoeState,
  type ShoeStatus,
} from "./lib/generator";
import {
  SUM_VALUES,
  expectedShare,
  runSanityCheck,
  variationBand,
  type SanityReport,
} from "./lib/stats";
import type { SanityWorkerRequest, SanityWorkerResponse } from "./lib/sanity.worker";
import { playCharge, playLockIn } from "./lib/sound";

const DISTRIBUTION_ORDER = [7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12];
const GENERATION_DURATION_MS = 300;
const SANITY_CHECK_ROLLS = 100_000;
const SANITY_RECHECK_ROLLS = 200_000;
/** Below this many results the tracker bars swing a lot, even for a fair generator. */
const SMALL_SAMPLE = 300;
const PHASES = ["Focusing", "Aligning", "Locking in"] as const;
const STORAGE_KEY = "two-number-generator-history";
const SOUND_KEY = "two-number-generator-sound";

type Result = { pair: Pair; sum: number };
type PersistedState = {
  pair: Pair | null;
  tally: Record<number, number>;
  totalRolls: number;
  recentResults: Result[];
  mode: GeneratorMode;
  shoe: ShoeState | null;
};
type ResultTone = "mirror" | "peak" | "rare";

function isValidPair(value: unknown): value is Pair {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((number) => Number.isInteger(number) && number >= 1 && number <= 6)
  );
}

function isValidResult(value: unknown): value is Result {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { pair?: unknown; sum?: unknown };
  return (
    isValidPair(candidate.pair) &&
    Number.isInteger(candidate.sum) &&
    candidate.sum === candidate.pair[0] + candidate.pair[1]
  );
}

function loadPersistedState(): PersistedState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      pair?: unknown;
      tally?: unknown;
      totalRolls?: unknown;
      recentResults?: unknown;
      mode?: unknown;
      shoe?: unknown;
    };

    if (
      !(parsed.pair === null || isValidPair(parsed.pair)) ||
      !Number.isInteger(parsed.totalRolls) ||
      (parsed.totalRolls as number) < 0 ||
      !parsed.tally ||
      typeof parsed.tally !== "object" ||
      Array.isArray(parsed.tally) ||
      !Array.isArray(parsed.recentResults) ||
      parsed.recentResults.length > 3 ||
      !parsed.recentResults.every(isValidResult)
    ) {
      return null;
    }

    const tally: Record<number, number> = {};
    for (const [key, value] of Object.entries(parsed.tally)) {
      const total = Number(key);
      if (!Number.isInteger(total) || total < 2 || total > 12 || !Number.isInteger(value) || value < 0) {
        return null;
      }
      tally[total] = value;
    }

    const tallyTotal = Object.values(tally).reduce((sum, count) => sum + count, 0);
    if (tallyTotal !== parsed.totalRolls) return null;

    return {
      pair: parsed.pair as Pair | null,
      tally,
      totalRolls: parsed.totalRolls as number,
      recentResults: parsed.recentResults,
      // Saves from before the mode toggle have neither field: they used the balanced pool.
      mode: parsed.mode === "pure" ? "pure" : "balanced",
      shoe: isValidShoeState(parsed.shoe) ? parsed.shoe : null,
    };
  } catch {
    return null;
  }
}

function loadSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

/** Aura color for the stage: a rare total (2 or 12), then doubles, then the most likely total (7). */
function getResultTone(pair: Pair | null): ResultTone | undefined {
  if (!pair) return undefined;
  const [a, b] = pair;
  const total = a + b;
  if (total === 2 || total === 12) return "rare";
  if (a === b) return "mirror";
  if (total === 7) return "peak";
  return undefined;
}

function NumberNode({
  value,
  rolling,
  index,
}: {
  value: number;
  rolling: boolean;
  index: "a" | "b";
}) {
  return (
    <div className={`number-node number-node-${index} ${rolling ? "is-charged" : "is-revealed"}`}>
      <span className="number-index">{index === "a" ? "A / 01" : "B / 02"}</span>
      <output
        className="number-value"
        aria-label={`Number ${index.toUpperCase()} is ${value}`}
        data-testid={`text-number-${index}`}
      >
        <span className="number-glyph">{value}</span>
      </output>
    </div>
  );
}

function NumberPlaceholder({ index }: { index: "a" | "b" }) {
  return (
    <div className="number-node number-node-placeholder">
      <span className="number-index">{index === "a" ? "A / 01" : "B / 02"}</span>
      <output
        className="number-value"
        aria-label={`Number ${index.toUpperCase()} is waiting`}
        data-testid={`text-number-${index}`}
      >
        ·
      </output>
    </div>
  );
}

export default function App() {
  const [persistedState] = useState(loadPersistedState);
  const [pair, setPair] = useState<Pair | null>(() => persistedState?.pair ?? null);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState(0);
  const [tally, setTally] = useState<Record<number, number>>(() => persistedState?.tally ?? {});
  const [totalRolls, setTotalRolls] = useState(() => persistedState?.totalRolls ?? 0);
  const [recentResults, setRecentResults] = useState<Result[]>(() => persistedState?.recentResults ?? []);
  const [mode, setMode] = useState<GeneratorMode>(() => persistedState?.mode ?? "balanced");
  const [rollKey, setRollKey] = useState(0);
  const [soundOn, setSoundOn] = useState(loadSoundPreference);
  const [showStats, setShowStats] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sanityRunning, setSanityRunning] = useState(false);
  const [sanityProgress, setSanityProgress] = useState(0);
  const [sanityResult, setSanityResult] = useState<SanityReport | null>(null);

  const generatorRef = useRef<Generator | null>(null);
  if (generatorRef.current === null) {
    generatorRef.current = createGenerator({
      mode: persistedState?.mode ?? "balanced",
      shoe: persistedState?.shoe,
    });
  }
  const [shoeStatus, setShoeStatus] = useState<ShoeStatus>(() => generatorRef.current!.shoeStatus());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sanityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (sanityTimeoutRef.current) clearTimeout(sanityTimeoutRef.current);
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          pair,
          tally,
          totalRolls,
          recentResults,
          mode,
          shoe: generatorRef.current?.serializeShoe() ?? null,
        } satisfies PersistedState),
      );
    } catch {
      // Storage can be unavailable in private browsing or restricted web views.
    }
  }, [mode, pair, recentResults, tally, totalRolls]);

  useEffect(() => {
    if (!showStats && !showResetConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowStats(false);
        setShowResetConfirm(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showStats, showResetConfirm]);

  const changeMode = useCallback(
    (nextMode: GeneratorMode) => {
      if (rolling || nextMode === mode) return;
      generatorRef.current?.setMode(nextMode);
      setMode(nextMode);
    },
    [mode, rolling],
  );

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // Preference simply will not persist.
    }
    // Turning sound on is a user gesture, so play a short preview chime.
    if (next) playLockIn(false);
  }, [soundOn]);

  const generate = useCallback(() => {
    const generator = generatorRef.current;
    if (rolling || !generator) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);
    setPhase(0);
    if (soundOn) playCharge();

    // The spinning frames are cosmetic only: the real result is drawn once, at lock-in,
    // so every shown result is a true consecutive draw from the selected mode.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intervalMs = window.matchMedia("(hover: none) and (pointer: coarse)").matches ? 96 : 72;
    if (!reducedMotion) {
      let frame = 0;
      intervalRef.current = setInterval(() => {
        frame += 1;
        setPair(cosmeticPair());
        setPhase(Math.min(PHASES.length - 1, Math.floor((frame * intervalMs) / (GENERATION_DURATION_MS / PHASES.length))));
      }, intervalMs);
    }

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timeoutRef.current = null;

      const result = generator.next();
      const sum = result[0] + result[1];
      setPair(result);
      setRolling(false);
      setRollKey((previous) => previous + 1);
      setShoeStatus(generator.shoeStatus());
      setTally((previous) => ({ ...previous, [sum]: (previous[sum] ?? 0) + 1 }));
      setTotalRolls((previous) => previous + 1);
      setRecentResults((previous) => [{ pair: result, sum }, ...previous].slice(0, 3));
      if (soundOn) playLockIn(getResultTone(result) !== undefined);
    }, GENERATION_DURATION_MS);
  }, [rolling, soundOn]);

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || showStats || showResetConfirm) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "BUTTON" ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      event.preventDefault();
      generate();
    };

    document.addEventListener("keydown", handleSpacebar);
    return () => document.removeEventListener("keydown", handleSpacebar);
  }, [generate, showResetConfirm, showStats]);

  const resetHistory = useCallback(() => {
    // A fresh generator also means a freshly shuffled pool. The save effect then
    // persists the cleared state (the chosen mode is kept).
    generatorRef.current = createGenerator({ mode });
    setShoeStatus(generatorRef.current.shoeStatus());
    setPair(null);
    setTally({});
    setTotalRolls(0);
    setRecentResults([]);
    setRollKey(0);
    setShowStats(false);
    setShowResetConfirm(false);
  }, [mode]);

  const finishSanity = useCallback((report: SanityReport) => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setSanityResult(report);
    setSanityRunning(false);
    setSanityProgress(0);
  }, []);

  const runSanity = useCallback(
    (isRecheck = false) => {
      if (sanityRunning) return;

      const rolls = isRecheck ? SANITY_RECHECK_ROLLS : SANITY_CHECK_ROLLS;
      setSanityRunning(true);
      setSanityResult(null);
      setSanityProgress(0);

      // Fallback for environments without module workers: same check, main thread.
      const runInline = () => {
        sanityTimeoutRef.current = setTimeout(() => {
          sanityTimeoutRef.current = null;
          finishSanity(runSanityCheck({ rolls, isRecheck }));
        }, 0);
      };

      if (typeof Worker === "undefined") {
        runInline();
        return;
      }

      try {
        const worker = new Worker(new URL("./lib/sanity.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        const fallBack = () => {
          worker.terminate();
          workerRef.current = null;
          runInline();
        };
        worker.onmessage = (event: MessageEvent<SanityWorkerResponse>) => {
          const message = event.data;
          if (message.type === "progress") setSanityProgress(message.completed / message.total);
          else if (message.type === "done") finishSanity(message.report);
          else fallBack();
        };
        worker.onerror = fallBack;
        worker.postMessage({ rolls, isRecheck } satisfies SanityWorkerRequest);
      } catch {
        runInline();
      }
    },
    [finishSanity, sanityRunning],
  );

  const handleSanityFix = useCallback(() => {
    runSanity(true);
  }, [runSanity]);

  const sum = pair ? pair[0] + pair[1] : null;
  const stageTone = rolling ? undefined : getResultTone(pair);
  const shoePercent = Math.min(100, (shoeStatus.drawn / shoeStatus.cutAfter) * 100);

  const probabilitySummary = useMemo(() => {
    if (totalRolls === 0) return null;

    let mostRepeatedCount = -1;
    const mostRepeatedTotals: number[] = [];
    let closestDifference = Number.POSITIVE_INFINITY;
    const closestTotals: Array<{ value: number; actual: number; expected: number }> = [];

    for (const value of SUM_VALUES) {
      const count = tally[value] ?? 0;
      if (count > mostRepeatedCount) {
        mostRepeatedCount = count;
        mostRepeatedTotals.length = 0;
        mostRepeatedTotals.push(value);
      } else if (count === mostRepeatedCount) {
        mostRepeatedTotals.push(value);
      }

      const actual = (count / totalRolls) * 100;
      const expected = expectedShare(value) * 100;
      const difference = Math.abs(actual - expected);
      if (difference < closestDifference) {
        closestDifference = difference;
        closestTotals.length = 0;
        closestTotals.push({ value, actual, expected });
      } else if (difference === closestDifference) {
        closestTotals.push({ value, actual, expected });
      }
    }

    return { mostRepeatedCount, mostRepeatedTotals, closestTotals };
  }, [tally, totalRolls]);

  return (
    <main className="cosmos">
      <div className="orb orb-one" aria-hidden="true" />
      <div className="orb orb-two" aria-hidden="true" />

      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark" aria-label="Version 2.0">
            <span className="brand-symbol" aria-hidden="true">
              <span />
            </span>
            <span>Version 2.0</span>
          </div>
          <div className="topbar-actions">
            <span className="topbar-note">Between 1 and 6</span>
            <button
              type="button"
              className={`sound-toggle ${soundOn ? "is-on" : ""}`}
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
              data-testid="button-sound"
            >
              <span className="sound-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{soundOn ? "Sound on" : "Sound off"}</span>
            </button>
          </div>
        </header>

        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">Random number generator</p>
          <h1 id="page-title">
            Generate 2 <em>random numbers.</em>
          </h1>
        </section>

        <section className="portal-card" aria-label="Two-number generator">
          <div className="portal-label">
            <span>Range 1–6</span>
            <span>{rolling ? PHASES[phase] : "Ready"}</span>
          </div>

          <div className="mode-switch" role="group" aria-label="Generator mode">
            <button
              type="button"
              className={`mode-option ${mode === "balanced" ? "is-active" : ""}`}
              aria-pressed={mode === "balanced"}
              disabled={rolling}
              onClick={() => changeMode("balanced")}
              data-testid="button-mode-balanced"
            >
              <strong>Balanced</strong>
              <span>{POOL_SIZE} pool</span>
            </button>
            <button
              type="button"
              className={`mode-option ${mode === "pure" ? "is-active" : ""}`}
              aria-pressed={mode === "pure"}
              disabled={rolling}
              onClick={() => changeMode("pure")}
              data-testid="button-mode-pure"
            >
              <strong>Pure random</strong>
              <span>independent</span>
            </button>
          </div>
          <p className="mode-hint">
            {mode === "balanced"
              ? `A shuffled pool of ${POOL_SIZE} results that follows the real odds (a 7 appears ${POOL_TOTAL_COUNTS[7]} times, a 2 or 12 only ${POOL_TOTAL_COUNTS[2]}), reshuffled after ${CUT_AFTER}. Smooths long streaks.`
              : "Two fresh, independent draws every time. Long streaks can and do happen."}
          </p>
          {mode === "balanced" && (
            <details className="pool-details">
              <summary>See what is in the pool</summary>
              <ul className="pool-makeup" aria-label="Pool makeup by total">
                {SUM_VALUES.map((value) => (
                  <li key={value}>
                    <strong>{value}</strong>
                    <span>{POOL_TOTAL_COUNTS[value]} of {POOL_SIZE}</span>
                    <em>{(expectedShare(value) * 100).toFixed(2)}%</em>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {mode === "balanced" && (
            <div
              className="shoe-meter"
              role="progressbar"
              aria-label="Balanced pool progress"
              aria-valuemin={0}
              aria-valuemax={shoeStatus.cutAfter}
              aria-valuenow={shoeStatus.drawn}
              data-testid="meter-pool"
            >
              <div className="shoe-meter-track">
                <div className="shoe-meter-fill" style={{ width: `${shoePercent}%` }} />
              </div>
              <span>
                Pool {shoeStatus.drawn} / {shoeStatus.cutAfter} · reshuffles at the cut
              </span>
            </div>
          )}

          <div className={`number-stage ${rolling ? "is-charged" : ""} ${stageTone ? `is-${stageTone}` : ""}`}>
            <div className="energy-field" aria-hidden="true">
              <span className="aura-ring" />
              <span className="energy-halo halo-one" />
              <span className="energy-halo halo-two" />
              <span className="sigil sigil-one" />
              <span className="sigil sigil-two" />
              <span className="speed-line speed-line-one" />
              <span className="speed-line speed-line-two" />
              <span className="speed-line speed-line-three" />
              <span className="energy-core" />
              {rollKey > 0 && !rolling && <span key={rollKey} className="shockwave" />}
            </div>

            {pair ? (
              <>
                <NumberNode value={pair[0]} rolling={rolling} index="a" />
                <span className="plus-mark" aria-hidden="true">
                  +
                </span>
                <NumberNode value={pair[1]} rolling={rolling} index="b" />
              </>
            ) : (
              <>
                <NumberPlaceholder index="a" />
                <span className="plus-mark" aria-hidden="true">
                  +
                </span>
                <NumberPlaceholder index="b" />
              </>
            )}
          </div>

          <div
            className={`result-band ${rolling ? "is-rolling" : ""} ${sum !== null && !rolling ? "is-final" : ""}`}
            role="group"
            aria-label="Current result"
            data-testid="status-result"
          >
            {rolling ? (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">{PHASES[phase]}</span>
                <span className="result-formula" aria-hidden="true">
                  · · ·
                </span>
              </>
            ) : sum !== null ? (
              <>
                <span className="result-kicker">Total</span>
                <span className="result-value" data-testid="text-total">
                  {sum}
                </span>
                <span className="result-formula">
                  {pair![0]} + {pair![1]}
                </span>
              </>
            ) : (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">—</span>
                <span className="result-formula">No result yet</span>
              </>
            )}
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {rolling
              ? "Generating two numbers."
              : pair && sum !== null
                ? `Generated ${pair[0]} and ${pair[1]}. Total ${sum}.`
                : ""}
          </p>

          <button
            type="button"
            className="roll-button"
            onClick={generate}
            disabled={rolling}
            aria-label={rolling ? "Generating two numbers" : pair ? "Generate another pair of numbers" : "Generate two numbers"}
            data-testid="button-roll"
          >
            {rolling ? PHASES[phase] : pair ? "Generate again" : "Generate 2 numbers"}
          </button>

          <div className="portal-foot">
            <span className="roll-count">
              <strong>{totalRolls}</strong> {totalRolls === 1 ? "roll" : "rolls"}
            </span>
          </div>
        </section>

        <div className="sanity-action">
          <button
            type="button"
            className="sanity-check-button"
            onClick={() => runSanity()}
            disabled={sanityRunning}
            aria-label={sanityRunning ? "Running sanity check" : "Run sanity check"}
          >
            {sanityRunning ? `Checking… ${Math.round(sanityProgress * 100)}%` : "Run sanity check"}
          </button>
          <span>Diagnostic only · tests the raw randomness · saved history and pool stay unchanged</span>
        </div>

        {sanityResult && (
          <aside
            className={`sanity-popup ${sanityResult.passed ? "is-passed" : "is-warning"}`}
            role="status"
            aria-live="polite"
          >
            <div className="sanity-popup-heading">
              <div>
                <p className="modal-overline">{sanityResult.passed ? "Check passed" : "Check flagged"}</p>
                <h2>Randomness sanity check</h2>
              </div>
              <button
                type="button"
                className="sanity-popup-close"
                onClick={() => setSanityResult(null)}
                aria-label="Dismiss sanity check results"
              >
                ×
              </button>
            </div>
            <p className="sanity-popup-detail">
              {sanityResult.rolls.toLocaleString()} simulated results from the raw generator
            </p>
            <p className="sanity-popup-detail">
              Distribution: χ² <strong>{sanityResult.chiSquare.toFixed(2)}</strong> (10 df) · p ={" "}
              <strong>{sanityResult.pValue.toFixed(3)}</strong>
            </p>
            <p className="sanity-popup-detail">
              Independence: consecutive correlation <strong>{sanityResult.serialCorrelation.toFixed(4)}</strong> · z ={" "}
              {sanityResult.serialZ.toFixed(2)}
            </p>
            <p className="sanity-popup-detail">
              Largest gap: number {sanityResult.worstTotal} at {sanityResult.actualPct.toFixed(2)}% vs{" "}
              {sanityResult.expectedPct.toFixed(2)}% expected
            </p>
            {sanityResult.passed ? (
              <p className="sanity-popup-note">
                Totals follow the expected distribution and consecutive results look independent.
              </p>
            ) : sanityResult.isRecheck ? (
              <p className="sanity-popup-note">
                Flagged twice in a row ({sanityResult.failures.join(" and ")}). A fair generator almost never does
                this, so it is worth investigating.
              </p>
            ) : (
              <>
                <p className="sanity-popup-note">
                  A fair generator trips this about 1 run in 75, so recheck before treating it as a problem. This
                  will not change your saved history.
                </p>
                <button
                  type="button"
                  className="sanity-fix-button"
                  onClick={handleSanityFix}
                  aria-label="Recheck with 200,000 simulated results"
                >
                  Recheck with 200,000 results
                </button>
              </>
            )}
          </aside>
        )}

        {totalRolls > 0 && (
          <>
            <section className="recent-results" aria-labelledby="recent-results-title">
              <div className="recent-heading">
                <h2 id="recent-results-title">Recent results</h2>
                <span>Last {Math.min(recentResults.length, 3)}</span>
              </div>
              <div className="recent-list">
                {recentResults.map(({ pair: recentPair, sum: recentSum }, index) => (
                  <div className="recent-result" key={`${recentPair[0]}-${recentPair[1]}-${index}`}>
                    <span className="recent-result-index">#0{index + 1}</span>
                    <span className="recent-result-expression">
                      <strong>
                        {recentPair[0]} + {recentPair[1]}
                      </strong>
                      <span className="recent-result-equals">=</span>
                      <strong className="recent-result-total">{recentSum}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="history-actions">
              <button
                type="button"
                className="stats-toggle"
                onClick={() => setShowStats(true)}
                aria-expanded={showStats}
                aria-controls="probability-modal"
                data-testid="button-toggle-stats"
              >
                View probability · {totalRolls}{" "}
                {totalRolls === 1 ? "result" : "results"}
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={() => setShowResetConfirm(true)}
                data-testid="button-reset-history"
              >
                Reset history
              </button>
            </div>
            <p className="local-history-note">History is saved on this device only.</p>
          </>
        )}

        {showStats && totalRolls > 0 && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setShowStats(false);
            }}
          >
            <section
              className="stats-panel probability-modal"
              id="probability-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="distribution-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="stats-heading">
                <div>
                  <p className="modal-overline">Probability analysis</p>
                  <h2 id="distribution-title">How your results compare</h2>
                  <p className="stats-description">
                    Actual results are shown against the fair expected share for two numbers from 1 to 6.
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowStats(false)}
                  aria-label="Close probability analysis"
                >
                  ×
                </button>
              </div>

              {totalRolls < SMALL_SAMPLE && (
                <p className="small-sample-note" role="note" data-testid="note-small-sample">
                  Small sample: with only {totalRolls} {totalRolls === 1 ? "result" : "results"}, bars swing widely
                  even for a perfectly fair generator. Compare after a few hundred.
                </p>
              )}

              {probabilitySummary && (
                <div className="analysis-summary" aria-label="Probability summary">
                  <div className="analysis-stat">
                    <span>Total rolls</span>
                    <strong>{totalRolls}</strong>
                    <small>completed generations</small>
                  </div>
                  <div className="analysis-stat">
                    <span>Most repeated</span>
                    <strong>
                      {probabilitySummary.mostRepeatedTotals.join(" · ")}
                    </strong>
                    <small>
                      {probabilitySummary.mostRepeatedTotals
                        .map((value) => {
                          const actual = ((tally[value] ?? 0) / totalRolls) * 100;
                          const expected = expectedShare(value) * 100;
                          const timesLabel = probabilitySummary.mostRepeatedCount === 1 ? "time" : "times";
                          return `${probabilitySummary.mostRepeatedCount} ${timesLabel} (${actual.toFixed(1)}% actual vs ${expected.toFixed(2)}% expected)`;
                        })
                        .join(" · ")}
                    </small>
                  </div>
                  <div className="analysis-stat">
                    <span>Closest to expected</span>
                    <strong>
                      {probabilitySummary.closestTotals.map(({ value }) => value).join(" · ")}
                    </strong>
                    <small>
                      {probabilitySummary.closestTotals
                        .map(({ actual, expected }) => `${actual.toFixed(1)}% actual vs ${expected.toFixed(2)}% expected`)
                        .join(" · ")}
                    </small>
                  </div>
                </div>
              )}

              <div className="probability-key" aria-label="Probability chart legend">
                <div>
                  <span className="key-swatch key-swatch-actual" aria-hidden="true" />
                  <span><strong>Actual</strong> your results</span>
                </div>
                <div>
                  <span className="key-swatch key-swatch-expected" aria-hidden="true" />
                  <span><strong>Expected</strong> fair share (tick)</span>
                </div>
                <div>
                  <span className="key-swatch key-swatch-band" aria-hidden="true" />
                  <span><strong>Normal range</strong> 95% for this many results</span>
                </div>
              </div>

              {DISTRIBUTION_ORDER.map((value) => {
                const count = tally[value] ?? 0;
                const actualPct = (count / totalRolls) * 100;
                const expectedPct = expectedShare(value) * 100;
                // The track spans 0 to 2x the expected share, so the expected tick sits at
                // the midpoint and overshoot is visible instead of being capped.
                const scaleMax = expectedPct * 2;
                const fillWidth = Math.min((actualPct / scaleMax) * 100, 100);
                const band = variationBand(value, totalRolls);
                const bandLeft = Math.min((band.low * 100 * 100) / scaleMax, 100);
                const bandRight = Math.min((band.high * 100 * 100) / scaleMax, 100);
                const isOver = actualPct > expectedPct;

                return (
                  <div className="distribution-row" key={value} data-testid={`distribution-row-${value}`}>
                    <div className="distribution-meta">
                      <div className="distribution-total">
                        <strong>{value}</strong>
                        <span>{count} {count === 1 ? "result" : "results"}</span>
                      </div>
                      <span className="distribution-percentages">
                        <b>{actualPct.toFixed(1)}% actual</b>
                        <em>{expectedPct.toFixed(2)}% expected</em>
                      </span>
                    </div>
                    <div
                      className="distribution-track"
                      aria-label={`Total ${value}: ${count} results, ${actualPct.toFixed(1)} percent actual, ${expectedPct.toFixed(2)} percent expected, normal range ${(band.low * 100).toFixed(1)} to ${(band.high * 100).toFixed(1)} percent`}
                    >
                      <div className="distribution-expected" aria-hidden="true" />
                      <div
                        className="distribution-band"
                        style={{ left: `${bandLeft}%`, width: `${Math.max(bandRight - bandLeft, 0)}%` }}
                        aria-hidden="true"
                      />
                      <div
                        className={`distribution-fill ${isOver ? "is-over" : ""}`}
                        style={{ width: `${fillWidth}%` }}
                        aria-hidden="true"
                      />
                      <div className="distribution-tick" aria-hidden="true" />
                    </div>
                  </div>
                );
              })}

              <p className="stats-legend">
                The tick marks the expected share and the shaded band is the normal range for this many results.
                Bars that stay inside the band are behaving like a fair generator.
              </p>
            </section>
          </div>
        )}

        {showResetConfirm && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setShowResetConfirm(false);
            }}
          >
            <section
              className="confirm-dialog"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-title"
              aria-describedby="reset-description"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p className="modal-overline">Clear history</p>
              <h2 id="reset-title">Reset your results?</h2>
              <p id="reset-description">
                This will clear the current numbers, recent results, and probability totals, and reshuffle the pool.
                This cannot be undone.
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="modal-secondary"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Keep history
                </button>
                <button type="button" className="modal-danger" onClick={resetHistory}>
                  Reset history
                </button>
              </div>
            </section>
          </div>
        )}

      </div>
    </main>
  );
}
