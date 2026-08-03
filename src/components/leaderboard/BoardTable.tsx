/**
 * BoardTable — presentational ranked table for ONE game board. Fully
 * controlled: it takes a ready-ranked `rows` array and never reads storage or
 * the network. It renders an honest EMPTY state (no crash when a game has no
 * scores) and marks the player's own local rows + optional server rows.
 */

export interface BoardRow {
  rank: number;
  /** Display name; local rows default to "You" upstream. */
  name: string;
  score: number;
  /** True for the signed-in / local player's own row. */
  self?: boolean;
  /** Where the row came from — local device vs the shared server board. */
  source?: "local" | "server";
  /** Optional extra readouts (e.g. accuracy) shown under the score. */
  meta?: Record<string, string | number>;
}

/** Format a numeric score with an optional unit suffix, sign-aware. */
export function formatScore(score: number, unit?: string): string {
  const rounded = Number.isInteger(score) ? score : Math.round(score * 100) / 100;
  const body = rounded.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (!unit) return body;
  if (unit === "$") {
    const sign = rounded < 0 ? "−" : "";
    return `${sign}$${Math.abs(rounded).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${body} ${unit}`;
}

export function BoardTable({
  rows,
  scoreUnit,
  emptyHint,
}: {
  rows: BoardRow[];
  scoreUnit?: string;
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-subtle bg-surface-muted px-4 py-8 text-center">
        <p className="font-display text-base font-semibold text-primary">
          No scores yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-secondary">
          {emptyHint ??
            "Play a run and your result lands here. Be the first on the board."}
        </p>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-subtle">
      {rows.map((r) => (
        <li
          key={`${r.source ?? "local"}-${r.rank}-${r.name}`}
          className={`flex items-center gap-3 py-2.5 ${
            r.self ? "text-accent" : "text-secondary"
          }`}
        >
          <span
            className={`num grid h-7 w-7 shrink-0 place-items-center rounded-sm text-sm font-bold ${
              r.rank === 1
                ? "bg-accent text-accent-contrast"
                : "border border-subtle text-muted"
            }`}
          >
            {r.rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className={r.self ? "font-semibold" : ""}>{r.name}</span>
            {r.source === "server" && (
              <span className="label ml-2 text-muted">· league</span>
            )}
          </span>
          <span className="num shrink-0 text-right text-base font-bold text-primary">
            {formatScore(r.score, scoreUnit)}
          </span>
        </li>
      ))}
    </ol>
  );
}
