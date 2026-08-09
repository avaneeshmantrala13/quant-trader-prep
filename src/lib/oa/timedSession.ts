/**
 * lib/oa/timedSession.ts — the PURE, deterministic, WALL-CLOCK timed-session
 * engine for the Interview OA practice (Case B).
 *
 * WHY WALL-CLOCK (not a ticker). Interview OAs must survive tab-close/reload:
 * the section clock does NOT pause while the user is away. So time lives as
 * ABSOLUTE epoch-ms deadlines (`deadlineTs`, `questionDeadlineTs`) and remaining
 * time is ALWAYS recomputed as `deadline − now`, never from an in-memory count.
 *
 * PURITY CONTRACT. Every transition is a pure `(state, …args) => newState`:
 *  - inputs are NEVER mutated (new objects returned; the `answers` array is
 *    deep-copied whenever an answer changes),
 *  - `nowTs` (epoch ms) is ALWAYS supplied by the caller — this module NEVER
 *    calls `Date.now()`, which keeps it deterministic and unit-testable and lets
 *    the React runner own the single real timer.
 *
 * The resulting `OaSessionState` is plain-serializable, so a JSON round-trip +
 * `resumeOaSession` reproduces the exact same behavior (see the tests).
 */
import type { OaFormatConfig, OaQuestion, OaSessionState } from "./types";
import { resolveScoring } from "./config";

/**
 * The shot-clock budget (ms) for sprint question `index`. Prefers an explicit
 * per-question budget (`state.questionBudgetsMs[index]`, additive variant used
 * by the timed-diagnostic mental-math sprint) and falls back to the uniform
 * `state.budgetMs` — so classic sprints (no per-question array) are unchanged.
 */
export function sprintBudgetMs(state: OaSessionState, index: number): number {
  const per = state.questionBudgetsMs?.[index];
  return typeof per === "number" && per > 0 ? per : state.budgetMs;
}

/**
 * Create a fresh, running session for `config` over `questions`. Deadlines are
 * seeded as absolute epoch-ms from `opts.nowTs` per kind:
 *  - section  ⇒ `deadlineTs = nowTs + sectionSec·1000` (one running clock),
 *  - sprint   ⇒ `questionDeadlineTs = nowTs + perQuestionSec·1000` (per-question),
 *  - measured ⇒ neither (untimed).
 * An empty question set yields a valid but already-`submitted` session.
 */
export function createOaSession(
  config: OaFormatConfig,
  questions: OaQuestion[],
  opts: { hardMode?: boolean; nowTs: number; questionBudgetsMs?: number[] },
): OaSessionState {
  const { nowTs } = opts;
  const hardMode = !!opts.hardMode;

  // Optional additive per-question shot-clock budgets (sprint only). Kept only
  // when it actually matches the sprint question set, so every other format's
  // persisted shape stays byte-identical to before this variant existed.
  const questionBudgetsMs =
    config.kind === "sprint" &&
    opts.questionBudgetsMs &&
    opts.questionBudgetsMs.length === questions.length
      ? opts.questionBudgetsMs.slice()
      : undefined;

  const deadlineTs =
    config.kind === "section" && config.sectionSec
      ? nowTs + config.sectionSec * 1000
      : undefined;
  const firstBudgetMs =
    questionBudgetsMs && questionBudgetsMs.length > 0
      ? questionBudgetsMs[0]
      : config.perQuestionSec
        ? config.perQuestionSec * 1000
        : undefined;
  const questionDeadlineTs =
    config.kind === "sprint" && firstBudgetMs ? nowTs + firstBudgetMs : undefined;

  // Module-lock only applies to a section-clock format that disables free
  // navigation (IMC-style). We carry it as an OPTIONAL flag so every other
  // format's persisted shape is byte-identical to before this variant existed.
  const noBack =
    config.kind === "section" && config.freeNavigation === false
      ? true
      : undefined;

  return {
    id: `${config.id}:${nowTs}`,
    formatId: config.id,
    kind: config.kind,
    startedAtTs: nowTs,
    deadlineTs,
    questionDeadlineTs,
    ...(noBack ? { noBack } : {}),
    ...(questionBudgetsMs ? { questionBudgetsMs } : {}),
    questions,
    answers: questions.map((q) => ({
      questionId: q.id,
      chosen: null,
      elapsedMs: 0,
    })),
    index: 0,
    // Nothing to do with zero questions ⇒ immediately terminal.
    status: questions.length === 0 ? "submitted" : "running",
    scoring: resolveScoring(config, hardMode),
    budgetMs: config.budgetMs,
    hardMode,
    completedAtTs: questions.length === 0 ? nowTs : undefined,
  };
}

/** Optional convenience: how many questions the session presents. */
export function sessionCount(state: OaSessionState): number {
  return state.questions.length;
}

/**
 * Section only: remaining ms on the running section clock, clamped at 0.
 * `null` for sprint/measured (no section deadline).
 */
export function remainingSectionMs(
  state: OaSessionState,
  nowTs: number,
): number | null {
  if (state.deadlineTs == null) return null;
  return Math.max(0, state.deadlineTs - nowTs);
}

/**
 * Sprint only: remaining ms on the CURRENT question clock, clamped at 0.
 * `null` when there is no per-question deadline (section/measured).
 */
export function remainingQuestionMs(
  state: OaSessionState,
  nowTs: number,
): number | null {
  if (state.questionDeadlineTs == null) return null;
  return Math.max(0, state.questionDeadlineTs - nowTs);
}

