import { useEffect } from "react";
import { createShakeDetector } from "../lib/shake";

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
export function useMotion(enabled: boolean, target: HTMLElement | null, onShake: () => void, onNoData?: () => void) {
  useEffect(() => {
    if (!enabled || !target) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const detect = createShakeDetector();
    let gotData = false;
    let frame = 0;
    let tiltX = 0;
    let tiltY = 0;

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      gotData = true;
      if (detect({ x: a.x, y: a.y, z: a.z, time: performance.now() })) onShake();
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
    // Some browsers block motion sensors without any error; say so instead of failing quietly.
    const watchdog = window.setTimeout(() => {
      if (!gotData) onNoData?.();
    }, 2500);

    return () => {
      window.clearTimeout(watchdog);
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
      if (frame) cancelAnimationFrame(frame);
      target.style.removeProperty("--tilt-x");
      target.style.removeProperty("--tilt-y");
    };
  }, [enabled, onNoData, onShake, target]);
}
