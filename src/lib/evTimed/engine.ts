/**
 * lib/evTimed/engine.ts — the PURE, deterministic engine for the EV-under-time
 * decision drill (task T4).
 *
 * DESIGN. This MIRRORS the wall-clock, per-question timed pattern of the OA
 * sprint session (`@/lib/oa/timedSession`) but is an ENTIRELY SEPARATE module:
 * we never import or mutate the OA/Arena stores. Like that pattern, time lives
 * as an absolute epoch-ms deadline (`questionDeadlineTs`) so a real component
 * can drive a `setInterval`/`Date.now()` countdown while every transition here
 * stays a pure `(state, …args, nowTs) => newState`.
 *
 * PURITY CONTRACT (identical in spirit to the OA engine):
 *  - inputs are never mutated (new objects returned),
 *  - `nowTs` (epoch ms) is ALWAYS supplied by the caller — this module NEVER
 *    calls `Date.now()`, which keeps draws + scoring deterministic and unit
 *    testable without a real wall clock,
 *  - the seeded question draw is reproducible: same `seed` ⇒ same items.
 *
 * SCORING. `scoreAnswer({ correct, elapsedMs, budgetMs })` is a standalone pure
 * function combining a correctness base with a within-budget speed bonus that
 * decays linearly to zero at the budget. Guarantees (asserted in tests):
 *  - a WRONG answer always scores the lowest (0),
 *  - among CORRECT answers, a faster one scores ≥ a slower one (monotonic),
 *  - a `withinBudget` flag independent of the point total.
 */
import { Rng } from "@/lib/rng";
import type { Question } from "@/types/content";
import {
  DEFAULT_BUDGET_MS,
  EV_TIMED_POOL,
  type EvTimedPoolEntry,
} from "./pool";

/* -------------------------------------------------------------------------- */
/*  Scoring — the pure `scoreAnswer` primitive                                 */
/* -------------------------------------------------------------------------- */

/** Points awarded for a correct answer BEFORE any speed bonus. */
export const CORRECT_BASE = 1000;
/** Max additional points for an instantaneous (0 ms) correct answer. */
export const SPEED_MAX = 1000;

export interface ScoreInput {
  /** Was the chosen answer correct? */
  correct: boolean;
  /** Wall-clock ms spent on this question (caller clamps to the budget). */
  elapsedMs: number;
  /** The per-question time budget (ms). */
  budgetMs: number;
}

export interface ScoreResult {
  /** Total points awarded (correctness base + speed bonus, or 0 if wrong). */
  points: number;
  /** Correctness base component (CORRECT_BASE if correct, else 0). */
  base: number;
  /** Speed bonus component (0 if wrong or slower than budget). */
  speedBonus: number;
  /** Was the answer committed within the time budget? */
  withinBudget: boolean;
  /** Fraction of the budget consumed, clamped to [0, 1]. */
  timeFraction: number;
}

/**
 * Score a single answer. Pure and total (defined for every input):
 *  - wrong ⇒ `{ points: 0, base: 0, speedBonus: 0 }` (the lowest possible),
 *  - correct ⇒ `CORRECT_BASE + round(SPEED_MAX · max(0, 1 − elapsed/budget))`,
 *    so points are non-increasing in `elapsedMs` (faster ≥ slower) and never
 *    drop below `CORRECT_BASE > 0`.
 * `budgetMs ≤ 0` degrades gracefully (no speed bonus; within-budget iff instant).
 */
export function scoreAnswer(input: ScoreInput): ScoreResult {
  const { correct } = input;
  const budgetMs = Math.max(0, input.budgetMs);
  const elapsedMs = Math.max(0, input.elapsedMs);

  const timeFraction =
    budgetMs > 0 ? Math.min(1, elapsedMs / budgetMs) : elapsedMs > 0 ? 1 : 0;
  const withinBudget = elapsedMs <= budgetMs;

  if (!correct) {
    return { points: 0, base: 0, speedBonus: 0, withinBudget, timeFraction };
  }

  // Linear time-decay bonus: full at 0 ms, zero once the budget is spent.
  const speedBonus = Math.round(SPEED_MAX * (1 - timeFraction));
  return {
    points: CORRECT_BASE + speedBonus,
    base: CORRECT_BASE,
    speedBonus,
    withinBudget,
    timeFraction,
  };
}

