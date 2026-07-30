import { describe, expect, it } from "vitest";
import type { TopicMastery } from "@/types/mastery";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  CONDITIONAL,
  COUNTING,
  L1_MEANING,
} from "@/content/remediation/prereqDAG";
import { planFinishRemediation, type FinishRemediationContext } from "./finish";

/** A weak (bottomed-out) learner: θ=-2 ⇒ P(intro) = σ(-2+1.5) = 0.378 < 0.5. */
function weakMastery(over: Partial<TopicMastery> = {}): TopicMastery {
  return {
    theta: -2,
    n: 4,
    alpha: 1,
    beta: 3,
    lastSeen: "2020-01-01T00:00:00.000Z",
    misconceptions: {},
    ...over,
  };
}

/** A failed finish on an EASY (floor-tier) DAG topic by a weak learner. */
function failedEasy(over: Partial<FinishRemediationContext> = {}): FinishRemediationContext {
  return {
    topicKey: CONDITIONAL,
    scoreFraction: 0.4,
    masteryThreshold: 0.8,
    mastery: weakMastery(),
    levelDifficulty: "easy",
    missedCount: 3,
    misconceptionTag: undefined,
    alreadyRemediated: false,
    mode: "dag",
    ...over,
  };
}

describe("planFinishRemediation — finish-time trigger", () => {
  it("a PASSING finish never launches remediation", () => {
    const plan = planFinishRemediation(failedEasy({ scoreFraction: 0.8 }));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("mastered");
  });

  it("a WEAK finish on a floor-tier DAG topic launches a descent", () => {
    const plan = planFinishRemediation(
      failedEasy({ misconceptionTag: MISCONCEPTION.reversedConditional }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate") {
      expect(plan.action.kind).toBe("descend");
      // The implicated misconception picks the descent edge (→ L1 meaning).
      if (plan.action.kind === "descend") {
        expect(plan.action.toTopicKey).toBe(L1_MEANING);
      }
    }
  });

  it("the misconception steers the descent edge (counting gap → Counting)", () => {
    const plan = planFinishRemediation(
      failedEasy({ misconceptionTag: MISCONCEPTION.orderedVsUnordered }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(COUNTING);
    }
  });

  it("does NOT double-trigger a topic already remediated mid-lesson this round", () => {
    const plan = planFinishRemediation(failedEasy({ alreadyRemediated: true }));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("already");
  });

  it("the BACKUP in-place mode disables the finish-time descent entirely", () => {
    const plan = planFinishRemediation(failedEasy({ mode: "in-place" }));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("not-dag");
  });

  it("graceful degrade: a failed topic NOT in the DAG offers no descent (retry via summary)", () => {
    const plan = planFinishRemediation(
      failedEasy({ topicKey: "betting-sizing::_core" }),
    );
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("no-gap");
  });

  it("graceful degrade: a foundation (floor) topic TEACHES rather than dead-ending", () => {
    // L1_MEANING is a floor node — there is nowhere to descend, so a weak finish
    // teaches the foundation directly instead of trapping the learner.
    const plan = planFinishRemediation(
      failedEasy({ topicKey: L1_MEANING, levelDifficulty: "easy" }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate") expect(plan.action.kind).toBe("floor-teach");
  });

  it("graceful degrade: a strong learner (P(intro) ≥ 0.5) gets a straightforward retry", () => {
    // θ=0 ⇒ P(intro) = σ(1.5) = 0.82 ≥ 0.5 ⇒ not bottomed ⇒ retry-in-place.
    const plan = planFinishRemediation(
      failedEasy({ mastery: weakMastery({ theta: 0 }) }),
    );
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("retry");
  });

  it("graceful degrade: a NON-floor-tier level eases in place rather than descending", () => {
    // A medium level is not the floor tier, so the policy keeps easing in place
    // (Elo lowers the within-topic tier first) rather than jumping the DAG.
    const plan = planFinishRemediation(failedEasy({ levelDifficulty: "medium" }));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("retry");
  });
});
