import { useState, useCallback, useRef } from "react";

// Pick one of 36 equally-likely (d1,d2) outcomes directly.
// floor(n/6)+1 gives d1 in 1–6, n%6+1 gives d2 in 1–6.
// Every pair has exactly 1/36 probability.
function rollDice(): [number, number] {
  const outcome = Math.floor(Math.random() * 36);
  const d1 = Math.floor(outcome / 6) + 1;
  const d2 = (outcome % 6) + 1;
  return [d1, d2];
}

// Expected probability for each sum (number of ways / 36)
const EXPECTED: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`die ${rolling ? "rolling" : ""}`}
      style={{
        width: 110,
        height: 110,
        borderRadius: 18,
        background: "white",
        boxShadow: "0 6px 24px rgba(99,60,180,0.18), 0 2px 6px rgba(0,0,0,0.10)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #e2d9f3",
        transition: "transform 0.1s",
      }}
    >
      <span style={{ fontSize: 52, fontWeight: 800, color: "#6B3FA0", lineHeight: 1 }}>
        {value}
      </span>
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

  const roll = useCallback(() => {
    if (rolling) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);

    // Rapid cycling — purely visual, results not recorded
    intervalRef.current = setInterval(() => {
      setDice(rollDice());
    }, 80);

    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      intervalRef.current = null;
      timeoutRef.current = null;

      // Final roll — this is the real result
      const [d1, d2] = rollDice();
      const sum = d1 + d2;
      setDice([d1, d2]);
      setRolling(false);

      // Record in tally
      setTally(prev => ({ ...prev, [sum]: (prev[sum] ?? 0) + 1 }));
      setTotalRolls(prev => prev + 1);
    }, 600);
  }, [rolling]);

  const sum = dice ? dice[0] + dice[1] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f3eeff 0%, #e8d9fa 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        padding: "32px 16px",
        gap: 24,
      }}
    >
      {/* ── Main card ── */}
      <div
        style={{
          background: "white",
          borderRadius: 28,
          padding: "48px 56px",
          boxShadow: "0 16px 60px rgba(99,60,180,0.13), 0 2px 8px rgba(0,0,0,0.07)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
          minWidth: 340,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#3b1f6e", letterSpacing: "-0.5px" }}>
            2 Random Numbers Generator
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#9b7ec8" }}>
            Click the button to generate
          </p>
        </div>

        <div style={{ display: "flex", gap: 28, alignItems: "center", minHeight: 110 }}>
          {dice ? (
            <>
              <Die value={dice[0]} rolling={rolling} />
              <span style={{ fontSize: 28, color: "#c4a8f0", fontWeight: 300 }}>+</span>
              <Die value={dice[1]} rolling={rolling} />
            </>
          ) : (
            <div style={{ display: "flex", gap: 28 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 18,
                    background: "#f5f0fc",
                    border: "2px dashed #d4b8f7",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {sum !== null && !rolling && (
          <div
            style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              borderRadius: 14,
              padding: "14px 40px",
              textAlign: "center",
              boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
            }}
          >
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
              Total
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "white", lineHeight: 1 }}>
              {sum}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
              {dice![0]} + {dice![1]}
            </div>
          </div>
        )}

        {rolling && (
          <div
            style={{
              background: "#f5f0fc",
              borderRadius: 14,
              padding: "14px 40px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, color: "#9b7ec8", fontWeight: 600 }}>Generating…</div>
          </div>
        )}

        <button
          onClick={roll}
          disabled={rolling}
          style={{
            background: rolling
              ? "#c4a8f0"
              : "linear-gradient(135deg, #7c3aed, #a855f7)",
            color: "white",
            border: "none",
            borderRadius: 14,
            padding: "16px 48px",
            fontSize: 17,
            fontWeight: 700,
            cursor: rolling ? "not-allowed" : "pointer",
            boxShadow: rolling ? "none" : "0 4px 16px rgba(124,58,237,0.30)",
            transition: "all 0.2s",
            letterSpacing: "0.3px",
          }}
        >
          {rolling ? "Generating…" : dice ? "Generate Again" : "Generate"}
        </button>
      </div>

      {/* ── Stats toggle ── */}
      {totalRolls > 0 && (
        <button
          onClick={() => setShowStats(s => !s)}
          style={{
            background: "transparent",
            border: "2px solid #d4b8f7",
            borderRadius: 10,
            padding: "8px 24px",
            fontSize: 13,
            fontWeight: 600,
            color: "#7c3aed",
            cursor: "pointer",
          }}
        >
          {showStats ? "Hide Stats" : `Show Stats (${totalRolls} roll${totalRolls === 1 ? "" : "s"})`}
        </button>
      )}

      {/* ── Stats panel ── */}
      {showStats && totalRolls > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: "28px 32px",
            boxShadow: "0 8px 32px rgba(99,60,180,0.10)",
            minWidth: 340,
            width: "100%",
            maxWidth: 480,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#3b1f6e" }}>
              Roll Distribution
            </span>
            <span style={{ fontSize: 12, color: "#9b7ec8" }}>
              {totalRolls} total rolls
            </span>
          </div>

          {[7, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12].map(s => {
            const count = tally[s] ?? 0;
            const actualPct = totalRolls > 0 ? (count / totalRolls) * 100 : 0;
            const expectedPct = (EXPECTED[s] / 36) * 100;
            const barActual = Math.min((actualPct / expectedPct) * 100, 200);

            return (
              <div key={s} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#3b1f6e", width: 20 }}>{s}</span>
                  <span style={{ fontSize: 12, color: "#9b7ec8" }}>
                    {count}×  —  actual <b style={{ color: "#6B3FA0" }}>{actualPct.toFixed(1)}%</b>
                    <span style={{ color: "#c4a8f0" }}> / expected {expectedPct.toFixed(2)}%</span>
                  </span>
                </div>
                <div style={{ position: "relative", height: 8, background: "#f5f0fc", borderRadius: 4, overflow: "hidden" }}>
                  {/* expected marker */}
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: "100%",
                    background: "#e8d9fa",
                    borderRadius: 4,
                  }} />
                  {/* actual fill */}
                  <div style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${Math.min(actualPct / expectedPct * 100, 100)}%`,
                    background: actualPct > expectedPct * 1.2
                      ? "linear-gradient(90deg, #7c3aed, #f59e0b)"
                      : actualPct < expectedPct * 0.8
                      ? "linear-gradient(90deg, #7c3aed, #9b7ec8)"
                      : "linear-gradient(90deg, #7c3aed, #a855f7)",
                    borderRadius: 4,
                    transition: "width 0.4s ease",
                  }} />
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 16, fontSize: 11, color: "#c4a8f0", textAlign: "center" }}>
            Bar = actual % of expected. Orange = over expected, purple = under expected.
            Natural variance is normal — results converge over many rolls.
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg) scale(1.07); }
          40% { transform: rotate(8deg) scale(1.07); }
          60% { transform: rotate(-5deg) scale(1.05); }
          80% { transform: rotate(5deg) scale(1.05); }
        }
        .rolling {
          animation: shake 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
