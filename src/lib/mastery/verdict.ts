import type { TopicMastery } from "@/types/mastery";
import { BETA_PRIOR_ALPHA, BETA_PRIOR_BETA, CAL_GAP_EPS, MASTERY_BAR } from "./config";
import { betaMeanCI } from "./beta";
import { topMisconceptions } from "./misconceptions";

/**
 * Derived, calibration-aware topic verdict (PHASE_1 §5). Three FIRST-CLASS
 * states — UNCERTAIN is never rounded away — combining the Beta credible
 * interval with the reliability gap:
 *
 *  - STRONG    ⇔ CI_low ≥ MASTERY_BAR AND relGap ≤ CAL_GAP_EPS.
 *  - WEAK      ⇔ CI_high < MASTERY_BAR OR overconfident (high mean but relGap
 *                exceeds the calibration threshold).
 *  - UNCERTAIN ⇔ otherwise (CI straddles the bar, or n = 0 ⇒ wide prior CI).
 *
 * `mastered` here is the TOPIC-level signal (CI_low ≥ bar) consumed by Phase 5 —
 * it is SEPARATE from `LevelProgress.mastered`, which stays the unlock gate
 * (COORDINATION §3.5 / §6.3). This verdict never feeds locking.ts.
 */
export type MasteryState = "STRONG" | "WEAK" | "UNCERTAIN";

export interface TopicVerdict {
  topicKey: string;
  state: MasteryState;
  mean: number;
  lo: number;
  hi: number; // Beta mean + 95% CI
  n: number;
  theta: number;
  reliabilityGap?: number; // from reliability.ts if computed
  namedMisconceptions: string[]; // keys with the highest decayed counts
  mastered: boolean; // lo ≥ MASTERY_BAR (topic-level, NOT the unlock gate)
  reviewDue?: string;
}

export function deriveVerdict(
  m: TopicMastery | undefined,
  topicKey: string,
  relGap?: number,
): TopicVerdict {
  const alpha = m?.alpha ?? BETA_PRIOR_ALPHA;
  const beta = m?.beta ?? BETA_PRIOR_BETA;
  const n = m?.n ?? 0;
  const theta = m?.theta ?? 0;
  const gap = relGap ?? 0;

  const { mean, lo, hi } = betaMeanCI(alpha, beta);
  const mastered = lo >= MASTERY_BAR;

  let state: MasteryState;
  if (n === 0) {
    // No graded evidence ⇒ the (1,1) prior CI is maximally wide.
    state = "UNCERTAIN";
  } else if (lo >= MASTERY_BAR && gap <= CAL_GAP_EPS) {
    state = "STRONG";
  } else if (hi < MASTERY_BAR || (gap > CAL_GAP_EPS && mean >= MASTERY_BAR)) {
    // Either provably below the bar, or overconfident: a high point estimate
    // that the reliability gap says is not trustworthy (below the diagonal).
    state = "WEAK";
  } else {
    state = "UNCERTAIN";
  }

  return {
    topicKey,
    state,
    mean,
    lo,
    hi,
    n,
    theta,
    reliabilityGap: relGap,
    namedMisconceptions: m ? topMisconceptions(m.misconceptions) : [],
    mastered,
    reviewDue: m?.reviewDue,
  };
}
