/**
 * leaderboard/gameSession.ts — durable, reload-proof SAVE/RESUME for the
 * multi-round competitive games (mirrors the OA durable-session pattern in
 * `src/lib/oa/*`: pure, immutable, JSON-serializable, wall-clock-stamped).
 *
 * WHY. A game like Cards Market Making or Probability Betting accumulates real
 * in-progress state across rounds (balance, round index, per-round log, the
 * current deal) in React state that is LOST the moment the user navigates away
 * or reloads. This module lets a page snapshot that state to
 * `qtp.gamesession.<gameId>` after every meaningful change and rehydrate it on
 * re-entry, so a partly-played game resumes instead of resetting.
 *
 * CONTRACT.
 *  - The `snapshot` is an OPAQUE, page-owned, plain-JSON value: this module
 *    never inspects it, so each page defines its own resumable shape. Anything
 *    non-serializable (a live `Rng`, timers) is NOT snapshotted — a page
 *    reconstructs those on resume (e.g. a fresh `Rng`); the games are random
 *    every deal, so future draws needn't reproduce, only the user's PROGRESS.
 *  - Helpers are pure `(…args) => value` and the only side effect is the single
 *    injected-store read/write, exactly like `localBoard.ts`.
 *  - A finished run is cleared (a page calls `clearGameSession` on finish / new
 *    game), so a stale "active" envelope can never resurrect a completed run.
 */
import type { KeyValueStore } from "./localBoard";

/** Bump if the envelope shape changes; old envelopes are then ignored. */
export const SESSION_VERSION = 1;

/** The persisted wrapper around a page's opaque snapshot. */
export interface GameSessionEnvelope<T> {
  v: number;
  gameId: string;
  /** Epoch-ms the snapshot was written (used for optional staleness checks). */
  savedAtMs: number;
  /** `active` = resumable in-progress; `finished` runs are cleared, not kept. */
  status: "active" | "finished";
  snapshot: T;
}

const PREFIX = "qtp.gamesession.";

/** localStorage key for a game's durable session: `qtp.gamesession.<gameId>`. */
export function sessionKey(gameId: string): string {
  return `${PREFIX}${gameId}`;
}

/** Build a fresh envelope around `snapshot`. Pure — no I/O, never mutates. */
export function makeSessionEnvelope<T>(
  gameId: string,
  snapshot: T,
  savedAtMs: number,
  status: "active" | "finished" = "active",
): GameSessionEnvelope<T> {
  return { v: SESSION_VERSION, gameId, savedAtMs, status, snapshot };
}

/**
 * Parse a raw stored string into a valid envelope, or `null` when it's absent,
 * malformed, a version mismatch, or for a different game. Pure.
 */
export function parseSessionEnvelope<T>(
  raw: string | null,
  gameId: string,
): GameSessionEnvelope<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const e = parsed as Partial<GameSessionEnvelope<T>>;
  if (e.v !== SESSION_VERSION) return null;
  if (e.gameId !== gameId) return null;
  if (e.status !== "active" && e.status !== "finished") return null;
  if (typeof e.savedAtMs !== "number") return null;
  if (!("snapshot" in e)) return null;
  return e as GameSessionEnvelope<T>;
}

/**
 * Persist `snapshot` for `gameId` (status defaults to `active`). Writes through
 * the injected store; safe to call on every state change.
 */
export function saveGameSession<T>(
  store: KeyValueStore,
  gameId: string,
  snapshot: T,
  savedAtMs: number,
  status: "active" | "finished" = "active",
): GameSessionEnvelope<T> {
  const env = makeSessionEnvelope(gameId, snapshot, savedAtMs, status);
  store.setItem(sessionKey(gameId), JSON.stringify(env));
  return env;
}

/**
 * Load a saved session for `gameId`, or `null` when there is none. Pass
 * `opts.maxAgeMs` + `opts.nowMs` to treat an old snapshot as expired (returns
 * `null`) — handy so a week-old half-game doesn't awkwardly resume.
 */
export function loadGameSession<T>(
  store: KeyValueStore,
  gameId: string,
  opts?: { maxAgeMs?: number; nowMs?: number },
): GameSessionEnvelope<T> | null {
  const env = parseSessionEnvelope<T>(store.getItem(sessionKey(gameId)), gameId);
  if (!env) return null;
  if (opts?.maxAgeMs != null) {
    const now = opts.nowMs ?? Date.now();
    if (now - env.savedAtMs > opts.maxAgeMs) return null;
  }
  return env;
}

/** True iff there is an ACTIVE (resumable) session for `gameId`. */
export function hasActiveGameSession(
  store: KeyValueStore,
  gameId: string,
  opts?: { maxAgeMs?: number; nowMs?: number },
): boolean {
  return loadGameSession(store, gameId, opts)?.status === "active";
}

/** Clear any saved session for `gameId` (called on finish / new game). */
export function clearGameSession(store: KeyValueStore, gameId: string): void {
  try {
    store.setItem(sessionKey(gameId), "");
  } catch {
    /* ignore */
  }
}

/**
 * An SSR/privacy-mode-safe `KeyValueStore` over `window.localStorage` for
 * session snapshots. Note: `clearGameSession` writes an empty string (which
 * `parseSessionEnvelope` rejects) rather than requiring a `removeItem`, so the
 * minimal `KeyValueStore` interface stays sufficient for both stores.
 */
export function browserSessionStore(): KeyValueStore {
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
        /* ignore */
      }
    },
  };
}
