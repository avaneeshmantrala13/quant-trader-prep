import { describe, expect, it } from "vitest";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  prereqClosure,
  suggestPrereqsToStrengthen,
  STRENGTHEN_MIN,
  STRENGTHEN_MAX,
  type PrereqMasterySnapshot,
} from "./suggestPrereqs";

const MARKOV = topicKeyOf("probability", "Markov Chains");
const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const CONDITIONAL_EXPECTATION = topicKeyOf("probability", "Conditional Expectation");
const L1 = topicKeyOf("probability", "Core Probability");
const COUNTING = topicKeyOf("probability", "Combinatorial Analysis");
const MENTAL = topicKeyOf("mental-math");

describe("prereqClosure", () => {
  it("returns the transitive prerequisite closure with minimum edge depths", () => {
    const closure = prereqClosure(MARKOV);
    // Direct prereqs are depth 1.
    expect(closure.get(CONDITIONAL)).toBe(1);
    expect(closure.get(EXPECTED_VALUE)).toBe(1);
    expect(closure.get(CONDITIONAL_EXPECTATION)).toBe(1);
    // Their prereqs are depth 2.
    expect(closure.get(L1)).toBe(2);
    expect(closure.get(COUNTING)).toBe(2);
    // The arithmetic floor is reached at depth 3.
    expect(closure.get(MENTAL)).toBe(3);
    // The origin itself is never in its own closure.
    expect(closure.has(MARKOV)).toBe(false);
  });

  it("is empty for a topic that is not in the DAG", () => {
    expect(prereqClosure("nope::nope").size).toBe(0);
  });
});

/** A masteryOf stub with a strong-but-imperfect EV, perfect conditioning, weak CE. */
function masteryStub(overrides: Record<string, PrereqMasterySnapshot>) {
  return (k: string): PrereqMasterySnapshot | undefined => overrides[k];
}

describe("suggestPrereqsToStrengthen (~0.85 relevant prereqs)", () => {
  const base: Record<string, PrereqMasterySnapshot> = {
    [EXPECTED_VALUE]: { mean: 0.85, n: 10 }, // in band, depth 1
    [CONDITIONAL]: { mean: 0.99, n: 10 }, // effectively mastered ⇒ excluded
    [CONDITIONAL_EXPECTATION]: { mean: 0.6, n: 10 }, // too weak ⇒ excluded (descend path)
    [L1]: { mean: 0.8, n: 10 }, // in band, depth 2
    // COUNTING: no evidence ⇒ excluded
  };

  it("picks the ~0.85, most-relevant prereqs and excludes mastered / too-weak / unseen ones", () => {
    const out = suggestPrereqsToStrengthen({
      failedTopicKey: MARKOV,
      masteryOf: masteryStub(base),
    });
    const keys = out.map((s) => s.topicKey);
    // EV (0.85, depth 1) and Core Probability (0.80, depth 2) are the in-band picks.
    expect(keys).toEqual([EXPECTED_VALUE, L1]);
    // The perfect (0.99) and weak (0.60) and unseen prereqs are all excluded.
    expect(keys).not.toContain(CONDITIONAL);
    expect(keys).not.toContain(CONDITIONAL_EXPECTATION);
    expect(keys).not.toContain(COUNTING);
    // Every pick is genuinely in the strengthen band.
    for (const s of out) {
      expect(s.mean).toBeGreaterThanOrEqual(STRENGTHEN_MIN);
      expect(s.mean).toBeLessThanOrEqual(STRENGTHEN_MAX);
    }
  });

  it("prefers the misconception-linked prereq first, even over a closer prereq", () => {
    // reversed_conditional ⇒ Core Probability (L1). It sits at depth 2 but must
    // still rank ABOVE the depth-1 Expected Value because it is the implicated gap.
    const out = suggestPrereqsToStrengthen({
      failedTopicKey: MARKOV,
      masteryOf: masteryStub(base),
      misconceptionTag: MISCONCEPTION.reversedConditional,
    });
    expect(out[0].topicKey).toBe(L1);
    expect(out[0].misconceptionLinked).toBe(true);
    expect(out[1].topicKey).toBe(EXPECTED_VALUE);
  });

  it("orders non-linked in-band prereqs by relevance (depth) then weakest mean", () => {
    // Two same-depth prereqs: the weaker one should come first.
    const out = suggestPrereqsToStrengthen({
      failedTopicKey: CONDITIONAL, // prereqs: L1 (depth1), COUNTING (depth1)
      masteryOf: masteryStub({
        [L1]: { mean: 0.9, n: 8 },
        [COUNTING]: { mean: 0.75, n: 8 },
      }),
    });
    expect(out.map((s) => s.topicKey)).toEqual([COUNTING, L1]);
  });

  it("returns nothing when no prereq has graded evidence in the band", () => {
    const out = suggestPrereqsToStrengthen({
      failedTopicKey: MARKOV,
      masteryOf: masteryStub({
        [EXPECTED_VALUE]: { mean: 0.4, n: 10 }, // too weak
        [CONDITIONAL]: { mean: 0.4, n: 10 },
      }),
    });
    expect(out).toEqual([]);
  });

  it("returns nothing for a floor topic with no prerequisites", () => {
    expect(
      suggestPrereqsToStrengthen({
        failedTopicKey: MENTAL,
        masteryOf: () => ({ mean: 0.85, n: 5 }),
      }),
    ).toEqual([]);
  });

  it("respects the max cap", () => {
    const out = suggestPrereqsToStrengthen({
      failedTopicKey: MARKOV,
      masteryOf: masteryStub({
        [EXPECTED_VALUE]: { mean: 0.85, n: 10 },
        [CONDITIONAL]: { mean: 0.84, n: 10 },
        [CONDITIONAL_EXPECTATION]: { mean: 0.83, n: 10 },
        [L1]: { mean: 0.82, n: 10 },
        [COUNTING]: { mean: 0.81, n: 10 },
      }),
      max: 2,
    });
    expect(out).toHaveLength(2);
  });
});
