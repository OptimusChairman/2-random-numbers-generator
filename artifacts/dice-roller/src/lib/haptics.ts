// Short vibration cues. Works on Android browsers; iPhones have no vibration API, so
// every call is a safe no-op there.

export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function vibrate(pattern: number | number[]) {
  try {
    if (canVibrate()) navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by a policy; ignore.
  }
}

export const HAPTIC_CHARGE = [10, 30, 14, 30, 18];
export const HAPTIC_LOCK = 22;
export const HAPTIC_SPECIAL = [22, 60, 34];
export const HAPTIC_TAP = 8;
