/**
 * lib/oa/store.ts — PURE, immutable helpers for the durable OA store
 * (`OaTimedStore`). NO I/O, NO clock, NO React: every function takes the current
 * (possibly undefined) store and returns a BRAND-NEW plain-object store, so the
 * result stays trivially JSON-serializable for localStorage-backed `UserProgress`
 * and safe to hand straight to React state / `structuredClone`.
 *
 * The store holds at most ONE resumable in-progress session (`active`) plus a
 * capped, oldest→newest history of completed `results`. Finishing a session
 * (`appendOaResult`) atomically clears the active one, so the two never disagree.
 */
import { MAX_OA_RESULTS } from "./config";
import type {
  OaSessionResult,
  OaSessionState,
  OaTimedStore,
} from "./types";

/** A fresh, empty store: no active session, no results. */
export function emptyOaStore(): OaTimedStore {
  return { results: [] };
}

/**
 * Set the single in-progress `active` session, preserving existing `results`.
 * Pure/immutable — returns a new store and never mutates the input (defaults to
 * an empty store when `store` is undefined).
 */
export function putActiveSession(
  store: OaTimedStore | undefined,
  session: OaSessionState,
): OaTimedStore {
  const base = store ?? emptyOaStore();
  return { active: session, results: base.results };
}

/**
 * Clear the `active` session, preserving existing `results`. Pure/immutable —
 * returns a new store with `active` undefined.
 */
export function clearActiveSession(
  store: OaTimedStore | undefined,
): OaTimedStore {
  const base = store ?? emptyOaStore();
  return { active: undefined, results: base.results };
}

/**
 * Append a completed `result` to the history, capping to the LAST `cap` entries
 * (oldest dropped), AND clear the `active` session (finishing a session ends the
 * resumable one). Pure/immutable — returns a new store.
 */
export function appendOaResult(
  store: OaTimedStore | undefined,
  result: OaSessionResult,
  cap = MAX_OA_RESULTS,
): OaTimedStore {
  const base = store ?? emptyOaStore();
  const appended = [...base.results, result];
  // Guard cap <= 0 explicitly: `slice(-0)` would (wrongly) return the whole
  // array, so an empty/zero cap must yield an empty history.
  const capped = cap > 0 ? appended.slice(-cap) : [];
  return { active: undefined, results: capped };
}

/** Read the single in-progress session (or undefined). */
export function getActiveSession(
  store: OaTimedStore | undefined,
): OaSessionState | undefined {
  return store?.active;
}

/** Read the completed results (oldest → newest), or an empty array. */
export function getOaResults(
  store: OaTimedStore | undefined,
): OaSessionResult[] {
  return store?.results ?? [];
}
