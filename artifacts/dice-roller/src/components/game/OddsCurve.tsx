import { useMemo } from "react";
import { linePath, smoothPath, type Point } from "../../lib/charts";
import { EXPECTED_WAYS, SUM_VALUES } from "../../lib/stats";

const WIDTH = 240;
const HEIGHT = 64;
const LEFT = 14;
const RIGHT = WIDTH - 14;
const BASE = 52;
const PEAK = 12;

function pointFor(total: number): Point {
  const x = LEFT + ((total - 2) / 10) * (RIGHT - LEFT);
  const y = BASE - (EXPECTED_WAYS[total] / 6) * (BASE - PEAK);
  return { x, y };
}

/**
 * The 2-12 odds curve with a glowing dot where the current total sits. While numbers are
 * being generated the dot scans along the curve, then settles on the real result.
 */
export function OddsCurve({ total, rolling }: { total: number | null; rolling: boolean }) {
  const { curve, area, ticks } = useMemo(() => {
    const points = SUM_VALUES.map(pointFor);
    const curvePath = smoothPath(points);
    return {
      curve: curvePath,
      area: `${curvePath} L${points[points.length - 1].x} ${BASE} L${points[0].x} ${BASE} Z`,
      ticks: SUM_VALUES.map((value) => ({ value, ...pointFor(value) })),
    };
  }, []);

  const dot = total !== null ? pointFor(total) : null;
  const ways = total !== null ? EXPECTED_WAYS[total] : null;

  return (
    <figure className="odds-curve" data-testid="odds-curve">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={total !== null ? `Total ${total} lands ${ways} times in 36` : "Odds of each total from 2 to 12"}>
        <defs>
          <linearGradient id="odds-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--t-accent)" stopOpacity=".38" />
            <stop offset="100%" stopColor="var(--t-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={linePath([{ x: LEFT - 6, y: BASE }, { x: RIGHT + 6, y: BASE }])} className="odds-baseline" />
        <path d={area} fill="url(#odds-fill)" />
        <path d={curve} className="odds-line" />
        {ticks.map((tick) => (
          <circle key={tick.value} cx={tick.x} cy={BASE} r={tick.value === total ? 0 : 1.2} className="odds-tick" />
        ))}
        <text x={LEFT} y={BASE + 11} className="odds-label" textAnchor="middle">2</text>
        <text x={pointFor(7).x} y={BASE + 11} className="odds-label" textAnchor="middle">7</text>
        <text x={RIGHT} y={BASE + 11} className="odds-label" textAnchor="middle">12</text>
        {dot && (
          <g
            className={`odds-dot ${rolling ? "is-scanning" : ""}`}
            style={{ transform: `translate(${dot.x}px, ${dot.y}px)` }}
          >
            <line x1="0" y1="0" x2="0" y2={BASE - dot.y} className="odds-drop" />
            <circle r="9" className="odds-dot-halo" />
            <circle r="3.6" className="odds-dot-core" />
          </g>
        )}
      </svg>
      <figcaption>
        {total !== null && ways !== null && !rolling ? (
          <>
            <strong>{total}</strong> lands <strong>{ways} in 36</strong> · {((ways / 36) * 100).toFixed(2)}%
          </>
        ) : rolling ? (
          "Reading the odds…"
        ) : (
          "Odds of every total"
        )}
      </figcaption>
    </figure>
  );
}