/** True when a section deadline exists and `nowTs` has reached/passed it. */
export function isDeadlinePassed(
  state: OaSessionState,
  nowTs: number,
): boolean {
  return state.deadlineTs != null && nowTs >= state.deadlineTs;
}

/**
 * Record (or clear) the chosen answer for question `index` and ACCUMULATE
 * `addElapsedMs` (negative deltas ignored) onto its view time. Pure: returns a
 * new state with a fresh `answers` array. Does NOT advance the index or touch
 * deadlines. No-op if not running or `index` is out of range.
 */
export function recordAnswer(
  state: OaSessionState,
  index: number,
  chosen: number | null,
  addElapsedMs: number,
  _nowTs: number,
): OaSessionState {
  if (state.status !== "running") return state;
  if (index < 0 || index >= state.answers.length) return state;

  const answers = state.answers.map((a, i) =>
    i === index
      ? { ...a, chosen, elapsedMs: a.elapsedMs + Math.max(0, addElapsedMs) }
      : a,
  );
  return { ...state, answers };
}

/**
 * Sprint auto-advance: move to the next question, giving it a FRESH full clock
 * (`questionDeadlineTs = nowTs + budgetMs`, since the sprint budget IS the
 * per-question window). Submits when the last question is passed. No-op unless
 * a running sprint.
 */
export function advanceSprint(
  state: OaSessionState,
  nowTs: number,
): OaSessionState {
  if (state.status !== "running" || state.kind !== "sprint") return state;

  const index = state.index + 1;
  if (index >= state.questions.length) {
    return {
      ...state,
      index,
      status: "submitted",
      completedAtTs: nowTs,
      questionDeadlineTs: undefined,
    };
  }
  return {
    ...state,
    index,
    questionDeadlineTs: nowTs + sprintBudgetMs(state, index),
  };
}

/**
 * Section/measured navigation to `index`. No-op if not running, for sprint
 * (no going back), or when `index` is out of range. Deadlines are untouched.
 *
 * MODULE-LOCK: when `state.noBack` is set (an IMC-style module-locked section),
 * navigation is FORWARD-ONLY — moving to any index at or before the current one
 * is a no-op, so a submitted/earlier question can never be revisited. Free-nav
 * sections (no `noBack`) still jump to any valid index as before.
 */
export function navigateTo(
  state: OaSessionState,
  index: number,
): OaSessionState {
  if (state.status !== "running") return state;
  if (state.kind === "sprint") return state;
  if (index < 0 || index >= state.questions.length) return state;
  if (state.noBack && index <= state.index) return state;
  return { ...state, index };
}

/**
 * Terminate the session. Idempotent: a no-op once already terminal. `outcome`
 * distinguishes a normal/user (or at-time) `submitted` from a deadline-passed
 * `expired`. `completedAtTs` is stamped from the supplied `nowTs`.
 */
export function submitOaSession(
  state: OaSessionState,
  nowTs: number,
  outcome: "submitted" | "expired" = "submitted",
): OaSessionState {
  if (state.status !== "running") return state;
  return {
    ...state,
    status: outcome === "expired" ? "expired" : "submitted",
    completedAtTs: nowTs,
  };
}

/**
 * THE reload/return handler — pure and idempotent. Reconciles a session with
 * the wall clock after time may have passed while the user was away:
 *  - measured / non-running ⇒ unchanged (no clocks to reconcile),
 *  - section ⇒ if the section deadline has passed, complete AT `deadlineTs`
 *    marked `expired` (the clock never paused); otherwise unchanged,
 *  - sprint ⇒ while the current question's clock elapsed while away, auto-skip
 *    it (chosen stays null, elapsedMs = full budget) and advance. A newly-shown
 *    question gets a FRESH full clock from `nowTs` (it wasn't visible while
 *    away), so the loop settles after at most one skip in practice; running off
 *    the end submits AT the moment it timed out.
 */
export function resumeOaSession(
  state: OaSessionState,
  nowTs: number,
): OaSessionState {
  if (state.status !== "running") return state;

  if (state.kind === "section") {
    if (isDeadlinePassed(state, nowTs)) {
      // The section clock kept running while away: complete exactly at deadline.
      return submitOaSession(state, state.deadlineTs as number, "expired");
    }
    return state;
  }

  if (state.kind === "sprint") {
    let next = state;
    while (
      next.status === "running" &&
      next.questionDeadlineTs != null &&
      nowTs >= next.questionDeadlineTs
    ) {
      const timedOutAt = next.questionDeadlineTs;
      const index = next.index;
      // The question timed out while away ⇒ skipped, full (per-question) budget spent.
      const spentMs = sprintBudgetMs(next, index);
      const answers = next.answers.map((a, i) =>
        i === index ? { ...a, elapsedMs: spentMs } : a,
      );
      const nextIndex = index + 1;
      if (nextIndex >= next.questions.length) {
        next = {
          ...next,
          answers,
          index: nextIndex,
          status: "submitted",
          completedAtTs: timedOutAt,
          questionDeadlineTs: undefined,
        };
        break;
      }
      next = {
        ...next,
        answers,
        index: nextIndex,
        // The newly-shown question wasn't visible while away ⇒ fresh clock.
        questionDeadlineTs: nowTs + sprintBudgetMs(next, nextIndex),
      };
    }
    return next;
  }

  // measured (no deadlines) — nothing to reconcile.
  return state;
}

/** The current question (`questions[index]`), or `undefined` if exhausted. */
export function currentQuestion(state: OaSessionState): OaQuestion | undefined {
  return state.questions[state.index];
}