/** Best achievable score for one item (instantaneous correct answer). */
export const MAX_ITEM_SCORE = CORRECT_BASE + SPEED_MAX;

/* -------------------------------------------------------------------------- */
/*  Session state machine                                                      */
/* -------------------------------------------------------------------------- */

/** A materialized drill item: a drawn question + its time budget + slot id. */
export interface EvTimedItem {
  /** The pool slot this was drawn from (see `EvTimedPoolEntry.id`). */
  slotId: string;
  /** Human label for the concept. */
  label: string;
  /** Time budget (ms) for this question. */
  budgetMs: number;
  /** The materialized MCQ (from an existing generator, unmodified). */
  question: Question;
}

/** One recorded answer, parallel by position to `EvTimedSessionState.items`. */
export interface EvTimedAnswer {
  /** Chosen choice index, or `null` when skipped / timed out unanswered. */
  chosen: number | null;
  /** Wall-clock ms spent before committing (clamped to the budget). */
  elapsedMs: number;
  /** Whether the answer timed out (auto-committed at the deadline). */
  timedOut: boolean;
  /** The pure score for this answer, or `null` until answered. */
  score: ScoreResult | null;
}

export type EvTimedStatus = "running" | "finished";

/**
 * The drill session. Wall-clock by design: `questionDeadlineTs` is an absolute
 * epoch-ms deadline for the CURRENT question, so the UI recomputes remaining
 * time as `deadline − now` and this engine never needs a live timer.
 */
export interface EvTimedSessionState {
  id: string;
  seed: number;
  startedAtTs: number;
  items: EvTimedItem[];
  answers: EvTimedAnswer[];
  index: number;
  /** Absolute deadline (epoch ms) for the CURRENT question. */
  questionDeadlineTs: number;
  status: EvTimedStatus;
  /** Running total of awarded points. */
  totalScore: number;
  /** Absolute completion timestamp once finished (epoch ms). */
  completedAtTs?: number;
}

export interface CreateEvTimedOptions {
  /** Seed for the deterministic draw. */
  seed: number;
  /** Absolute wall-clock start (epoch ms). */
  nowTs: number;
  /** How many questions to present (default: the whole pool). */
  count?: number;
  /** Override the pool (mainly for tests); defaults to the curated pool. */
  pool?: readonly EvTimedPoolEntry[];
}

/**
 * Deterministically draw `count` items from the curated pool and open a running
 * session with the first question's clock started at `nowTs`. Same `seed` ⇒
 * byte-identical items (same order, prompts, correctIndex), so a draw is fully
 * reproducible and unit-testable. An empty pool yields an already-`finished`
 * session.
 */
export function createEvTimedSession(
  opts: CreateEvTimedOptions,
): EvTimedSessionState {
  const { seed, nowTs } = opts;
  const pool = opts.pool ?? EV_TIMED_POOL;
  const count = opts.count ?? pool.length;

  const items = drawEvTimedItems(seed, count, pool);

  const empty = items.length === 0;
  return {
    id: `ev-timed:${seed}:${nowTs}`,
    seed,
    startedAtTs: nowTs,
    items,
    answers: items.map(() => ({
      chosen: null,
      elapsedMs: 0,
      timedOut: false,
      score: null,
    })),
    index: 0,
    questionDeadlineTs: empty ? nowTs : nowTs + items[0].budgetMs,
    status: empty ? "finished" : "running",
    totalScore: 0,
    completedAtTs: empty ? nowTs : undefined,
  };
}

/**
 * Pure, deterministic draw: seed an `Rng`, shuffle the pool once, then walk it
 * (cycling if `count` exceeds the pool size) materializing one question per
 * slot from the SAME rng stream. Never mutates the pool or the generators.
 */
export function drawEvTimedItems(
  seed: number,
  count: number,
  pool: readonly EvTimedPoolEntry[] = EV_TIMED_POOL,
): EvTimedItem[] {
  if (pool.length === 0 || count <= 0) return [];
  const rng = new Rng(seed);
  const order = rng.shuffle(pool);
  const items: EvTimedItem[] = [];
  for (let i = 0; i < count; i++) {
    const entry = order[i % order.length];
    const question = entry.generator(rng);
    items.push({
      slotId: entry.id,
      label: entry.label,
      budgetMs: entry.budgetMs > 0 ? entry.budgetMs : DEFAULT_BUDGET_MS,
      question,
    });
  }
  return items;
}

