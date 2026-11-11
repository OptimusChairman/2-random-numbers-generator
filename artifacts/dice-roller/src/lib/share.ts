// "Share result" card: draws a square PNG with the two numbers, then shares or downloads it.

import type { Pair } from "./generator";

export const SHARE_SIZE = 1080;

const PALETTES = {
  silver: { deep: "#5b6cff", accent: "#8fb8ff", soft: "#c9dcff" },
  ember: { deep: "#ff6240", accent: "#ff9a5a", soft: "#ffd2b8" },
  emerald: { deep: "#14b882", accent: "#50dcaa", soft: "#c4ffe9" },
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

  const background = ctx.createLinearGradient(0, 0, size, size);
  background.addColorStop(0, "#050711");
  background.addColorStop(0.55, "#0b1230");
  background.addColorStop(1, "#07091a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  if (art) {
    // Portrait artwork fitted to the card width: the character floats at the top, the middle stays dark.
    ctx.drawImage(art, 0, 0, size, (size * art.naturalHeight) / art.naturalWidth);
    const shade = ctx.createLinearGradient(0, 0, 0, size);
    shade.addColorStop(0, "rgba(5,7,17,0)");
    shade.addColorStop(0.42, "rgba(5,7,17,.38)");
    shade.addColorStop(1, "rgba(5,7,17,.82)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
  }

  const cy = art ? size * 0.56 : size * 0.46;
  const radius = art ? 175 : 190;
  const boxY = art ? 815 : 745;

  const glow = ctx.createRadialGradient(size / 2, cy, 20, size / 2, cy, size * 0.55);
  glow.addColorStop(0, `${palette.deep}55`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // A few fixed "stars" so the card is stable between renders.
  ctx.fillStyle = "rgba(255,255,255,.7)";
  for (let i = 0; i < (art ? 0 : 70); i += 1) {
    const x = (i * 137.5) % size;
    const y = (i * 71.3 + (i % 7) * 97) % size;
    ctx.fillRect(x, y, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = palette.soft;
  ctx.font = "600 34px 'Space Grotesk', system-ui, sans-serif";
  if (!art) ctx.fillText("T W O   R A N D O M   N U M B E R S", size / 2, 150);

  const centers: Array<[number, number]> = [
    [size / 2 - 250, cy],
    [size / 2 + 250, cy],
  ];
  centers.forEach(([cx, cy], index) => {
    const ring = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius + 40);
    ring.addColorStop(0, "transparent");
    ring.addColorStop(1, `${palette.accent}66`);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(8,14,40,.92)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = palette.soft;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `${palette.deep}88`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 24, 0, Math.PI * 2);
    ctx.stroke();

    const digit = ctx.createLinearGradient(0, cy - 120, 0, cy + 120);
    digit.addColorStop(0, "#ffffff");
    digit.addColorStop(0.5, palette.soft);
    digit.addColorStop(1, palette.accent);
    ctx.fillStyle = digit;
    ctx.font = "700 250px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillText(String(pair[index]), cx, cy + 12);
  });

  // The plus is drawn as two bars so it sits exactly between the circles.
  ctx.fillStyle = "#f4f8ff";
  const px = size / 2;
  const py = cy;
  ctx.fillRect(px - 34, py - 5, 68, 10);
  ctx.fillRect(px - 5, py - 34, 10, 68);

  roundedRect(ctx, size / 2 - 230, boxY, 460, 150, 34);
  ctx.fillStyle = "rgba(120,150,255,.12)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${palette.soft}66`;
  ctx.stroke();
  ctx.fillStyle = "rgba(205,220,244,.7)";
  ctx.font = "500 30px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("TOTAL", size / 2 - 120, boxY + 75);
  ctx.fillStyle = "#f4f8ff";
  ctx.font = "700 100px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillText(String(total), size / 2 + 70, boxY + 81);

  ctx.fillStyle = "rgba(205,220,244,.55)";
  ctx.font = "500 28px 'JetBrains Mono', ui-monospace, monospace";
  if (art) {
    ctx.fillText(`TWO RANDOM NUMBERS  ·  VERSION ${version}`, size / 2, 1030);
  } else {
    ctx.fillText(`${pair[0]} + ${pair[1]}  ·  version ${version}`, size / 2, 975);
  }
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
