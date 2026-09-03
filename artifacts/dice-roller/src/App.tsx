import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Select one of 36 equally likely pairs so every outcome remains fair.
function generatePair(): [number, number] {
  const outcome = Math.floor(Math.random() * 36);
  return [Math.floor(outcome / 6) + 1, (outcome % 6) + 1];
}

const EXPECTED: Record<number, number> = {
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

const DISTRIBUTION_ORDER = [7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12];
const GENERATION_DURATION_MS = 300;
const SANITY_CHECK_ROLLS = 100_000;
const SANITY_RECHECK_ROLLS = 200_000;
const SANITY_VARIANCE_LIMIT = 1.5;
type Result = { pair: [number, number]; sum: number };
type PersistedState = {
  pair: [number, number] | null;
  tally: Record<number, number>;
  totalRolls: number;
  recentResults: Result[];
};
type SanityResult = {
  rolls: number;
  passed: boolean;
  isRecheck: boolean;
  worstTotal: number;
  maxDifference: number;
  actualPct: number;
  expectedPct: number;
};
const STORAGE_KEY = "two-number-generator-history";

function isValidPair(value: unknown): value is [number, number] {
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
      pair: parsed.pair as [number, number] | null,
      tally,
      totalRolls: parsed.totalRolls as number,
      recentResults: parsed.recentResults,
    };
  } catch {
    return null;
  }
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
        {value}
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
  const [pair, setPair] = useState<[number, number] | null>(() => persistedState?.pair ?? null);
  const [rolling, setRolling] = useState(false);
  const [tally, setTally] = useState<Record<number, number>>(() => persistedState?.tally ?? {});
  const [totalRolls, setTotalRolls] = useState(() => persistedState?.totalRolls ?? 0);
  const [recentResults, setRecentResults] = useState<Result[]>(() => persistedState?.recentResults ?? []);
  const [showStats, setShowStats] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sanityRunning, setSanityRunning] = useState(false);
  const [sanityResult, setSanityResult] = useState<SanityResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sanityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (sanityTimeoutRef.current) clearTimeout(sanityTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pair, tally, totalRolls, recentResults } satisfies PersistedState),
      );
    } catch {
      // Storage can be unavailable in private browsing or restricted web views.
    }
  }, [pair, recentResults, tally, totalRolls]);

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

  const generate = useCallback(() => {
    if (rolling) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);
    const intervalMs = window.matchMedia("(hover: none) and (pointer: coarse)").matches ? 96 : 72;
    intervalRef.current = setInterval(() => {
      setPair(generatePair());
    }, intervalMs);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timeoutRef.current = null;

      const result = generatePair();
      const sum = result[0] + result[1];
      setPair(result);
      setRolling(false);
      setTally((previous) => ({ ...previous, [sum]: (previous[sum] ?? 0) + 1 }));
      setTotalRolls((previous) => previous + 1);
      setRecentResults((previous) => [{ pair: result, sum }, ...previous].slice(0, 3));
    }, GENERATION_DURATION_MS);
  }, [rolling]);

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
    setPair(null);
    setTally({});
    setTotalRolls(0);
    setRecentResults([]);
    setShowStats(false);
    setShowResetConfirm(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The cleared in-memory state remains available if storage is restricted.
    }
  }, []);

  const runSanityCheck = useCallback(
    (isRecheck = false) => {
      if (sanityRunning) return;

      const rolls = isRecheck ? SANITY_RECHECK_ROLLS : SANITY_CHECK_ROLLS;
      const sanityTally: Record<number, number> = {};
      let completed = 0;
      const chunkSize = 5_000;

      setSanityRunning(true);
      setSanityResult(null);

      const processChunk = () => {
        const chunkEnd = Math.min(completed + chunkSize, rolls);
        for (; completed < chunkEnd; completed += 1) {
          const result = generatePair();
          const resultSum = result[0] + result[1];
          sanityTally[resultSum] = (sanityTally[resultSum] ?? 0) + 1;
        }

        if (completed < rolls) {
          sanityTimeoutRef.current = setTimeout(processChunk, 0);
          return;
        }

        let maxDifference = -1;
        let worstTotal = 7;
        let worstActual = 0;
        let worstExpected = 0;

        for (let value = 2; value <= 12; value += 1) {
          const actual = ((sanityTally[value] ?? 0) / rolls) * 100;
          const expected = (EXPECTED[value] / 36) * 100;
          const difference = Math.abs(actual - expected);
          if (difference > maxDifference) {
            maxDifference = difference;
            worstTotal = value;
            worstActual = actual;
            worstExpected = expected;
          }
        }

        sanityTimeoutRef.current = null;
        setSanityResult({
          rolls,
          passed: maxDifference <= SANITY_VARIANCE_LIMIT,
          isRecheck,
          worstTotal,
          maxDifference,
          actualPct: worstActual,
          expectedPct: worstExpected,
        });
        setSanityRunning(false);
      };

      sanityTimeoutRef.current = setTimeout(processChunk, 0);
    },
    [sanityRunning],
  );

  const handleSanityFix = useCallback(() => {
    runSanityCheck(true);
  }, [runSanityCheck]);

  const sum = pair ? pair[0] + pair[1] : null;
  const probabilitySummary = useMemo(() => {
    if (totalRolls === 0) return null;

    let mostRepeatedCount = -1;
    const mostRepeatedTotals: number[] = [];
    let closestDifference = Number.POSITIVE_INFINITY;
    const closestTotals: Array<{ value: number; actual: number; expected: number }> = [];

    for (let value = 2; value <= 12; value += 1) {
      const count = tally[value] ?? 0;
      if (count > mostRepeatedCount) {
        mostRepeatedCount = count;
        mostRepeatedTotals.length = 0;
        mostRepeatedTotals.push(value);
      } else if (count === mostRepeatedCount) {
        mostRepeatedTotals.push(value);
      }

      const actual = (count / totalRolls) * 100;
      const expected = (EXPECTED[value] / 36) * 100;
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
          <span className="topbar-note">Between 1 and 6</span>
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
            <span>{rolling ? "Generating" : "Ready"}</span>
          </div>

          <div className={`number-stage ${rolling ? "is-charged" : ""}`} aria-live="polite" aria-atomic="true">
            <div className="energy-field" aria-hidden="true">
              <span className="energy-halo halo-one" />
              <span className="energy-halo halo-two" />
              <span className="sigil sigil-one" />
              <span className="sigil sigil-two" />
              <span className="speed-line speed-line-one" />
              <span className="speed-line speed-line-two" />
              <span className="speed-line speed-line-three" />
              <span className="energy-core" />
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
            role="status"
            data-testid="status-result"
          >
            {rolling ? (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">Generating</span>
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

          <button
            type="button"
            className="roll-button"
            onClick={generate}
            disabled={rolling}
            aria-label={rolling ? "Generating two numbers" : pair ? "Generate another pair of numbers" : "Generate two numbers"}
            data-testid="button-roll"
          >
            {rolling ? "Generating" : pair ? "Generate again" : "Generate 2 numbers"}
          </button>
          <p className="keyboard-hint">
            Press <kbd>Space</kbd> to generate
          </p>

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
            onClick={() => runSanityCheck()}
            disabled={sanityRunning}
            aria-label={sanityRunning ? "Checking 100,000 simulated rolls" : "Run sanity check"}
          >
            {sanityRunning ? "Checking 100,000 rolls…" : "Run sanity check"}
          </button>
          <span>Diagnostic only · saved history stays unchanged</span>
        </div>

        {sanityResult && (
          <aside
            className={`sanity-popup ${sanityResult.passed ? "is-passed" : "is-warning"}`}
            role="status"
            aria-live="polite"
          >
            <div className="sanity-popup-heading">
              <div>
                <p className="modal-overline">{sanityResult.passed ? "Check passed" : "Large variance detected"}</p>
                <h2>Probability sanity check</h2>
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
              {sanityResult.rolls.toLocaleString()} simulated rolls · largest gap{" "}
              <strong>{sanityResult.maxDifference.toFixed(2)} percentage points</strong>
            </p>
            <p className="sanity-popup-detail">
              Number {sanityResult.worstTotal}: {sanityResult.actualPct.toFixed(2)}% actual vs{" "}
              {sanityResult.expectedPct.toFixed(2)}% expected
            </p>
            {sanityResult.passed ? (
              <p className="sanity-popup-note">The distribution is within the expected variance.</p>
            ) : (
              <>
                <p className="sanity-popup-note">
                  Recheck before treating this as a generator issue. This will not change your saved history.
                </p>
                <button type="button" className="sanity-fix-button" onClick={handleSanityFix}>
                  Fix &amp; recheck
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
                          const expected = (EXPECTED[value] / 36) * 100;
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
                  <span><strong>Expected</strong> fair share</span>
                </div>
              </div>

              {DISTRIBUTION_ORDER.map((value) => {
                const count = tally[value] ?? 0;
                const actualPct = (count / totalRolls) * 100;
                const expectedPct = (EXPECTED[value] / 36) * 100;
                const fillWidth = Math.min((actualPct / expectedPct) * 100, 100);

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
                      aria-label={`Total ${value}: ${count} results, ${actualPct.toFixed(1)} percent actual, ${expectedPct.toFixed(2)} percent expected`}
                    >
                      <div className="distribution-expected" aria-hidden="true" />
                      <div className="distribution-fill" style={{ width: `${fillWidth}%` }} aria-hidden="true" />
                    </div>
                  </div>
                );
              })}

              <p className="stats-legend">The bar compares your observed share with the expected fair share.</p>
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
                This will clear the current numbers, recent results, and probability totals. This cannot be undone.
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