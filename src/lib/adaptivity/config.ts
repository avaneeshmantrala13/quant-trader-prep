import { P_TARGET } from "@/lib/mastery/config";

/**
 * Adaptivity (next-question policy) constants — PHASE_5 §5.
 *
 * Research anchors (RESEARCH_ASSESSMENT_ADAPTIVITY.md):
 *  - ZPDES learning-progress topic selection within the unlock graph:
 *    Clément, Roy, Oudeyer & Lopes 2015.
 *  - 85% Rule optimal-difficulty band (tier ≈ P_TARGET): Wilson et al. 2019.
 *  - SM-2 spaced repetition ladder: SuperMemo (Woźniak).
 *
 * These weights/ε live here (not baked into the algorithm) so the policy is a
 * pure function of explicit config + snapshot, keeping `zpdes.test.ts`
 * deterministic. `P_TARGET` (0.80) is CONSUMED from Phase 1's mastery config —
 * a single source of truth, never forked.
 */

/** ZPDES priority weights: below-target gap, CI-width, learning-progress, reviewDue. */
export const ZPDES_W = {
  belowTarget: 1.0,
  uncertainty: 0.5,
  learningProgress: 0.5,
  reviewDue: 2.0,
} as const;

/** Exploration floor: neighbor-tier jitter / occasional random topic (a-stratification analogue). */
export const ZPDES_EPS = 0.15;

/** Learning-progress smoothing: wₐ ← β·wₐ + η·r (r = recent − older success rate). */
export const LP_BETA = 0.8;
export const LP_ETA = 0.2;

/**
 * SM-2 spaced-review interval ladder in DAYS (0-based index = TopicMastery.reviewStep).
 *
 * OWNERSHIP NOTE (PHASE_5 §5): Phase 4 is the SINGLE OWNER of `scheduleReview` /
 * `REVIEW_INTERVALS_DAYS`. Now that Phase 4 is merged, the previously-inlined
 * ladder has been DELETED and this simply re-exports the canonical constant from
 * `src/lib/remediation/climbBack.ts` so there is one source of truth (identical
 * `[1,3,7,16,35]`); `src/lib/adaptivity/review.ts` likewise imports the canonical
 * `scheduleReview` rather than re-implementing the SM-2 fold.
 */
export { REVIEW_INTERVALS_DAYS } from "@/lib/remediation/climbBack";

export { P_TARGET };
