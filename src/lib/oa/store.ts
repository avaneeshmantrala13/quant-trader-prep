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
import type { Rng } from "@/lib/rng";
import {
  createRotation,
  nextSelection,
  recordServed,
  selectSequence,
  type RotationState,
  type Selection,
} from "@/lib/content/rotation";

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
  // Spread `base` first so any persisted `rotation` survives untouched.
  return { ...base, active: session, results: base.results };
}

/**
 * Clear the `active` session, preserving existing `results`. Pure/immutable —
 * returns a new store with `active` undefined.
 */
export function clearActiveSession(
  store: OaTimedStore | undefined,
): OaTimedStore {
  const base = store ?? emptyOaStore();
  // Preserve `rotation` (anti-repeat state outlives any single session).
  return { ...base, active: undefined, results: base.results };
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
  // Preserve `rotation` — served-signature history is independent of results.
  return { ...base, active: undefined, results: capped };
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

/* ------------------------------------------------------------------------- *
 * Anti-repeat ROTATION API (T8 wiring).
 *
 * The persisted `OaTimedStore.rotation` is a bounded ring of recently SERVED
 * question signatures (see `@/lib/content/rotation`). These helpers are the
 * ONLY sanctioned way to read/advance it, so the question pool (T11) never has
 * to know the persisted shape — it just calls `selectServed*` to obtain a
 * rotation-biased draw (and the new store to persist) or `recordServed*` to log
 * signatures it served through some other path. Every helper is pure/immutable:
 * it returns a BRAND-NEW store and never mutates the input, and it initializes
 * the ring on first use so OLD saves (no `rotation` field) keep working.
 * ------------------------------------------------------------------------- */

/**
 * Default anti-repeat window: how many recently served signatures the OA store
 * remembers. Sized so a typical multi-question draw won't repeat a signature
 * within a session while staying tiny in localStorage.
 */
export const DEFAULT_OA_ROTATION_WINDOW = 24;

/**
 * Read the store's rotation ring, creating an empty one (with `windowSize`) when
 * absent. An existing ring is returned AS-IS (its own window wins, so `windowSize`
 * only seeds a brand-new ring). Never mutates the store.
 */
export function getRotationState(
  store: OaTimedStore | undefined,
  windowSize: number = DEFAULT_OA_ROTATION_WINDOW,
): RotationState {
  return store?.rotation ?? createRotation(windowSize);
}

/**
 * Set the rotation ring, preserving `active` + `results`. Pure/immutable —
 * returns a new store (defaults from an empty store when `store` is undefined).
 */
export function putRotationState(
  store: OaTimedStore | undefined,
  rotation: RotationState,
): OaTimedStore {
  const base = store ?? emptyOaStore();
  return { ...base, rotation };
}

/**
 * Record that `signature` was served: advance the (lazily-initialized) ring and
 * write it back. Returns a new store; old saves initialize on first record.
 */
export function recordServedSignature(
  store: OaTimedStore | undefined,
  signature: string,
  windowSize: number = DEFAULT_OA_ROTATION_WINDOW,
): OaTimedStore {
  const rotation = getRotationState(store, windowSize);
  return putRotationState(store, recordServed(rotation, signature));
}

/**
 * Record a batch of served signatures in order (each trims the ring), returning
 * the updated store. Convenience for a multi-question draw served in one shot.
 */
export function recordServedSignatures(
  store: OaTimedStore | undefined,
  signatures: readonly string[],
  windowSize: number = DEFAULT_OA_ROTATION_WINDOW,
): OaTimedStore {
  let rotation = getRotationState(store, windowSize);
  for (const sig of signatures) rotation = recordServed(rotation, sig);
  return putRotationState(store, rotation);
}

/**
 * Draw ONE candidate biased away from recently-served signatures, and return the
 * chosen item alongside the UPDATED store (with the chosen signature recorded).
 * This is the primary helper T11's question pool calls. Deterministic given
 * (store rotation, candidates, rng seed). `signatureOf` maps a candidate to its
 * signature (defaults to `String`). Throws if `candidates` is empty.
 */
export function selectServed<T>(
  store: OaTimedStore | undefined,
  candidates: readonly T[],
  rng: Rng,
  signatureOf?: (candidate: T) => string,
  windowSize: number = DEFAULT_OA_ROTATION_WINDOW,
): { chosen: T; store: OaTimedStore } {
  const rotation = getRotationState(store, windowSize);
  const sel: Selection<T> = signatureOf
    ? nextSelection(rotation, candidates, rng, signatureOf)
    : nextSelection(rotation, candidates, rng);
  return { chosen: sel.chosen, store: putRotationState(store, sel.state) };
}

/**
 * Draw `count` candidates in sequence, each biased away from the recent ring
 * (which advances as items are chosen), and return them alongside the UPDATED
 * store. Deterministic given (store rotation, candidates, rng seed, count).
 */
export function selectSequenceServed<T>(
  store: OaTimedStore | undefined,
  candidates: readonly T[],
  rng: Rng,
  count: number,
  signatureOf?: (candidate: T) => string,
  windowSize: number = DEFAULT_OA_ROTATION_WINDOW,
): { chosen: T[]; store: OaTimedStore } {
  const rotation = getRotationState(store, windowSize);
  const result = signatureOf
    ? selectSequence(rotation, candidates, rng, count, signatureOf)
    : selectSequence(rotation, candidates, rng, count);
  return { chosen: result.chosen, store: putRotationState(store, result.state) };
}
