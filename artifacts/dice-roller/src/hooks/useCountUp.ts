import { useLayoutEffect, useState } from "react";

/**
 * Counts a number up from 0 to `target` whenever `trigger` changes (but not on first
 * render, and not for people who prefer reduced motion).
 */
export function useCountUp(target: number | null, trigger: number, duration = 380): number | null {
  const [value, setValue] = useState<number | null>(target);

  useLayoutEffect(() => {
    if (target === null) {
      setValue(null);
      return;
    }
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (trigger === 0 || reduced) {
      setValue(target);
      return;
    }

    setValue(0);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, target, trigger]);

  return value;
}
