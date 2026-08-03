/**
 * leaderboard/localBoard.ts — the LOCAL-FIRST ranked board for the competitive
 * games (Make-a-Market, Cards, Probability Betting, Fruit Market, Dice & Cards,
 * Next Card Betting, Trading Floor, Speed Arena).
 *
 * This is the always-on, dependency-free, SSR/test-safe store: every function
 * takes an injected `KeyValueStore` (the minimal slice of `Storage` we use), so
 * the ranking logic is unit-tested with an in-memory map — no real
 * `localStorage`, no clock. The React layer passes `browserBoardStore()` and
 * `Date.now()`. When the optional AWS board is configured (see `client.ts`) the
 * UI MERGES server rows on top of this; when it isn't, the local board stands
 * alone and the games are fully functional offline.
 *
 * SCORE MODEL (see `games.ts`): every board is HIGHER-IS-BETTER. Scores can be
 * negative. Ties break toward the EARLIER timestamp (first to reach the score
 * ranks ahead). Everything here is plain-JSON-serializable.
 */

/** The tiny slice of `Storage` we depend on (so tests inject a fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** One recorded local score for a game board. */
export interface LocalScore {
  /** The ranked value — higher is better; may be negative. */
  score: number;
  /** Epoch-ms the run finished (tie-break: earlier ranks ahead). */
  atMs: number;
  /** Optional local display name (defaults to "You" in the UI). */
  name?: string;
  /** Optional extra readouts to show alongside the score (e.g. accuracy). */
  meta?: Record<string, string | number>;
}

/** A local score annotated with its 1-based rank on the board. */
export interface RankedScore extends LocalScore {
  rank: number;
}

const PREFIX = "qtp.leaderboard.";
/** How many top scores we retain per board (localStorage stays tiny). */
export const DEFAULT_KEEP = 25;

/** localStorage key for a game board: `qtp.leaderboard.<gameId>`. */
export function boardKey(gameId: string): string {
  return `${PREFIX}${gameId}`;
}

/**
 * The board ranking comparator: HIGHER score first; on an exact tie the EARLIER
 * timestamp ranks ahead. Pure and total, safe to pass to `Array.prototype.sort`.
 */
export function compareScores(a: LocalScore, b: LocalScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.atMs - b.atMs;
}

/** Rank a list of scores (does NOT mutate the input): sorted + 1-based `rank`. */
export function rankScores(scores: readonly LocalScore[]): RankedScore[] {
  return [...scores]
    .sort(compareScores)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

/** The ranked top-`n` of a score list (default `DEFAULT_KEEP`). */
export function topN(
  scores: readonly LocalScore[],
  n: number = DEFAULT_KEEP,
): RankedScore[] {
  return rankScores(scores).slice(0, Math.max(0, n));
}

/** The single best (rank-1) score, or `null` when there are none. */
export function bestScore(scores: readonly LocalScore[]): RankedScore | null {
  return rankScores(scores)[0] ?? null;
}

function readJson<T>(store: KeyValueStore, key: string): T | null {
  const raw = store.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Read the raw (unranked) local scores for a game board. */
export function readLocalScores(
  store: KeyValueStore,
  gameId: string,
): LocalScore[] {
  const arr = readJson<LocalScore[]>(store, boardKey(gameId));
  if (!Array.isArray(arr)) return [];
  // Defensive: keep only well-formed rows so a corrupt blob can't crash the UI.
  return arr.filter(
    (s): s is LocalScore =>
      !!s && typeof s.score === "number" && typeof s.atMs === "number",
  );
}

/** Read the ranked top-`n` local board for a game (empty when none recorded). */
export function readLocalBoard(
  store: KeyValueStore,
  gameId: string,
  n: number = DEFAULT_KEEP,
): RankedScore[] {
  return topN(readLocalScores(store, gameId), n);
}

/**
 * Record a finished run's score on a game board. Appends the entry, keeps the
 * top-`keep` (by the board comparator), and writes it back. Returns the new
 * ranked board plus the submitted entry's rank and whether it set a new best.
 * Pure aside from the single injected-store write.
 */
export function submitLocalScore(
  store: KeyValueStore,
  gameId: string,
  entry: LocalScore,
  keep: number = DEFAULT_KEEP,
): { board: RankedScore[]; rank: number; isNewBest: boolean } {
  const prev = readLocalScores(store, gameId);
  const prevBest = bestScore(prev);
  const isNewBest = !prevBest || compareScores(entry, prevBest) < 0;

  const ranked = rankScores([...prev, entry]);
  const kept = ranked.slice(0, Math.max(1, keep));
  // Persist the kept rows without the (derived) rank field.
  const toStore: LocalScore[] = kept.map(({ rank: _rank, ...s }) => s);
  store.setItem(boardKey(gameId), JSON.stringify(toStore));

  // The submitted entry's rank in the FULL ranked list (before the keep cut).
  const rank =
    ranked.findIndex(
      (s) => s.atMs === entry.atMs && s.score === entry.score,
    ) + 1;

  return { board: kept, rank: rank || ranked.length, isNewBest };
}

/**
 * An SSR/privacy-mode-safe `KeyValueStore` over `window.localStorage`. All
 * access is wrapped so a missing `localStorage` (SSR/tests) or a thrown quota /
 * privacy error degrades to a no-op instead of crashing.
 */
export function browserBoardStore(): KeyValueStore {
  return {
    getItem: (k) => {
      try {
        return typeof localStorage !== "undefined"
          ? localStorage.getItem(k)
          : null;
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
      } catch {
        /* ignore quota / privacy-mode errors */
      }
    },
  };
}
