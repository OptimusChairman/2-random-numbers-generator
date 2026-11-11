import { useMemo } from "react";
import { dotsPath, type Point } from "../../lib/charts";

const COLS = 45; // 45 x 12 = 540, and the 405 cut lands exactly on a row boundary
const PITCH = 10;
const RADIUS = 2.6;

/**
 * The balanced pool as 540 dots. Dealt dots dim, the latest one glows, and a dashed line
 * marks the cut: dots below it are never dealt before the pool is reshuffled.
 */
export function PoolGrid({ drawn, poolSize, cutAfter }: { drawn: number; poolSize: number; cutAfter: number }) {
  const rows = Math.ceil(poolSize / COLS);
  const cutRow = cutAfter / COLS;
  const width = COLS * PITCH;
  const height = rows * PITCH;

  const paths = useMemo(() => {
    const dealt: Point[] = [];
    const upcoming: Point[] = [];
    const tail: Point[] = [];
    let latest: Point | null = null;

    for (let i = 0; i < poolSize; i += 1) {
      const point = { x: (i % COLS) * PITCH + PITCH / 2, y: Math.floor(i / COLS) * PITCH + PITCH / 2 };
      if (i >= cutAfter) tail.push(point);
      else if (i < drawn - 1) dealt.push(point);
      else if (i === drawn - 1) latest = point;
      else upcoming.push(point);
    }
    return {
      dealt: dotsPath(dealt, RADIUS),
      upcoming: dotsPath(upcoming, RADIUS),
      tail: dotsPath(tail, RADIUS),
      latest,
    };
  }, [cutAfter, drawn, poolSize]);

  return (
    <svg className="pool-grid" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" data-testid="pool-grid">
      <path d={paths.tail} className="pool-dot pool-dot-tail" />
      <path d={paths.upcoming} className="pool-dot pool-dot-upcoming" />
      <path d={paths.dealt} className="pool-dot pool-dot-dealt" />
      <line x1="0" x2={width} y1={cutRow * PITCH} y2={cutRow * PITCH} className="pool-cut" />
      {paths.latest && (
        <g key={drawn} style={{ transform: `translate(${paths.latest.x}px, ${paths.latest.y}px)` }}>
          <circle r="6" className="pool-latest-halo" />
          <circle r={RADIUS + 0.6} className="pool-latest" />
        </g>
      )}
    </svg>
  );
}
