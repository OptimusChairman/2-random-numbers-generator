import { memo } from "react";
import type { Pair } from "../../lib/generator";

export type Result = { pair: Pair; sum: number };

/** The last results as glowing orbs: newest first, brightest and largest. */
function HistoryStripInner({ results }: { results: Result[] }) {
  return (
    <ol className="history-strip" aria-label="Recent results, newest first">
      {results.map(({ pair, sum }, index) => (
        <li
          key={`${index}-${pair[0]}-${pair[1]}`}
          className={`history-orb ${index === 0 ? "is-latest" : ""}`}
          style={{ ["--age" as string]: Math.min(index, 9) }}
          aria-label={`Total ${sum}, ${pair[0]} plus ${pair[1]}`}
          data-testid="history-orb"
        >
          <strong>{sum}</strong>
          <span>
            {pair[0]}+{pair[1]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export const HistoryStrip = memo(HistoryStripInner);
