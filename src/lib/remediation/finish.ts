import { DIFFICULTY_META, type Difficulty } from "@/types/content";
import type { TopicMastery } from "@/types/mastery";
import { BOTTOM_OUT_MISSES } from "./config";
import {
  remediationStep,
  type RemediationAction,
  type RemediationInput,
} from "./policy";

/**
 * FINISH-TIME remediation trigger (pure decision) — PHASE_4 gap fix.
 *
 * Today remediation is ONLY an in-round, mid-lesson mechanism (it can descend
 * the prereq DAG when a learner hits ≥2 consecutive misses at a floor tier with
 * predicted intro success < 0.5). It does NOT fire when a learner simply FAILS a
 * whole level (finishes below `masteryThreshold`) and then navigates away — so a
 * bombed "Probability intro" would go un-remediated. This planner closes that
 * gap: on a WEAK/FAILED finish it decides whether to AUTO-LAUNCH a remediation
 * session (descend → probe → climb back) BEFORE the learner can leave.
 *
 * It is a thin, deterministic wrapper over the SAME tested {@link remediationStep}
 * cascade: a whole-level failure is treated as a genuine repeated-miss gap
 * signal (≥ {@link BOTTOM_OUT_MISSES}) at the ORIGIN node, but every other policy
 * safeguard still applies — the floor-tier / P(intro) < 0.5 gate, the slip
 * (fast+confident) override, and the depth cap. When the policy declines to
 * descend (mastered, not a DAG topic, a slip, or a within-node retry) the caller
 * degrades gracefully to the normal summary + retry rather than dead-ending.
 */
export interface FinishRemediationContext {
  /** The origin (just-finished) topic's Phase-1 topicKey. */
  topicKey: string;
  /** Round score fraction in [0,1] and the level's mastery bar. */
  scoreFraction: number;
  masteryThreshold: number;
  /** Current mastery for the origin topic (may be undefined for a fresh topic). */
  mastery: TopicMastery | undefined;
  /** The finished level's difficulty (drives the atFloorTier heuristic). */
  levelDifficulty: Difficulty;
  /** Wrong answers in the just-finished round (≥ 1 on a failed level). */
  missedCount: number;
  /** The misconception tag behind the learner's most recent miss this round. */
  misconceptionTag?: string;
  /** True if this topic was ALREADY remediated mid-lesson this round (no double-trigger). */
  alreadyRemediated: boolean;
  /** The remediation mode gate (`"dag"` = descend; `"in-place"` = disabled here). */
  mode: "dag" | "in-place";
  /**
   * Part B — the just-failed topic was only held at a diagnostic-seeded
   * LOW-CONFIDENCE unlock and this failure RE-LOCKED it. That is a confirmed
   * prerequisite gap, so bypass the Kapur first-stumble / bottom-out grace and
   * descend straight to the ~85% prerequisite probe (via `forceDescend`).
   * Additive: absent/false ⇒ the original conservative behavior is unchanged.
   */
  wasLowConfidenceUnlock?: boolean;
}

export type FinishRemediationPlan =
  | { kind: "remediate"; origin: RemediationInput; action: RemediationAction }
  | {
      kind: "none";
      reason:
        | "mastered"
        | "already"
        | "not-dag"
        | "slip"
        | "no-gap"
        | "cap"
        | "retry";
    };

/**
 * Decide whether a finished level should auto-launch remediation. Pure: no
 * clock, no network, no React — just the Phase-1 scalars + round counters.
 */
export function planFinishRemediation(
  ctx: FinishRemediationContext,
): FinishRemediationPlan {
  // Mastered ⇒ nothing to remediate (also the "passing does not launch" case).
  if (ctx.scoreFraction >= ctx.masteryThreshold) {
    return { kind: "none", reason: "mastered" };
  }
  // BACKUP in-place mode disables cross-topic descent entirely.
  if (ctx.mode !== "dag") return { kind: "none", reason: "not-dag" };
  // Don't double-trigger for a topic already remediated mid-lesson this round.
  if (ctx.alreadyRemediated) return { kind: "none", reason: "already" };

  const origin: RemediationInput = {
    topicKey: ctx.topicKey,
    theta: ctx.mastery?.theta ?? 0,
    alpha: ctx.mastery?.alpha ?? 1,
    beta: ctx.mastery?.beta ?? 1,
    n: ctx.mastery?.n ?? 0,
    // A whole-level failure is a genuine repeated-miss gap signal: treat it as
    // (at least) the bottom-out threshold so the policy evaluates a descent —
    // while still honoring the atFloorTier / P(intro) / slip safeguards below.
    consecutiveMisses: Math.max(ctx.missedCount, BOTTOM_OUT_MISSES),
    // Mirror the mid-lesson heuristic: an intro/easy level IS the floor tier.
    atFloorTier: DIFFICULTY_META[ctx.levelDifficulty].order <= 1,
    misconceptionTag: ctx.misconceptionTag,
    // Finishing a whole level below mastery is never a fast+confident slip.
    responseFast: false,
    depthThisSession: 0,
    // A relocked low-confidence unlock is a confirmed gap ⇒ force the descent
    // to the ~0.85 prerequisite (Part B); otherwise the normal gates apply.
    forceDescend: ctx.wasLowConfidenceUnlock === true,
  };

  const action = remediationStep(origin);
  if (
    action.kind === "descend" ||
    action.kind === "teach-link" ||
    action.kind === "floor-teach"
  ) {
    return { kind: "remediate", origin, action };
  }
  if (action.kind === "exit") return { kind: "none", reason: action.reason };
  // retry-in-place ⇒ degrade to a straightforward retry of the same topic.
  return { kind: "none", reason: "retry" };
}
