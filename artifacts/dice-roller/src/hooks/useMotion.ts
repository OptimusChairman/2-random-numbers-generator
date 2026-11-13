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
    if (typeof motion?.requestPermission === "function") {
      if ((await motion.requestPermission()) !== "granted") return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** While enabled, shaking the phone calls `onShake`. `onNoData` fires if the browser sends no motion data. */
export function useMotion(enabled: boolean, onShake: () => void, onNoData?: () => void) {
  useEffect(() => {
    if (!enabled) return;

    const detect = createShakeDetector();
    let gotData = false;

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      gotData = true;
      if (detect({ x: a.x, y: a.y, z: a.z, time: performance.now() })) onShake();
    };

    window.addEventListener("devicemotion", onMotion);
    // Some browsers block motion sensors without any error; say so instead of failing quietly.
    const watchdog = window.setTimeout(() => {
      if (!gotData) onNoData?.();
    }, 2500);

    return () => {
      window.clearTimeout(watchdog);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [enabled, onNoData, onShake]);
}
