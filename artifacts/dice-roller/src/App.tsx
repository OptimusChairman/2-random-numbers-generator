import { useState, useCallback, useRef } from "react";

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roll = useCallback(() => {
    if (rolling) return;

    // Clear any lingering timers from a previous roll (safety)
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setRolling(true);

    // Rapid cycling for visual effect — does NOT affect the final result
    intervalRef.current = setInterval(() => {
      setDice([rollDie(), rollDie()]);
    }, 80);

    // After 600 ms: stop cycling, set the real final roll
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      intervalRef.current = null;
      timeoutRef.current = null;

      // Final independent roll — clean, unaffected by interval timing
      const d1 = rollDie();
      const d2 = rollDie();
      setDice([d1, d2]);
      setRolling(false);
    }, 600);
  }, [rolling]);

  const sum = dice ? dice[0] + dice[1] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f3eeff 0%, #e8d9fa 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
      }}
    >
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
