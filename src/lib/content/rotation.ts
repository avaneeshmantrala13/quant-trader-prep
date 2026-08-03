/**
 * lib/content/rotation.ts — a PURE, seed-aware anti-repeat rotation selector.
 *
 * Generated items are stamped with a stable "signature" (typically their
 * `family` id and/or a normalized prompt key). When a feature serves a stream
 * of items it wants variety: avoid re-serving something whose signature was
 * shown in the last few draws. This module tracks a bounded ring of recently
 * served signatures and biases selection AWAY from anything currently in that
 * window — while staying fully deterministic given (state, candidates, rng).
 *
 * Design notes:
 *  - `RotationState` is immutable. Every operation returns a NEW state; nothing
 *    is mutated in place, so callers can freely snapshot/replay it.
 *  - `recent` is a plain FIFO queue of the last `windowSize` served signatures
 *    (oldest first, newest last), trimmed from the front so it never exceeds the
 *    window. This is the "signature ring".
 *  - Selection is deterministic: given the same state, candidates and rng seed,
 *    `nextSelection` always picks the same item.
 *  - Graceful fallback: when EVERY candidate is currently in-window (e.g. fewer
 *    distinct candidates than the window), it falls back to picking from the
 *    full candidate list rather than failing, so the stream never stalls.
 *
 * This file is a pure utility only — it wires into NOTHING. The Wave-2
 * Arena/OA-store owner (and T11) is responsible for threading a `RotationState`
 * through served-signature state in `questionPool` / the arena / the OA store.
 */
import type { Rng } from "@/lib/rng";

/**
 * Immutable rotation state: a bounded FIFO ring of recently served signatures.
 * `recent` is ordered oldest-first, newest-last, and never exceeds `windowSize`.
 */
export interface RotationState {
  /** Maximum number of recent signatures to remember (>= 0). */
  readonly windowSize: number;
  /** Recently served signatures, oldest first, bounded to `windowSize`. */
  readonly recent: readonly string[];
}

/** Result of a selection: the chosen candidate plus the advanced state. */
export interface Selection<T> {
  readonly chosen: T;
  readonly state: RotationState;
}

/**
 * Create an empty rotation with the given anti-repeat window. `windowSize` is
 * coerced to a non-negative integer; a window of 0 disables anti-repeat (the
 * ring stays empty and every candidate is always eligible).
 */
export function createRotation(windowSize: number): RotationState {
  const w = Number.isFinite(windowSize) ? Math.max(0, Math.floor(windowSize)) : 0;
  return { windowSize: w, recent: [] };
}

/**
 * Record that `signature` was served: append it to the ring and trim from the
 * front so the ring never exceeds `windowSize`. Returns a NEW state (the input
 * is never mutated). With `windowSize === 0` the ring stays empty.
 */
export function recordServed(state: RotationState, signature: string): RotationState {
  if (state.windowSize <= 0) {
    return state.recent.length === 0 ? state : { ...state, recent: [] };
  }
  const appended = [...state.recent, signature];
  const recent =
    appended.length > state.windowSize
      ? appended.slice(appended.length - state.windowSize)
      : appended;
  return { windowSize: state.windowSize, recent };
}

/**
 * Deterministically pick the next candidate, biased away from signatures
 * currently in the window, and return the chosen item alongside the advanced
 * state (with the chosen signature recorded).
 *
 * Behavior:
 *  - Candidates whose signature is NOT in the current window are preferred.
 *  - If at least one such candidate exists, the pick is made only among those,
 *    guaranteeing no in-window repeat.
 *  - If EVERY candidate is in-window (graceful fallback), the pick is made among
 *    ALL candidates so the stream never stalls.
 *  - The pick uses `rng.pick`, so it is fully deterministic given the rng seed.
 *
 * `signatureOf` maps a candidate to its signature; it defaults to `String`, so
 * candidates that are already signature strings work with no extra argument.
 *
 * Throws if `candidates` is empty (there is nothing to choose).
 */
export function nextSelection<T>(
  state: RotationState,
  candidates: readonly T[],
  rng: Rng,
  signatureOf: (candidate: T) => string = String as unknown as (candidate: T) => string,
): Selection<T> {
  if (candidates.length === 0) {
    throw new Error("nextSelection: candidates must be non-empty");
  }
  const inWindow = new Set(state.recent);
  const eligible = candidates.filter((c) => !inWindow.has(signatureOf(c)));
  const pool = eligible.length > 0 ? eligible : candidates;
  const chosen = rng.pick(pool);
  return { chosen, state: recordServed(state, signatureOf(chosen)) };
}

/**
 * Convenience: run `nextSelection` `count` times, threading state forward, and
 * return the chosen items in order alongside the final state. Pure and
 * deterministic given (state, candidates, rng seed, count).
 */
export function selectSequence<T>(
  state: RotationState,
  candidates: readonly T[],
  rng: Rng,
  count: number,
  signatureOf: (candidate: T) => string = String as unknown as (candidate: T) => string,
): { chosen: T[]; state: RotationState } {
  const chosen: T[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const step = nextSelection(s, candidates, rng, signatureOf);
    chosen.push(step.chosen);
    s = step.state;
  }
  return { chosen, state: s };
}
