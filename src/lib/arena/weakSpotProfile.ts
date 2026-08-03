/**
 * arena/weakSpotProfile.ts — persisted, rolling attempt history that feeds the
 * "Weak-Spot Trainer" mode's over-sampling.
 *
 * Mirrors `localPb.ts` / `speedProfile.ts`: pure by construction over an injected
 * key→value store, so it is unit-tested with an in-memory map (no real
 * `localStorage`). The React layer passes `window.localStorage`. Only the
 * reduced `WeakSpotAttempt` shape (op × shape × correct) is stored — never
 * prompts or answers — so the record stays tiny and privacy-clean.
 *
 * Like the other arena practice aids, this is a PRIVATE study record: it never
 * touches scoring or the leaderboard bucket, so Case A stays untouched.
 */
import type { KeyValueStore } from "./localPb";
import type { WeakSpotAttempt } from "./weakSpot";

/** Single-key store: the trainer is one global drill, not per-config. */
export const WEAK_SPOT_KEY = "qtp.arena.weakspot";
/** Keep the most recent N attempts so error rates track the learner's CURRENT skill. */
export const WEAK_SPOT_HISTORY_LIMIT = 400;

/** Read the rolling attempt history (oldest → newest), or `[]` when absent/corrupt. */
export function readWeakSpotHistory(store: KeyValueStore): WeakSpotAttempt[] {
  const raw = store.getItem(WEAK_SPOT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeakSpotAttempt[]) : [];
  } catch {
    return [];
  }
}

/**
 * Append `attempts` to the history, cap to the last `limit` (oldest dropped),
 * persist, and return the new history. Immutable w.r.t. the stored value.
 */
export function recordWeakSpotAttempts(
  store: KeyValueStore,
  attempts: readonly WeakSpotAttempt[],
  limit = WEAK_SPOT_HISTORY_LIMIT,
): WeakSpotAttempt[] {
  const prev = readWeakSpotHistory(store);
  const appended = [...prev, ...attempts];
  const capped = limit > 0 ? appended.slice(-limit) : [];
  store.setItem(WEAK_SPOT_KEY, JSON.stringify(capped));
  return capped;
}
