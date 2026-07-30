/**
 * Partial-credit schedule for the free-response, hint-attempt flow (PHASE_1).
 *
 * On a WRONG free-response answer the app does NOT reveal the solution: it
 * discloses the 5-rung hint ladder ONE rung at a time and lets the learner
 * RE-ATTEMPT the same instance after each rung. The credit a correct answer
 * earns decays with the HIGHEST rung the learner needed before getting it right;
 * a first-try correct earns full credit and a still-wrong-after-rung-5 earns 0.
 *
 * This fractional credit feeds the mastery engine directly (Elo score S ∈ [0,1];
 * Beta fractional pseudo-counts) — see `src/lib/mastery/mastery.ts`.
 *
 * ── Research grounding (Nessie brainlift "Adaptive Learning Engine…", DOK 1/2) ──
 * The shape of the schedule tracks HOW MUCH of the answer/solution was handed
 * over — the KR < KCR < EF feedback hierarchy and the answer-withholding stance:
 *   • Van der Kleij, Feskens & Eggen (2015) + Shute (2008) [C2.2]: elaborated,
 *     answer-WITHHOLDING feedback (EF, d≈0.49) ≫ giving the correct answer
 *     (KCR, d≈0.32) ≫ bare right/wrong (KR, d≈0.05). Rungs 1–2 are EF that
 *     withhold the answer → high credit; rungs 3–5 progressively reveal the
 *     method/answer (KCR-ward) → the "solution-revealed" credit cliff at rung 3.
 *   • Kapur (2008; 2014) productive failure [C1.2]: a first miss + a single
 *     misconception nudge that the learner self-corrects from is a PRODUCTIVE
 *     recovery, close to independent solving → rung-1 credit stays high (0.65).
 *   • VanLehn (2011) [C2.2]: step-based guidance is real learning (d≈0.76), so
 *     early-rung recoveries keep meaningful (not near-zero) credit.
 *   • Corbett & Anderson BKT guess P(G) [C3.1]: a correct answer AFTER the exact
 *     problem has been solved end-to-end (rung 5) is near-guess-level evidence of
 *     knowledge → floor credit (0.04), "almost nothing" as the user asked.
 *   • Shute's "do not always immediately reveal the answer" + help-abuse framing
 *     (user cited Aleven & Koedinger gaming-the-system; note that this brainlift
 *     grounds the help penalty in Shute + Van der Kleij rather than a dedicated
 *     Aleven/Koedinger DOK entry) → withholding + decaying credit disincentivises
 *     hint-mining while still rewarding genuine guided recovery.
 *
 * ── Reconciliation with the user's starting proposal ──
 * User: 100 / 60 / 50 / 20 / 10 / 5 / 0.  FINAL (calibrated): 100 / 65 / 45 /
 * 20 / 10 / 4 / 0.  Deltas & why:
 *   • Rung 1 60→65: EF is the single highest-value feedback type and the answer
 *     is fully withheld — a self-correction from one leading question is close to
 *     productive-failure independent recovery (Kapur), so it deserves a touch
 *     more; still well below 100 to preserve the no-help signal and discourage
 *     help-mining.
 *   • Rung 2 50→45: widen the rung-1↔2 gap so fewer hints is more clearly
 *     rewarded; rung 2 hands over a concrete worked mini-example (more scaffolding
 *     than rung 1's single nudge), so its evidence of INDEPENDENT mastery is
 *     lower. Rungs 1–2 (answer-withheld EF) still sit clearly above the rung-3
 *     "method revealed" cliff.
 *   • Rung 3 kept at 20: the deliberate cliff — a full worked method (albeit with
 *     different numbers) is shown, crossing EF→KCR territory.
 *   • Rung 4 kept at 10: sim deep-link (elicit-then-confront) — heavy scaffolding.
 *   • Rung 5 5→4: the exact problem is solved end-to-end ⇒ answer effectively
 *     revealed; a subsequent correct is near-guess evidence (BKT P(G)). A tiny
 *     non-zero floor acknowledges engagement without materially moving mastery.
 */

/** The highest hint rung a learner reached before answering correctly. */
export type HintRungReached = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * credit[k] = partial credit ∈ [0,1] for a CORRECT answer whose highest rung
 * reached was `k` (0 = no hint used / first-try correct). Monotone decreasing.
 */
export const RUNG_CREDIT: Record<HintRungReached, number> = {
  0: 1.0, // no hint — first-try correct
  1: 0.65, // corrected after the misconception-coaching sentence (answer withheld)
  2: 0.45, // corrected after guided intuition / worked mini-example (answer withheld)
  3: 0.2, // corrected after a diff-numbers worked walkthrough (method revealed) — the cliff
  4: 0.1, // corrected after opening the exact simulation (elicit-then-confront)
  5: 0.04, // corrected after the exact problem was solved end-to-end (≈ shown the answer)
} as const;

/** Credit earned for a WRONG answer after all 5 rungs were exhausted. */
export const WRONG_AFTER_ALL_RUNGS_CREDIT = 0;

/** Credit for a first-try correct answer (no hint used). */
export const NO_HINT_CREDIT = RUNG_CREDIT[0];

/**
 * The partial credit ∈ [0,1] a resolved hint episode earns.
 *
 * @param correct  did the learner EVENTUALLY answer correctly?
 * @param highestRung  the highest rung reached before that correct answer
 *   (0 = answered correctly with no hint). Ignored when `correct` is false.
 */
export function creditForEpisode(
  correct: boolean,
  highestRung: HintRungReached,
): number {
  if (!correct) return WRONG_AFTER_ALL_RUNGS_CREDIT;
  return RUNG_CREDIT[highestRung];
}
