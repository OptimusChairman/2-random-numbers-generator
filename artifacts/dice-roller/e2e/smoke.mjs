// Browser smoke tests. Run the built app first, then:  pnpm run e2e
//   PORT=4173 BASE_PATH=/ pnpm run build && PORT=4173 BASE_PATH=/ pnpm run serve
// Needs Playwright with a Chromium browser (npx playwright install chromium).
// Not a dependency of the app, so the site's install and build stay lean.

import { createRequire } from "node:module";

let chromium;
let devices;
try {
  // createRequire also honours NODE_PATH, so a globally installed Playwright works.
  ({ chromium, devices } = createRequire(import.meta.url)("playwright"));
} catch {
  console.error("Playwright is not installed. Run: npm i -g playwright && npx playwright install chromium");
  process.exit(2);
}

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
};

const browser = await chromium.launch();

async function newPage(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => problems.push(`request failed: ${request.url()}`));
  return { context, page, problems };
}

const read = (page, id) => page.locator(`[data-testid="${id}"]`).textContent();
const rollOnce = async (page) => {
  await page.click('[data-testid="button-roll"]');
  await page.waitForTimeout(650);
};

// 1. Core flow on a phone: results are valid and consistent.
{
  const { context, page, problems } = await newPage(devices["iPhone 13"]);
  await page.goto(BASE);
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i += 1) await rollOnce(page);
  const orbs = await page.locator('[data-testid="history-orb"]').count();
  check("six rolls create six history orbs", orbs === 6, `got ${orbs}`);

  const label = await page.locator('[data-testid="history-orb"]').first().getAttribute("aria-label");
  const match = /Total (\d+), (\d) plus (\d)/.exec(label ?? "");
  const valid = match && Number(match[2]) + Number(match[3]) === Number(match[1]) && [2, 3].every((i) => Number(match[i]) >= 1 && Number(match[i]) <= 6);
  check("latest result is two numbers from 1 to 6 that add up", Boolean(valid), label ?? "");
  check("total shown equals the latest orb", (await read(page, "text-total")).trim() === match?.[1]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no sideways scroll on a phone", overflow === 0, `${overflow}px`);

  // 2. Mode and theme persist across a reload.
  await page.click('[data-testid="button-mode-pure"]');
  await page.click('[data-testid="button-theme"]');
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    mode: document.querySelector(".mode-switch")?.dataset.mode,
    theme: document.querySelector(".cosmos")?.dataset.theme,
    orbs: document.querySelectorAll('[data-testid="history-orb"]').length,
    layers: document.querySelectorAll(".theme-backdrop").length,
  }));
  check("mode survives a reload", after.mode === "pure", after.mode);
  check("theme survives a reload", after.theme === "ember", after.theme);
  check("history survives a reload", after.orbs === 6, String(after.orbs));
  check("one backdrop layer after load", after.layers === 1, String(after.layers));

  // 3. Each theme loads its own portrait artwork.
  const seen = [];
  page.on("response", (response) => {
    if (response.url().includes("/backgrounds/")) seen.push(`${response.status()} ${response.url().split("/").pop()}`);
  });
  await page.click('[data-testid="button-theme"]');
  await page.waitForTimeout(900);
  await page.click('[data-testid="button-theme"]');
  await page.waitForTimeout(900);
  check("themes request portrait artwork on a phone", seen.length > 0 && seen.every((s) => s.startsWith("200") && s.includes("portrait")), seen.join(", "));

  // 4. Tracker opens and shows both charts.
  await page.click('[data-testid="button-toggle-stats"]');
  await page.waitForTimeout(400);
  check("tracker shows the histogram", await page.locator('[data-testid="chart-shape"]').isVisible());
  check("tracker shows the convergence chart", await page.locator('[data-testid="chart-convergence"]').isVisible());

  check("no console errors or failed requests (phone)", problems.length === 0, problems.join(" | "));
  await context.close();
}

// 5. Desktop gets landscape artwork and no overflow.
{
  const { context, page, problems } = await newPage({ viewport: { width: 1280, height: 800 } });
  const seen = [];
  page.on("response", (response) => {
    if (response.url().includes("/backgrounds/")) seen.push(response.url().split("/").pop());
  });
  await page.goto(BASE);
  await page.waitForTimeout(600);
  await rollOnce(page);
  check("desktop requests landscape artwork", seen.length === 1 && seen[0].includes("landscape"), seen.join(", "));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no sideways scroll on desktop", overflow === 0, `${overflow}px`);
  check("no console errors (desktop)", problems.length === 0, problems.join(" | "));
  await context.close();
}

// 6. Tablet in portrait: headline sits below the artwork, no overflow.
{
  const { context, page, problems } = await newPage(devices["iPad (gen 7)"]);
  await page.goto(BASE);
  await page.waitForTimeout(600);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingTop: document.querySelector(".hero h1")?.getBoundingClientRect().top ?? 0,
    viewport: window.innerHeight,
  }));
  check("no sideways scroll on a tablet", layout.overflow === 0, `${layout.overflow}px`);
  check("tablet headline starts below the artwork", layout.headingTop > layout.viewport * 0.3, `${layout.headingTop}px`);
  check("no console errors (tablet)", problems.length === 0, problems.join(" | "));
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
