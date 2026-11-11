import { describe, expect, it } from "vitest";
import { createShakeDetector, type MotionSample } from "./shake";

/** Samples at ~60 Hz: resting gravity with optional hard jolts at the given times. */
function run(durationMs: number, jolts: number[], rateHz = 60, joltSize = 14): boolean[] {
  const detect = createShakeDetector();
  const step = 1000 / rateHz;
  const out: boolean[] = [];
  for (let t = 0; t <= durationMs; t += step) {
    const jolting = jolts.some((j) => t >= j && t < j + step * 1.5);
    const sample: MotionSample = { x: 0, y: jolting ? joltSize : 0, z: 9.81, time: t };
    out.push(detect(sample));
  }
  return out;
}

describe("shake detector", () => {
  it("stays quiet when the phone is resting", () => {
    expect(run(3000, []).some(Boolean)).toBe(false);
  });

  it("ignores a single bump", () => {
    expect(run(3000, [500]).some(Boolean)).toBe(false);
  });

  it("detects a back-and-forth shake", () => {
    expect(run(2000, [400, 560, 720]).filter(Boolean)).toHaveLength(1);
  });

  it("still detects it at a slow 20 Hz sensor rate", () => {
    expect(run(2000, [400, 560, 720], 20).filter(Boolean)).toHaveLength(1);
  });

  it("ignores gentle movement such as walking", () => {
    const detect = createShakeDetector();
    let fired = false;
    for (let t = 0; t < 4000; t += 16) {
      const wobble = 4 * Math.sin(t / 120);
      fired = detect({ x: wobble, y: wobble, z: 9.81 + wobble, time: t }) || fired;
    }
    expect(fired).toBe(false);
  });

  it("waits out the cooldown before firing again", () => {
    const fired = run(1200, [100, 250, 400, 550, 700, 850, 1000]).filter(Boolean);
    expect(fired).toHaveLength(1);
  });
});