/** The current item, or `undefined` once the drill is exhausted. */
export function currentItem(state: EvTimedSessionState): EvTimedItem | undefined {
  return state.items[state.index];
}

/** Remaining ms on the current question clock, clamped at 0. */
export function remainingMs(
  state: EvTimedSessionState,
  nowTs: number,
): number {
  return Math.max(0, state.questionDeadlineTs - nowTs);
}

/** True once the current question's deadline has been reached/passed. */
export function isQuestionExpired(
  state: EvTimedSessionState,
  nowTs: number,
): boolean {
  return nowTs >= state.questionDeadlineTs;
}

/** Whether the item at `index` has already been answered/scored. */
export function isAnswered(
  state: EvTimedSessionState,
  index: number,
): boolean {
  const a = state.answers[index];
  return !!a && a.score !== null;
}

/**
 * Commit the answer for the CURRENT question and score it. Pure: returns a new
 * state (does NOT advance). No-op if not running or the current item is already
 * answered.
 *
 *  - `chosen === null` ⇒ a skip / timeout (scored as wrong, lowest points).
 *  - `elapsedMs` is derived from the deadline (`budget − remaining`) and clamped
 *    to `[0, budget]`, so a commit exactly at/after the deadline counts as the
 *    full budget. Pass `timedOut` to flag an auto-commit.
 */
export function answerCurrent(
  state: EvTimedSessionState,
  chosen: number | null,
  nowTs: number,
  timedOut = false,
): EvTimedSessionState {
  if (state.status !== "running") return state;
  const index = state.index;
  const item = state.items[index];
  if (!item) return state;
  if (isAnswered(state, index)) return state;

  const budgetMs = item.budgetMs;
  const questionStartTs = state.questionDeadlineTs - budgetMs;
  const rawElapsed = nowTs - questionStartTs;
  const elapsedMs = Math.min(budgetMs, Math.max(0, rawElapsed));
  const correct = chosen !== null && chosen === item.question.correctIndex;
  const score = scoreAnswer({ correct, elapsedMs, budgetMs });

  const answers = state.answers.map((a, i) =>
    i === index ? { chosen, elapsedMs, timedOut, score } : a,
  );

  return {
    ...state,
    answers,
    totalScore: state.totalScore + score.points,
  };
}

/**
 * Advance to the next question, giving it a FRESH full clock
 * (`questionDeadlineTs = nowTs + nextBudget`). Finishes the session when the
 * last question is passed. No-op unless running.
 */
export function advanceEvTimed(
  state: EvTimedSessionState,
  nowTs: number,
): EvTimedSessionState {
  if (state.status !== "running") return state;
  const index = state.index + 1;
  if (index >= state.items.length) {
    return {
      ...state,
      index,
      status: "finished",
      completedAtTs: nowTs,
    };
  }
  return {
    ...state,
    index,
    questionDeadlineTs: nowTs + state.items[index].budgetMs,
  };
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

export interface EvTimedSummary {
  total: number;
  answered: number;
  correct: number;
  /** correct / total in [0, 1]. */
  accuracy: number;
  /** Correct answers committed within budget. */
  withinBudget: number;
  /** Sum of awarded points. */
  score: number;
  /** Best achievable score = total × MAX_ITEM_SCORE. */
  maxScore: number;
  /** Mean solve time over answered items (ms); 0 when none answered. */
  avgElapsedMs: number;
}

/** Derive a pure, order-independent summary from a session's recorded answers. */
export function summarize(state: EvTimedSessionState): EvTimedSummary {
  const total = state.items.length;
  const scored = state.answers.filter((a) => a.score !== null);
  const answered = scored.length;
  let correct = 0;
  let withinBudget = 0;
  let score = 0;
  let elapsedSum = 0;
  for (const a of scored) {
    score += a.score!.points;
    elapsedSum += a.elapsedMs;
    if (a.score!.base > 0) {
      correct++;
      if (a.score!.withinBudget) withinBudget++;
    }
  }
  return {
    total,
    answered,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    withinBudget,
    score,
    maxScore: total * MAX_ITEM_SCORE,
    avgElapsedMs: answered > 0 ? Math.round(elapsedSum / answered) : 0,
  };
}
