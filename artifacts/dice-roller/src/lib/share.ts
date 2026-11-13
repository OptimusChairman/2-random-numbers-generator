// "Share result" card: draws a square PNG with the two numbers, then shares or downloads it.

import type { Pair } from "./generator";

export const SHARE_SIZE = 1080;

const PALETTES = {
  silver: { deep: "#5b6cff", accent: "#8fb8ff", soft: "#c9dcff", base: "#06080f", glow: "110,125,255" },
  ember: { deep: "#ff6240", accent: "#ff9a5a", soft: "#ffd2b8", base: "#0a0605", glow: "255,110,60" },
  emerald: { deep: "#14b882", accent: "#50dcaa", soft: "#c4ffe9", base: "#040a08", glow: "40,200,150" },
} as const;

export type ShareTheme = keyof typeof PALETTES;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Loads the theme's portrait artwork; resolves null when it cannot be loaded. */
function loadArt(theme: ShareTheme): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `/backgrounds/${theme}-portrait.webp`;
  });
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  pair: Pair,
  theme: ShareTheme,
  version: string,
  art: HTMLImageElement | null = null,
) {
  const size = SHARE_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  const palette = PALETTES[theme];
  const total = pair[0] + pair[1];
  const sans = "'Manrope', system-ui, sans-serif";
  const display = "'Space Grotesk', system-ui, sans-serif";

  // Same calm look as the page: a tinted dark canvas with one soft glow at the top.
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, 0, 0, size / 2, 0, size * 0.85);
  glow.addColorStop(0, `rgba(${palette.glow},.2)`);
  glow.addColorStop(1, `rgba(${palette.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  if (art) {
    // Portrait artwork fitted to the card width: the character floats at the top, the middle stays dark.
    ctx.drawImage(art, 0, 0, size, (size * art.naturalHeight) / art.naturalWidth);
    const shade = ctx.createLinearGradient(0, 0, 0, size);
    shade.addColorStop(0, "rgba(5,7,17,0)");
    shade.addColorStop(0.42, "rgba(5,7,17,.4)");
    shade.addColorStop(1, "rgba(5,7,17,.85)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
  }

  const cy = art ? size * 0.57 : size * 0.47;
  const radius = art ? 175 : 190;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!art) {
    ctx.fillStyle = "rgba(232,238,255,.62)";
    ctx.font = `700 34px ${sans}`;
    ctx.fillText("Two Numbers", size / 2, 140);
  }

  const centers: Array<[number, number]> = [
    [size / 2 - 250, cy],
    [size / 2 + 250, cy],
  ];
  centers.forEach(([cx, cyy], index) => {
    const fill = ctx.createLinearGradient(0, cyy - radius, 0, cyy + radius);
    fill.addColorStop(0, "rgba(255,255,255,.07)");
    fill.addColorStop(1, art ? "rgba(6,9,20,.88)" : "rgba(10,14,28,.82)");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cyy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `${palette.soft}55`;
    ctx.stroke();

    ctx.fillStyle = "#f4f8ff";
    ctx.font = `500 240px ${display}`;
    ctx.fillText(String(pair[index]), cx, cyy + 10);
  });

  // The plus is drawn as two bars so it sits exactly between the circles.
  ctx.fillStyle = "rgba(244,248,255,.85)";
  ctx.fillRect(size / 2 - 30, cy - 4, 60, 8);
  ctx.fillRect(size / 2 - 4, cy - 30, 8, 60);

  const totalY = cy + radius + 120;
  // "Total" and the number are centred together as one group.
  const label = "Total";
  const gap = 28;
  ctx.textAlign = "left";
  ctx.font = `600 34px ${sans}`;
  const labelWidth = ctx.measureText(label).width;
  ctx.font = `500 120px ${display}`;
  const valueWidth = ctx.measureText(String(total)).width;
  const startX = size / 2 - (labelWidth + gap + valueWidth) / 2;
  ctx.fillStyle = "rgba(205,220,244,.7)";
  ctx.font = `600 34px ${sans}`;
  ctx.fillText(label, startX, totalY + 4);
  ctx.fillStyle = "#f4f8ff";
  ctx.font = `500 120px ${display}`;
  ctx.fillText(String(total), startX + labelWidth + gap, totalY);
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(205,220,244,.55)";
  ctx.font = `500 28px ${sans}`;
  const footer = art ? `Two Numbers  ·  Version ${version}` : `${pair[0]} + ${pair[1]}  ·  Version ${version}`;
  ctx.fillText(footer, size / 2, art ? 1030 : 975);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create image"))), "image/png");
  });
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/** Share the card with the native sheet when possible, otherwise download it. */
export async function shareResult(pair: Pair, theme: ShareTheme, version: string, withArt = true): Promise<ShareOutcome> {
  const canvas = document.createElement("canvas");
  try {
    // Canvas text only uses a web font once it has loaded.
    await Promise.all([document.fonts.load("600 34px Manrope"), document.fonts.load("500 120px 'Space Grotesk'")]);
  } catch {
    // Fall back to the system font.
  }
  drawShareCard(canvas, pair, theme, version, withArt ? await loadArt(theme) : null);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `numbers-${pair[0]}-${pair[1]}.png`, { type: "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Two random numbers", text: `${pair[0]} + ${pair[1]} = ${pair[0] + pair[1]}` });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Any other failure: fall through to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
