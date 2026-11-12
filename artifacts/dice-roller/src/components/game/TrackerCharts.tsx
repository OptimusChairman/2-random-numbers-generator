import { useMemo } from "react";
import { linePath, smoothPath, type Point } from "../../lib/charts";
import { SUM_VALUES, expectedShare } from "../../lib/stats";
import { typicalFairDeviation, type TrendPoint } from "../../lib/trend";

const W = 360;

/** Your results as bars with the expected curve drawn over them. */
function ShapeChart({ tally, totalRolls }: { tally: Record<number, number>; totalRolls: number }) {
  const H = 150;
  const top = 14;
  const bottom = 128;
  const slot = (W - 20) / SUM_VALUES.length;

  const { bars, curve, max } = useMemo(() => {
    const actual = SUM_VALUES.map((value) => ((tally[value] ?? 0) / totalRolls) * 100);
    const expected = SUM_VALUES.map((value) => expectedShare(value) * 100);
    const peak = Math.max(...actual, ...expected) * 1.15;
    const y = (pct: number) => bottom - (pct / peak) * (bottom - top);
    const centers = SUM_VALUES.map((_, i) => 10 + slot * i + slot / 2);
    const points: Point[] = expected.map((pct, i) => ({ x: centers[i], y: y(pct) }));
    return {
      max: peak,
      curve: smoothPath(points),
      bars: SUM_VALUES.map((value, i) => ({
        value,
        x: centers[i] - slot * 0.31,
        y: y(actual[i]),
        height: bottom - y(actual[i]),
        center: centers[i],
        over: actual[i] > expected[i],
      })),
    };
  }, [slot, tally, totalRolls]);

  return (
    <figure className="tracker-chart" data-testid="chart-shape">
      <figcaption>
        <strong>Shape</strong>
        <span>Bars are your results (lighter = above fair), the line is the fair curve</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Histogram of your ${totalRolls} results against the expected curve`}>
        <path d={linePath([{ x: 10, y: bottom }, { x: W - 10, y: bottom }])} className="chart-axis" />
        <text x="4" y="12" className="chart-label">{max.toFixed(0)}%</text>
        {bars.map((bar) => (
          <g key={bar.value}>
            <rect x={bar.x} y={bar.y} width={slot * 0.62} height={Math.max(bar.height, 0)} rx="3" className={`chart-bar ${bar.over ? "is-over" : ""}`} />
            <text x={bar.center} y={bottom + 14} className="chart-label" textAnchor="middle">{bar.value}</text>
          </g>
        ))}
        <path d={curve} className="chart-expected" />
      </svg>
    </figure>
  );
}

/** Deviation from the fair odds as the session grows, against what a fair generator typically does. */
function ConvergenceChart({ trend }: { trend: TrendPoint[] }) {
  const H = 140;
  const left = 30;
  const right = W - 10;
  const top = 12;
  const bottom = 112;

  const chart = useMemo(() => {
    const last = trend[trend.length - 1];
    const maxN = Math.max(last[0], 10);
    const logMin = Math.log10(3);
    const logMax = Math.log10(Math.max(maxN, 4));
    const x = (n: number) => left + ((Math.log10(Math.max(n, 3)) - logMin) / (logMax - logMin)) * (right - left);
    // Ignore the first couple of results: one or two rolls are always wildly off.
    const settled = trend.filter(([n]) => n >= 3);
    const ceiling = Math.max(...settled.map(([, d]) => d), typicalFairDeviation(3), 4) * 1.1;
    const y = (d: number) => bottom - (Math.min(d, ceiling) / ceiling) * (bottom - top);

    const mine: Point[] = settled.map(([n, d]) => ({ x: x(n), y: y(d) }));
    const reference: Point[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i += 1) {
      const n = 3 * Math.pow(maxN / 3, i / steps);
      reference.push({ x: x(n), y: y(typicalFairDeviation(n)) });
    }
    return {
      mine: linePath(mine),
      reference: linePath(reference),
      ceiling,
      end: mine[mine.length - 1],
      maxN,
      current: last[1],
      typical: typicalFairDeviation(last[0]),
    };
  }, [trend]);

  return (
    <figure className="tracker-chart" data-testid="chart-convergence">
      <figcaption>
        <strong>Convergence</strong>
        <span>How far your results are from fair odds. Lower is better.</span>
      </figcaption>
      {trend.filter(([n]) => n >= 3).length < 2 ? (
        <p className="chart-empty">Generate a few more results to see the trend.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Deviation from the fair odds compared with a typical fair generator">
            <path d={linePath([{ x: left, y: bottom }, { x: right, y: bottom }])} className="chart-axis" />
            <text x="4" y="16" className="chart-label">Bigger gap</text>
            <text x="4" y={bottom - 4} className="chart-label">Fair</text>
            <text x={left} y={bottom + 16} className="chart-label">Fewer results</text>
            <text x={right} y={bottom + 16} className="chart-label" textAnchor="end">{chart.maxN} results</text>
            <path d={chart.reference} className="chart-expected" />
            <path d={chart.mine} className="chart-trend" />
            {chart.end && <circle cx={chart.end.x} cy={chart.end.y} r="3.6" className="chart-trend-dot" />}
          </svg>
          <p className="chart-note">
            <span className="chart-key chart-key-you">Your results</span>
            <span className="chart-key chart-key-typical">Typical fair generator</span>
            <br />
            You are <strong>{chart.current.toFixed(1)}%</strong> off perfectly fair. A fair generator is usually about{" "}
            <strong>{chart.typical.toFixed(1)}%</strong> off at this point. The gap shrinks the more you generate.
          </p>
        </>
      )}
    </figure>
  );
}

export function TrackerCharts({ tally, totalRolls, trend }: { tally: Record<number, number>; totalRolls: number; trend: TrendPoint[] }) {
  return (
    <div className="tracker-charts">
      <ShapeChart tally={tally} totalRolls={totalRolls} />
      {trend.length > 0 && <ConvergenceChart trend={trend} />}
    </div>
  );
}
