import { describe, expect, it } from "vitest";
import { didRelock, planRelockRemediation } from "./relock";
import { planFinishRemediation } from "./finish";
import { probeTierFor } from "./policy";
import { PROBE_P } from "./config";
import { predictSuccess, seedTierDifficulty } from "@/lib/mastery/elo";
import { applyDiagnosticSeed, applyItemAttempt } from "@/lib/mastery/mastery";
import { isTopicUnlocked } from "@/lib/mastery/unlock";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { prereqNode } from "@/content/remediation/prereqDAG";
import type { ItemAttempt } from "@/types/mastery";

const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const MENTAL = topicKeyOf("mental-math"); // a DAG floor with no prereqs

function fail(topicKey: string): ItemAttempt {
  return {
    topicKey,
    tier: "medium",
    correct: false,
    mode: "quiz",
    kOptions: 4,
    at: "2026-02-01T00:00:00.000Z",
  };
}

describe("didRelock", () => {
  it("is true only for an unlocked→relocked transition", () => {
    const unlocked = applyDiagnosticSeed(undefined, { successes: 2, failures: 0 });
    const relocked = applyItemAttempt(unlocked, undefined, fail(CONDITIONAL), 0).mastery;
    expect(isTopicUnlocked(unlocked)).toBe(true);
    expect(isTopicUnlocked(relocked)).toBe(false);
    expect(didRelock(unlocked, relocked)).toBe(true);

    // Earned mastery does not relock on one miss.
    const earned = applyDiagnosticSeed(undefined, { successes: 17, failures: 0 });
    const earnedAfter = applyItemAttempt(earned, undefined, fail(CONDITIONAL), 0).mastery;
    expect(didRelock(earned, earnedAfter)).toBe(false);
  });
});

describe("planRelockRemediation routes to the ~85% ZPD prerequisite", () => {
  it("descends to a prerequisite at the PROBE_P (~0.85) tier", () => {
    const unlocked = applyDiagnosticSeed(undefined, {
      successes: 2,
      failures: 0,
      thetaSeed: 0.5,
    });
    const relocked = applyItemAttempt(unlocked, undefined, fail(CONDITIONAL), 0).mastery;

    const action = planRelockRemediation({
      topicKey: CONDITIONAL,
      mastery: relocked,
    });

    expect(action.kind).toBe("descend");
    if (action.kind !== "descend") return;

    const prereqs = prereqNode(CONDITIONAL)!.prereqs;
    expect(prereqs).toContain(action.toTopicKey);

    // The probe tier is the ~0.85-predicted-success tier for the chosen prereq.
    expect(action.probeTier).toBe(
      probeTierFor(relocked.theta, action.toTopicKey, {}),
    );
    const pAtProbe = predictSuccess(
      relocked.theta,
      seedTierDifficulty(action.probeTier),
    );
    // Closest achievable tier to the Wilson 0.85 band.
    expect(Math.abs(pAtProbe - PROBE_P)).toBeLessThan(0.35);
  });

  it("exits (no-gap) when the relocked topic has no prerequisite", () => {
    const action = planRelockRemediation({ topicKey: MENTAL, mastery: undefined });
    expect(action).toEqual({ kind: "exit", reason: "no-gap" });
  });
});

describe("finish-time trigger forces the prereq descent on a low-confidence relock", () => {
  const base = {
    topicKey: CONDITIONAL,
    scoreFraction: 0.4, // failed the level
    masteryThreshold: 0.8,
    // A strong learner (high θ) who would normally get Kapur "retry-in-place":
    mastery: { theta: 1.2, n: 3, alpha: 3, beta: 2, lastSeen: "", misconceptions: {} },
    levelDifficulty: "medium" as const,
    missedCount: 2,
    alreadyRemediated: false,
    mode: "dag" as const,
  };

  it("without the flag: a non-bottomed miss does NOT descend (unchanged behavior)", () => {
    const plan = planFinishRemediation(base);
    expect(plan.kind).toBe("none");
  });

  it("with wasLowConfidenceUnlock: descends straight to the prerequisite", () => {
    const plan = planFinishRemediation({ ...base, wasLowConfidenceUnlock: true });
    expect(plan.kind).toBe("remediate");
    if (plan.kind !== "remediate") return;
    expect(plan.action.kind).toBe("descend");
    if (plan.action.kind !== "descend") return;
    expect(prereqNode(CONDITIONAL)!.prereqs).toContain(plan.action.toTopicKey);
  });
});
