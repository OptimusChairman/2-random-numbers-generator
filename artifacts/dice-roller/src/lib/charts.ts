// Tiny SVG path helpers for the odds curve and the tracker charts.

export type Point = { x: number; y: number };

const round = (value: number) => Math.round(value * 100) / 100;

/** Straight polyline path through the points. */
export function linePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
}

/** Smooth path through the points (Catmull-Rom converted to cubic Beziers). */
export function smoothPath(points: Point[]): string {
  if (points.length < 3) return linePath(points);

  let path = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return path;
}

/**
 * Path made of tiny circles: one <path> draws hundreds of dots, instead of one DOM
 * element per dot.
 */
export function dotsPath(centers: Point[], radius: number): string {
  return centers
    .map((c) => `M${round(c.x - radius)} ${round(c.y)}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`)
    .join("");
}
