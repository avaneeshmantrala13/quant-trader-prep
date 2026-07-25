/**
 * arena/localPb.ts — LOCAL personal-best + recent-run history for the Speed
 * Arena (Phase 6). This is the always-on, no-server store: the arena is fully
 * functional (records PBs, shows a 7-day trend) with the leaderboard OFF.
 *
 * Pure by construction: every function takes an injected key→value store (the
 * minimal slice of the `Storage` interface we use), so the logic is unit-tested
 * with an in-memory map — no real `localStorage`, no clock. The React layer
 * passes `window.localStorage` and `Date.now()`.
 */

/** The tiny slice of `Storage` we depend on (so tests inject a fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PersonalBest {
  bestScore: number;
  bestAtMs: number;
  attempts: number;
}

export interface RunRecord {
  score: number;
  atMs: number;
}

const PB_PREFIX = "qtp.arena.pb.";
const HISTORY_PREFIX = "qtp.arena.hist.";
const HISTORY_LIMIT = 50;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function pbKey(board: string, configHash: string): string {
  return `${PB_PREFIX}${board}.${configHash}`;
}
function histKey(board: string, configHash: string): string {
  return `${HISTORY_PREFIX}${board}.${configHash}`;
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

/** Current local PB for a board+config, or `null` if none recorded yet. */
export function readLocalPb(
  store: KeyValueStore,
  board: string,
  configHash: string,
): PersonalBest | null {
  return readJson<PersonalBest>(store, pbKey(board, configHash));
}

/**
 * Record a finished run: append to history (capped) and update the PB when the
 * score improves. Returns the updated PB and whether this run set a new best.
 */
export function recordLocalRun(
  store: KeyValueStore,
  board: string,
  configHash: string,
  score: number,
  atMs: number,
): { pb: PersonalBest; isNewBest: boolean } {
  const prev = readLocalPb(store, board, configHash);
  const isNewBest = !prev || score > prev.bestScore;
  const pb: PersonalBest = {
    bestScore: isNewBest ? score : prev!.bestScore,
    bestAtMs: isNewBest ? atMs : prev!.bestAtMs,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  store.setItem(pbKey(board, configHash), JSON.stringify(pb));

  const history = readJson<RunRecord[]>(store, histKey(board, configHash)) ?? [];
  history.push({ score, atMs });
  const trimmed = history.slice(-HISTORY_LIMIT);
  store.setItem(histKey(board, configHash), JSON.stringify(trimmed));

  return { pb, isNewBest };
}

/** All recorded runs for a board+config (oldest first). */
export function readHistory(
  store: KeyValueStore,
  board: string,
  configHash: string,
): RunRecord[] {
  return readJson<RunRecord[]>(store, histKey(board, configHash)) ?? [];
}

/**
 * Median score over runs within the last 7 days of `nowMs` — the "trend" the
 * post-run report compares the latest run against. Returns `null` when there
 * are no runs in-window.
 */
export function trailing7DayMedian(
  store: KeyValueStore,
  board: string,
  configHash: string,
  nowMs: number,
): number | null {
  const recent = readHistory(store, board, configHash)
    .filter((r) => nowMs - r.atMs <= WEEK_MS)
    .map((r) => r.score)
    .sort((a, b) => a - b);
  if (recent.length === 0) return null;
  const mid = Math.floor(recent.length / 2);
  return recent.length % 2 === 1
    ? recent[mid]
    : (recent[mid - 1] + recent[mid]) / 2;
}
