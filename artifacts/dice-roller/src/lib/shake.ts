// Shake detection that works at any sensor rate. Phones report motion 20-60 times a
// second, so comparing neighbouring samples sees almost nothing. Instead this looks at how
// far the total acceleration strays from gravity: a shake is a few hard spikes close together.

export const GRAVITY = 9.81;
/** How far from resting gravity (m/s^2) counts as a hard spike. Walking stays under about 5. */
export const SPIKE_THRESHOLD = 7;
/** A shake needs this many spikes... */
export const SPIKES_NEEDED = 2;
/** ...inside this window (ms), and spikes closer together than the gap count as one. */
export const SHAKE_WINDOW_MS = 900;
export const SPIKE_GAP_MS = 90;
export const SHAKE_COOLDOWN_MS = 1200;

export type MotionSample = { x: number; y: number; z: number; time: number };

export function createShakeDetector() {
  let spikes: number[] = [];
  let lastShake = -Infinity;

  /** Feed one reading; returns true when it completes a shake. */
  return function detect({ x, y, z, time }: MotionSample): boolean {
    const deviation = Math.abs(Math.sqrt(x * x + y * y + z * z) - GRAVITY);
    if (deviation < SPIKE_THRESHOLD) return false;

    const previous = spikes[spikes.length - 1];
    if (previous !== undefined && time - previous < SPIKE_GAP_MS) return false;

    spikes = [...spikes.filter((t) => time - t <= SHAKE_WINDOW_MS), time];
    if (spikes.length >= SPIKES_NEEDED && time - lastShake > SHAKE_COOLDOWN_MS) {
      lastShake = time;
      spikes = [];
      return true;
    }
    return false;
  };
}
