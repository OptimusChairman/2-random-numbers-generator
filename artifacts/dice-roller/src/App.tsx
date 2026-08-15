import { useCallback, useEffect, useRef, useState } from "react";

// Select one of 36 equally likely pairs so every two-die outcome remains fair.
function rollDice(): [number, number] {
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

function Die({ value, rolling, label }: { value: number; rolling: boolean; label: string }) {
  return (
    <div className="die-wrap">
      <span className="die-index">{label}</span>
      <div
        className={`die ${rolling ? "rolling" : ""}`}
        role="img"
        aria-label={`${label} shows ${value}`}
        data-testid={`die-${label.toLowerCase()}`}
      >
        <span className="die-value">{value}</span>
      </div>
    </div>
  );
}

function PlaceholderDie({ label }: { label: string }) {
  return (
    <div className="die-wrap">
      <span className="die-index">{label}</span>
      <div className="die-placeholder" aria-label={`${label} is waiting for a roll`} data-testid={`die-placeholder-${label.toLowerCase()}`}>
        <span aria-hidden="true">?</span>
      </div>
    </div>
  );
}

export default function App() {
  const [dice, setDice] = useState<[number, number] | null>(null);
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

  const roll = useCallback(() => {
    if (rolling) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);
    intervalRef.current = setInterval(() => {
      setDice(rollDice());
    }, 78);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      timeoutRef.current = null;

      const result = rollDice();
      const sum = result[0] + result[1];
      setDice(result);
      setRolling(false);
      setTally((previous) => ({ ...previous, [sum]: (previous[sum] ?? 0) + 1 }));
      setTotalRolls((previous) => previous + 1);
    }, 650);
  }, [rolling]);

  const sum = dice ? dice[0] + dice[1] : null;
  const statusText = rolling ? "The portal is turning" : sum !== null ? `Total ${sum}` : "Ready when you are";

  return (
    <main className="cosmos">
      <div className="orb orb-one" aria-hidden="true" />
      <div className="orb orb-two" aria-hidden="true" />

      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark" aria-label="Chance portal">
            <span className="brand-symbol" aria-hidden="true" />
            <span>Chance / 02</span>
          </div>
          <span className="topbar-note">A tiny ritual of randomness</span>
        </header>

        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">Two paths · one moment</p>
          <h1 id="page-title">Open the <em>portal.</em></h1>
          <p className="hero-copy">
            Two fair dice. Thirty-six possible doors. Roll when you need a small, beautiful answer.
          </p>
        </section>

        <section className="portal-card" aria-label="Two dice roller">
          <div className="portal-label">
            <span>Live chamber</span>
            <span>{rolling ? "Calculating" : "Awaiting chance"}</span>
          </div>

          <div className="dice-stage" aria-live="polite" aria-atomic="true">
            {dice ? (
              <>
                <Die value={dice[0]} rolling={rolling} label="Die one" />
                <span className="plus-mark" aria-hidden="true">+</span>
                <Die value={dice[1]} rolling={rolling} label="Die two" />
              </>
            ) : (
              <>
                <PlaceholderDie label="Die one" />
                <span className="plus-mark" aria-hidden="true">+</span>
                <PlaceholderDie label="Die two" />
              </>
            )}
          </div>

          <div className={`result-band ${rolling ? "is-rolling" : ""}`} role="status" data-testid="status-result">
            {rolling ? (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">Generating</span>
                <span className="result-formula" aria-hidden="true">•••</span>
              </>
            ) : sum !== null ? (
              <>
                <span className="result-kicker">Total</span>
                <span className="result-value" data-testid="text-total">{sum}</span>
                <span className="result-formula">{dice![0]} + {dice![1]}</span>
              </>
            ) : (
              <>
                <span className="result-kicker">Result</span>
                <span className="result-value">—</span>
                <span className="result-formula">Your numbers will appear here</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="roll-button"
            onClick={roll}
            disabled={rolling}
            aria-label={rolling ? "Generating a new pair of dice" : dice ? "Roll the dice again" : "Roll the dice"}
            data-testid="button-roll"
          >
            {rolling ? "Turning the chance" : dice ? "Roll again" : "Roll the dice"}
          </button>

          <div className="portal-foot">
            <span>{statusText}</span>
            <span><strong>{totalRolls}</strong> {totalRolls === 1 ? "reading" : "readings"} recorded</span>
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
            {showStats ? "Close distribution" : "View distribution"} · {totalRolls} {totalRolls === 1 ? "roll" : "rolls"}
          </button>
        )}

        {showStats && totalRolls > 0 && (
          <section className="stats-panel" id="distribution-panel" aria-labelledby="distribution-title">
            <div className="stats-heading">
              <h2 id="distribution-title">Roll distribution</h2>
              <p>{totalRolls} total {totalRolls === 1 ? "roll" : "rolls"}</p>
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
                    <span>{count}× · actual <b>{actualPct.toFixed(1)}%</b> / expected {expectedPct.toFixed(2)}%</span>
                  </div>
                  <div className="distribution-track" aria-label={`Sum ${value}: ${count} rolls, ${actualPct.toFixed(1)} percent actual`}>
                    <div className="distribution-expected" aria-hidden="true" />
                    <div className="distribution-fill" style={{ width: `${fillWidth}%` }} aria-hidden="true" />
                  </div>
                </div>
              );
            })}

            <p className="stats-legend">
              The brighter fill is your observed share against the expected odds. Short runs wander; the pattern settles with time.
            </p>
          </section>
        )}

        <p className="footer-note">Each pair has a 1 in 36 chance · no hidden weighting</p>
      </div>
    </main>
  );
}