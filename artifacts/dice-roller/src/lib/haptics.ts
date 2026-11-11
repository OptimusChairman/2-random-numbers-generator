// Short vibration cues. Works on Android browsers; iPhones have no vibration API, so
// every call is a safe no-op there.

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Returns false when the browser refused (no support, blocked, or not allowed yet). */
export function vibrate(pattern: number | number[]): boolean {
  try {
    return canVibrate() ? navigator.vibrate(pattern) : false;
  } catch {
    return false;
  }
}

// Pulses under about 30 ms are too faint to feel on many Android motors, so keep them longer.
export const HAPTIC_CHARGE = [35, 45, 40, 45, 55];
export const HAPTIC_LOCK = 70;
export const HAPTIC_SPECIAL = [80, 70, 130];
export const HAPTIC_TAP = 35;
