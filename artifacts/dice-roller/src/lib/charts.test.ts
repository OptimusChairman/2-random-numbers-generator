import { describe, expect, it } from "vitest";
import { dotsPath, linePath, smoothPath } from "./charts";

describe("linePath", () => {
  it("draws a polyline", () => {
    expect(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe("M0 1 L2 3");
  });
  it("is empty for no points", () => {
    expect(linePath([])).toBe("");
  });
});

describe("smoothPath", () => {
  it("falls back to a line for fewer than 3 points", () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe("M0 0 L5 5");
  });

  it("passes through every point with one curve segment between each pair", () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 5 }, { x: 30, y: 15 }];
    const path = smoothPath(points);
    expect(path.startsWith("M0 0")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(points.length - 1);
    for (const point of points.slice(1)) expect(path).toContain(`${point.x} ${point.y}`);
  });
});

describe("dotsPath", () => {
  it("draws two arcs per dot", () => {
    const path = dotsPath([{ x: 5, y: 5 }, { x: 15, y: 5 }], 2);
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/a/g)).toHaveLength(4);
  });
});
