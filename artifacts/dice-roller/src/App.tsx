import { useCallback, useEffect, useRef, useState } from "react";

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
    <div className={`number-node ${rolling ? "is-charged" : ""}`}>
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
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [tally, setTally] = useState<Record<number, number>>({});
  const [totalRolls, setTotalRolls] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const generate = useCallback(() => {
    if (rolling) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);
    intervalRef.current = setInterval(() => {
      setPair(generatePair());
    }, 78);

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
    }, 650);
  }, [rolling]);

  const sum = pair ? pair[0] + pair[1] : null;
  const statusText = rolling ? "Signal in motion" : sum !== null ? `Total ${sum}` : "Awaiting signal";

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
            <span>Live channel</span>
            <span>{rolling ? "Charging" : "Standby"}</span>
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

          <div className={`result-band ${rolling ? "is-rolling" : ""}`} role="status" data-testid="status-result">
            {rolling ? (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">Resolving</span>
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
                <span className="result-formula">No signal yet</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="roll-button"
            onClick={generate}
            disabled={rolling}
            aria-label={rolling ? "Generating a new pair of numbers" : pair ? "Generate another pair" : "Generate two numbers"}
            data-testid="button-roll"
          >
            {rolling ? "Resolving" : pair ? "Generate again" : "Generate pair"}
          </button>

          <div className="portal-foot">
            <span>{statusText}</span>
            <span>
              <strong>{totalRolls}</strong> {totalRolls === 1 ? "reading" : "readings"}
            </span>
          </div>
        </section>

        {totalRolls > 0 && (
          <button
            type="button"
            className="stats-toggle"
            onClick={() => setShowStats((visible) => !visible)}
            aria-expanded={showStats}
            aria-controls="distribution-panel"
            data-testid="button-toggle-stats"
          >
            {showStats ? "Close distribution" : "View distribution"} · {totalRolls}{" "}
            {totalRolls === 1 ? "reading" : "readings"}
          </button>
        )}

        {showStats && totalRolls > 0 && (
          <section className="stats-panel" id="distribution-panel" aria-labelledby="distribution-title">
            <div className="stats-heading">
              <h2 id="distribution-title">Distribution</h2>
              <p>{totalRolls} total readings</p>
            </div>

            {DISTRIBUTION_ORDER.map((value) => {
              const count = tally[value] ?? 0;
              const actualPct = (count / totalRolls) * 100;
              const expectedPct = (EXPECTED[value] / 36) * 100;
              const fillWidth = Math.min((actualPct / expectedPct) * 100, 100);

              return (
                <div className="distribution-row" key={value} data-testid={`distribution-row-${value}`}>
                  <div className="distribution-meta">
                    <strong>{value}</strong>
                    <span>
                      {count}× · actual <b>{actualPct.toFixed(1)}%</b> / expected {expectedPct.toFixed(2)}%
                    </span>
                  </div>
                  <div
                    className="distribution-track"
                    aria-label={`Total ${value}: ${count} readings, ${actualPct.toFixed(1)} percent actual`}
                  >
                    <div className="distribution-expected" aria-hidden="true" />
                    <div className="distribution-fill" style={{ width: `${fillWidth}%` }} aria-hidden="true" />
                  </div>
                </div>
              );
            })}

            <p className="stats-legend">Observed share / expected share</p>
          </section>
        )}

        <p className="footer-note">36 equal outcomes</p>
      </div>
    </main>
  );
}