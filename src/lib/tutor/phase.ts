/**
 * Tutor-phase selector — the adaptive worked-example → faded → independent
 * ladder that REPLACES the passive prologue (PHASE_2 §4/§5).
 *
 * Research anchors (cite in the module, per PHASE_2 §1):
 *  - Sweller & Cooper 1985: the worked-example effect — novices learn more from
 *    studying full solutions than from unsupported problem solving.
 *  - Kalyuga, Chandler, Tuovinen & Sweller 2001: the EXPERTISE-REVERSAL effect —
 *    worked examples (and a passive prologue) are *harmful* for stronger
 *    learners, so scaffolding must FADE as skill (θ) rises.
 *  - Renkl & Atkinson 2003: faded/completion problems are the transition
 *    mechanism between studying and solving.
 *
 * This operationalises adaptive fading: low/new/regressing learners get the
 * worked example; rising learners get faded completion; near/above-band learners
 * go straight to independent practice. All thresholds are on Phase-1's topic θ
 * (logit scale) so the selector is a pure function of mastery state + session
 * history — no LLM, fully deterministic.
 */

export type TutorPhase = "worked" | "faded" | "independent";

/** θ ≤ this (or n < 2, or ≥ 2 recent failures) ⇒ worked example. */
export const WORKED_THETA_MAX = -0.5;
/** θ ≥ this ⇒ independent practice; between the two bounds ⇒ faded. */
export const INDEPENDENT_THETA_MIN = 0.5;
/** Consecutive misses this session that force a re-scaffold back to `worked`. */
export const REFAIL_RESCAFFOLD = 2;
/** Below this many attempts in the topic the learner is treated as new. */
export const WORKED_MIN_N = 2;

/**
 * Pick the tutor phase for a topic from Phase-1 θ + this session's history.
 *
 * - `worked` if θ ≤ {@link WORKED_THETA_MAX}, OR the topic is essentially new
 *   (`n <` {@link WORKED_MIN_N}), OR the learner just missed
 *   {@link REFAIL_RESCAFFOLD}+ in a row (regression ⇒ re-scaffold, per Kalyuga).
 * - `independent` if θ ≥ {@link INDEPENDENT_THETA_MIN}.
 * - `faded` otherwise (the rising middle band).
 *
 * The re-scaffold and new-learner rules take precedence over θ so a strong
 * learner who starts slipping is caught immediately.
 */
export function selectTutorPhase(args: {
  /** Phase-1 topic θ (0 if the topic is unseen). */
  theta: number;
  /** Items answered in this topic (drives new-learner detection). */
  n: number;
  /** Consecutive misses this session (drives regression re-scaffolding). */
  recentFailures: number;
}): TutorPhase {
  const { theta, n, recentFailures } = args;
  // Re-scaffold on regression / cold-start regardless of θ (Kalyuga fading).
  if (n < WORKED_MIN_N || recentFailures >= REFAIL_RESCAFFOLD) return "worked";
  if (theta <= WORKED_THETA_MAX) return "worked";
  if (theta >= INDEPENDENT_THETA_MIN) return "independent";
  return "faded";
}
