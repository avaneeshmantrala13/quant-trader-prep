/**
 * arena/session.ts — the PURE timed-session state machine (Phase 6).
 *
 * A run is fully described by its immutable `stream` (from
 * `arenaQuestionStream`) plus a scalar clock. All transitions are pure
 * `(state, …) => state` functions and time is advanced only via explicit
 * `tick(state, deltaMs)` calls — there is NO real clock and NO randomness here,
 * so the machine is deterministic and unit-testable. The React runner owns the
 * wall-clock timer and simply feeds ticks/answers into these transitions.
 *
 * End conditions: the session finishes when the clock hits 0 OR when every
 * question up to the `questionCap` (or the end of the stream) has been resolved.
 */
import type { ArenaPreset } from "./config";
import type { AnsweredItem } from "./scoring";
import type { StreamItem } from "@/lib/leaderboard/seed";

export type SessionStatus = "running" | "finished";

export interface SessionState {
  status: SessionStatus;
  /** Index of the CURRENT (not-yet-resolved) question in the stream. */
  index: number;
  /** Milliseconds left on the clock. */
  remainingMs: number;
  /** Resolved answers, in order. */
  answered: AnsweredItem[];
  /** Total questions this session will present (cap ∧ stream length). */
  total: number;
}

/** Effective question count: the cap, bounded by the available stream length. */
export function sessionTotal(preset: ArenaPreset, stream: StreamItem[]): number {
  return preset.questionCap && preset.questionCap > 0
    ? Math.min(preset.questionCap, stream.length)
    : stream.length;
}

/** Fresh, running session at full duration on question 0. */
export function startSession(
  preset: ArenaPreset,
  stream: StreamItem[],
): SessionState {
  const total = sessionTotal(preset, stream);
  const remainingMs = preset.durationSec * 1000;
  return {
    status: remainingMs > 0 && total > 0 ? "running" : "finished",
    index: 0,
    remainingMs,
    answered: [],
    total,
  };
}

/** True once no more questions remain to present. */
function outOfQuestions(state: SessionState): boolean {
  return state.index >= state.total;
}

/** Force the session into its terminal state (idempotent). */
export function finish(state: SessionState): SessionState {
  if (state.status === "finished") return state;
  return { ...state, status: "finished" };
}

/**
 * Advance the clock by `deltaMs`. Clamps at 0 and finishes the session when the
 * window elapses. A no-op once finished.
 */
export function tick(state: SessionState, deltaMs: number): SessionState {
  if (state.status === "finished") return state;
  const remainingMs = Math.max(0, state.remainingMs - Math.max(0, deltaMs));
  if (remainingMs <= 0) {
    return { ...state, remainingMs: 0, status: "finished" };
  }
  return { ...state, remainingMs };
}

function push(state: SessionState, item: AnsweredItem): SessionState {
  const answered = [...state.answered, item];
  const index = state.index + 1;
  const next: SessionState = { ...state, answered, index };
  return index >= next.total ? finish(next) : next;
}

/**
 * Answer the current question with `value` (grade by exact match against the
 * stream's computed answer) after `rtMs`. Advances to the next question and
 * finishes if that was the last. A no-op once finished / out of questions.
 */
export function answer(
  state: SessionState,
  stream: StreamItem[],
  value: number,
  rtMs: number,
): SessionState {
  if (state.status === "finished" || outOfQuestions(state)) return state;
  const q = stream[state.index];
  return push(state, {
    id: q.id,
    correct: value === q.answer,
    skipped: false,
    rtMs,
    op: q.op,
  });
}

/**
 * Skip the current question (no grade). Advances without scoring; the resolved
 * item is recorded as `skipped` so the scorer can honor the "skips free"
 * toggle. A no-op once finished / out of questions.
 */
export function skip(
  state: SessionState,
  stream: StreamItem[],
  rtMs: number,
): SessionState {
  if (state.status === "finished" || outOfQuestions(state)) return state;
  const q = stream[state.index];
  return push(state, {
    id: q.id,
    correct: false,
    skipped: true,
    rtMs,
    op: q.op,
  });
}

/** The current stream item, or `undefined` if the session is exhausted. */
export function currentItem(
  state: SessionState,
  stream: StreamItem[],
): StreamItem | undefined {
  return outOfQuestions(state) ? undefined : stream[state.index];
}
