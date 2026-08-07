import { describe, expect, it } from "vitest";
import { prereqClosure, seedUnlockedLevelIds } from "./unlockGraph";
import { applyDiagnosticSeed } from "./mastery";
import { topicKeyOf } from "./topicKey";
import type { TopicMastery } from "@/types/mastery";

const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const CORE_PROB = topicKeyOf("probability", "Core Probability");
const COMBINATORICS = topicKeyOf("probability", "Combinatorial Analysis");
const MENTAL = topicKeyOf("mental-math");
const MARKOV = topicKeyOf("probability", "Markov Chains");

describe("prereqClosure (KST prerequisites from the skill graph)", () => {
  it("walks the transitive prerequisites of a topic", () => {
    const closure = prereqClosure(CONDITIONAL);
    // Direct prereqs of Conditional Probability.
    expect(closure.has(CORE_PROB)).toBe(true);
    expect(closure.has(COMBINATORICS)).toBe(true);
    // Transitive: Core Probability / Combinatorics rest on Mental Arithmetic.
    expect(closure.has(MENTAL)).toBe(true);
    // Never includes the topic itself.
    expect(closure.has(CONDITIONAL)).toBe(false);
  });

  it("prunes out-of-scope prereqs (stays 'within that path')", () => {
    const courseOnly = (k: string) => k !== MENTAL; // foundations out of scope
    const closure = prereqClosure(CONDITIONAL, courseOnly);
    expect(closure.has(CORE_PROB)).toBe(true);
    expect(closure.has(COMBINATORICS)).toBe(true);
    expect(closure.has(MENTAL)).toBe(false);
  });

  it("returns empty for a graph floor with no prerequisites", () => {
    expect(prereqClosure(MENTAL).size).toBe(0);
  });
});

describe("seedUnlockedLevelIds (level ids whose topic is low-confidence unlocked)", () => {
  const levels = [
    { id: "cp-1", section: "Conditional Probability" },
    { id: "cp-2", section: "Conditional Probability" },
    { id: "mc-1", section: "Markov Chains" },
  ];

  it("includes every level of an unlocked topic and excludes others", () => {
    const unlocked: TopicMastery = applyDiagnosticSeed(undefined, {
      successes: 2,
      failures: 0,
    });
    const map: Record<string, TopicMastery> = { [CONDITIONAL]: unlocked };
    const set = seedUnlockedLevelIds(levels, "probability", (k) => map[k]);
    expect(set.has("cp-1")).toBe(true);
    expect(set.has("cp-2")).toBe(true);
    expect(set.has("mc-1")).toBe(false); // Markov not seeded
  });

  it("excludes a topic seeded below the unlock bar", () => {
    const weak = applyDiagnosticSeed(undefined, { successes: 1, failures: 1 });
    const map: Record<string, TopicMastery> = { [MARKOV]: weak };
    const set = seedUnlockedLevelIds(levels, "probability", (k) => map[k]);
    expect(set.has("mc-1")).toBe(false);
  });
});
