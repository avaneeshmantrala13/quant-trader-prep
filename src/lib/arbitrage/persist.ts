/**
 * lib/arbitrage/persist.ts — a SELF-CONTAINED, localStorage-namespaced
 * persistence shim for the No-Arbitrage / de-vig drill's single in-progress run.
 *
 * WHY THIS EXISTS. `ArbitragePage` is a disjoint practice surface that never
 * touches `UserProgress`/mastery, and its in-progress state (the deterministic
 * `seed`, the current `index`, and the parallel per-item correctness
 * `responses`, plus the current item's live entry) doesn't fit the shared
 * `ResumeState`. So we durably persist a small, JSON-serializable snapshot here,
 * mirroring the OA store's durable style. The battery is re-materialized from
 * `seed` on resume (deterministic), so only the seed + progress need saving.
 *
 * Only the CURRENT run is kept, and only while it is RUNNING; finishing
 * (reaching the scorecard) or restarting clears it, so re-entering after a
 * completed run starts fresh.
 */

/** localStorage key (device-level; this drill is disjoint from per-user progress). */
export const ARBITRAGE_STORAGE_KEY = "qtp.arbitrage.run";

/** The minimal surface of `Storage` we use — injectable for tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The persisted in-progress run (versioned for safe future migrations). */
export interface ArbitrageRunState {
  version: 1;
  /** Deterministic seed the battery is re-materialized from on resume. */
  seed: number;
  /** Index of the current item. */
  index: number;
  /** Per-item correctness, parallel to the battery; null = not yet committed. */
  responses: (boolean | null)[];
  /** Whether the CURRENT item has been committed (drives the reveal). */
  committed: boolean;
  /** The chosen choice index for the current quiz item (null otherwise). */
  chosen: number | null;
  /** The current numeric item's typed entry (empty for quiz items). */
  typed: string;
}

function resolveStore(store?: StorageLike): StorageLike | null {
  if (store) return store;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Persist the in-progress run (overwrites any prior one). Non-fatal on failure. */
export function saveArbitrageRun(
  run: ArbitrageRunState,
  store?: StorageLike,
): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.setItem(ARBITRAGE_STORAGE_KEY, JSON.stringify(run));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/**
 * Read the persisted run, or `undefined` when absent/corrupt. Performs a light
 * structural check so a malformed blob is treated as "no resume".
 */
export function loadArbitrageRun(
  store?: StorageLike,
): ArbitrageRunState | undefined {
  const s = resolveStore(store);
  if (!s) return undefined;
  try {
    const raw = s.getItem(ARBITRAGE_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ArbitrageRunState | null;
    if (
      !parsed ||
      typeof parsed.seed !== "number" ||
      typeof parsed.index !== "number" ||
      !Array.isArray(parsed.responses)
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** Clear the persisted run (on finish or explicit restart). Non-fatal. */
export function clearArbitrageRun(store?: StorageLike): void {
  const s = resolveStore(store);
  if (!s) return;
  try {
    s.removeItem(ARBITRAGE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
