import { useEffect, useRef, useState } from "react";
import type { Theme } from "../../lib/settings";

type Layer = { id: number; theme: Theme; fade: boolean };

function imageFor(theme: Theme): string {
  const portrait = typeof window !== "undefined" && window.matchMedia("(orientation: portrait)").matches;
  return `/backgrounds/${theme}-${portrait ? "portrait" : "landscape"}.webp`;
}

/**
 * Theme artwork on a fixed layer. When the theme changes, the new picture is loaded first
 * and then fades in over the old one, so there is no flash and no half-loaded image.
 */
export function ThemeBackdrop({ theme }: { theme: Theme }) {
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, theme, fade: false }]);
  const latest = layers[layers.length - 1].theme;

  useEffect(() => {
    if (theme === latest) return;
    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      setLayers((previous) => [...previous.slice(-1), { id: nextId.current++, theme, fade: true }]);
    };
    const image = new Image();
    image.onload = reveal;
    image.onerror = reveal; // show the layer anyway; the dark base still looks fine
    image.src = imageFor(theme);
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [latest, theme]);

  // Once the newest layer has faded in, the one beneath is no longer needed.
  useEffect(() => {
    if (layers.length < 2) return;
    const timer = window.setTimeout(() => setLayers((previous) => previous.slice(-1)), 650);
    return () => window.clearTimeout(timer);
  }, [layers]);

  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`theme-backdrop ${layer.fade ? "is-fading-in" : ""}`}
          data-bg={layer.theme}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
