# Description:
A React/Vite web application that generates two integers between 1 and 6. It features an Ultra Instinct-inspired cosmic interface, a crisp 300-millisecond generation sequence, and a built-in probability tracker that compares your actual session results against the expected 1/36 mathematical distribution. The interface strictly avoids any traditional physical-object or dice-related terminology and imagery.

# Two generator modes
Switch between them at any time from the toggle on the main card. Both draw from the Web Crypto API with rejection sampling (no modulo bias).

- **Balanced (540 pool):** a Fisher-Yates shuffled pool of 540 results that follows the real odds exactly (all 36 ordered pairs, 15 times each, so totals appear 2: 2.78%, 3: 5.56%, 4: 8.33%, 5: 11.11%, 6: 13.89%, 7: 16.67%, 8: 13.89%, 9: 11.11%, 10: 8.33%, 11: 5.56%, 12: 2.78%; a 7 is 90 of the 540, a 2 or 12 only 15). Results are dealt without replacement and the pool is reshuffled after 405 draws (a casino-style cut point), so long streaks are smoothed and the tail of a pool can never be counted. The pool position is saved with your history.
- **Pure random:** every result is two fresh, independent draws. Streaks, repeats and lopsided sessions can and do happen.

The spinning animation is cosmetic only. The real result is drawn once, when the numbers lock in, so every result you see is a true consecutive draw from the selected mode.

# Sanity check
"Run sanity check" tests the raw randomness source in a Web Worker, separate from your live pool and history: a chi-square goodness-of-fit test on the totals (10 degrees of freedom) plus a lag-1 correlation test for independence. A fair generator trips it about 1 run in 75, which is why a flagged result offers a 200,000-result recheck.

# What's new in 3.0
- **Charge-up button** with a press effect, a **sliding mode switch**, a slot-style digit reveal and a counting-up total.
- **Odds curve** under the total: a glowing dot sits on the 2-12 curve with text like "6 in 36 · 16.67%".
- **Pool dot grid:** all 540 results as dots (dealt ones dim, the 405 cut marked by a dashed line).
- **History orbs** for the last 10 results.
- **Tracker charts:** a histogram of your results over the fair curve, plus a convergence line showing how far you are from the fair odds against what a fair generator typically does.
- **Themes** (silver, ember, emerald), **haptics** on lock-in (Android; iPhones have no vibration API), **shake to generate** and **tilt parallax** on phones (iPhone asks for motion permission), **share result** as an image, matching app icons, and an **install** button where the browser offers one.

Settings are saved on the device. Shake, tilt, haptics and install only appear on devices that support them.

# A Note for Players:
If you cannot use physical dice for personal, ethical, or religious reasons, this tool is built specifically for you. It provides a mathematically sound, visually engaging alternative so you can fully participate in your favorite board games—like Catan—with your friends, without ever having to compromise your principles.

# Development
```bash
pnpm install
pnpm --filter @workspace/dice-roller run test        # unit tests (Vitest)
pnpm --filter @workspace/dice-roller run typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/dice-roller run dev
PORT=4173 BASE_PATH=/ pnpm --filter @workspace/dice-roller run build
```
The generator and statistics live in `artifacts/dice-roller/src/lib/` (`generator.ts`, `stats.ts`, `trend.ts`, `settings.ts`, `sanity.worker.ts`) and take an injectable random source, which is how the tests stay deterministic.
