import { describe, expect, it } from "vitest";
import {
  computeRoadmap,
  isSkillMastered,
  skillReadinessContribution,
  skillReadinessFraction,
  type SkillEvidence,
} from "./readiness";
import { SKILL_GRAPH, skillByKey } from "./skillGraph";
import { MASTERY_BAR } from "@/lib/mastery/config";

/** A zero-evidence skill (fresh learner). */
function empty(topicKey: string): SkillEvidence {
  return {
    topicKey,
    ciLow: 0,
    mean: 0,
    gradedCount: 0,
    theta: 0,
    levelsMastered: 0,
    levelsTotal: 3,
  };
}

/** A confidently-mastered skill (ciLow at/above the bar). */
function mastered(topicKey: string): SkillEvidence {
  return {
    topicKey,
    ciLow: 0.9,
    mean: 0.95,
    gradedCount: 20,
    theta: 1.5,
    levelsMastered: 3,
    levelsTotal: 3,
  };
}

describe("skillReadinessFraction / isSkillMastered", () => {
  it("is 0 for no evidence and clamps to 1 at the mastery bar", () => {
    expect(skillReadinessFraction(empty("k"))).toBe(0);
    expect(skillReadinessFraction(mastered("k"))).toBe(1);
  });

  it("uses ciLow scaled by the mastery bar", () => {
    const half: SkillEvidence = { ...empty("k"), ciLow: MASTERY_BAR / 2, levelsTotal: 0 };
    expect(skillReadinessFraction(half)).toBeCloseTo(0.5, 5);
  });

  it("falls back to level completion when there is no graded evidence", () => {
    // Flashcard topic: no graded items, but all levels mastered ⇒ mastered.
    const bt: SkillEvidence = {
      topicKey: "brainteasers::Core Puzzles",
      ciLow: 0,
      mean: 0,
      gradedCount: 0,
      theta: 0,
      levelsMastered: 3,
      levelsTotal: 3,
    };
    expect(isSkillMastered(bt)).toBe(true);
    expect(skillReadinessFraction(bt)).toBe(1);
  });

  it("counts as mastered on high ciLow even if not all levels done", () => {
    const e: SkillEvidence = { ...mastered("k"), levelsMastered: 1, levelsTotal: 5 };
    expect(isSkillMastered(e)).toBe(true);
  });
});

describe("computeRoadmap", () => {
  it("is all-locked/available with zero readiness for a fresh learner", () => {
    const state = computeRoadmap((k) => empty(k));
    expect(state.overallReadiness).toBe(0);
    expect(state.masteredCount).toBe(0);
    expect(state.remainingCount).toBe(SKILL_GRAPH.length);
    expect(state.complete).toBe(false);
    // Tier-0 skills (no prereqs) are AVAILABLE; deeper ones are LOCKED.
    const mental = state.skills.find((s) => s.topicKey === SKILL_GRAPH[0].topicKey)!;
    expect(mental.status).toBe("available");
    const locked = state.skills.filter((s) => s.status === "locked");
    expect(locked.length).toBeGreaterThan(0);
  });

  it("reaches 100% and complete when every skill is mastered", () => {
    const state = computeRoadmap((k) => mastered(k));
    expect(state.overallReadiness).toBe(100);
    expect(state.masteredCount).toBe(SKILL_GRAPH.length);
    expect(state.complete).toBe(true);
    expect(state.currentSkillKey).toBeUndefined();
  });

  it("points 'where you are' at the first non-mastered, prereqs-met skill", () => {
    // Master only the first Tier-0 skill; its dependents unlock.
    const done = new Set([SKILL_GRAPH[0].topicKey]);
    const state = computeRoadmap((k) => (done.has(k) ? mastered(k) : empty(k)));
    expect(state.currentSkillKey).toBeDefined();
    const cur = state.skills.find((s) => s.topicKey === state.currentSkillKey)!;
    expect(cur.mastered).toBe(false);
    expect(cur.prereqsMet).toBe(true);
  });

  it("unlocks a dependent once its prereqs are mastered", () => {
    const combinatorics = skillByKey("probability::Combinatorial Analysis")!;
    // Combinatorics requires mental-math; master that only.
    const done = new Set(combinatorics.prereqs);
    const state = computeRoadmap((k) => (done.has(k) ? mastered(k) : empty(k)));
    const combo = state.skills.find((s) => s.topicKey === combinatorics.topicKey)!;
    expect(combo.prereqsMet).toBe(true);
    expect(combo.status).toBe("available");
  });

  it("keeps a skill LOCKED and lists its missing prereqs", () => {
    const conditional = skillByKey("probability::Conditional Probability")!;
    const state = computeRoadmap((k) => empty(k));
    const cond = state.skills.find((s) => s.topicKey === conditional.topicKey)!;
    expect(cond.status).toBe("locked");
    expect(cond.missingPrereqs.sort()).toEqual([...conditional.prereqs].sort());
  });

  it("reports partial readiness between 0 and 100", () => {
    const done = new Set([SKILL_GRAPH[0].topicKey, SKILL_GRAPH[1].topicKey]);
    const state = computeRoadmap((k) => (done.has(k) ? mastered(k) : empty(k)));
    expect(state.overallReadiness).toBeGreaterThan(0);
    expect(state.overallReadiness).toBeLessThan(100);
    expect(state.masteredCount).toBe(2);
  });

  it("is CONSERVATIVE: post-diagnostic partial progress reads only single digits", () => {
    // Simulate a fresh diagnostic result: every topic has some low-confidence
    // evidence (ciLow well below the bar) but NOTHING is confidently mastered.
    const seeded = (k: string): SkillEvidence => ({
      ...empty(k),
      ciLow: MASTERY_BAR * 0.5, // ~half-way to the bar on every topic
      mean: 0.7,
      gradedCount: 4,
      levelsMastered: 0,
    });
    const state = computeRoadmap((k) => seeded(k));
    expect(state.masteredCount).toBe(0);
    // A linear average would read ~50%; the convex discount keeps it in single digits.
    expect(state.overallReadiness).toBeGreaterThan(0);
    expect(state.overallReadiness).toBeLessThanOrEqual(12);
  });
});

describe("skillReadinessContribution", () => {
  it("gives full credit at mastery and heavily discounts partial progress", () => {
    expect(skillReadinessContribution(mastered("k"))).toBeCloseTo(1, 5);
    expect(skillReadinessContribution(empty("k"))).toBe(0);
    const half: SkillEvidence = { ...empty("k"), ciLow: MASTERY_BAR / 2, levelsTotal: 0 };
    // fraction 0.5 -> contribution must be far below 0.5 (convex discount).
    expect(skillReadinessContribution(half)).toBeLessThan(0.15);
  });
});
