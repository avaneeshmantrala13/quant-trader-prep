import { describe, expect, it } from "vitest";
import type { TopicMastery } from "@/types/mastery";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import {
  ARBITRAGE,
  AUCTIONS,
  BETTING,
  CONDITIONAL,
  CONDITIONAL_EXPECTATION,
  COUNTING,
  EXPECTED_VALUE,
  GEOMETRIC,
  L1_MEANING,
  MARKOV,
  NUMBER_THEORY,
  ORDER_STATS,
  SEQUENCES,
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

  it("a newly-covered scored topic (Betting & Sizing) now launches a descent (was previously no-gap)", () => {
    // Before the DAG expansion, Betting & Sizing had no node ⇒ finishing it
    // weak returned reason "no-gap". It now descends to its EV prerequisite.
    const plan = planFinishRemediation(failedEasy({ topicKey: BETTING }));
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(EXPECTED_VALUE);
    }
  });

  it("a newly-covered scored topic (Geometric Probability) descends to Core Probability", () => {
    const plan = planFinishRemediation(failedEasy({ topicKey: GEOMETRIC }));
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(L1_MEANING);
    }
  });

  it("graceful degrade: a flashcard-only Brainteaser topic offers no descent (intentionally out of scope)", () => {
    // The self-assessed Brainteaser tracks have no scored attempt to remediate,
    // so they are deliberately absent from the DAG ⇒ reason "no-gap".
    const plan = planFinishRemediation(
      failedEasy({ topicKey: topicKeyOf("brainteasers", "Core Puzzles") }),
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
    // Conditional Probability HAS an easy level, so a medium finish is NOT its
    // floor tier: the policy keeps easing in place (Elo lowers the within-topic
    // tier first) rather than jumping the DAG.
    const plan = planFinishRemediation(failedEasy({ levelDifficulty: "medium" }));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toBe("retry");
  });
});

describe("planFinishRemediation — medium-only topics now descend (defect D1)", () => {
  it("Conditional Expectation (no intro/easy level) DESCENDS on a weak medium finish", () => {
    // Its easiest authored tier IS medium, so finishing medium weak is at-floor:
    // previously `atFloorTier = order<=1` was never true here ⇒ stuck on retry.
    const plan = planFinishRemediation(
      failedEasy({ topicKey: CONDITIONAL_EXPECTATION, levelDifficulty: "medium" }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      // No misconception, no mastery snapshot ⇒ first-listed prereq (Cond. Prob).
      expect(plan.action.toTopicKey).toBe(CONDITIONAL);
    } else {
      throw new Error(`expected a descend, got ${plan.kind}`);
    }
  });

  it("a hard-only topic still descends when finished weak at its hard floor", () => {
    // Order Statistics is medium-only in the shipped content; a medium finish is
    // its floor tier, so a weak learner descends to Expected Value.
    const plan = planFinishRemediation(
      failedEasy({ topicKey: ORDER_STATS, levelDifficulty: "medium" }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(EXPECTED_VALUE);
    }
  });
});

describe("planFinishRemediation — weakest / stated prereq (defect D3)", () => {
  it("descent targets the learner's WEAKEST prereq, not prereqs[0]", () => {
    // Markov's prereqs are [Conditional Prob, Expected Value, Conditional Exp];
    // prereqs[0] is Conditional Probability. With a mastery snapshot where
    // Conditional EXPECTATION is weakest, the descent must pick it instead.
    const masteryOf = (k: string) =>
      k === CONDITIONAL_EXPECTATION
        ? { mean: 0.2, theta: -1.5 }
        : { mean: 0.85, theta: 1.2 };
    const plan = planFinishRemediation(
      failedEasy({ topicKey: MARKOV, levelDifficulty: "easy", masteryOf }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(CONDITIONAL_EXPECTATION);
    } else {
      throw new Error(`expected a descend, got ${plan.kind}`);
    }
  });
});

describe("planFinishRemediation — external drill/game topics now route (audit Z1)", () => {
  it("a bombed Auctions round descends to a real prereq instead of exiting no-gap", () => {
    // Auctions is an external routing stub (no in-topic tier ladder), so any
    // repeated miss is at-floor and descends. Default target is Conditional Prob.
    const plan = planFinishRemediation(
      failedEasy({ topicKey: AUCTIONS, levelDifficulty: "hard" }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(CONDITIONAL);
    } else {
      throw new Error(`expected a descend, got ${plan.kind}`);
    }
  });

  it("the winner's-curse 'shade with n' tag routes Auctions to Order Statistics", () => {
    const plan = planFinishRemediation(
      failedEasy({
        topicKey: AUCTIONS,
        levelDifficulty: "hard",
        misconceptionTag: "no_shading_for_n",
      }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(ORDER_STATS);
    }
  });

  it("a bombed No-Arbitrage round routes an odds-reading slip to Core Probability", () => {
    const plan = planFinishRemediation(
      failedEasy({
        topicKey: ARBITRAGE,
        levelDifficulty: "medium",
        misconceptionTag: "complement_prob",
      }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(L1_MEANING);
    }
  });

  it("a bombed Sequences round descends to Number Theory & Counting", () => {
    const plan = planFinishRemediation(
      failedEasy({ topicKey: SEQUENCES, levelDifficulty: "medium" }),
    );
    expect(plan.kind).toBe("remediate");
    if (plan.kind === "remediate" && plan.action.kind === "descend") {
      expect(plan.action.toTopicKey).toBe(NUMBER_THEORY);
    }
  });
});
