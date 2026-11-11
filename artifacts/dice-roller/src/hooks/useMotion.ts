import { useEffect } from "react";

const SHAKE_THRESHOLD = 17; // change in m/s^2 between two readings
const SHAKE_COOLDOWN_MS = 1200;

type PermissionedEvent = { requestPermission?: () => Promise<"granted" | "denied"> };

/** Motion needs a touch device with motion sensors. */
export function canUseMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches && "DeviceMotionEvent" in window;
}

/**
 * iPhones ask for permission, and only inside a tap. Other browsers need nothing.
 * Returns true when motion can be used.
 */
export async function requestMotionPermission(): Promise<boolean> {
  try {
    const motion = (window as unknown as { DeviceMotionEvent?: PermissionedEvent }).DeviceMotionEvent;
    const orientation = (window as unknown as { DeviceOrientationEvent?: PermissionedEvent }).DeviceOrientationEvent;
    if (typeof motion?.requestPermission === "function") {
      if ((await motion.requestPermission()) !== "granted") return false;
    }
    if (typeof orientation?.requestPermission === "function") {
      if ((await orientation.requestPermission()) !== "granted") return false;
    }
    return true;
  } catch {
    return false;
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * While enabled: shaking the phone calls `onShake`, and tilting it nudges the starfield
 * through the --tilt-x / --tilt-y custom properties on `target`.
 */
export function useMotion(enabled: boolean, target: HTMLElement | null, onShake: () => void) {
  useEffect(() => {
    if (!enabled || !target) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = { x: 0, y: 0, z: 0, ready: false };
    let lastShake = 0;
    let frame = 0;
    let tiltX = 0;
    let tiltY = 0;

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      if (last.ready) {
        const delta = Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
        const now = Date.now();
        if (delta > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN_MS) {
          lastShake = now;
          onShake();
        }
      }
      last = { x: a.x, y: a.y, z: a.z, ready: true };
    };

    const paint = () => {
      frame = 0;
      target.style.setProperty("--tilt-x", `${tiltX.toFixed(1)}px`);
      target.style.setProperty("--tilt-y", `${tiltY.toFixed(1)}px`);
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      tiltX = clamp(event.gamma / 45, -1, 1) * -22;
      tiltY = clamp((event.beta - 50) / 45, -1, 1) * -22;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener("devicemotion", onMotion);
    if (!reduced) window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
      if (frame) cancelAnimationFrame(frame);
      target.style.removeProperty("--tilt-x");
      target.style.removeProperty("--tilt-y");
    };
  }, [enabled, onShake, target]);
}
